begin;
create table public.ew_profiles (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (data->>'id' = owner_id::text)
);
create table public.ew_projects (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check (data->>'id'=id::text and data->>'profileId'=owner_id::text),
 updated_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.ew_documents (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null, revision integer not null default 0 check(revision>=0),
 data jsonb not null check(data->>'id'=id::text and data->>'projectId'=project_id::text and (data->>'revision')::int=revision),
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.ew_projects(id,owner_id) on delete cascade
);
create index on public.ew_projects(owner_id);
create index on public.ew_documents(owner_id,project_id);
alter table public.ew_profiles enable row level security;
alter table public.ew_projects enable row level security;
alter table public.ew_documents enable row level security;
create policy own_profile on public.ew_profiles for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy own_project on public.ew_projects for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy own_document on public.ew_documents for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on public.ew_profiles,public.ew_projects,public.ew_documents from anon,authenticated;
grant select,insert,update on public.ew_profiles to authenticated;
grant select,insert,delete on public.ew_projects,public.ew_documents to authenticated;

-- Definer functions use a fixed search path and explicit ownership predicates.
create function public.ew_save_document(document_id uuid, expected_revision int, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
 update public.ew_documents set revision=revision+1, data=payload || jsonb_build_object('id',id,'projectId',project_id,'revision',revision+1,'updatedAt',floor(extract(epoch from clock_timestamp())*1000))
 where id=document_id and owner_id=auth.uid() and revision=expected_revision returning data into saved;
 if saved is null then raise exception 'EW_CONFLICT'; end if;
 update public.ew_projects set updated_at=now(),data=data || jsonb_build_object('updatedAt',saved->'updatedAt') where id=(saved->>'projectId')::uuid and owner_id=auth.uid();
 return saved;
end $$;
create function public.ew_patch_project(project_id uuid, patch jsonb, expected_cover jsonb default null, check_cover boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_data jsonb; saved jsonb;
begin
 select data into current_data from public.ew_projects where id=project_id and owner_id=auth.uid() for update;
 if current_data is null then raise exception 'Projeto indisponível'; end if;
 if check_cover and coalesce(current_data->'cover','null'::jsonb) is distinct from coalesce(expected_cover,'null'::jsonb) then raise exception 'A capa foi alterada em outra sessão. Reabra o editor.'; end if;
 if exists(select 1 from jsonb_object_keys(patch) k where k not in ('title','description','icon','cover')) then raise exception 'Campo inválido'; end if;
 saved=current_data || patch || jsonb_build_object('updatedAt',floor(extract(epoch from clock_timestamp())*1000));
 update public.ew_projects set data=saved,updated_at=now() where id=project_id and owner_id=auth.uid();
 return saved;
end $$;
create function public.ew_import_project(payload jsonb, documents jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d jsonb;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 insert into public.ew_projects(id,owner_id,data) values((payload->>'id')::uuid,auth.uid(),payload);
 for d in select value from jsonb_array_elements(documents) loop
 insert into public.ew_documents(id,owner_id,project_id,revision,data) values((d->>'id')::uuid,auth.uid(),(payload->>'id')::uuid,(d->>'revision')::int,d);
 end loop;
 return payload;
end $$;
create function public.ew_export() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('profile',(select data || jsonb_build_object('email',auth.jwt()->>'email') from public.ew_profiles where owner_id=auth.uid()),'projects',coalesce((select jsonb_agg(jsonb_build_object('project',p.data,'documents',coalesce((select jsonb_agg(d.data) from public.ew_documents d where d.project_id=p.id),'[]'::jsonb))) from public.ew_projects p where p.owner_id=auth.uid()),'[]'::jsonb));
$$;
revoke all on function public.ew_save_document(uuid,int,jsonb),public.ew_patch_project(uuid,jsonb,jsonb,boolean),public.ew_import_project(jsonb,jsonb),public.ew_export() from public,anon;
grant execute on function public.ew_save_document(uuid,int,jsonb),public.ew_patch_project(uuid,jsonb,jsonb,boolean),public.ew_import_project(jsonb,jsonb),public.ew_export() to authenticated;
commit;
