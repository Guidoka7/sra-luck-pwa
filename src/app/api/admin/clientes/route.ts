import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { apenasDigitos, cpfValido } from "@/lib/cpf";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabase
    .from("clientes")
    .select(`
      id, nome_completo, cpf, data_nascimento, telefone, email, procedimento,
      medico, hospital, consultora, valor_contrato, status_cirurgia,
      status_financeiro, observacoes_internas, quantidade_parcelas,
      status_revisao_financeira, data_atingiu_percentual,
      observacao_revisao_financeira, ativo, created_at, updated_at
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Status financeiro real: calculado a partir das parcelas (boletos) pagas,
  // não do campo manual. O campo manual só serve de fallback pra clientes
  // que ainda não tiveram boletos gerados.
  const { data: boletos, error: erroBoletos } = await supabase
    .from("boletos")
    .select("cliente_id, status");

  if (erroBoletos) return NextResponse.json({ erro: erroBoletos.message }, { status: 500 });

  const resumoPorCliente = new Map<string, { total: number; pagos: number }>();
  for (const b of boletos ?? []) {
    const atual = resumoPorCliente.get(b.cliente_id) ?? { total: 0, pagos: 0 };
    atual.total += 1;
    if (b.status === "pago") atual.pagos += 1;
    resumoPorCliente.set(b.cliente_id, atual);
  }

  const clientesComPagamento = (data ?? []).map((cliente) => {
    const resumo = resumoPorCliente.get(cliente.id);
    const porcentagemPagamento =
      resumo && resumo.total > 0 ? Math.round((resumo.pagos / resumo.total) * 1000) / 10 : null;
    return {
      ...cliente,
      porcentagem_pagamento: porcentagemPagamento,
      parcelas_pagas: resumo?.pagos ?? null,
      parcelas_total: resumo?.total ?? null,
    };
  });

  return NextResponse.json({ clientes: clientesComPagamento });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const cpf = apenasDigitos(body.cpf ?? "");

  if (!body.nomeCompleto || !cpf || !body.dataNascimento) {
    return NextResponse.json({ erro: "Nome, CPF e data de nascimento são obrigatórios." }, { status: 400 });
  }
  if (!cpfValido(cpf)) {
    return NextResponse.json({ erro: "CPF inválido." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome_completo: body.nomeCompleto,
      cpf,
      data_nascimento: body.dataNascimento,
      telefone: body.telefone || null,
      email: body.email || null,
      procedimento: body.procedimento || null,
      medico: body.medico || null,
      hospital: body.hospital || null,
      consultora: body.consultora || null,
      valor_contrato: Number(body.valorContrato) || 0,
      status_cirurgia: body.statusCirurgia || "nao_agendada",
      status_financeiro: body.statusFinanceiro || "a_pagar",
      observacoes_internas: body.observacoes || null,
    })
    .select("*")
    .single();

  if (error) {
    const mensagem = error.code === "23505" ? "Já existe uma cliente cadastrada com esse CPF." : error.message;
    return NextResponse.json({ erro: mensagem }, { status: 400 });
  }

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: "cadastrou_cliente",
    entidade: "clientes",
    entidade_id: data.id,
    detalhes: { nome: data.nome_completo },
  });

  return NextResponse.json({ cliente: data });
}
