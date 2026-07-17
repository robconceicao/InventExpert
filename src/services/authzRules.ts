/**
 * Regras RBAC puras (sem Supabase) — testáveis em Jest node.
 */

export type AppRole = "OPERADOR" | "LIDER" | "ADMIN";

const ROLE_RANK: Record<AppRole, number> = {
  OPERADOR: 1,
  LIDER: 2,
  ADMIN: 3,
};

export function parseAppRole(raw: unknown): AppRole | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase();
  if (u === "OPERADOR" || u === "OPERATOR" || u === "USER") return "OPERADOR";
  if (u === "LIDER" || u === "LÍDER" || u === "LEADER") return "LIDER";
  if (u === "ADMIN" || u === "ADMINISTRADOR") return "ADMIN";
  return null;
}

export function roleAtLeast(role: AppRole | null, min: AppRole): boolean {
  // null = legado sem perfil → não restringe
  if (role === null) return true;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function canAccessManagement(role: AppRole | null): boolean {
  return roleAtLeast(role, "LIDER");
}

export function canGenerateEscala(role: AppRole | null): boolean {
  return roleAtLeast(role, "LIDER");
}

export function canPublishProdutividade(role: AppRole | null): boolean {
  return roleAtLeast(role, "LIDER");
}
