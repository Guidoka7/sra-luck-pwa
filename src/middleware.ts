import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname } = request.nextUrl;

  // --- Área administrativa: exige sessão do Supabase Auth ---
  if ((pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) || pathname.startsWith("/api/admin")) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "Integração Supabase não configurada neste ambiente." }, { status: 503 });
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // Colaboradores autenticados não podem entrar no painel administrativo.
    // O Admin existente continua liberado quando não possui perfil de colaborador.
    const { data: colaborador } = await supabase
      .from("colaboradores")
      .select("cargo, ativo")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (colaborador?.ativo && colaborador.cargo !== "administrativo") {
      if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "Área administrativa não autorizada para este perfil." }, { status: 403 });
      return NextResponse.redirect(new URL(`/colaboradores/${colaborador.cargo}`, request.url));
    }
  }

  if (pathname.startsWith("/colaboradores") && !pathname.startsWith("/colaboradores/login")) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.redirect(new URL("/colaboradores/login", request.url));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
          remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: "", ...options }); },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/colaboradores/login", request.url));
  }

  // --- Área da cliente: exige cookie de sessão válido (CPF + nascimento) ---
  if (pathname.startsWith("/agenda")) {
    const token = request.cookies.get(CLIENTE_COOKIE_NAME)?.value;
    const payload = await verificarTokenSessao(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/agenda/:path*", "/colaboradores/:path*"],
};
