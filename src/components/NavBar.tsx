"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Início", icon: "🏠" },
  { href: "/aulas", label: "Acadêmico", icon: "🎓" },
  { href: "/historico", label: "Histórico", icon: "🗓️" },
  { href: "/palestras", label: "Palestras", icon: "🎤" },
  { href: "/grupos", label: "Grupos", icon: "👥" },
  { href: "/vademecum", label: "Vade Mecum", icon: "⚖️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function NavBar({ isAdmin, loggedIn }: { isAdmin: boolean; loggedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  if (!loggedIn) return null;

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const itens = [
    ...links,
    ...(isAdmin ? [{ href: "/admin/usuarios", label: "Usuários", icon: "🔑" }] : []),
  ];

  return (
    <>
      {/* Sidebar para telas maiores (notebook) */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-black/10 dark:md:border-white/10 md:py-6 md:px-3 md:shrink-0">
        <div className="px-3 mb-6 flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <span className="text-xl font-bold tracking-tight">Juris+</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {itens.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 ${
                isActive(pathname, link.href)
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-foreground/70 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              }`}
            >
              <span aria-hidden className="text-lg">
                {link.icon}
              </span>
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={sair}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/50 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          <span aria-hidden>🚪</span>
          Sair
        </button>
      </aside>

      {/* Barra superior + menu lateral pro celular */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 h-14 px-3 border-b border-black/10 dark:border-white/10 bg-background/95 backdrop-blur">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="text-2xl leading-none p-1.5 rounded-lg hover:bg-black/[.04] dark:hover:bg-white/[.06] active:scale-90 transition-transform"
        >
          ☰
        </button>
        <span className="text-lg">⚖️</span>
        <span className="text-lg font-bold tracking-tight">Juris+</span>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity ${
          aberto ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!aberto}
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setAberto(false)}
        />
        <nav
          className={`absolute top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-background border-r border-black/10 dark:border-white/10 flex flex-col py-6 px-3 shadow-xl transition-transform duration-200 ${
            aberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="px-3 mb-6 flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <span className="text-xl font-bold tracking-tight">Juris+</span>
          </div>
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
            {itens.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setAberto(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all active:scale-95 ${
                  isActive(pathname, link.href)
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-foreground/70 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                }`}
              >
                <span aria-hidden className="text-xl">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => {
              setAberto(false);
              sair();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/50 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            <span aria-hidden className="text-xl">
              🚪
            </span>
            Sair
          </button>
        </nav>
      </div>
    </>
  );
}
