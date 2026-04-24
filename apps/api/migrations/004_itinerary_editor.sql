-- Migration 004: Itinerary editor scaffold
-- Adds goal-based planning tables and activity tracking.
--
-- NOTE: itinerary_days already exists with the legacy Phase 1 schema
-- (date, city, country, title, plan, intensity, is_special, special_label).
-- IF NOT EXISTS preserves the existing table unchanged.
-- Schema reconciliation to the Phase 2 shape (position, day_type, notes)
-- is a separate migration story.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- trip_goals
-- ─────────────────────────────────────────────
create table if not exists trip_goals (
    id          uuid primary key default gen_random_uuid(),
    trip_id     uuid not null references trips(id) on delete cascade,
    goal_type   text not null check (goal_type in ('preset', 'custom')),
    label       text not null,
    created_at  timestamptz not null default now(),
    unique (trip_id, label)
);

create index if not exists trip_goals_trip_id_idx on trip_goals(trip_id);

-- ─────────────────────────────────────────────
-- trip_constraints
-- ─────────────────────────────────────────────
create table if not exists trip_constraints (
    id               uuid primary key default gen_random_uuid(),
    trip_id          uuid not null references trips(id) on delete cascade,
    constraint_type  text not null check (constraint_type in (
                         'must_visit', 'must_avoid', 'budget_cap',
                         'time_constraint', 'custom')),
    description      text not null,
    value            numeric,
    created_at       timestamptz not null default now()
);

create index if not exists trip_constraints_trip_id_idx on trip_constraints(trip_id);

-- ─────────────────────────────────────────────
-- itinerary_days (Phase 2 schema — IF NOT EXISTS preserves Phase 1 table)
-- ─────────────────────────────────────────────
create table if not exists itinerary_days (
    id          uuid primary key default gen_random_uuid(),
    trip_id     uuid not null references trips(id) on delete cascade,
    position    integer not null,
    date        date,
    city        text,
    day_type    text not null default 'exploration'
                    check (day_type in ('exploration', 'rest', 'transit')),
    notes       text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (trip_id, position)
);

create index if not exists itinerary_days_trip_id_idx on itinerary_days(trip_id);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_trigger where tgname = 'itinerary_days_updated_at'
    ) then
        create trigger itinerary_days_updated_at
            before update on itinerary_days
            for each row execute function set_updated_at();
    end if;
end;
$$;

-- ─────────────────────────────────────────────
-- itinerary_activities
-- ─────────────────────────────────────────────
create table if not exists itinerary_activities (
    id             uuid primary key default gen_random_uuid(),
    day_id         uuid not null references itinerary_days(id) on delete cascade,
    position       integer not null,
    title          text not null,
    time_slot      text not null check (time_slot in (
                       'morning', 'afternoon', 'evening', 'specific')),
    specific_time  text,
    category       text not null check (category in (
                       'food', 'transit', 'sightseeing', 'lodging',
                       'shopping', 'activity')),
    estimated_cost numeric,
    notes          text,
    created_at     timestamptz not null default now(),
    unique (day_id, position)
);

create index if not exists itinerary_activities_day_id_idx on itinerary_activities(day_id);

-- ─────────────────────────────────────────────
-- itinerary_mutations (audit log for AI-driven changes)
-- ─────────────────────────────────────────────
create table if not exists itinerary_mutations (
    id              uuid primary key default gen_random_uuid(),
    trip_id         uuid not null references trips(id) on delete cascade,
    mutation_type   text not null,
    payload_before  jsonb,
    payload_after   jsonb,
    created_at      timestamptz not null default now()
);

create index if not exists itinerary_mutations_trip_id_idx on itinerary_mutations(trip_id);
