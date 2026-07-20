create table if not exists public.parcels (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.parcels enable row level security;
drop policy if exists "own parcels" on public.parcels;
create policy "own parcels" on public.parcels
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table public.parcels;
exception when duplicate_object then null; end $$;
