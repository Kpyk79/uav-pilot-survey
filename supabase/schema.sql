-- ============================================================================
-- Анкета відбору майбутніх пілотів БпЛА — схема Supabase
-- Виконати повністю у Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Блок 1. Проживання та контакти
  residence_type text not null,            -- адреса, яку курсант вписує самостійно
  full_name text not null,
  birth_date date,
  phone text not null,
  email text,
  region text,

  -- Блок 2. Служба / освіта
  status text,                             -- 'civilian' | 'military'
  unit text,
  approx_service_years text,               -- вільний текст, напр. "7 років"
  position_specialty text,                 -- якщо строк служби > 5 років
  profile_courses text,
  equipment_experience text,
  trained_others boolean default false,
  trained_others_details text,
  awards text,
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

  -- Блок 6. Особисті якості та інтереси
  hobbies text,
  info_perception text,                     -- 'practice' | 'theory' | 'observation' | 'mixed'
  character_traits text,
  talk_topics text,

  -- Блок 7. Мотивація
  motivation text,
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

-- Видаляти анкети може лише автентифікований користувач (кнопка видалення
-- на сторінці штабу / в застосунку Ocinka).
drop policy if exists "authenticated can delete" on public.candidates;
create policy "authenticated can delete"
  on public.candidates
  for delete
  to authenticated
  using (true);

-- Явно забороняємо анонімний SELECT/UPDATE/DELETE (RLS без policy = заборона,
-- але залишаємо це тут як документацію намірів).
