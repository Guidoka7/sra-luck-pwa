import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("cliente_app_devices")
    .select(`
      cliente_id, device_key, device_type, display_mode, is_pwa_installed,
      notification_permission, push_active, user_agent, first_access_at,
      last_access_at, pwa_installed_at, notifications_activated_at
    `)
    .order("last_access_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const ids = [...new Set((data ?? []).map((item) => item.cliente_id))];
  const { data: clientes, error: erroClientes } = ids.length
    ? await supabase.from("clientes").select("id, nome_completo, cpf, ativo").in("id", ids)
    : { data: [], error: null };
  if (erroClientes) return NextResponse.json({ erro: erroClientes.message }, { status: 500 });

  const mapa = new Map((clientes ?? []).map((cliente) => [cliente.id, cliente]));
  const dispositivos = (data ?? []).map((item) => ({ ...item, cliente: mapa.get(item.cliente_id) ?? null }));

  const porCliente = new Map<string, typeof dispositivos[number]>();
  for (const item of dispositivos) {
    const atual = porCliente.get(item.cliente_id);
    if (!atual || new Date(item.last_access_at).getTime() > new Date(atual.last_access_at).getTime()) porCliente.set(item.cliente_id, item);
  }
  const resumo = [...porCliente.values()];

  return NextResponse.json({
    dispositivos,
    resumo,
    metricas: {
      clientesMonitoradas: resumo.length,
      pwaInstalado: resumo.filter((x) => x.is_pwa_installed).length,
      notificacoesAtivas: resumo.filter((x) => x.notification_permission === "granted" && x.push_active).length,
      notificacoesBloqueadas: resumo.filter((x) => x.notification_permission === "denied").length,
      acessoWeb: resumo.filter((x) => x.display_mode === "browser").length,
    },
  });
}
