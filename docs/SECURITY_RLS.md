# Segurança Supabase — RLS, Auth e SECURITY DEFINER

Última actualização: 2026-07-17  
Projeto: `maoduppsngdwupokxtqr`

## Fase 0 — Diagnóstico (estado pré-patch Security Advisor)

### Tabelas core e RLS

| Tabela | RLS | Policies problemáticas |
|--------|-----|------------------------|
| `clientes` | ON | `USING (true)` / `WITH CHECK (true)` para `authenticated` |
| `colaboradores` | ON | idem |
| `escala` | ON | idem |
| `inventarios` | ON | idem |
| `produtividade` | ON | idem (`WITH CHECK (true)` no INSERT) |

### Colunas de controlo de acesso (schema real)

| Tabela | Colunas relevantes | Multi-tenant por loja? |
|--------|--------------------|-------------------------|
| `app_profiles` | `user_id`, `role` (`OPERADOR`/`LIDER`/`ADMIN`) | N/A — perfil de app |
| `clientes` | `id` (+ `codigo_loja` se migration campos) | **Não** ligado a `auth.uid()` |
| `colaboradores` | `id`, `matricula`, `funcao` | **Sem** `user_id` |
| `inventarios` | `id`, `cliente_id`, `created_by` | `created_by` → `auth.users` (parcial) |
| `escala` | `colaborador_id`, `papel` | Sem `user_id` |
| `produtividade` | `colaborador_id` | Sem `user_id` |
| `field_events` | `user_id` | Sim — dono do evento |

**Conclusão:** o exemplo do plano com `colaboradores.user_id` + `codigo_loja` **não existe** no schema actual.  
Políticas realistas:

1. Exigir `auth.uid() IS NOT NULL` (elimina “Always True” literal).
2. Escrita restrita a `app_profiles.role IN ('LIDER','ADMIN')` (ou legado sem perfil).
3. Leitura para qualquer papel de staff autenticado (incl. `OPERADOR`).
4. `field_events` / `app_profiles` já usam `user_id = auth.uid()`.

### Funções SECURITY DEFINER

| Função | Grants (pré-patch) | search_path | Auth check |
|--------|-------------------|-------------|------------|
| `gerar_escala(uuid)` | authenticated, service_role | `public` | `auth.uid()` (patch anterior) |
| `listar_escala(uuid)` | **PUBLIC, anon**, authenticated, service_role | `public` | **ausente** |

### Auth

| Setting | Valor pré-patch | Pós-patch |
|---------|-----------------|-----------|
| `password_hibp_enabled` (Leaked Password Protection) | `false` | **Bloqueado no plano Free** (API 402 — requer Pro+) |
| `password_min_length` | `6` | Tentativa de 8 via API; ver dashboard se aplicou |

**Acção manual (plano Free):** Dashboard → Authentication → Providers → Email → activar *Leaked password protection* só está disponível em **Pro**. No Free, manter senha mínima forte no app (`AuthScreen` min 8) e considerar upgrade.

---

## Modelo de policies (pós Security Advisor patch)

Helpers (SECURITY INVOKER):

- `is_authenticated_user()` → `auth.uid() IS NOT NULL`
- `is_staff_reader()` → autenticado + (sem perfil **ou** role OPERADOR/LIDER/ADMIN)
- `is_staff_writer()` → autenticado + (sem perfil **ou** role LIDER/ADMIN)

| Operação | Policy |
|----------|--------|
| SELECT nas 5 tabelas core | `is_staff_reader()` |
| INSERT/UPDATE/DELETE | `is_staff_writer()` |

**Legado:** utilizador autenticado **sem** linha em `app_profiles` mantém acesso total (compatibilidade).  
Para endurecer: criar perfil `OPERADOR` para todos os users e promover líderes a `LIDER`.

---

## Migrations relacionadas

1. `migration_rls_authenticated_only.sql` — removeu acesso `anon`/`public`
2. `migration_gerar_escala_lock_patch1.sql` — lock + auth em `gerar_escala`
3. `migration_field_events_and_roles.sql` — `field_events`, `app_profiles`
4. **`migration_security_advisor_harden.sql`** — Always True → role helpers; listar_escala; HIBP via API/docs

---

## Checklist Security Advisor

- [x] RLS Always True nas 5 tabelas core → `is_staff_reader/writer()` (0 policies `true` no core)
- [x] Public execute SECURITY DEFINER (`listar_escala`) → só `authenticated` + `service_role`
- [ ] Leaked Password Protection → **requer Supabase Pro** (402 no Free)
- [x] `search_path` em `listar_escala` / `gerar_escala` → `public, pg_temp`
- [ ] Validar no Dashboard Security Advisor (UI)
- [ ] Testar com users OPERADOR vs LIDER

## Backup

- Snapshot de policies pré-harden: `docs/backup_rls_policies_20260717.json`
- Migration: `supabase/migration_security_advisor_harden.sql`

## Promover utilizador

```sql
INSERT INTO public.app_profiles (user_id, role)
VALUES ('<auth.users.id>', 'LIDER')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
```
