import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  const provas = await prisma.prova.findMany({ include: { disciplina: true } });
  const subscriptions = await prisma.pushSubscription.findMany();

  let notificacoesEnviadas = 0;

  for (const prova of provas) {
    const dias = diasRestantes(prova.data);
    if (!LIMITES_DIAS.includes(dias)) continue;

    const jaEnviado = await prisma.lembreteEnviado.findUnique({
      where: { provaId_dias: { provaId: prova.id, dias } },
    });
    if (jaEnviado) continue;

    const mensagem =
      dias === 0
        ? `A prova de ${prova.disciplina.nome} é hoje!`
        : `Faltam ${dias} dia${dias === 1 ? "" : "s"} para a prova de ${prova.disciplina.nome}.`;

    for (const sub of subscriptions) {
      try {
        await sendPushNotification(sub, {
          title: "Juris+ · Lembrete de prova",
          body: mensagem,
          url: "/provas",
        });
        notificacoesEnviadas++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    await prisma.lembreteEnviado.create({ data: { provaId: prova.id, dias } });
  }

  return NextResponse.json({ ok: true, notificacoesEnviadas });
}
