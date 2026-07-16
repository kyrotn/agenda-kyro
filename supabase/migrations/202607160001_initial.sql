create table if not exists public.kyro_flows (
  id text primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "ownerEmail" text not null default '',
  name text not null,
  color text not null default '#2a9d8f',
  position integer not null default 0,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.kyro_contacts (
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

create table if not exists public.kyro_tasks (
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

create table if not exists public.kyro_settings (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  "ownerEmail" text not null default '',
  "googleClientId" text not null default '',
  "sheetId" text not null default '',
  "updatedAt" timestamptz not null default now()
);

create index if not exists kyro_flows_user_id_idx on public.kyro_flows ("userId", position);
create index if not exists kyro_contacts_user_id_idx on public.kyro_contacts ("userId", "createdAt" desc);
create index if not exists kyro_tasks_user_id_idx on public.kyro_tasks ("userId", "dueDate", "dueTime");

alter table public.kyro_flows enable row level security;
alter table public.kyro_contacts enable row level security;
alter table public.kyro_tasks enable row level security;
alter table public.kyro_settings enable row level security;

drop policy if exists "Own Kyro flows" on public.kyro_flows;
create policy "Own Kyro flows" on public.kyro_flows for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "Own Kyro contacts" on public.kyro_contacts;
create policy "Own Kyro contacts" on public.kyro_contacts for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "Own Kyro tasks" on public.kyro_tasks;
create policy "Own Kyro tasks" on public.kyro_tasks for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "Own Kyro settings" on public.kyro_settings;
create policy "Own Kyro settings" on public.kyro_settings for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
