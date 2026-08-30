"use server";

import { auth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function criarUsuario(formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const senha = String(formData.get("senha") || "");
  const papel = String(formData.get("papel") || "aluno") === "admin" ? "admin" : "aluno";

  if (!nome || !email || senha.length < 6) return;

  const user = await auth.createUser({
    email,
    password: senha,
    displayName: nome,
  });
  await auth.setCustomUserClaims(user.uid, { role: papel });

  revalidatePath("/admin/usuarios");
}

export async function removerUsuario(uid: string) {
  await requireAdmin();
  await auth.deleteUser(uid);
  revalidatePath("/admin/usuarios");
}
