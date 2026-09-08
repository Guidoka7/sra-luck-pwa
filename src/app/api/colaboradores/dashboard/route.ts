import { NextResponse } from "next/server";
import { fimMesExclusivoSaoPaulo, getColaboradorSessao, inicioMesSaoPaulo } from "@/lib/colaboradores";

function erroSessao(motivo: string) {
  if (motivo === "configuracao_ausente") return NextResponse.json({ erro: "Integração Supabase não configurada neste ambiente." }, { status: 503 });
  if (motivo === "nao_autenticado") return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (motivo === "migration_pendente") return NextResponse.json({ erro: "A migration de colaboradores ainda não foi aplicada no Supabase." }, { status: 503 });
  return NextResponse.json({ erro: "Perfil de colaborador não encontrado ou inativo." }, { status: 403 });
}

function soma(items: Array<{ valor: number | string | null }>) {
  return items.reduce((total, item) => total + Number(item.valor ?? 0), 0);
}

export async function GET() {
  const sessao = await getColaboradorSessao();
  if (!sessao.colaborador || !sessao.service) return erroSessao(sessao.motivo ?? "sem_acesso");
  const { colaborador, service } = sessao;
  const inicio = inicioMesSaoPaulo();
  const fim = fimMesExclusivoSaoPaulo();
  const { data: mensagens } = await service.from("mensagens_motivacionais").select("id, titulo, mensagem, cargo, programada_para").eq("ativo", true).or(`cargo.is.null,cargo.eq.${colaborador.cargo}`).or(`programada_para.is.null,programada_para.lte.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(1);
  const mensagemDiaria = mensagens?.[0] ?? null;

  if (colaborador.cargo === "vendedora") {
    const [clientesRes, vendasRes, comissoesRes] = await Promise.all([
      service.from("clientes").select("id, nome_completo, created_at, status_financeiro").eq("vendedora_id", colaborador.id).order("created_at", { ascending: false }),
      service.from("novas_vendas").select("id, nome_completo, cliente_id, data_venda, valor_contrato, status").eq("vendedora_id", colaborador.id).order("data_venda", { ascending: false }),
      service.from("comissoes").select("id, cliente_id, evento, valor, status, created_at").eq("colaborador_id", colaborador.id).eq("cargo", "vendedora").order("created_at", { ascending: false }),
    ]);
    if (clientesRes.error || vendasRes.error || comissoesRes.error) return NextResponse.json({ erro: clientesRes.error?.message ?? vendasRes.error?.message ?? comissoesRes.error?.message }, { status: 503 });
    const clientes = (clientesRes.data ?? []) as Array<{ id: string; nome_completo: string; created_at: string; status_financeiro: string }>;
    const ids = clientes.map((cliente) => cliente.id);
    const [boletosRes, comissoesMesRes] = await Promise.all([
      ids.length ? service.from("boletos").select("id, cliente_id, numero_parcela, status").eq("numero_parcela", 1).in("cliente_id", ids) : Promise.resolve({ data: [], error: null }),
      service.from("comissoes").select("valor, status, evento").eq("colaborador_id", colaborador.id).gte("created_at", `${inicio}T00:00:00-03:00`).lt("created_at", `${fim}T00:00:00-03:00`),
    ]);
    if (boletosRes.error || comissoesMesRes.error) return NextResponse.json({ erro: boletosRes.error?.message ?? comissoesMesRes.error?.message }, { status: 503 });
    const boletos = (boletosRes.data ?? []) as Array<{ cliente_id: string; status: string }>;
    const comissoes = (comissoesRes.data ?? []) as Array<{ id: string; cliente_id: string | null; evento: string; valor: number; status: string; created_at: string }>;
    const porCliente = new Map(comissoes.map((comissao) => [comissao.cliente_id ?? "", comissao]));
    const primeiraParcela = new Map(boletos.map((boleto) => [boleto.cliente_id, boleto.status]));
    const clientesLista = clientes.map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome_completo,
      primeiraParcela: primeiraParcela.get(cliente.id) ?? "nao_pago",
      comissao: porCliente.get(cliente.id)?.status ?? "pendente",
    }));
    const mes = comissoesMesRes.data ?? [];
    const total = soma(comissoes);
    return NextResponse.json({
      perfil: colaborador.cargo,
      colaborador,
      atualizadoEm: new Date().toISOString(),
      mensagemDiaria,
      dados: {
        ganhos: { mes: soma(mes), total, pendente: soma(comissoes.filter((item) => item.status === "pendente")), paga: soma(comissoes.filter((item) => item.status === "paga")), clientesPrimeiraParcela: comissoes.filter((item) => item.evento === "primeira_parcela_confirmada").length },
        vendas: { clientesVinculadas: clientes.length, contratosIdentificados: ((vendasRes.data ?? []) as Array<{ cliente_id: string | null }>).filter((venda) => venda.cliente_id).length, naoFecharam: null, conversao: null, fonteNaoRegistraNaoConvertidas: true },
        clientes: clientesLista,
        vendasRecentes: vendasRes.data ?? [],
      },
    });
  }

  if (colaborador.cargo === "sdr") {
    const [agendamentosRes, comissoesRes, metaRes] = await Promise.all([
      service.from("agendamentos").select("id, cliente_id, comparecimento_status, created_at, datas(data), clientes(nome_completo)").eq("sdr_id", colaborador.id).order("created_at", { ascending: false }),
      service.from("comissoes").select("valor, status, created_at").eq("colaborador_id", colaborador.id).eq("cargo", "sdr").order("created_at", { ascending: false }),
      service.from("metas_colaboradores").select("meta_minima, ano, mes").eq("colaborador_id", colaborador.id).eq("ano", Number(inicio.slice(0, 4))).eq("mes", Number(inicio.slice(5, 7))).maybeSingle(),
    ]);
    if (agendamentosRes.error || comissoesRes.error || metaRes.error) return NextResponse.json({ erro: agendamentosRes.error?.message ?? comissoesRes.error?.message ?? metaRes.error?.message }, { status: 503 });
    const agendamentos = (agendamentosRes.data ?? []) as Array<{ id: string; comparecimento_status: string | null; created_at: string; datas: { data?: string } | null; clientes: { nome_completo?: string } | null }>;
    const comissoes = (comissoesRes.data ?? []) as Array<{ valor: number; status: string; created_at: string }>;
    return NextResponse.json({ perfil: colaborador.cargo, colaborador, atualizadoEm: new Date().toISOString(), mensagemDiaria, dados: {
      agendamentos: { total: agendamentos.length, compareceram: agendamentos.filter((item) => item.comparecimento_status === "compareceu").length, naoCompareceram: agendamentos.filter((item) => item.comparecimento_status === "nao_compareceu").length, pendentes: agendamentos.filter((item) => !item.comparecimento_status || item.comparecimento_status === "pendente").length },
      comissao: { mes: soma(comissoes.filter((item) => item.created_at >= `${inicio}T00:00:00-03:00` && item.created_at < `${fim}T00:00:00-03:00`)), total: soma(comissoes), pendente: soma(comissoes.filter((item) => item.status === "pendente")) },
      meta: { mensal: Number(metaRes.data?.meta_minima ?? 0), configurada: Boolean(metaRes.data) },
      agenda: agendamentos.slice(0, 12).map((item) => ({ id: item.id, nome: (item.clientes as { nome_completo?: string } | null)?.nome_completo ?? "Cliente", data: (item.datas as { data?: string } | null)?.data ?? null, comparecimento: item.comparecimento_status ?? "pendente" })),
    } });
  }

  if (colaborador.cargo === "financeiro") {
    const [pagamentosRes, metaRes] = await Promise.all([
      service.from("boletos").select("valor, data_pagamento, cliente_id").eq("status", "pago").gte("data_pagamento", inicio).lt("data_pagamento", fim),
      service.from("metas_colaboradores").select("meta_minima, percentual_comissao, comissao_estimada, comissao_final, ano, mes").eq("colaborador_id", colaborador.id).eq("ano", Number(inicio.slice(0, 4))).eq("mes", Number(inicio.slice(5, 7))).maybeSingle(),
    ]);
    if (pagamentosRes.error || metaRes.error) return NextResponse.json({ erro: pagamentosRes.error?.message ?? metaRes.error?.message }, { status: 503 });
    const valorRecuperado = soma(pagamentosRes.data ?? []);
    return NextResponse.json({ perfil: colaborador.cargo, colaborador, atualizadoEm: new Date().toISOString(), mensagemDiaria, dados: {
      resultado: { mes: valorRecuperado, pagamentosConfirmados: (pagamentosRes.data ?? []).length },
      meta: { minima: Number(metaRes.data?.meta_minima ?? 0), atingido: valorRecuperado, percentual: metaRes.data?.percentual_comissao == null ? null : Number(metaRes.data.percentual_comissao) },
      comissao: { estimada: metaRes.data?.comissao_estimada == null ? null : Number(metaRes.data.comissao_estimada), final: metaRes.data?.comissao_final == null ? null : Number(metaRes.data.comissao_final), formulaDefinida: false },
      historico: [],
    } });
  }

  return NextResponse.json({ erro: "Perfil administrativo não possui dashboard de colaborador." }, { status: 403 });
}