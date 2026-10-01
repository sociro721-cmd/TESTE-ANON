-- =========================================================================
-- ANÔNQR - MIGRAÇÃO OFICIAL: FUNCIONALIDADE DE NICK ÚNICO DOS USUÁRIOS
-- =========================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- 
-- ESTA MIGRAÇÃO REALIZA:
-- 1. Cria ou atualiza a tabela public.profiles com suporte à coluna 'nick'.
-- 2. Garante unicidade CASE-INSENSITIVE para o Nick através de índice único em LOWER(nick).
-- 3. Valida tamanho (3 a 20 caracteres), caracteres (apenas letras, números e _), e impede espaços.
-- 4. Cria a RPC segura 'definir_nick_usuario' que valida auth.uid(), formato, tamanho e unicidade.
-- 5. Cria a RPC de busca pública 'buscar_usuarios_por_nick' que retorna nick e nome público,
--    NUNCA expondo e-mail, compras ou dados sensíveis.
-- 6. Configura Row Level Security (RLS) protegendo perfis.
-- 7. Cria trigger automático 'on_auth_user_created' para que novos cadastros em auth.users
--    criem instantaneamente o registro correspondente em public.profiles.
-- 8. Executa backfill seguro para garantir que todo usuário já existente em auth.users possua perfil.
-- =========================================================================

-- 1. GARANTIR A TABELA PROFILES E ADICIONAR COLUNA NICK
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    premium BOOLEAN NOT NULL DEFAULT false,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Adiciona a coluna nick caso ainda não exista
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nick TEXT;

-- 2. ÍNDICE DE UNICIDADE CASE-INSENSITIVE PARA O NICK
-- Garante que @Felipe123, felipe123 e FELIPE123 sejam estritamente tratados como o mesmo nick
DROP INDEX IF EXISTS idx_profiles_nick_unique_lower;
CREATE UNIQUE INDEX idx_profiles_nick_unique_lower 
ON public.profiles (LOWER(TRIM(nick))) 
WHERE nick IS NOT NULL AND TRIM(nick) <> '';

-- 3. CONSTRAINT DE VALIDAÇÃO DE FORMATO DO NICK (3-20 caracteres, a-z, A-Z, 0-9, _)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_nick_format;
ALTER TABLE public.profiles ADD CONSTRAINT check_nick_format
CHECK (
    nick IS NULL OR (
        length(TRIM(nick)) >= 3 
        AND length(TRIM(nick)) <= 20 
        AND TRIM(nick) ~ '^[a-zA-Z0-9_]{3,20}$'
    )
);

-- 4. RPC SEGURA PARA DEFINIÇÃO E ALTERAÇÃO DE NICK PELO PRÓPRIO USUÁRIO
CREATE OR REPLACE FUNCTION public.definir_nick_usuario(novo_nick TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_clean_nick TEXT;
    v_existing_id UUID;
    v_current_nick TEXT;
BEGIN
    -- 4.1 Identificação do usuário autenticado via auth.uid()
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- 4.2 Sanitização: remove @ inicial (se houver) e espaços nas extremidades
    v_clean_nick := regexp_replace(TRIM(novo_nick), '^@+', '');

    -- 4.3 Validação de tamanho (3 a 20 caracteres)
    IF length(v_clean_nick) < 3 OR length(v_clean_nick) > 20 THEN
        RAISE EXCEPTION 'O Nick deve possuir entre 3 e 20 caracteres.' USING ERRCODE = '22023';
    END IF;

    -- 4.4 Validação de formato (somente letras, números e _)
    IF NOT (v_clean_nick ~ '^[a-zA-Z0-9_]{3,20}$') THEN
        RAISE EXCEPTION 'Nick inválido. Permite apenas letras, números e underscore (_).' USING ERRCODE = '22023';
    END IF;

    -- 4.5 Validação de unicidade case-insensitive contra outros usuários
    SELECT id INTO v_existing_id
    FROM public.profiles
    WHERE LOWER(TRIM(nick)) = LOWER(v_clean_nick)
      AND id <> v_user_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'Este Nick já está em uso por outro usuário.' USING ERRCODE = '23505';
    END IF;

    -- 4.6 Persistência segura em public.profiles
    INSERT INTO public.profiles (id, nick, updated_at)
    VALUES (v_user_id, v_clean_nick, timezone('utc'::text, now()))
    ON CONFLICT (id) DO UPDATE
    SET nick = EXCLUDED.nick,
        updated_at = timezone('utc'::text, now());

    RETURN jsonb_build_object(
        'success', true,
        'nick', v_clean_nick,
        'message', 'Nick salvo com sucesso!'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.definir_nick_usuario(TEXT) TO authenticated, service_role;

-- 5. RPC DE PESQUISA PÚBLICA POR NICK (NÃO EXPÕE E-MAILS OU DADOS PRIVADOS)
CREATE OR REPLACE FUNCTION public.buscar_usuarios_por_nick(termo_busca TEXT)
RETURNS TABLE (
    id UUID,
    nick TEXT,
    name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_termo TEXT;
BEGIN
    -- Sanitização do termo de busca (remove @ inicial e espaços)
    v_clean_termo := regexp_replace(TRIM(termo_busca), '^@+', '');
    IF length(v_clean_termo) < 1 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT p.id, p.nick, p.name
    FROM public.profiles p
    WHERE p.nick IS NOT NULL
      AND (
          LOWER(p.nick) LIKE LOWER(v_clean_termo || '%')
          OR LOWER(p.nick) = LOWER(v_clean_termo)
          OR (p.name IS NOT NULL AND LOWER(p.name) LIKE LOWER('%' || v_clean_termo || '%'))
      )
    ORDER BY
        CASE 
            WHEN LOWER(p.nick) = LOWER(v_clean_termo) THEN 1
            WHEN LOWER(p.nick) LIKE LOWER(v_clean_termo || '%') THEN 2
            ELSE 3
        END,
        p.nick ASC
    LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_usuarios_por_nick(TEXT) TO anon, authenticated, service_role;

-- 6. POLÍTICAS ROW LEVEL SECURITY (RLS) NA TABELA PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis são legíveis por todos" ON public.profiles;
CREATE POLICY "Perfis são legíveis por todos"
    ON public.profiles
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Usuário atualiza o próprio perfil" ON public.profiles;
CREATE POLICY "Usuário atualiza o próprio perfil"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Usuário insere o próprio perfil" ON public.profiles;
CREATE POLICY "Usuário insere o próprio perfil"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role gerencia perfis" ON public.profiles;
CREATE POLICY "Service role gerencia perfis"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 7. TRIGGER AUTOMÁTICO PARA CRIAÇÃO DE PERFIL DE NOVOS USUÁRIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, plan, premium, credits, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'free',
        false,
        0,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(profiles.name, EXCLUDED.name),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. BACKFILL SEGURO PARA USUÁRIOS EXISTENTES
INSERT INTO public.profiles (id, name, email, plan, premium, credits)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email,
    'free',
    false,
    0
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
