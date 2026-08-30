"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function VademecumSearchBar({ termoInicial }: { termoInicial: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(termoInicial);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      const termo = valor.trim();
      if (termo) params.set("q", termo);
      const destino = `/vademecum${params.toString() ? `?${params.toString()}` : ""}`;
      startTransition(() => {
        router.replace(destino, { scroll: false });
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [valor, router]);

  return (
    <div className="flex items-center gap-2">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder='Ex: "CC 186", "homicídio", "art. 5"...'
        className="flex-1 field"
      />
      <span className="text-xs text-foreground/40 w-16 text-center shrink-0">
        {isPending ? "🔍 ..." : valor.trim() ? "🔍" : ""}
      </span>
    </div>
  );
}
