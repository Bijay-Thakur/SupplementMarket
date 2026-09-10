-- Persist CSV review state so previews survive API restarts and multiple workers.
alter table public.catalog_import_batches
  add column if not exists preview_metadata jsonb not null default '{}'::jsonb;

alter table public.catalog_import_rows
  drop constraint if exists catalog_import_rows_detected_action_check;

alter table public.catalog_import_rows
  add constraint catalog_import_rows_detected_action_check
  check (detected_action in ('insert', 'conflict', 'update', 'unchanged', 'skip', 'error'));

create unique index if not exists catalog_import_rows_batch_row_unique
  on public.catalog_import_rows (batch_id, source_row_number);
