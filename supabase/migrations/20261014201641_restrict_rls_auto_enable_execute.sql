-- Supabase's automatic-RLS helper is present on the hosted project, but may be
-- absent from a local stack. Its postgres-owned event trigger remains intact.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
