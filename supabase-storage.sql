-- Rode UMA vez no Supabase > SQL Editor (depois do supabase-grants.sql).
-- Corrige "new row violates row-level security policy" ao enviar foto/logo.
--
-- O que faz:
--  1) cria o bucket público "logos" (as imagens do cardápio precisam ser legíveis por qualquer cliente);
--  2) deixa cada admin enviar/trocar/apagar arquivos SOMENTE na pasta da própria empresa
--     (o app grava em  logos/<id-da-empresa>/arquivo.ext).

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- Descobre a empresa do usuário logado. SECURITY DEFINER porque o papel "authenticated"
-- não tem (e não deve ter) acesso direto à tabela marmitaria.users.
create or replace function marmitaria.current_company_id()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select u."companyId" from marmitaria.users u where u."supabaseUserId" = auth.uid() limit 1
$$;

grant usage on schema marmitaria to authenticated;
revoke all on function marmitaria.current_company_id() from public;
grant execute on function marmitaria.current_company_id() to authenticated;

drop policy if exists "logos_insert_own_company" on storage.objects;
drop policy if exists "logos_update_own_company" on storage.objects;
drop policy if exists "logos_delete_own_company" on storage.objects;

create policy "logos_insert_own_company" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = marmitaria.current_company_id()::text);

create policy "logos_update_own_company" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = marmitaria.current_company_id()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = marmitaria.current_company_id()::text);

create policy "logos_delete_own_company" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = marmitaria.current_company_id()::text);
