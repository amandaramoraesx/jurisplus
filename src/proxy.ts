import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Checagem rápida (só confere se o cookie existe) pra redirecionar sem
// carregar a página toda. A verificação de verdade (assinatura, validade,
// papel do usuário) acontece no servidor via requireUser()/requireAdmin(),
// que são a fonte de segurança real.
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-.*\\.png|apple-touch-icon.png).*)",
  ],
};
