import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Agenda paralela à agenda de termos cirúrgicos: mostra, por dia, quanto a
// empresa previu pagar (liberação financeira) às clientes que assinaram os
// termos e já receberam uma data de previsão. Também lista as assinaturas
// confirmadas que AINDA NÃO têm uma previsão definida — pra o admin
// preencher assim que informar a cliente no dia da assinatura.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ano = Number(searchParams.get("ano"));
  const mes = Number(searchParams.get("mes"));

  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const proximoMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

  const { data: config } = await supabase
    .from("configuracoes")
    .select("meta_orcamento_mensal")
    .eq("id", 1)
    .single();

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(
      "id, valor_contrato, previsao_liberacao_financeira, clientes(id, nome_completo), datas(data)"
    )
    .eq("status", "confirmado");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  type Linha = {
    agendamentoId: string;
    clienteId: string | null;
    nome: string;
    valor: number;
    dataTermos: string | null;
  };

  const comPrevisaoNoMes = new Map<string, Linha[]>();
  const semPrevisao: (Linha & { previsaoSugerida: null })[] = [];
  // Lista completa de clientes com assinatura confirmada — independentemente
  // de já terem ou não uma previsão — para o seletor de "cadastrar/alterar
  // previsão" no admin. Cadastro e alteração usam o mesmo fluxo: se a
  // cliente já tem uma data, ela aparece pré-preenchida para edição.
  const todosClientes: { agendamentoId: string; clienteId: string | null; nome: string; previsaoAtual: string | null }[] = [];
  let totalPrevistoMes = 0;

  for (const item of agendamentos ?? []) {
    const linha: Linha = {
      agendamentoId: item.id,
      clienteId: (item as any).clientes?.id ?? null,
      nome: (item as any).clientes?.nome_completo ?? "Cliente",
      valor: Number(item.valor_contrato),
      dataTermos: (item as any).datas?.data ?? null,
    };

    todosClientes.push({
      agendamentoId: linha.agendamentoId,
      clienteId: linha.clienteId,
      nome: linha.nome,
      previsaoAtual: (item.previsao_liberacao_financeira as string | null) ?? null,
    });

    if (!item.previsao_liberacao_financeira) {
      semPrevisao.push({ ...linha, previsaoSugerida: null });
      continue;
    }

    const data = item.previsao_liberacao_financeira as string;
    if (data >= inicioMes && data < proximoMes) {
      totalPrevistoMes += linha.valor;
      const lista = comPrevisaoNoMes.get(data) ?? [];
      lista.push(linha);
      comPrevisaoNoMes.set(data, lista);
    }
  }

  todosClientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const diasComPrevisao = Array.from(comPrevisaoNoMes.entries())
    .map(([data, clientes]) => ({
      data,
      valorTotal: clientes.reduce((soma, c) => soma + c.valor, 0),
      clientes,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  // Assinaturas aguardando previsão, ordenadas pela data dos termos (mais
  // antigas primeiro — são as mais urgentes de preencher).
  semPrevisao.sort((a, b) => (a.dataTermos ?? "").localeCompare(b.dataTermos ?? ""));

  return NextResponse.json({
    meta: config?.meta_orcamento_mensal ?? 100000,
    totalPrevistoMes,
    diasComPrevisao,
    semPrevisao,
    todosClientes,
  });
}
