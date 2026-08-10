-- 북끄럽 아카이브 — 테이블 + RLS
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행.
--
-- 이미 만든 뒤에 컬럼만 추가한다면:
--   alter table meetings add column if not exists cover_url text;
--   alter table picks add column if not exists url text;
--   alter table picks drop constraint if exists picks_kind_check;
--   alter table picks add constraint picks_kind_check
--     check (kind in ('book', 'movie', 'video', 'etc'));

create table if not exists meetings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  title       text not null,
  author      text not null default '',
  pages       int,
  cover_url   text,                                -- 표지 이미지. 없으면 색으로 대신한다
  picked_by   text,                                -- 책 고른 사람. 화면에는 마스킹해서 나온다
  questions   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- 모임 중에 자연스레 나온 추천작 (모임 선정도서가 아님)
create table if not exists picks (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid references meetings(id) on delete set null,
  kind           text not null default 'book' check (kind in ('book', 'movie', 'video', 'etc')),
  title          text not null,
  creator        text not null default '',
  note           text not null default '',
  url            text,                              -- 유튜브 등 링크. 있으면 썸네일을 보여준다
  recommended_by text,
  created_at     timestamptz not null default now()
);

create index if not exists picks_kind_idx on picks (kind, created_at desc);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  target     text not null,
  nickname   text not null check (char_length(nickname) between 1 and 20),
  body       text not null check (char_length(body) between 1 and 1000),
  anon_id    text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_meeting_idx on comments (meeting_id, created_at);
create index if not exists meetings_date_idx on meetings (date desc);

alter table meetings enable row level security;
alter table comments enable row level security;
alter table picks enable row level security;

-- picks: 누구나 읽기·등록·수정. 삭제는 거부.
drop policy if exists picks_read on picks;
create policy picks_read on picks
  for select using (true);

drop policy if exists picks_write on picks;
drop policy if exists picks_insert on picks;
create policy picks_insert on picks
  for insert with check (true);

drop policy if exists picks_update on picks;
create policy picks_update on picks
  for update using (true) with check (true);

-- meetings: 누구나 읽기·등록·수정. 삭제는 어떤 정책도 없으므로 전부 거부된다.
-- 잘못 올린 회차는 Supabase 대시보드에서 직접 지운다.
drop policy if exists meetings_read on meetings;
create policy meetings_read on meetings
  for select using (true);

drop policy if exists meetings_write on meetings;
drop policy if exists meetings_insert on meetings;
create policy meetings_insert on meetings
  for insert with check (true);

drop policy if exists meetings_update on meetings;
create policy meetings_update on meetings
  for update using (true) with check (true);

-- comments: 누구나 읽기·쓰기.
-- 수정·삭제는 "같은 브라우저(anon_id)가 30분 안에 쓴 댓글"만.
--
-- anon_id는 브라우저가 스스로 보내는 값이라 위조할 수 있다. 이건 보안이 아니라
-- 오타를 고치기 위한 장치다. 30분 제한은 그 위조가 통하는 범위를 최근 댓글로
-- 좁히기 위한 것이고, 옛날 댓글을 쓸어버리는 일은 시간 조건이 막는다.
drop policy if exists comments_read on comments;
create policy comments_read on comments
  for select using (true);

drop policy if exists comments_insert on comments;
create policy comments_insert on comments
  for insert with check (true);

-- 클라이언트가 헤더로 보낸 anon_id를 읽는다.
create or replace function current_anon_id() returns text
language sql stable as $$
  select coalesce(
    current_setting('request.headers', true)::json ->> 'x-anon-id',
    ''
  );
$$;

drop policy if exists comments_modify on comments;
create policy comments_modify on comments
  for update
  using (anon_id = current_anon_id() and created_at > now() - interval '30 minutes')
  with check (anon_id = current_anon_id());

drop policy if exists comments_delete on comments;
create policy comments_delete on comments
  for delete
  using (anon_id = current_anon_id() and created_at > now() - interval '30 minutes');
