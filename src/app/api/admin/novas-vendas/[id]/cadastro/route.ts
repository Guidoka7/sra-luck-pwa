import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { apenasDigitos, cpfValido } from "@/lib/cpf";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data: venda, error: vendaError } = await supabase.from("novas_vendas").select("*").eq("id", params.id).single();
  if (vendaError || !venda) return NextResponse.json({ erro: "Nova venda não encontrada." }, { status: 404 });
  if (venda.cliente_id) return NextResponse.json({ clienteId: venda.cliente_id, status: "aguardando_boletos" });

  const cpf = apenasDigitos(body.cpf ?? venda.cpf ?? "");
  const nascimento = body.dataNascimento;
  if (!venda.nome_completo || !cpf || !nascimento) return NextResponse.json({ erro: "Nome, CPF e data de nascimento são obrigatórios." }, { status: 400 });
  if (!cpfValido(cpf)) return NextResponse.json({ erro: "CPF inválido." }, { status: 400 });

  const { data: existente } = await supabase.from("clientes").select("id, nome_completo").eq("cpf", cpf).maybeSingle();
  if (existente) return NextResponse.json({ erro: `Já existe uma cliente cadastrada com este CPF (${existente.nome_completo}).` }, { status: 409 });

  const quantidade = venda.quantidade_parcelas && [12, 18, 24, 36, 48, 60, 72].includes(venda.quantidade_parcelas) ? venda.quantidade_parcelas : null;
  const taxa = venda.taxa_administrativa == null ? 0 : Number(venda.taxa_administrativa);
  const { data: cliente, error } = await supabase.from("clientes").insert({
    nome_completo: venda.nome_completo,
    cpf,
    data_nascimento: nascimento,
    telefone: body.telefone ?? venda.telefone ?? null,
    email: body.email ?? venda.email ?? null,
    consultora: body.vendedoraResponsavel ?? venda.vendedora_responsavel ?? null,
    valor_contrato: Number(venda.valor_contrato) || 0,
    taxa_administrativa_percentual: taxa,
    quantidade_parcelas: quantidade,
    observacoes_internas: `Origem: ${venda.origem_venda ?? "RD Station"}. ID RD Station: ${venda.rd_station_id}`,
    status_cirurgia: "nao_agendada",
    status_financeiro: "a_pagar",
    ativo: true,
  }).select("*").single();
  if (error) return NextResponse.json({ erro: error.code === "23505" ? "Já existe uma cliente cadastrada com este CPF." : error.message }, { status: 400 });

  const { error: updateError } = await supabase.from("novas_vendas").update({ cliente_id: cliente.id, cpf, status: "aguardando_boletos" }).eq("id", params.id);
  if (updateError) return NextResponse.json({ erro: updateError.message }, { status: 500 });
  await supabase.from("logs_alteracoes").insert({ usuario: user.email ?? "admin", acao: "converteu_nova_venda_em_cliente", entidade: "novas_vendas", entidade_id: params.id, detalhes: { cliente_id: cliente.id, rd_station_id: venda.rd_station_id } });
  return NextResponse.json({ clienteId: cliente.id, status: "aguardando_boletos" });
}
