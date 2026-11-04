-- Дозвіл на видалення анкет для автентифікованих користувачів (штаб).
-- Виконати в Supabase Dashboard → SQL Editor → New query → Run.
-- Потрібно один раз, якщо кнопки «Видалити» на сторінці штабу повідомляють про заборону.

drop policy if exists "authenticated can delete" on public.candidates;
create policy "authenticated can delete"
  on public.candidates
  for delete
  to authenticated
  using (true);
