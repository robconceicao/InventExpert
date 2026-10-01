/**
 * RBAC leve do InventExpert — resolução assíncrona de papel + re-export das regras.
 *
 * Fontes (por ordem):
 *  1) user.app_metadata.role (administrado pelo servidor)
 *  2) tabela app_profiles.role
 *  3) null → acesso privilegiado negado
 */

import { isSupabaseConfigured, supabase } from "./supabase";
import {
  parseAppRole,
  type AppRole,
} from "./authzRules";

export type { AppRole } from "./authzRules";
export {
  parseAppRole,
  roleAtLeast,
  canAccessManagement,
  canGenerateEscala,
  canPublishProdutividade,
} from "./authzRules";

/**
 * Resolve o papel do utilizador autenticado.
 * null = perfil ausente ou indisponível, sem privilégios.
 */
export async function resolveAppRole(): Promise<AppRole | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const meta = parseAppRole(session.user.app_metadata?.role);
    if (meta) return meta;

    const { data, error } = await supabase
      .from("app_profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|42P01/i.test(error.message)) {
        return null;
      }
      console.warn("[authz] app_profiles:", error.message);
      return null;
    }

    if (!data) return null;
    return parseAppRole(data.role) ?? "OPERADOR";
  } catch (e) {
    console.warn("[authz] resolveAppRole failed:", e);
    return null;
  }
}
