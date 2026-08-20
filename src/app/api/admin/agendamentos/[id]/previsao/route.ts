import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { enviarWebPushParaCliente } from "@/lib/webPush";
import { formatarDataLonga } from "@/lib/utils";

// Canal do Supabase Realtime (Broadcast) por cliente. O app da cliente e o
// simulador de iPhone escutam nesse mesmo canal pra receber a notificação
// na hora, sem precisar de refresh — ver CentralNotificacoes.tsx e
// public/simulador-iphone.html.
function canalNotificacoesCliente(clienteId: string) {
  return `notificacoes-cliente:${clienteId}`;
}

const ACOES_PREVISAO = [
  "definiu_previsao_liberacao_financeira",
  "alterou_previsao_liberacao_financeira",
] as const;

// Define (ou edita) a previsão de liberação financeira de um agendamento —
// a data informada à cliente, no ato da assinatura dos termos, de quando a
// empresa fará o pagamento da cirurgia dela.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { previsaoLiberacaoFinanceira } = body as { previsaoLiberacaoFinanceira?: string | null };

  const { data: agendamento } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, previsao_liberacao_financeira, clientes(nome_completo)")
    .eq("id", params.id)
    .single();

  if (!agendamento) return NextResponse.json({ erro: "Agendamento não encontrado." }, { status: 404 });

  // Guardamos o valor anterior antes de sobrescrever — é isso que permite
  // registrar "data anterior → nova data" na auditoria, e não só o estado final.
  const dataAnterior = (agendamento as any).previsao_liberacao_financeira ?? null;
  const dataNova = previsaoLiberacaoFinanceira || null;

  const { data, error } = await supabase
    .from("agendamentos")
    .update({ previsao_liberacao_financeira: dataNova })
    .eq("id", params.id)
    .select("id, previsao_liberacao_financeira")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const alteradoEm = new Date().toISOString();

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: dataAnterior ? "alterou_previsao_liberacao_financeira" : "definiu_previsao_liberacao_financeira",
    entidade: "agendamentos",
    entidade_id: params.id,
    detalhes: {
      cliente: (agendamento as any).clientes?.nome_completo,
      data_anterior: dataAnterior,
      data_nova: dataNova,
      alterado_em: alteradoEm,
    },
  });

  // Notificação automática pra cliente na central de notificações do app —
  // só quando de fato houve uma data nova definida (não dispara ao limpar
  // uma previsão, nem quando o valor salvo é igual ao anterior).
  if (dataNova && dataNova !== dataAnterior) {
    const dataFormatada = formatarDataLonga(dataNova);
    const clienteId = (agendamento as any).cliente_id as string;

    const { data: notificacao, error: erroNotificacao } = await supabase
      .from("notificacoes_cliente")
      .insert({
        cliente_id: clienteId,
        tipo: dataAnterior ? "previsao_atualizada" : "previsao_criada",
        titulo: dataAnterior ? "Previsão de liberação atualizada" : "Nova etapa da sua jornada",
        mensagem: dataAnterior
          ? `Sua previsão de liberação financeira foi atualizada para ${dataFormatada}.`
          : `Sua previsão de liberação financeira foi definida para ${dataFormatada}.`,
        emoji: "🔔",
        destino: "agenda",
        referencia_id: params.id,
      })
      .select("id, tipo, titulo, mensagem, emoji, destino, referencia_id, created_at")
      .single();

    const serviceClient = createServiceSupabaseClient();
    if (!erroNotificacao && notificacao) {
      await serviceClient.from("notificacao_logs").insert({
        cliente_id: clienteId,
        notificacao_id: notificacao.id,
        referencia_id: params.id,
        tipo: notificacao.tipo,
        titulo: notificacao.titulo,
        corpo: notificacao.mensagem,
        status: "enviada",
      });
    }

    // Publica no canal Realtime (Broadcast) da cliente pra quem estiver com
    // o app aberto — ou o simulador de iPhone escutando esse cliente_id —
    // ver a Dynamic Island/notificação aparecer na hora, sem refresh. Usa
    // o client service_role: broadcast não depende de sessão nem de RLS, e
    // assim funciona mesmo que a inserção acima já tenha usado a sessão do
    // admin. Uma falha aqui não deve derrubar o cadastro da previsão em si
    // (a notificação já foi salva e aparecerá no próximo polling/login).
    if (!erroNotificacao && notificacao) {
      try {
        await serviceClient.channel(canalNotificacoesCliente(clienteId)).send({
          type: "broadcast",
          event: "nova_notificacao",
          payload: notificacao,
        });
      } catch (erro) {
        console.error("Falha ao publicar notificação em tempo real:", erro);
      }
      let push = { enviadas: 0, falhas: 0, removidas: 0 };
      try {
        push = await enviarWebPushParaCliente(serviceClient, clienteId, {
          title: notificacao.titulo,
          body: notificacao.mensagem,
          icon: "/icons/sra-luck-192.png",
          badge: "/icons/sra-luck-192.png",
          url: "/agenda",
          tag: `previsao-${notificacao.id}`,
          notificationId: notificacao.id,
        });
      } catch (erro) {
        console.error("Falha ao enviar Web Push da previsão:", erro);
      }
      await serviceClient.from("notificacao_logs").update({
        push_enviadas: push.enviadas,
        push_falhas: push.falhas,
        push_status: push.enviadas > 0 ? "enviada" : "sem_dispositivo",
      }).eq("notificacao_id", notificacao.id);
    }
  }

  return NextResponse.json({ agendamento: data, dataAnterior, dataNova, alteradoEm });
}

// Histórico de cadastro/alteração da previsão de liberação financeira desse
// agendamento — usado no painel do admin para mostrar "data anterior, nova
// data e quando foi alterado" sem precisar de uma tela de auditoria à parte.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("logs_alteracoes")
    .select("id, usuario, acao, detalhes, created_at")
    .eq("entidade", "agendamentos")
    .eq("entidade_id", params.id)
    .in("acao", ACOES_PREVISAO)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const historico = (data ?? []).map((log) => ({
    id: log.id,
    usuario: log.usuario,
    dataAnterior: (log.detalhes as any)?.data_anterior ?? null,
    dataNova: (log.detalhes as any)?.data_nova ?? null,
    alteradoEm: (log.detalhes as any)?.alterado_em ?? log.created_at,
  }));

  return NextResponse.json({ historico });
}
