import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Disciplina, type Prova, type PushSubscriptionDoc } from "@/lib/firestore";
import { sendPushNotification, isPushConfigured } from "@/lib/webpush";

const LIMITES_DIAS = [7, 3, 1, 0];

function autorizado(req: NextRequest) {
  const token = process.env.NOTIFICACOES_CRON_TOKEN;
  if (!token) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${token}`) return true;

  const query = req.nextUrl.searchParams.get("token");
  return query === token;
}

function diasRestantes(data: Date) {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((data.getTime() - inicioHoje.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push não configurado" }, { status: 500 });
  }

  const [provasSnap, disciplinasSnap, subscriptionsSnap] = await Promise.all([
    db.collection("provas").get(),
    db.collection("disciplinas").get(),
    db.collection("push_subscriptions").get(),
  ]);

  const disciplinasPorId = new Map(
    disciplinasSnap.docs.map((doc) => [doc.id, fromDoc<Disciplina>(doc)])
  );
  const provas = provasSnap.docs.map((doc) => fromDoc<Prova>(doc));
  const subscriptions = subscriptionsSnap.docs.map((doc) => fromDoc<PushSubscriptionDoc>(doc));

  let notificacoesEnviadas = 0;

  for (const prova of provas) {
    const dias = diasRestantes(prova.data);
    if (!LIMITES_DIAS.includes(dias)) continue;

    const lembreteId = `${prova.id}_${dias}`;
    const jaEnviado = await db.collection("lembretes_enviados").doc(lembreteId).get();
    if (jaEnviado.exists) continue;

    const disciplina = disciplinasPorId.get(prova.disciplinaId)!;
    const mensagem =
      dias === 0
        ? `A prova de ${disciplina.nome} é hoje!`
        : `Faltam ${dias} dia${dias === 1 ? "" : "s"} para a prova de ${disciplina.nome}.`;

    for (const sub of subscriptions) {
      try {
        await sendPushNotification(sub, {
          title: "Juris+ · Lembrete de prova",
          body: mensagem,
          url: "/aulas?abrir=provas",
        });
        notificacoesEnviadas++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.collection("push_subscriptions").doc(sub.id).delete().catch(() => {});
        }
      }
    }

    await db
      .collection("lembretes_enviados")
      .doc(lembreteId)
      .set({ provaId: prova.id, dias, enviadoEm: new Date() });
  }

  return NextResponse.json({ ok: true, notificacoesEnviadas });
}
