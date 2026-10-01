-- =========================================================================
-- MIGRAÇÃO SUPABASE: CICLO DE VIDA E PERSISTÊNCIA DE PRAZO DAS SALAS
-- =========================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Esta migração é totalmente NÃO-DESTRUTIVA (IF NOT EXISTS) e preserva
-- 100% dos dados e histórico de compras existentes.
-- =========================================================================

-- 1. Adicionar colunas de ciclo de vida e controle temporal à tabela 'compras'
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 2. Índices para consultas eficientes e seguras
CREATE INDEX IF NOT EXISTS idx_compras_expires_at ON public.compras(expires_at);
CREATE INDEX IF NOT EXISTS idx_compras_activated_at ON public.compras(activated_at);
CREATE INDEX IF NOT EXISTS idx_compras_status ON public.compras(status);
CREATE INDEX IF NOT EXISTS idx_compras_user_status ON public.compras(user_id, status);

-- 3. Comentários explicativos para documentação no Supabase
COMMENT ON COLUMN public.compras.duration_minutes IS 'Duração contratada em minutos (30, 60, 120, 240, 720, 1440, ou 0 para permanente)';
COMMENT ON COLUMN public.compras.is_permanent IS 'Indica se a sala é permanente (sem expiração de tempo)';
COMMENT ON COLUMN public.compras.activated_at IS 'Data/hora exata em que o comprador entrou na sala pela primeira vez (início do prazo)';
COMMENT ON COLUMN public.compras.expires_at IS 'Data/hora exata em que o acesso expira (activated_at + duration_minutes)';
