"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "carregando" | "suportado-inativo" | "ativo" | "nao-suportado";

export function NotificacoesButton() {
  const [status, setStatus] = useState<Status>("carregando");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function verificar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("nao-suportado");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setStatus(sub ? "ativo" : "suportado-inativo");
    }
    verificar().catch(() => setStatus("nao-suportado"));
  }, []);

  async function ativar() {
    setErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setErro("Permissão de notificação não concedida.");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setErro("Notificações push não configuradas neste servidor.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setStatus("ativo");
    } catch {
      setErro("Não foi possível ativar as notificações.");
    }
  }

  async function desativar() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("suportado-inativo");
    } catch {
      setErro("Não foi possível desativar as notificações.");
    }
  }

  if (status === "carregando" || status === "nao-suportado") return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {status === "ativo" ? (
        <button
          onClick={desativar}
          className="rounded-full border border-black/15 dark:border-white/15 px-3 py-1 text-green-700 dark:text-green-400"
        >
          🔔 Lembretes ativados
        </button>
      ) : (
        <button
          onClick={ativar}
          className="rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
        >
          🔕 Ativar lembretes de prova
        </button>
      )}
      {erro && <span className="text-red-600 dark:text-red-400">{erro}</span>}
    </div>
  );
}
