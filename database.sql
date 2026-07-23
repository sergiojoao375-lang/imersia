-- Imersia: schema inicial para o simulador de conversas difíceis
-- Executa este script no SQL Editor do painel Supabase

-- Extensão para geração de UUIDs (já activa por defeito no Supabase)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabela: arquetipos
-- Personagens base das simulações (ex.: chefe narcisista, colega conflituoso)
-- ---------------------------------------------------------------------------
create table if not exists public.arquetipos (
  id uuid primary key default gen_random_uuid(),
  nome_masculino text not null,
  nome_feminino text not null,
  perfil_comportamental text not null,
  dificuldade text not null check (dificuldade in ('facil', 'medio', 'dificil')),
  contexto_base text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabela: simulacoes
-- Sessões de simulação por utilizador
-- ---------------------------------------------------------------------------
create table if not exists public.simulacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  arquetipo_id uuid not null references public.arquetipos (id) on delete restrict,
  genero_escolhido text not null check (genero_escolhido in ('masculino', 'feminino')),
  nivel_tensao_final numeric(5, 2) check (nivel_tensao_final >= 0 and nivel_tensao_final <= 100),
  status_resultado text not null default 'em_andamento'
    check (status_resultado in ('em_andamento', 'sucesso', 'falha', 'abandonada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabela: historico_dialogos
-- Mensagens e sinais biométricos de voz capturados durante a simulação
-- ---------------------------------------------------------------------------
create table if not exists public.historico_dialogos (
  id uuid primary key default gen_random_uuid(),
  simulacao_id uuid not null references public.simulacoes (id) on delete cascade,
  remetente text not null check (remetente in ('utilizador', 'arquetipo')),
  conteudo_texto text not null,
  bio_pitch_oscilacao numeric(6, 3),
  bio_velocidade_fala numeric(6, 3),
  bio_hesitacoes_detected integer not null default 0 check (bio_hesitacoes_detected >= 0),
  created_at timestamptz not null default now()
);

-- Índices para consultas frequentes em redes lentas (menos dados transferidos)
create index if not exists idx_simulacoes_user_id on public.simulacoes (user_id);
create index if not exists idx_simulacoes_arquetipo_id on public.simulacoes (arquetipo_id);
create index if not exists idx_historico_dialogos_simulacao_id on public.historico_dialogos (simulacao_id);

-- ---------------------------------------------------------------------------
-- Dados iniciais de exemplo
-- ---------------------------------------------------------------------------
insert into public.arquetipos (
  nome_masculino,
  nome_feminino,
  perfil_comportamental,
  dificuldade,
  contexto_base
)
values (
  'Dr. Carlos',
  'Dra. Helena',
  'Chefe Narcisista',
  'dificil',
  'Reunião one-on-one no escritório. O chefe exige resultados imediatos, desvaloriza o teu trabalho em público e usa culpa emocional para te manter sob controlo. O objectivo é pedir um aumento ou renegociar prazos sem perder a calma.'
);
