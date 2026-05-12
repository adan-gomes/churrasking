create table public.events (
    id          uuid primary key default gen_random_uuid(),
    host_id     uuid not null references public.profiles(id) on delete cascade,
    title       text not null,
    description text,
    date        timestamptz not null,
    location    text,
    slug        text not null unique,
    cover_url   text,
    created_at  timestamptz not null default now()
);

-- Lookup events by host (dashboard)
create index events_host_id_idx on public.events(host_id);
-- Lookup events by slug (public page)
create index events_slug_idx on public.events(slug);
-- Order events by date (dashboard listing)
create index events_date_idx on public.events(date desc);

alter table public.events enable row level security;

-- OWASP A01: sensitive host data is not exposed via select columns in the app layer
create policy "events: public read"
    on public.events
    for select
    using (true);

create policy "events: host insert"
    on public.events
    for insert
    with check (auth.uid() = host_id);

create policy "events: host update"
    on public.events
    for update
    using (auth.uid() = host_id)
    with check (auth.uid() = host_id);

create policy "events: host delete"
    on public.events
    for delete
    using (auth.uid() = host_id);