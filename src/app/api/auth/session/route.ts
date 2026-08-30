import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { SESSION_COOKIE } from "@/lib/auth";

const EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias (máximo permitido pelo Firebase)

export async function POST(req: NextRequest) {
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "idToken é obrigatório" }, { status: 400 });
  }

  try {
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      maxAge: EXPIRES_IN_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Não foi possível criar a sessão" }, { status: 401 });
  }
}
