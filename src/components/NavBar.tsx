"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Início", icon: "🏠" },
  { href: "/aulas", label: "Aulas", icon: "📝" },
  { href: "/notas", label: "Notas", icon: "📊" },
  { href: "/professores", label: "Professores", icon: "🎓" },
  { href: "/provas", label: "Provas", icon: "📅" },
  { href: "/palestras", label: "Palestras", icon: "🎤" },
  { href: "/grupos", label: "Grupos", icon: "👥" },
  { href: "/vademecum", label: "Vade Mecum", icon: "⚖️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar para telas maiores (notebook) */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-black/10 dark:md:border-white/10 md:py-6 md:px-3 md:shrink-0">
        <div className="px-3 mb-6 flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <span className="text-xl font-bold tracking-tight">Juris+</span>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, link.href)
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-foreground/70 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              }`}
            >
              <span aria-hidden>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Barra inferior para celular */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 dark:border-white/10 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto no-scrollbar">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 min-w-[64px] flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium transition-colors ${
                isActive(pathname, link.href)
                  ? "text-[var(--accent)]"
                  : "text-foreground/50"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {link.icon}
              </span>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
