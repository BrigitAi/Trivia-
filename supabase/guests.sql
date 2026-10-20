-- =====================================================================
-- Brigit Trivia League — guests: non-Brigit people who may PLAY (not review)
-- Run once in the Supabase SQL editor (after players.sql). Safe to re-run.
-- To add someone later: insert a row here AND add the email to guestEmails in config.js.
-- =====================================================================
create table if not exists public.quiz_guests (
  email    text primary key,
  name     text,
  added_at timestamptz not null default now()
);
alter table public.quiz_guests enable row level security;
revoke all on public.quiz_guests from anon, authenticated;

insert into public.quiz_guests (email, name) values
  ('carlos@elveygroup.com', 'Carlos')
on conflict (email) do update set name = excluded.name;

create or replace function public.quiz_is_guest()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quiz_guests g where lower(g.email) = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.quiz_is_guest() from public, anon;
grant execute on function public.quiz_is_guest() to authenticated;

-- Players allowed in the quiz tables: Brigit emails, approvers, and guests
create or replace function public.quiz_is_brigit()
returns boolean language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@brigit.co.za'
      or public.quiz_is_approver() or public.quiz_is_guest();
$$;

-- Registered players list (approvers): include guests
drop function if exists public.quiz_registered_players();
create function public.quiz_registered_players()
returns table (
  email text, registered_at timestamptz, email_confirmed boolean, last_sign_in timestamptz,
  league_name text, division text, sectors text, races_played bigint, points bigint, last_played timestamptz,
  did_company_policies boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.quiz_is_approver() then
    raise exception 'Only approvers can see registered players';
  end if;
  return query
    select u.email::text, u.created_at, u.email_confirmed_at is not null, u.last_sign_in_at,
           p.display_name, p.division, array_to_string(p.sectors, ', '),
           coalesce(r.n_races, 0), coalesce(r.n_points, 0), r.last_at, coalesce(r.did_policies, false)
    from auth.users u
    left join public.quiz_profiles p on p.user_id = u.id
    left join (
      select x.user_id as uid, count(*) as n_races, sum(x.points)::bigint as n_points, max(x.created_at) as last_at,
             bool_or(x.library = 'policies') as did_policies
      from public.quiz_results x group by x.user_id
    ) r on r.uid = u.id
    where u.email ilike '%@brigit.co.za'
       or lower(u.email::text) in (select lower(a.email) from public.quiz_approvers a)
       or lower(u.email::text) in (select lower(g.email) from public.quiz_guests g)
    order by u.created_at desc;
end $$;
revoke all on function public.quiz_registered_players() from public, anon;
grant execute on function public.quiz_registered_players() to authenticated;
