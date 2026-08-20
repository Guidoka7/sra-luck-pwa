import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { acao, observacoes, valor } = body as { acao?: string; observacoes?: string; valor?: number | string };

  // Edição direta do valor da parcela (não mexe no status do boleto).
  if (valor !== undefined) {
    const valorNumero = Number(valor);
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      return NextResponse.json({ erro: "Valor inválido." }, { status: 400 });
    }

    const { data: boletoAtual } = await supabase
      .from("boletos")
      .select("id, cliente_id, numero_parcela, valor")
      .eq("id", params.id)
      .single();

    if (!boletoAtual) return NextResponse.json({ erro: "Boleto não encontrado." }, { status: 404 });

    const { data, error } = await supabase
      .from("boletos")
      .update({ valor: valorNumero })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

    await supabase.from("logs_alteracoes").insert({
      usuario: user.email ?? "admin",
      acao: "editou_valor_parcela",
      entidade: "boleto",
      entidade_id: params.id,
      detalhes: {
        cliente_id: boletoAtual.cliente_id,
        numero_parcela: boletoAtual.numero_parcela,
        de: Number(boletoAtual.valor),
        para: valorNumero,
      },
    });

    return NextResponse.json({ boleto: { ...data, valor: Number(data.valor) } });
  }

  if (!acao || !["confirmar", "rejeitar"].includes(acao)) {
    return NextResponse.json({ erro: "Ação inválida. Use 'confirmar' ou 'rejeitar'." }, { status: 400 });
  }

  const { data: boleto } = await supabase
    .from("boletos")
    .select("id, cliente_id, numero_parcela, status")
    .eq("id", params.id)
    .single();

  if (!boleto) return NextResponse.json({ erro: "Boleto não encontrado." }, { status: 404 });

  const novoStatus = acao === "confirmar" ? "pago" : "rejeitado";
  const dataPagamento = acao === "confirmar" ? new Date().toISOString().slice(0, 10) : null;

  const { data, error } = await supabase
    .from("boletos")
    .update({
      status: novoStatus,
      data_pagamento: dataPagamento,
      observacoes: observacoes || null,
    })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: acao === "confirmar" ? "confirmou_pagamento" : "rejeitou_pagamento",
    entidade: "boleto",
    entidade_id: params.id,
    detalhes: { cliente_id: boleto.cliente_id, numero_parcela: boleto.numero_parcela },
  });

  return NextResponse.json({ boleto: { ...data, valor: Number(data.valor) } });
}
