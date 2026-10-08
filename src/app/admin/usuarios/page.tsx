import { auth } from "@/lib/firebase-admin";
import { requireAdminPage } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { criarUsuario, removerUsuario, renomearUsuario } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const admin = await requireAdminPage();

  const { users } = await auth.listUsers();
  const usuarios = users
    .map((u) => ({
      uid: u.uid,
      nome: u.displayName || "(sem nome)",
      semNome: !u.displayName,
      email: u.email || "",
      role: (u.customClaims?.role as string) === "admin" ? "admin" : "aluno",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Crie logins pra colegas usarem o Juris+. Disciplinas, professores e provas são da turma
          (só admin cadastra disciplinas e professores). Todo o resto — aulas, anotações, lousa,
          anexos, IA, frequência, notas, palestras, grupos e favoritos — é de cada login: ninguém vê
          o do outro.
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
          <div key={u.uid} className="card flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {u.nome}
                  {u.uid === admin.uid && (
                    <span className="text-xs text-foreground/50 font-normal"> (você)</span>
                  )}
                </p>
                <p className="text-xs text-foreground/60 truncate">
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
            <details className="disclosure text-sm">
              <summary className="text-xs font-medium text-foreground/60">✏️ Trocar nome</summary>
              <form action={renomearUsuario.bind(null, u.uid)} className="flex gap-2 mt-2">
                <input
                  name="nome"
                  defaultValue={u.semNome ? "" : u.nome}
                  placeholder="Nome que aparece no app"
                  required
                  className="field flex-1 min-w-0"
                />
                <SubmitButton savedLabel="Salvo!" className="btn-primary shrink-0">
                  Salvar
                </SubmitButton>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
