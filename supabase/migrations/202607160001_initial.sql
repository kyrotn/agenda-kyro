create table if not exists public.flows (
  id text primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "ownerEmail" text not null default '',
  name text not null,
  color text not null default '#2a9d8f',
  position integer not null default 0,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.contacts (
  id text primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "ownerEmail" text not null default '',
  name text not null,
  phone text not null,
  city text not null default '',
  niche text not null default '',
  "flowId" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "ownerEmail" text not null default '',
  title text not null,
  "contactId" text,
  "flowId" text not null,
  priority text not null default 'Media',
  "dueDate" text not null default '',
  "dueTime" text not null default '',
  status text not null default 'Aberta',
  notes text not null default '',
  "calendarEventId" text not null default '',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.settings (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  "ownerEmail" text not null default '',
  "googleClientId" text not null default '',
  "sheetId" text not null default '',
  "updatedAt" timestamptz not null default now()
);

create index if not exists flows_user_id_idx on public.flows ("userId", position);
create index if not exists contacts_user_id_idx on public.contacts ("userId", "createdAt" desc);
create index if not exists tasks_user_id_idx on public.tasks ("userId", "dueDate", "dueTime");

alter table public.flows enable row level security;
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.settings enable row level security;

drop policy if exists "Own flows" on public.flows;
create policy "Own flows" on public.flows for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "Own contacts" on public.contacts;
create policy "Own contacts" on public.contacts for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "Own tasks" on public.tasks;
create policy "Own tasks" on public.tasks for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "Own settings" on public.settings;
create policy "Own settings" on public.settings for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
