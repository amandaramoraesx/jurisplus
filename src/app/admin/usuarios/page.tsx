import { auth } from "@/lib/firebase-admin";
import { requireAdminPage } from "@/lib/auth";
import { criarUsuario, removerUsuario } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const admin = await requireAdminPage();

  const { users } = await auth.listUsers();
  const usuarios = users
    .map((u) => ({
      uid: u.uid,
      nome: u.displayName || "(sem nome)",
      email: u.email || "",
      role: (u.customClaims?.role as string) === "admin" ? "admin" : "aluno",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Crie logins pra colegas usarem o Juris+. Só quem é admin cadastra ou edita professores e
          disciplinas — o resto do app fica liberado pra todo mundo.
        </p>
      </div>

      <form action={criarUsuario} className="flex flex-col gap-3 card">
        <h2 className="section-title">Novo login</h2>
        <input name="nome" placeholder="Nome" required className="field" />
        <input name="email" type="email" placeholder="E-mail" required className="field" />
        <input
          name="senha"
          type="password"
          placeholder="Senha (mínimo 6 caracteres)"
          required
          minLength={6}
          className="field"
        />
        <select name="papel" defaultValue="aluno" className="field">
          <option value="aluno">Aluno (não pode mexer em professores/disciplinas)</option>
          <option value="admin">Admin (acesso total)</option>
        </select>
        <button type="submit" className="self-start btn-primary">
          Criar login
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <div key={u.uid} className="card flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {u.nome}
                {u.uid === admin.uid && (
                  <span className="text-xs text-foreground/50 font-normal"> (você)</span>
                )}
              </p>
              <p className="text-xs text-foreground/60">
                {u.email} · {u.role === "admin" ? "Admin" : "Aluno"}
              </p>
            </div>
            {u.uid !== admin.uid && (
              <form action={removerUsuario.bind(null, u.uid)}>
                <button type="submit" className="btn-danger-text shrink-0">
                  Remover acesso
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
