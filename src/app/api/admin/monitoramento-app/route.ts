import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // O monitoramento precisa enxergar também quem ainda nunca abriu o PWA.
  // Por isso a lista-base é a tabela de clientes e os dispositivos entram como complemento.
  const [{ data: clientes, error: erroClientes }, { data: dispositivosBrutos, error: erroDispositivos }] = await Promise.all([
    supabase.from("clientes").select("id, nome_completo, cpf, ativo").eq("ativo", true).order("nome_completo", { ascending: true }),
    supabase.from("cliente_app_devices").select(`
      cliente_id, device_key, device_type, display_mode, is_pwa_installed,
      notification_permission, push_active, user_agent, first_access_at,
      last_access_at, pwa_installed_at, notifications_activated_at
    `).order("last_access_at", { ascending: false }),
  ]);

  if (erroClientes) return NextResponse.json({ erro: erroClientes.message }, { status: 500 });
  if (erroDispositivos) return NextResponse.json({ erro: erroDispositivos.message }, { status: 500 });

  type Device = NonNullable<typeof dispositivosBrutos>[number];
  const dispositivos = dispositivosBrutos ?? [];
  const clienteMapa = new Map((clientes ?? []).map((cliente) => [cliente.id, cliente]));

  // Um resumo por cliente usa o dispositivo com acesso mais recente.
  const porCliente = new Map<string, Device>();
  for (const item of dispositivos) {
    if (!clienteMapa.has(item.cliente_id)) continue;
    const atual = porCliente.get(item.cliente_id);
    if (!atual || new Date(item.last_access_at).getTime() > new Date(atual.last_access_at).getTime()) {
      porCliente.set(item.cliente_id, item);
    }
  }

  type Resumo = {
    cliente_id: string;
    cliente: { id: string; nome_completo: string; cpf: string; ativo: boolean };
    device_key: string | null;
    device_type: string | null;
    display_mode: string | null;
    is_pwa_installed: boolean;
    notification_permission: string;
    push_active: boolean;
    first_access_at: string | null;
    last_access_at: string | null;
    pwa_installed_at: string | null;
    notifications_activated_at: string | null;
  };

  const resumo: Resumo[] = (clientes ?? []).map((cliente) => {
    const item = porCliente.get(cliente.id);
    return {
      cliente_id: cliente.id,
      cliente,
      device_key: item?.device_key ?? null,
      device_type: item?.device_type ?? null,
      display_mode: item?.display_mode ?? null,
      is_pwa_installed: Boolean(item?.is_pwa_installed),
      notification_permission: item?.notification_permission ?? "default",
      push_active: Boolean(item?.push_active),
      first_access_at: item?.first_access_at ?? null,
      last_access_at: item?.last_access_at ?? null,
      pwa_installed_at: item?.pwa_installed_at ?? null,
      notifications_activated_at: item?.notifications_activated_at ?? null,
    };
  });

  const monitoradas = resumo.length;
  const pwaInstalado = resumo.filter((x) => x.is_pwa_installed).length;
  const notificacoesAtivas = resumo.filter((x) => x.notification_permission === "granted" && x.push_active).length;
  const notificacoesBloqueadas = resumo.filter((x) => x.notification_permission === "denied").length;
  const acessoWeb = resumo.filter((x) => x.display_mode === "browser").length;

  return NextResponse.json({
    dispositivos,
    resumo,
    metricas: {
      clientesMonitoradas: monitoradas,
      pwaInstalado,
      pwaNaoInstalado: Math.max(0, monitoradas - pwaInstalado),
      notificacoesAtivas,
      notificacoesNaoAtivadas: Math.max(0, monitoradas - notificacoesAtivas),
      notificacoesBloqueadas,
      acessoWeb,
    },
  });
}
