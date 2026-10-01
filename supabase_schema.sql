-- =========================================================================
-- ESQUEMA DO SUPABASE: PLATAFORMA DE VENDA INDIVIDUAL DE SALAS
-- =========================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Este script:
-- 1. Cria APENAS as tabelas 'salas' e 'compras' (sem tocar em profiles ou payments).
-- 2. Não insere dados de teste / salas fictícias.
-- 3. Configura Row Level Security (RLS) rigoroso contra adulterações.
-- 4. Impede que salas fiquem presas em 'pending' indefinidamente através de:
--    - Campo expires_at na compra (tempo limite de pagamento).
--    - Função de liberação automática de salas expiradas.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. TABELA DE SALAS (PRODUTOS INDIVIDUAIS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT DEFAULT 'Privada',
    valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'sold')),
    comprador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cor TEXT DEFAULT '#10b981',
    icone TEXT DEFAULT 'Lock',
    max_participantes INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para busca rápida e catálogo
CREATE INDEX IF NOT EXISTS idx_salas_status ON public.salas(status);
CREATE INDEX IF NOT EXISTS idx_salas_comprador_id ON public.salas(comprador_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

-- Regra RLS: Qualquer pessoa (mesmo visitante sem login) pode consultar o catálogo de salas
DROP POLICY IF EXISTS "Permitir leitura pública de salas" ON public.salas;
CREATE POLICY "Permitir leitura pública de salas"
    ON public.salas
    FOR SELECT
    USING (true);

-- Regra RLS: Usuários comuns NÃO podem alterar valor, status ou comprador da sala.
-- Apenas service_role (Edge Function / Webhook / Backend) tem permissão de INSERT, UPDATE e DELETE.
DROP POLICY IF EXISTS "Apenas service_role gerencia salas" ON public.salas;
CREATE POLICY "Apenas service_role gerencia salas"
    ON public.salas
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- -------------------------------------------------------------------------
-- 2. TABELA DE COMPRAS / PEDIDOS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sala_id TEXT NOT NULL REFERENCES public.salas(id) ON DELETE RESTRICT,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'rejected', 'expired')),
    payment_id TEXT,
    metodo_pagamento TEXT,
    duration_minutes INTEGER,
    is_permanent BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de consulta de pedidos e integridade
CREATE INDEX IF NOT EXISTS idx_compras_user_id ON public.compras(user_id);
CREATE INDEX IF NOT EXISTS idx_compras_sala_id ON public.compras(sala_id);
CREATE INDEX IF NOT EXISTS idx_compras_status ON public.compras(status);
CREATE INDEX IF NOT EXISTS idx_compras_expires_at ON public.compras(expires_at);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- Regra RLS: Usuário autenticado só pode visualizar suas próprias compras
DROP POLICY IF EXISTS "Usuários consultam apenas suas próprias compras" ON public.compras;
CREATE POLICY "Usuários consultam apenas suas próprias compras"
    ON public.compras
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Regra RLS: Usuário autenticado só pode registrar ordem inicial com status 'pending'
-- O valor é validado diretamente com o valor oficial cadastrado na tabela 'salas'
-- e a sala precisa estar com status 'available' (ou seja, não pode comprar sala já vendida)
DROP POLICY IF EXISTS "Usuário autenticado registra intenção de compra pendente" ON public.compras;
CREATE POLICY "Usuário autenticado registra intenção de compra pendente"
    ON public.compras
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.salas s
            WHERE s.id = sala_id
              AND s.status = 'available'
              AND s.valor = valor
        )
    );

-- Regra RLS: O cliente não pode alterar compras para 'paid' ou 'cancelled' diretamente no banco.
-- Atualizações de status e payment_id são restritas exclusivamente ao service_role (Webhook do Mercado Pago)
DROP POLICY IF EXISTS "Apenas service_role atualiza pedidos" ON public.compras;
CREATE POLICY "Apenas service_role atualiza pedidos"
    ON public.compras
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);


-- -------------------------------------------------------------------------
-- 3. PREVENÇÃO DE SALAS PRESAS EM 'PENDING'
-- -------------------------------------------------------------------------
-- Função que libera automaticamente qualquer sala cujo pedido pendente tenha expirado
CREATE OR REPLACE FUNCTION public.liberar_pedidos_expirados()
RETURNS INTEGER AS $$
DECLARE
    pedidos_expirados_count INTEGER;
BEGIN
    -- 1. Marca compras pendentes que ultrapassaram o tempo limite (expires_at) como 'expired'
    WITH compras_expiradas AS (
        UPDATE public.compras
        SET status = 'expired',
            updated_at = timezone('utc'::text, now())
        WHERE status = 'pending'
          AND expires_at < timezone('utc'::text, now())
        RETURNING sala_id
    )
    -- 2. Devolve o status da sala para 'available' se ela ainda não tiver sido vendida
    UPDATE public.salas s
    SET status = 'available',
        updated_at = timezone('utc'::text, now())
    FROM compras_expiradas ce
    WHERE s.id = ce.sala_id
      AND s.status = 'pending';

    GET DIAGNOSTICS pedidos_expirados_count = ROW_COUNT;
    RETURN pedidos_expirados_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
