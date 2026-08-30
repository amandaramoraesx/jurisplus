import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/firebase-admin";

export const SESSION_COOKIE = "juris_session";

export type Role = "admin" | "aluno";

export type SessionUser = {
  uid: string;
  email: string | null;
  nome: string | null;
  role: Role;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const role: Role = decoded.role === "admin" ? "admin" : "aluno";
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      nome: (decoded.name as string | undefined) ?? null,
      role,
    };
  } catch {
    return null;
  }
}

/** Usa dentro de páginas: redireciona para /login se ninguém estiver logado. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Usa no início de toda Server Action que só a admin pode executar
 * (ex: criar/editar/remover professor ou disciplina). Essa é a checagem
 * de segurança de verdade — a UI só esconde o botão por conveniência.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Apenas a administradora pode fazer essa ação.");
  }
  return user;
}

/** Usa dentro de páginas exclusivas de admin: redireciona pra "/" em vez de dar erro. */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
