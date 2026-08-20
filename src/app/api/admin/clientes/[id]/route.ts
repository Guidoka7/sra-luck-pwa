import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CAMPO_LABEL: Record<string, string> = {
  nome_completo: "Nome completo",
  telefone: "Telefone",
  email: "E-mail",
  procedimento: "Procedimento",
  medico: "Médico",
  hospital: "Hospital",
  consultora: "Consultora",
  valor_contrato: "Valor do contrato",
  taxa_administrativa_percentual: "Taxa administrativa (%)",
  status_cirurgia: "Status da cirurgia",
  status_financeiro: "Status financeiro",
  ativo: "Ativa",
  observacoes_internas: "Observações",
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 404 });

  const { data: historico } = await supabase
    .from("logs_alteracoes")
    .select("*")
    .eq("entidade", "clientes")
    .eq("entidade_id", params.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ cliente, historico: historico ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const atualizacoes: Record<string, unknown> = {};
  if (body.nomeCompleto !== undefined) atualizacoes.nome_completo = body.nomeCompleto;
  if (body.telefone !== undefined) atualizacoes.telefone = body.telefone || null;
  if (body.email !== undefined) atualizacoes.email = body.email || null;
  if (body.procedimento !== undefined) atualizacoes.procedimento = body.procedimento || null;
  if (body.medico !== undefined) atualizacoes.medico = body.medico || null;
  if (body.hospital !== undefined) atualizacoes.hospital = body.hospital || null;
  if (body.consultora !== undefined) atualizacoes.consultora = body.consultora || null;
  if (body.valorContrato !== undefined) atualizacoes.valor_contrato = Number(body.valorContrato) || 0;
  if (body.taxaAdministrativaPercentual !== undefined) {
    const taxa = Number(body.taxaAdministrativaPercentual);
    if (!Number.isFinite(taxa) || taxa < 0) {
      return NextResponse.json({ erro: "Taxa administrativa inválida." }, { status: 400 });
    }
    atualizacoes.taxa_administrativa_percentual = taxa;
  }
  if (body.statusCirurgia !== undefined) atualizacoes.status_cirurgia = body.statusCirurgia;
  if (body.statusFinanceiro !== undefined) atualizacoes.status_financeiro = body.statusFinanceiro;
  if (body.ativo !== undefined) atualizacoes.ativo = body.ativo;
  if (body.observacoes !== undefined) atualizacoes.observacoes_internas = body.observacoes || null;

  if (Object.keys(atualizacoes).length === 0) {
    return NextResponse.json({ erro: "Nenhuma alteração informada." }, { status: 400 });
  }

  // busca o estado anterior para registrar um histórico campo a campo
  const { data: anterior } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", params.id)
    .single();

  const { data, error } = await supabase
    .from("clientes")
    .update(atualizacoes)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  const alteracoes = Object.keys(atualizacoes)
    .filter((campo) => !anterior || anterior[campo] !== atualizacoes[campo])
    .map((campo) => ({
      campo: CAMPO_LABEL[campo] ?? campo,
      de: anterior ? anterior[campo] : null,
      para: atualizacoes[campo],
    }));

  if (alteracoes.length > 0) {
    await supabase.from("logs_alteracoes").insert({
      usuario: user.email ?? "admin",
      acao: "editou_cliente",
      entidade: "clientes",
      entidade_id: params.id,
      detalhes: { cliente: data.nome_completo, alteracoes },
    });
  }

  return NextResponse.json({ cliente: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome_completo")
    .eq("id", params.id)
    .single();

  const { error } = await supabase.from("clientes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  await supabase.from("logs_alteracoes").insert({
    usuario: user.email ?? "admin",
    acao: "removeu_cliente",
    entidade: "clientes",
    entidade_id: params.id,
    detalhes: { cliente: cliente?.nome_completo ?? null },
  });

  return NextResponse.json({ ok: true });
}
