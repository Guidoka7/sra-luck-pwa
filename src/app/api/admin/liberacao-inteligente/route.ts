import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * API para o calendário de liberação financeira.
 *
 * O calendário-base (datas liberadas pela gestão especificamente para
 * liberação financeira, na tabela `datas_liberacao_financeira` — separada
 * da agenda de "Termos cirúrgicos" — + datas já ocupadas por previsões
 * confirmadas) é sempre calculado, com ou sem cliente selecionada.
 *
 * Params:
 * - ano: ano a mostrar (formato YYYY) [obrigatório]
 * - mes: mês a mostrar (formato MM, 1-12) [obrigatório]
 * - agendamento_id: UUID do agendamento da cliente selecionada [opcional]
 *
 * Retorna:
 * - Cliente: informações básicas (null se nenhuma cliente selecionada)
 * - Calendário do mês, com estado por dia:
 *   - "vermelho": data já possui previsão de liberação confirmada (ocupada)
 *   - "cinza": data não foi disponibilizada pela gestão
 *   - "verde": data disponível (dentro do orçamento, quando há cliente selecionada)
 *   - "amarelo": data disponível, mas ultrapassa o orçamento da cliente selecionada
 *   - "passado": data já passou
 * - Melhor data sugerida (apenas com cliente selecionada)
 * - Alternativas (apenas com cliente selecionada)
 */

interface DiaAnalise {
  data: string;
  dia: number;
  estado: "verde" | "amarelo" | "vermelho" | "cinza" | "passado";
  vagasDisponiveis: boolean;
  oracamentoAntes: number;
  oracamentoDepois: number;
  ultrapassagem: number;
  dentroOrcamento: boolean;
  diasDisponibilizados: number;
  ocupante: { nome: string; valor: number } | null;
}

interface AlternativaData {
  data: string;
  dia: number;
  estado: "verde" | "amarelo";
  oracamentoDepois: number;
  ultrapassagem: number;
  motivo: string;
}

interface MelhorData {
  data: string;
  dia: number;
  mes: number;
  ano: number;
  oracamentoMes: number;
  comprometidoAntes: number;
  valorCliente: number;
  totalDepois: number;
  dentroOrcamento: boolean;
  motivo: string;
}

interface ClienteInfo {
  id: string;
  nome: string;
  valor: number;
  status: "apta" | "termos_assinados";
  dataTermos: string | null;
}

interface Calendario {
  ano: number;
  mes: number;
  dias: DiaAnalise[];
}

interface Resposta {
  cliente: ClienteInfo | null;
  erro?: string;
  orcamentoMensal: number;
  calendario: Calendario;
  melhorData: MelhorData | null;
  alternativas: {
    verdes: AlternativaData[];
    amarelas: AlternativaData[];
  };
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agendamentoId = searchParams.get("agendamento_id") || null;
  const ano = Number(searchParams.get("ano"));
  const mes = Number(searchParams.get("mes"));

  if (!ano || !mes) {
    return NextResponse.json(
      { erro: "Parâmetros obrigatórios: ano, mes" },
      { status: 400 }
    );
  }

  // Cliente selecionada é opcional: o calendário-base existe independentemente dela.
  let clienteId: string | null = null;
  let cliente: ClienteInfo | null = null;

  if (agendamentoId) {
    const { data: agendamento, error: erroAgendamento } = await supabase
      .from("agendamentos")
      .select("cliente_id, valor_contrato, clientes(id, nome_completo, valor_contrato), datas(data)")
      .eq("id", agendamentoId)
      .eq("status", "confirmado")
      .single();

    if (erroAgendamento || !agendamento) {
      return NextResponse.json({ erro: "Agendamento não encontrado" }, { status: 404 });
    }

    clienteId = (agendamento as any).cliente_id;
    const dataTermos = (agendamento as any).datas?.data ?? null;
    cliente = {
      id: clienteId!,
      nome: (agendamento as any).clientes?.nome_completo ?? "Cliente",
      valor: Number(agendamento.valor_contrato),
      status: dataTermos ? "termos_assinados" : "apta",
      dataTermos,
    };
  }

