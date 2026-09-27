-- خدمة الأبحاث العلمية للمتدربين
-- شغّل هذا الملف في مشروع Supabase المرتبط بالمنصة قبل تفعيل الخدمة.

create table if not exists public.research_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_submissions (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.trainees(id) on delete cascade,
  topic_id uuid not null references public.research_topics(id),
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text not null default 'application/pdf',
  extracted_text text,
  status text not null default 'submitted' check (status in ('submitted','plagiarism_checked','confirmed','ai_reviewed','approved','returned')),
  plagiarism_percent numeric(5,2),
  plagiarism_summary text,
  academic_score numeric(4,2),
  academic_feedback text,
  confirmed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  max_file_size_mb integer not null default 10,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.research_settings(id, enabled) values(true,false)
on conflict (id) do nothing;

alter table public.research_topics enable row level security;
alter table public.research_submissions enable row level security;
alter table public.research_settings enable row level security;

drop policy if exists "research topics active read" on public.research_topics;
create policy "research topics active read" on public.research_topics
for select to anon, authenticated using (is_active=true);

drop policy if exists "research settings read" on public.research_settings;
create policy "research settings read" on public.research_settings
for select to anon, authenticated using (true);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('research-papers','research-papers',false,10485760,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
