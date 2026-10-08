import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/firebase-admin";
import { migrarDadosSemDono, migrarParaCadernoIndividual } from "@/lib/dono";

export const SESSION_COOKIE = "juris_session";

export type Role = "admin" | "aluno";

export type SessionUser = {
  uid: string;
  email: string | null;
  nome: string | null;
  role: Role;
};

/** "maria.silva@x.com" → "Maria" — só pra quem ainda não tem nome cadastrado. */
function nomeDoEmail(email: string | null) {
  const base = email?.split("@")[0]?.split(/[._-]/)[0];
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : null;
}

// cache(): várias chamadas na mesma requisição (layout + página + actions) verificam uma vez só.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const role: Role = decoded.role === "admin" ? "admin" : "aluno";
    // O nome vem da conta (e não do cookie de login), pra troca de nome valer na hora.
    const conta = await auth.getUser(decoded.uid).catch(() => null);
    const email = conta?.email ?? decoded.email ?? null;
    const user: SessionUser = {
      uid: decoded.uid,
      email,
      nome: conta?.displayName || (decoded.name as string | undefined) || nomeDoEmail(email),
      role,
    };
    if (role === "admin") {
      await migrarDadosSemDono(user.uid).catch((e) => console.error("Migração de dono falhou", e));
    }
    // Roda na primeira entrada de qualquer login (precisa da v1 já feita pra saber a dona).
    await migrarParaCadernoIndividual(user).catch((e) => console.error("Migração individual falhou", e));
    return user;
  } catch {
    return null;
  }
});

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