  // Buscar configuração de orçamento
  const { data: config } = await supabase
    .from("configuracoes")
    .select("meta_orcamento_mensal")
    .eq("id", 1)
    .single();

  const orcamentoMensal = Number(config?.meta_orcamento_mensal ?? 100000);

  // Janela ampla de busca (cobre a procura pela melhor data em até 24 meses à frente).
  const anoFimBusca = ano + 2;

  // 1) Datas disponibilizadas pela gestão — calendário PRÓPRIO da liberação
  //    financeira (independente do calendário de "Termos cirúrgicos").
  const { data: datasLiberadasTodas } = await supabase
    .from("datas_liberacao_financeira")
    .select("data")
    .eq("status", "disponivel")
    .gte("data", `${ano}-01-01`)
    .lte("data", `${anoFimBusca}-12-31`);
  const datasDisponibilizadas = new Set((datasLiberadasTodas ?? []).map((d) => d.data));

  // 2) Previsões de liberação já confirmadas — essas datas ficam ocupadas (vermelhas).
  const { data: liberacoesConfirmadas } = await supabase
    .from("agendamentos")
    .select("cliente_id, valor_contrato, previsao_liberacao_financeira, clientes(nome_completo)")
    .eq("status", "confirmado")
    .not("previsao_liberacao_financeira", "is", null)
    .gte("previsao_liberacao_financeira", `${ano}-01-01`)
    .lte("previsao_liberacao_financeira", `${anoFimBusca}-12-31`);

  const ocupadas = new Map<string, { nome: string; valor: number; clienteId: string }>();
  const oracamentoPorMes = new Map<string, number>(); // chave: "YYYY-MM"

  for (const item of liberacoesConfirmadas ?? []) {
    const dataOcupada = (item as any).previsao_liberacao_financeira as string | null;
    if (!dataOcupada) continue;

    ocupadas.set(dataOcupada, {
      nome: (item as any).clientes?.nome_completo ?? "Cliente",
      valor: Number(item.valor_contrato),
      clienteId: (item as any).cliente_id,
    });

    // Orçamento já comprometido no mês (exclui a própria cliente selecionada, se houver,
    // para não contar o valor dela duas vezes ao reavaliar a mesma liberação).
    if (!clienteId || (item as any).cliente_id !== clienteId) {
      const chaveMes = dataOcupada.slice(0, 7);
      oracamentoPorMes.set(chaveMes, (oracamentoPorMes.get(chaveMes) ?? 0) + Number(item.valor_contrato));
    }
  }

  const hoje = new Date();
  const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;

  const valorCliente = cliente?.valor ?? 0;

