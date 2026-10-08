-- Rode UMA vez no Supabase > SQL Editor (depois do `pnpm run db:push`).
-- O schema "marmitaria" é criado pela migração, mas o Supabase NÃO libera acesso a schemas
-- customizados automaticamente. Sem estes GRANTs a API responde "permission denied for schema
-- marmitaria" e o cadastro/consulta de empresas falha.

GRANT USAGE ON SCHEMA marmitaria TO anon, authenticated, service_role;

-- O backend usa a service_role: precisa de acesso total às tabelas e sequences.
GRANT ALL ON ALL TABLES    IN SCHEMA marmitaria TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA marmitaria TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA marmitaria TO service_role;

-- Tabelas criadas no futuro herdam as mesmas permissões.
ALTER DEFAULT PRIVILEGES IN SCHEMA marmitaria GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marmitaria GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA marmitaria GRANT ALL ON ROUTINES  TO service_role;
