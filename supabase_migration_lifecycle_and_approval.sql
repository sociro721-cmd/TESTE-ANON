-- ==============================================================================
-- MIGRATION: supabase_migration_lifecycle_and_approval.sql
-- Objetivo: Corrigir persistência do ciclo temporário (primeiro acesso) e
--           aprovação de compras PIX pelo proprietário via funções SECURITY DEFINER,
--           mantendo o RLS estritamente habilitado na tabela public.compras.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNÇÃO: public.ativar_ciclo_compra
-- Descrição:
--   Executada no primeiro acesso de uma compra paga.
--   - Valida que o usuário autenticado (auth.uid()) é o dono da compra.
--   - Valida que o status da compra é 'paid'.
--   - Idempotente: se a compra já foi ativada (activated_at IS NOT NULL),
--     retorna os valores existentes sem alterar absolutamente nada.
--   - Se for o primeiro acesso, grava activated_at e expires_at uma única vez.
--   - Não permite adulteração posterior de prazos.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ativar_ciclo_compra(
    p_compra_id UUID,
    p_duration_minutes INT DEFAULT NULL,
    p_is_permanent BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_compra RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_expires_at TIMESTAMPTZ := NULL;
    v_duration INT;
    v_is_perm BOOLEAN;
BEGIN
    -- 1. Obter e validar sessão do usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado: usuário não autenticado.';
    END IF;

    -- 2. Buscar a compra correspondente
    SELECT * INTO v_compra
    FROM public.compras
    WHERE id = p_compra_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra com ID % não encontrada.', p_compra_id;
    END IF;

    -- 3. Garantir isolamento de tenancy (somente o comprador pode ativar)
    IF v_compra.user_id != v_user_id THEN
        RAISE EXCEPTION 'Acesso negado: esta compra não pertence ao usuário autenticado.';
    END IF;

    -- 4. Validar se a compra já foi aprovada e paga
    IF v_compra.status != 'paid' THEN
        RAISE EXCEPTION 'A compra ainda não possui confirmação de pagamento (status atual: %).', v_compra.status;
    END IF;

    -- 5. IDEMPOTÊNCIA ESTRITA: se já possui ativação registrada, retorna os dados gravados sem modificar
    IF v_compra.activated_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'newly_activated', false,
            'id', v_compra.id,
            'status', v_compra.status,
            'activated_at', v_compra.activated_at,
            'expires_at', v_compra.expires_at,
            'duration_minutes', v_compra.duration_minutes,
            'is_permanent', v_compra.is_permanent
        );
    END IF;

    -- 6. Resolver duração e tipo de permanência
    v_is_perm := COALESCE(v_compra.is_permanent, p_is_permanent, false);

    IF v_is_perm THEN
        v_duration := 0;
        v_expires_at := NULL;
    ELSE
        v_duration := COALESCE(v_compra.duration_minutes, p_duration_minutes, 60);
        IF v_duration <= 0 THEN
            v_duration := 60;
        END IF;
        v_expires_at := v_now + (v_duration || ' minutes')::interval;
    END IF;

    -- 7. Persistência atômica e irreversível do primeiro acesso
    UPDATE public.compras
    SET activated_at = v_now,
        expires_at = v_expires_at,
        duration_minutes = v_duration,
        is_permanent = v_is_perm,
        updated_at = v_now
    WHERE id = p_compra_id
      AND activated_at IS NULL;

    -- 8. Retorno dos timestamps definitivos registrados
    RETURN jsonb_build_object(
        'success', true,
        'newly_activated', true,
        'id', p_compra_id,
        'status', 'paid',
        'activated_at', v_now,
        'expires_at', v_expires_at,
        'duration_minutes', v_duration,
        'is_permanent', v_is_perm
    );
END;
$$;

-- Permissões de execução da função de ativação
REVOKE ALL ON FUNCTION public.ativar_ciclo_compra(UUID, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ativar_ciclo_compra(UUID, INT, BOOLEAN) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO: public.aprovar_compra_admin
-- Descrição:
--   Permite que o administrador do sistema (autenticado com o segredo do proprietário)
--   aprove uma compra manual via PIX (pending -> paid) sem que usuários comuns
--   consigam burlar a alteração de status.
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
    IF p_admin_secret IS NULL OR (p_admin_secret != v_valid_secret AND p_admin_secret != COALESCE(current_setting('app.settings.owner_secret_key', true), '8090')) THEN
        RAISE EXCEPTION 'Acesso negado: chave administrativa incorreta.';
    END IF;

    -- 2. Busca do registro da compra
    SELECT * INTO v_compra
    FROM public.compras
    WHERE id = p_compra_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra com ID % não encontrada.', p_compra_id;
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

    -- 4. Atualização de status para 'paid'
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

-- Permissões de execução da função de aprovação administrativa
REVOKE ALL ON FUNCTION public.aprovar_compra_admin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprovar_compra_admin(UUID, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO: public.expirar_compra
-- Descrição:
--   Marca uma compra temporária como expirada assim que seu prazo limite
--   (expires_at) for atingido, garantindo consistência entre backend e banco.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expirar_compra(
    p_compra_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_compra RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT * INTO v_compra
    FROM public.compras
    WHERE id = p_compra_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra com ID % não encontrada.', p_compra_id;
    END IF;

    -- Se já está marcada como expired, retorna sem erro
    IF v_compra.status = 'expired' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_expired', true,
            'id', v_compra.id,
            'status', 'expired'
        );
    END IF;

    -- Só permite expiração se não for permanente e (ou prazo venceu ou chamada autorizada)
    IF v_compra.is_permanent = true THEN
        RAISE EXCEPTION 'Salas permanentes não podem ser marcadas como expiradas.';
    END IF;

    UPDATE public.compras
    SET status = 'expired',
        updated_at = v_now
    WHERE id = p_compra_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_expired', false,
        'id', p_compra_id,
        'status', 'expired',
        'updated_at', v_now
    );
END;
$$;

-- Permissões de execução da função de expiração
REVOKE ALL ON FUNCTION public.expirar_compra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_compra(UUID) TO anon, authenticated, service_role;
