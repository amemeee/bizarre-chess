-- Run this in the Supabase SQL editor.
-- Also enable: Authentication > Providers > Email, and "Allow anonymous sign-ins" (for guest play).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  character_id text not null,
  result text not null check (result in ('win','loss','draw')),
  moves int not null default 0,
  ultimates_faced int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists games_user_idx on public.games (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.games enable row level security;

create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create policy "own games read"   on public.games for select using (auth.uid() = user_id);
create policy "own games insert" on public.games for insert with check (auth.uid() = user_id);

-- Create a profile row automatically for every new user
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Guest ' || substr(new.id::text, 1, 4)))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
