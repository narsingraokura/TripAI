-- TripAI — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- All tables use uuid PKs, trip_id for multi-tenancy, and created_at/updated_at.

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  clerk_id    text unique,           -- set after Clerk auth is wired up
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- trips
-- ─────────────────────────────────────────────
create table if not exists trips (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_id      uuid not null references users(id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  budget_cap    numeric(10,2) not null,
  viewer_token  text unique default encode(gen_random_bytes(16), 'hex'),
  status        text not null default 'planning'
                  check (status in ('planning', 'active', 'completed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- trip_members
-- ─────────────────────────────────────────────
create table if not exists trip_members (
  trip_id     uuid not null references trips(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null default 'member'
                check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ─────────────────────────────────────────────
-- bookings
-- ─────────────────────────────────────────────
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references trips(id) on delete cascade,
  title           text not null,
  subtitle        text,
  category        text not null
                    check (category in ('flights', 'hotels', 'trains', 'activities', 'food', 'misc')),
  urgency         text not null
                    check (urgency in ('fire', 'now', 'soon')),
  status          text not null default 'pending'
                    check (status in ('pending', 'booked')),
  estimated_cost  numeric(10,2) not null,
  actual_cost     numeric(10,2),
  deadline        text,
  discount_code   text,
  card_tip        text,
  notes           text,
  booked_by       uuid references users(id) on delete set null,
  booked_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- itinerary_days
-- ─────────────────────────────────────────────
create table if not exists itinerary_days (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  date           date not null,
  city           text not null,
  country        text not null,
  title          text not null,
  plan           text not null,   -- embedded into RAG pipeline
  intensity      text not null
                   check (intensity in ('light', 'moderate', 'busy', 'travel', 'special')),
  is_special     boolean not null default false,
  special_label  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (trip_id, date)
);

-- ─────────────────────────────────────────────
-- updated_at auto-maintenance
-- ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger trips_updated_at
  before update on trips
  for each row execute function set_updated_at();

create trigger trip_members_updated_at
  before update on trip_members
  for each row execute function set_updated_at();

create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

create trigger itinerary_days_updated_at
  before update on itinerary_days
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
create index if not exists bookings_trip_id_idx        on bookings(trip_id);
create index if not exists bookings_urgency_idx        on bookings(trip_id, urgency);
create index if not exists itinerary_days_trip_id_idx  on itinerary_days(trip_id);
create index if not exists itinerary_days_date_idx     on itinerary_days(trip_id, date);

-- ─────────────────────────────────────────────
-- chat_logs (conversation logging for evals)
-- ─────────────────────────────────────────────
create table if not exists chat_logs (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  conversation_id  uuid not null,
  query            text not null,
  retrieved_chunks jsonb,
  response         text,
  latency_ms       integer,
  created_at       timestamptz not null default now()
);

create index if not exists chat_logs_trip_id_idx          on chat_logs(trip_id);
create index if not exists chat_logs_conversation_id_idx  on chat_logs(conversation_id);