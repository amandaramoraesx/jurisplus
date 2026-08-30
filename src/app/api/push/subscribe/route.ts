import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { hashEndpoint } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { endpoint, keys } = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }

  await db
    .collection("push_subscriptions")
    .doc(hashEndpoint(endpoint))
    .set(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth, createdAt: new Date() },
      { merge: true }
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { endpoint } = body as { endpoint?: string };

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint é obrigatório" }, { status: 400 });
  }

  await db.collection("push_subscriptions").doc(hashEndpoint(endpoint)).delete();

  return NextResponse.json({ ok: true });
}
