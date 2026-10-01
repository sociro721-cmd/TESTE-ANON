-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA V3: PERSISTÊNCIA ATÔMICA DO CICLO DE VIDA DE COMPRAS
-- ==============================================================================

-- 1. Garante colunas de ciclo de vida na tabela compras
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE;

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_compras_user_sala_status
  ON public.compras (user_id, sala_id, status);

CREATE INDEX IF NOT EXISTS idx_compras_expires_at
  ON public.compras (expires_at)
  WHERE expires_at IS NOT NULL;

-- 3. Função RPC de ATIVAÇÃO ATÔMICA E IDEMPOTENTE
DROP FUNCTION IF EXISTS public.ativar_ciclo_compra(UUID, TEXT);
DROP FUNCTION IF EXISTS public.ativar_ciclo_compra(UUID, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.ativar_ciclo_compra(UUID, TEXT, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.ativar_ciclo_compra(
  p_compra_id UUID,
  p_sala_id TEXT,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_is_permanent BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_service_role BOOLEAN;
  v_compra RECORD;
  v_is_perm BOOLEAN := FALSE;
  v_duration INTEGER := NULL;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_expires TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  v_is_service_role := (COALESCE(auth.role(), '') = 'service_role');

  -- Bloqueio exclusivo de linha (previne corrida simultânea de duas abas)
  SELECT * INTO v_compra
  FROM public.compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPRA_NAO_ENCONTRADA: Compra % não existe.', p_compra_id;
  END IF;

  -- 1. AUTORIZAÇÃO: apenas o dono ou service_role
  IF NOT v_is_service_role AND (v_caller_id IS NULL OR v_compra.user_id != v_caller_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: A compra não pertence ao usuário autenticado.';
  END IF;

  -- 2. VALIDAÇÃO DA SALA
  IF v_compra.sala_id IS DISTINCT FROM p_sala_id THEN
    RAISE EXCEPTION 'DIVERGENCIA_SALA: O ciclo solicitado não corresponde à sala da compra.';
  END IF;

  -- 3. VALIDAÇÃO DO ESTADO FINANCEIRO (Apenas pagas ou aprovadas)
  IF v_compra.status NOT IN ('paid', 'approved') THEN
    RAISE EXCEPTION 'STATUS_INVALIDO: Compra com status "%" não está apta para ativação.', v_compra.status;
  END IF;

  -- 4. RESOLUÇÃO DE TIPO E DURAÇÃO (Prioridades estritas):
  -- 1. Se a compra já possui duration_minutes válido (> 0), usar esse valor.
  IF v_compra.duration_minutes IS NOT NULL AND v_compra.duration_minutes > 0 THEN
    v_duration := v_compra.duration_minutes;
    v_is_perm := FALSE;
  -- 2. Se a compra for permanente, respeitar is_permanent = true e NÃO criar expires_at.
  ELSIF v_compra.is_permanent IS TRUE OR (p_is_permanent IS TRUE) THEN
    v_is_perm := TRUE;
    v_duration := 0;
  -- 3. Se duration_minutes da compra estiver NULL ou inválido, usar p_duration_minutes fornecido pelo backend.
  ELSIF p_duration_minutes IS NOT NULL AND p_duration_minutes > 0 THEN
    v_duration := p_duration_minutes;
    v_is_perm := FALSE;
  -- 4. Se ainda assim não houver duração válida para uma compra temporária, retornar DURACAO_INDETERMINADA.
  ELSE
    RAISE EXCEPTION 'DURACAO_INDETERMINADA: Impossível ativar compra % sem duração configurada.', p_compra_id;
  END IF;

  -- 5. COMPRA PERMANENTE (Sem expiração e sem contagem de tempo)
  IF v_is_perm IS TRUE THEN
    -- Primeiro acesso da compra permanente: registrar activated_at
    IF v_compra.activated_at IS NULL THEN
      UPDATE public.compras
      SET
        activated_at = v_now,
        expires_at = NULL,
        duration_minutes = 0,
        is_permanent = TRUE,
        updated_at = v_now
      WHERE id = v_compra.id;

      RETURN jsonb_build_object(
        'success', true,
        'compra_id', v_compra.id,
        'is_permanent', true,
        'activated_at', v_now,
        'expires_at', null,
        'duration_minutes', 0,
        'already_active', false,
        'status', v_compra.status
      );
    END IF;

    -- Acessos posteriores da compra permanente: reutilizam a ativação existente
    RETURN jsonb_build_object(
      'success', true,
      'compra_id', v_compra.id,
      'is_permanent', true,
      'activated_at', v_compra.activated_at,
      'expires_at', null,
      'duration_minutes', 0,
      'already_active', true,
      'status', v_compra.status
    );
  END IF;

  -- 6. VERIFICAÇÃO DE EXPIRAÇÃO PRÉVIA (NUNCA REATIVAR)
  IF v_compra.expires_at IS NOT NULL AND v_compra.expires_at <= v_now THEN
    IF v_compra.status != 'expired' THEN
      UPDATE public.compras
      SET status = 'expired', updated_at = v_now
      WHERE id = v_compra.id;
    END IF;
    RAISE EXCEPTION 'COMPRA_EXPIRADA: Este ciclo expirou em % e não pode ser reativado.', v_compra.expires_at;
  END IF;

  -- 7. IDEMPOTÊNCIA (Segunda aba ou reentrada dentro do prazo)
  -- Devolve os mesmos timestamps gravados pela primeira chamada, sem alteração
  IF v_compra.activated_at IS NOT NULL AND v_compra.expires_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'compra_id', v_compra.id,
      'is_permanent', false,
      'activated_at', v_compra.activated_at,
      'expires_at', v_compra.expires_at,
      'duration_minutes', COALESCE(v_compra.duration_minutes, v_duration),
      'remaining_seconds', GREATEST(0, EXTRACT(EPOCH FROM (v_compra.expires_at - v_now))::INTEGER),
      'already_active', true,
      'status', v_compra.status
    );
  END IF;

  -- 8. PRIMEIRA ATIVAÇÃO ATÔMICA DA COMPRA TEMPORÁRIA
  -- Preserva rigorosamente o status financeiro original (NÃO sobrescreve para 'paid')
  v_expires := v_now + (v_duration || ' minutes')::interval;

  UPDATE public.compras
  SET
    activated_at = v_now,
    expires_at = v_expires,
    duration_minutes = v_duration,
    is_permanent = FALSE,
    updated_at = v_now
  WHERE id = v_compra.id
    AND activated_at IS NULL
    AND expires_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'compra_id', v_compra.id,
    'is_permanent', false,
    'activated_at', v_now,
    'expires_at', v_expires,
    'duration_minutes', v_duration,
    'remaining_seconds', (v_duration * 60),
    'already_active', false,
    'status', v_compra.status
  );
END;
$$;

-- 4. Função RPC de EXPIRAÇÃO CONTROLADA E IDEMPOTENTE
CREATE OR REPLACE FUNCTION public.expirar_ciclo_compra(
  p_compra_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_service_role BOOLEAN;
  v_compra RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  v_caller_id := auth.uid();
  v_is_service_role := (COALESCE(auth.role(), '') = 'service_role');

  SELECT * INTO v_compra
  FROM public.compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPRA_NAO_ENCONTRADA: Compra % não existe.', p_compra_id;
  END IF;

  -- AUTORIZAÇÃO: apenas service_role ou o próprio dono da compra
  IF NOT v_is_service_role AND (v_caller_id IS NULL OR v_compra.user_id != v_caller_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: Apenas o proprietário ou o backend pode expirar esta compra.';
  END IF;

  -- Permanente ou ainda não iniciada: não expira
  IF v_compra.is_permanent IS TRUE OR v_compra.expires_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'NAO_EXPIRAVEL'
    );
  END IF;

  -- Só expira se a data limite foi efetivamente ultrapassada
  IF v_compra.expires_at <= v_now THEN
    IF v_compra.status != 'expired' THEN
      UPDATE public.compras
      SET status = 'expired', updated_at = v_now
      WHERE id = p_compra_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'compra_id', p_compra_id,
      'status', 'expired'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'reason', 'TEMPO_RESTANTE',
    'remaining_seconds', EXTRACT(EPOCH FROM (v_compra.expires_at - v_now))::INTEGER
  );
END;
$$;

-- 5. CONCESSÃO EXPLÍCITA E RESTRITA DE PERMISSÕES
REVOKE ALL ON FUNCTION public.ativar_ciclo_compra(UUID, TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ativar_ciclo_compra(UUID, TEXT, INTEGER, BOOLEAN) FROM anon;

REVOKE ALL ON FUNCTION public.expirar_ciclo_compra(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expirar_ciclo_compra(UUID) FROM anon;

-- Permissões explicitadas para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.ativar_ciclo_compra(UUID, TEXT, INTEGER, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expirar_ciclo_compra(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. FUNÇÃO: public.aprovar_compra_admin
-- Descrição:
--   Permite que o backend (com segredo do proprietário ou service_role)
--   aprove uma compra manual via PIX (pending -> paid) sem iniciar o timer.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aprovar_compra_admin(
    p_compra_id UUID,
    p_admin_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_compra RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_valid_secret CONSTANT TEXT := '8090';
BEGIN
    -- 1. Validação da credencial administrativa do proprietário
    IF (p_admin_secret IS NULL OR (p_admin_secret != v_valid_secret AND p_admin_secret != COALESCE(current_setting('app.settings.owner_secret_key', true), '8090'))) 
       AND COALESCE(auth.role(), '') != 'service_role' THEN
        RAISE EXCEPTION 'ACESSO_NEGADO: Chave administrativa incorreta.';
    END IF;

    -- 2. Busca do registro da compra
    SELECT * INTO v_compra
    FROM public.compras
    WHERE id = p_compra_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'COMPRA_NAO_ENCONTRADA: Compra com ID % não encontrada.', p_compra_id;
    END IF;

    -- 3. Idempotência se já aprovada
    IF v_compra.status = 'paid' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'A compra já estava aprovada.',
            'id', v_compra.id,
            'status', v_compra.status,
            'user_id', v_compra.user_id,
            'sala_id', v_compra.sala_id,
            'updated_at', v_compra.updated_at
        );
    END IF;

    -- 4. Atualização estrita de status para 'paid' (SEM iniciar activated_at ou expires_at)
    UPDATE public.compras
    SET status = 'paid',
        updated_at = v_now
    WHERE id = p_compra_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Compra aprovada com sucesso.',
        'id', p_compra_id,
        'status', 'paid',
        'user_id', v_compra.user_id,
        'sala_id', v_compra.sala_id,
        'updated_at', v_now
    );
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_compra_admin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aprovar_compra_admin(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.aprovar_compra_admin(UUID, TEXT) TO authenticated, service_role;

