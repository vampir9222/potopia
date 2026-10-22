import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Contrôle optimiste : sans cookie de session, redirection vers /login (401 JSON pour les routes
 * /api). Il ne vérifie pas la session (pas d'accès base ici) : les vrais contrôles sont
 * requireMember / requireAdmin dans chaque layout, page, server action et route handler.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return Response.json({ error: "Connexion requise." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|refused|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
