import { NextRequest, NextResponse } from "next/server";
import { getAdminOperator } from "@/lib/admin-access";

export async function GET() {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const [colaboradores, clientes, vendas, agendamentos] = await Promise.all([
    sessao.service!.from("colaboradores").select("id, nome, cargo, ativo").eq("ativo", true).in("cargo", ["vendedora", "sdr"]).order("nome"),
    sessao.service!.from("clientes").select("id, nome_completo, consultora, vendedora_id").eq("ativo", true).order("nome_completo"),
    sessao.service!.from("novas_vendas").select("id, nome_completo, vendedora_responsavel, vendedora_id, cliente_id, data_venda").order("data_venda", { ascending: false }).limit(100),
    sessao.service!.from("agendamentos").select("id, sdr_id, comparecimento_status, datas(data), clientes(nome_completo)").eq("status", "confirmado").order("created_at", { ascending: false }).limit(100),
  ]);
  const error = colaboradores.error ?? clientes.error ?? vendas.error ?? agendamentos.error;
  if (error) return NextResponse.json({ erro: error.message }, { status: 503 });
  return NextResponse.json({ colaboradores: colaboradores.data ?? [], clientes: clientes.data ?? [], vendas: vendas.data ?? [], agendamentos: agendamentos.data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const sessao = await getAdminOperator();
  if (sessao.error) return NextResponse.json({ erro: "Acesso não autorizado." }, { status: sessao.error === "nao_autenticado" ? 401 : 403 });
  const body = await req.json().catch(() => ({}));
  const tipo = String(body.tipo ?? "");
  const registroId = String(body.registroId ?? "");
  const colaboradorId = body.colaboradorId ? String(body.colaboradorId) : null;
  if (!registroId || !["cliente", "venda", "agendamento"].includes(tipo)) return NextResponse.json({ erro: "Vínculo inválido." }, { status: 400 });
  let cargoEsperado = tipo === "agendamento" ? "sdr" : "vendedora";
  if (colaboradorId) {
    const { data: colaborador } = await sessao.service!.from("colaboradores").select("id, cargo, ativo").eq("id", colaboradorId).maybeSingle();
    if (!colaborador?.ativo || colaborador.cargo !== cargoEsperado) return NextResponse.json({ erro: `Selecione um perfil ${cargoEsperado} ativo.` }, { status: 400 });
  }
  const tabela = tipo === "cliente" ? "clientes" : tipo === "venda" ? "novas_vendas" : "agendamentos";
  const campo = tipo === "agendamento" ? "sdr_id" : "vendedora_id";
  const { data, error } = await sessao.service!.from(tabela).update({ [campo]: colaboradorId }).eq("id", registroId).select("id").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ vinculo: { tipo, registroId: data.id, colaboradorId } });
}