-- INV-03: additive hardening; do not edit migrations already applied.
-- A profile provisioned by a trusted administrator is required for staff writes.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_staff_writer()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.app_profiles p
    WHERE p.user_id = auth.uid() AND p.role IN ('LIDER', 'ADMIN')
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff_writer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_writer() TO authenticated;
COMMIT;
