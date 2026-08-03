-- ============================================================
-- FarmaGest — Políticas RLS sugeridas
-- Baseado no que supabase-sync.js realmente faz.
-- Corre isto no SQL Editor do Supabase (Settings → SQL Editor).
-- ============================================================

-- 1) Garantir que RLS está ativo nas duas tabelas
alter table public.farmacias enable row level security;
alter table public.farmacias_backups enable row level security;

-- ------------------------------------------------------------
-- TABELA: farmacias
-- Usada por: cloudSalvar (upsert), cloudCarregar (select),
--            cloudEscutar (realtime select)
-- Nunca é apagada pelo código -> sem policy de DELETE.
-- ------------------------------------------------------------

drop policy if exists "farmacias_select_alvirosil" on public.farmacias;
create policy "farmacias_select_alvirosil"
  on public.farmacias for select
  using (id = 'alvirosil');

drop policy if exists "farmacias_insert_alvirosil" on public.farmacias;
create policy "farmacias_insert_alvirosil"
  on public.farmacias for insert
  with check (id = 'alvirosil');

drop policy if exists "farmacias_update_alvirosil" on public.farmacias;
create policy "farmacias_update_alvirosil"
  on public.farmacias for update
  using (id = 'alvirosil')
  with check (id = 'alvirosil');

-- ------------------------------------------------------------
-- TABELA: farmacias_backups
-- Usada por: fazerBackupNuvem (insert + delete de antigas),
--            listarBackupsNuvem (select), restaurarBackupNuvem (select por id)
-- IMPORTANTE: só deixar apagar cópias automáticas (manual = false).
-- As cópias manuais nunca devem poder ser apagadas pelo anon key.
-- ------------------------------------------------------------

drop policy if exists "backups_select_alvirosil" on public.farmacias_backups;
create policy "backups_select_alvirosil"
  on public.farmacias_backups for select
  using (farmacia_id = 'alvirosil');

drop policy if exists "backups_insert_alvirosil" on public.farmacias_backups;
create policy "backups_insert_alvirosil"
  on public.farmacias_backups for insert
  with check (farmacia_id = 'alvirosil');

drop policy if exists "backups_delete_auto_alvirosil" on public.farmacias_backups;
create policy "backups_delete_auto_alvirosil"
  on public.farmacias_backups for delete
  using (farmacia_id = 'alvirosil' and manual = false);

-- Sem policy de UPDATE: o código nunca faz update a backups (cada cópia
-- é imutável, o que aliás é o comportamento correto para um backup).

-- ------------------------------------------------------------
-- Nota sobre restaurarBackupNuvem():
-- O select é feito por "id" (chave primária do backup), sem filtrar
-- por farmacia_id. Com a policy de select acima (que exige
-- farmacia_id = 'alvirosil'), continua seguro — só devolve a linha se
-- também pertencer a essa farmácia — mas vale a pena confirmar que
-- "id" é mesmo a PK e não um valor adivinhável/sequencial exposto
-- publicamente sem necessidade.
-- ------------------------------------------------------------
