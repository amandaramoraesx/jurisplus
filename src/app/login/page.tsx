"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email, senha);
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("Não foi possível entrar");

      router.push("/");
      router.refresh();
    } catch {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center mb-2">
          <span className="text-3xl">⚖️</span>
          <h1 className="text-xl font-bold tracking-tight mt-1">Juris+</h1>
          <p className="text-sm text-foreground/60 mt-1">Entre com seu e-mail e senha</p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
          <input
            type="email"
            placeholder="E-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
          <input
            type="password"
            placeholder="Senha"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="field"
          />
          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
          <button type="submit" disabled={carregando} className="btn-primary">
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
