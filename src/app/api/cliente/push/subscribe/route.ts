import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { verificarTokenSessao, CLIENTE_COOKIE_NAME } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const token = cookies().get(CLIENTE_COOKIE_NAME)?.value;
  const sessao = await verificarTokenSessao(token);
  if (!sessao) return NextResponse.json({ erro: "Sessão da cliente inválida." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ erro: "Assinatura de notificações inválida." }, { status: 400 });
  }

  const service = createServiceSupabaseClient();
  const { error } = await service.from("web_push_subscriptions").upsert({
    cliente_id: sessao.clienteId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: req.headers.get("user-agent"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
