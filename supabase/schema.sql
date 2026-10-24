-- ============================================================================
-- Анкета відбору майбутніх пілотів БпЛА — схема Supabase
-- Виконати повністю у Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Блок 1. Проживання та контакти
  residence_type text not null,            -- 'own' | 'needs_housing' | 'rent' | 'other'
  residence_note text,
  full_name text not null,
  birth_date date,
  phone text not null,
  email text,
  region text,

  -- Блок 2. Служба / освіта
  status text,                             -- 'civilian' | 'military'
  unit text,
  education_level text,
  education_field text,

  -- Блок 3. Досвід з БпЛА та авіацією
  uav_experience boolean default false,
  uav_types text[],                        -- {'fpv','multirotor','fixed_wing','vtol'}
  uav_hours text,
  rc_experience boolean default false,
  rc_details text,
  sim_experience boolean default false,
  sim_details text,

  -- Блок 4. Технічні навички
  skill_electronics int,                   -- 0-3
  skill_programming int,                   -- 0-3
  skill_repair int,                        -- 0-3
  driver_license text[],                   -- {'A','B','C','D'}

  -- Блок 5. Фізичний і психологічний стан
  vision text,                              -- 'normal' | 'corrected' | 'impaired'
  health_limitations text,
  stress_resilience int,                    -- 1-5
  stress_example text,

  -- Блок 6. Мотивація та готовність
  motivation text,
  availability text,                        -- 'full' | 'partial' | 'limited'
  availability_note text,
  contact_person text,
  additional_info text,

  consent boolean not null default false
);

alter table public.candidates enable row level security;

-- Будь-хто (анонімний відвідувач сайту) може ТІЛЬКИ додавати анкету.
drop policy if exists "anon can insert" on public.candidates;
create policy "anon can insert"
  on public.candidates
  for insert
  to anon
  with check (consent = true);

-- Читати список анкет може лише автентифікований користувач
-- (тобто лише той, хто увійшов на прихованій сторінці результатів
-- за акаунтом, який ви самі створите в Supabase Auth).
drop policy if exists "authenticated can read" on public.candidates;
create policy "authenticated can read"
  on public.candidates
  for select
  to authenticated
  using (true);

-- Явно забороняємо анонімний SELECT/UPDATE/DELETE (RLS без policy = заборона,
-- але залишаємо це тут як документацію намірів).
