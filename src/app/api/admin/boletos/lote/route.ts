import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Confirma/rejeita vários boletos em uma única requisição.
 * Mantém um log por boleto, mas elimina dezenas de round-trips HTTP do painel.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0) : [];
  const acao = body.acao;

  if (!ids.length || ids.length > 500) {
    return NextResponse.json({ erro: "Selecione entre 1 e 500 parcelas." }, { status: 400 });
  }
  if (acao !== "confirmar" && acao !== "rejeitar") {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }

  const novoStatus = acao === "confirmar" ? "pago" : "rejeitado";
  const dataPagamento = acao === "confirmar" ? new Date().toISOString().slice(0, 10) : null;

  const { data: boletos, error: erroBusca } = await supabase
    .from("boletos")
    .select("id, cliente_id, numero_parcela")
    .in("id", ids);

  if (erroBusca) return NextResponse.json({ erro: erroBusca.message }, { status: 500 });

  const { data: atualizados, error } = await supabase
    .from("boletos")
    .update({ status: novoStatus, data_pagamento: dataPagamento })
    .in("id", ids)
    .select("id, cliente_id, numero_parcela, valor, status, data_pagamento");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const logs = (boletos ?? []).map((boleto) => ({
    usuario: user.email ?? "admin",
    acao: acao === "confirmar" ? "confirmou_pagamento" : "rejeitou_pagamento",
    entidade: "boleto",
    entidade_id: boleto.id,
    detalhes: { cliente_id: boleto.cliente_id, numero_parcela: boleto.numero_parcela },
  }));

  if (logs.length) await supabase.from("logs_alteracoes").insert(logs);

  return NextResponse.json({ boletos: atualizados ?? [], total: atualizados?.length ?? 0 });
}