  function analisarMes(anoM: number, mesM: number): DiaAnalise[] {
    const totalDias = new Date(anoM, mesM, 0).getDate();
    const mesStr = String(mesM).padStart(2, "0");
    const chaveMes = `${anoM}-${mesStr}`;
    const oracamentoDoMes = oracamentoPorMes.get(chaveMes) ?? 0;

    const dias: DiaAnalise[] = [];

    for (let dia = 1; dia <= totalDias; dia++) {
      const isoData = `${anoM}-${mesStr}-${String(dia).padStart(2, "0")}`;
      const ePassado = isoData < isoHoje;
      const ocupante = ocupadas.get(isoData);
      const estaDisponibilizada = datasDisponibilizadas.has(isoData);

      const base = {
        data: isoData,
        dia,
        oracamentoAntes: oracamentoDoMes,
        diasDisponibilizados: estaDisponibilizada ? 1 : 0,
      };

      if (ePassado) {
        dias.push({
          ...base,
          estado: "passado",
          vagasDisponiveis: false,
          oracamentoDepois: oracamentoDoMes,
          ultrapassagem: 0,
          dentroOrcamento: true,
          ocupante: ocupante ? { nome: ocupante.nome, valor: ocupante.valor } : null,
        });
        continue;
      }

      if (ocupante) {
        // Data já possui previsão de liberação confirmada: fica ocupada (vermelha),
        // independentemente de orçamento ou de qual cliente está selecionada.
        dias.push({
          ...base,
          estado: "vermelho",
          vagasDisponiveis: false,
          oracamentoDepois: oracamentoDoMes,
          ultrapassagem: 0,
          dentroOrcamento: true,
          ocupante: { nome: ocupante.nome, valor: ocupante.valor },
        });
        continue;
      }

      if (!estaDisponibilizada) {
        dias.push({
          ...base,
          estado: "cinza",
          vagasDisponiveis: false,
          oracamentoDepois: oracamentoDoMes,
          ultrapassagem: 0,
          dentroOrcamento: true,
          ocupante: null,
        });
        continue;
      }

      // Data disponibilizada pela gestão e ainda livre.
      if (!cliente) {
        // Sem cliente selecionada: só existe a informação de disponibilidade.
        dias.push({
          ...base,
          estado: "verde",
          vagasDisponiveis: true,
          oracamentoDepois: oracamentoDoMes,
          ultrapassagem: 0,
          dentroOrcamento: true,
          ocupante: null,
        });
        continue;
      }

      const novoTotal = oracamentoDoMes + valorCliente;
      const ultrapassagem = Math.max(0, novoTotal - orcamentoMensal);
      const dentroOrcamento = novoTotal <= orcamentoMensal;

      dias.push({
        ...base,
        estado: dentroOrcamento ? "verde" : "amarelo",
        vagasDisponiveis: true,
        oracamentoDepois: novoTotal,
        ultrapassagem,
        dentroOrcamento,
        ocupante: null,
      });
    }

    return dias;
  }

  const diasCalendario = analisarMes(ano, mes);

  // Melhor data: primeira VERDE encontrada a partir do mês exibido (apenas com cliente selecionada).
  let melhorData: MelhorData | null = null;

  if (cliente) {
    let mesBusca = mes;
    let anoBusca = ano;

    busca_melhor_data: for (let tentativa = 0; tentativa < 24; tentativa++) {
      const diasMesBusca =
        anoBusca === ano && mesBusca === mes ? diasCalendario : analisarMes(anoBusca, mesBusca);

      for (const d of diasMesBusca) {
        if (d.estado === "verde") {
          melhorData = {
            data: d.data,
            dia: d.dia,
            mes: mesBusca,
            ano: anoBusca,
            oracamentoMes: orcamentoMensal,
            comprometidoAntes: d.oracamentoAntes,
            valorCliente,
            totalDepois: d.oracamentoDepois,
            dentroOrcamento: true,
            motivo:
              "É a primeira data disponível encontrada que permite realizar a liberação sem ultrapassar o orçamento mensal.",
          };
          break busca_melhor_data;
        }
      }

      mesBusca++;
      if (mesBusca > 12) {
        mesBusca = 1;
        anoBusca++;
      }
    }
  }

  // Alternativas do mês exibido (apenas com cliente selecionada).
  const verdes: AlternativaData[] = [];
  const amarelas: AlternativaData[] = [];

  if (cliente) {
    for (const dia of diasCalendario) {
      if (dia.estado === "verde") {
        verdes.push({
          data: dia.data,
          dia: dia.dia,
          estado: "verde",
          oracamentoDepois: dia.oracamentoDepois,
          ultrapassagem: 0,
          motivo: "Data disponível dentro do orçamento mensal",
        });
      } else if (dia.estado === "amarelo") {
        amarelas.push({
          data: dia.data,
          dia: dia.dia,
          estado: "amarelo",
          oracamentoDepois: dia.oracamentoDepois,
          ultrapassagem: dia.ultrapassagem,
          motivo: `Ultrapassa o orçamento em ${new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(dia.ultrapassagem)}.`,
        });
      }
    }
  }

  const resposta: Resposta = {
    cliente,
    orcamentoMensal,
    calendario: { ano, mes, dias: diasCalendario },
    melhorData,
    alternativas: {
      verdes: verdes.slice(0, 5), // Limitar a 5 alternativas
      amarelas: amarelas.slice(0, 5),
    },
  };

  return NextResponse.json(resposta);
}
