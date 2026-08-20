"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Star,
  Calendar,
  DollarSign,
  User,
  Lock,
  Unlock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { cn, nomeMes, formatarMoeda, formatarDataLonga } from "@/lib/utils";
import { ResumoOrcamentoMensal } from "@/components/admin/ResumoOrcamentoMensal";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Estado "visual" de cada dia no calendário unificado: junta o estado
 * vindo da análise de orçamento (verde/amarelo/vermelho/cinza/passado) com
 * a informação de bloqueio manual (gerida aqui mesmo, sem cliente).
 *
 * "lotada" só existe quando a agenda está bloqueada globalmente (via
 * Configurações): é o estado simplificado que substitui amarelo/vermelho/
 * cinza/bloqueado enquanto o bloqueio estiver ativo — só "verde" continua
 * distinto, indicando o que ainda pode ser escolhido. */
type EstadoVisual = "verde" | "amarelo" | "vermelho" | "cinza" | "bloqueado" | "passado" | "lotada";

interface InfoGerenciamento {
  id: string;
  status: string;
}


interface ClienteInfo {
  id: string;
  nome: string;
  valor: number;
  status: "apta" | "termos_assinados";
  dataTermos: string | null;
}

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

interface AlternativaData {
  data: string;
  dia: number;
  estado: "verde" | "amarelo";
  oracamentoDepois: number;
  ultrapassagem: number;
  motivo: string;
}

interface DadosAnalise {
  cliente: ClienteInfo | null;
  erro?: string;
  orcamentoMensal: number;
  calendario: {
    ano: number;
    mes: number;
    dias: DiaAnalise[];
  };
  melhorData: MelhorData | null;
  alternativas: {
    verdes: AlternativaData[];
    amarelas: AlternativaData[];
  };
}

export function PrevisaoLiberacaoFinanceiraInteligente() {
  const hoje = new Date();
  const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [agendamentoSelecionadoId, setAgendamentoSelecionadoId] = useState("");
  const [todosClientes, setTodosClientes] = useState<
    { agendamentoId: string; clienteId: string; nome: string; previsaoAtual: string | null }[]
  >([]);

  const [analise, setAnalise] = useState<DadosAnalise | null>(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [showingModalAmarela, setShowingModalAmarela] = useState(false);
  const [showingConfirmacao, setShowingConfirmacao] = useState(false);
  const [showingInfoOcupada, setShowingInfoOcupada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Info de gestão (id + status "disponivel"/"bloqueado") de cada data do
  // mês exibido — é o que antes vivia num calendário separado, e agora
  // alimenta as ações de liberar/bloquear direto neste mesmo calendário.
  const [datasGerenciamento, setDatasGerenciamento] = useState<Map<string, InfoGerenciamento>>(new Map());
  const [salvandoGerenciamento, setSalvandoGerenciamento] = useState(false);
  // Interruptor global (Configurações › Agenda de liberação financeira): quando
  // true, simplifica o calendário pra só "disponível" (verde) x "lotada".
  const [agendaBloqueadaGlobal, setAgendaBloqueadaGlobal] = useState(false);

  // Carregar lista de clientes
  useEffect(() => {
    async function carregar() {
      const res = await fetch("/api/admin/clientes-agendamentos");
      const data: any = await res.json();
      setTodosClientes(data.clientes ?? []);
    }
    carregar();
  }, []);

  // Carrega, em paralelo: (1) o calendário-base com a análise de orçamento
  // (liberacao-inteligente) e (2) a informação de gestão de cada data
  // (id + status), usada pelas ações de liberar/bloquear/desbloquear.
  // O calendário-base é carregado sempre — com ou sem cliente selecionada.
  async function carregarCalendario() {
    setCarregandoAnalise(true);
    try {
      const params = new URLSearchParams({ ano: String(ano), mes: String(mes) });
      if (agendamentoSelecionadoId) params.set("agendamento_id", agendamentoSelecionadoId);

      const [resAnalise, resGerenciamento, resConfig] = await Promise.all([
        fetch(`/api/admin/liberacao-inteligente?${params.toString()}`),
        fetch(`/api/admin/datas-liberacao-financeira?ano=${ano}&mes=${mes}`),
        fetch("/api/admin/configuracoes"),
      ]);
      const data = await resAnalise.json();
      if (resAnalise.ok) {
        setAnalise(data);
      } else {
        toast.error(data.erro ?? "Erro ao carregar o calendário");
      }

      const dataGerenciamento = await resGerenciamento.json();
      if (resGerenciamento.ok) {
        const mapa = new Map<string, InfoGerenciamento>();
        for (const d of dataGerenciamento.datas ?? []) mapa.set(d.data, { id: d.id, status: d.status });
        setDatasGerenciamento(mapa);
      }

      const dataConfig = await resConfig.json();
      if (resConfig.ok) {
        setAgendaBloqueadaGlobal(!!dataConfig.configuracoes?.agenda_liberacao_financeira_bloqueada);
      }
    } finally {
      setCarregandoAnalise(false);
    }
  }

  useEffect(() => {
    carregarCalendario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoSelecionadoId, ano, mes]);

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
    }
    if (novoMes < 1) {
      novoMes = 12;
      novoAno--;
    }
    setMes(novoMes);
    setAno(novoAno);
    setDataSelecionada(null);
  }

  function clicarEmDia(data: string, estadoVisual: EstadoVisual) {
    if (estadoVisual === "passado") return;

    if (estadoVisual === "vermelho") {
      // Data já ocupada: apenas mostra informações, não permite seleção.
      setDataSelecionada(data);
      setShowingInfoOcupada(true);
      return;
    }

    if ((estadoVisual === "verde" || estadoVisual === "amarelo") && agendamentoSelecionadoId) {
      setDataSelecionada(data);
      if (estadoVisual === "amarelo") setShowingModalAmarela(true);
      else setShowingConfirmacao(true);
      return;
    }

    // Cinza, bloqueada, ou disponível sem cliente selecionada: só seleciona
    // o dia, pra exibir o painel de gestão (liberar/bloquear/desbloquear).
    setDataSelecionada(data);
  }

  async function salvarPrevisao(data: string) {
    if (!agendamentoSelecionadoId || !analise?.cliente) return;

    setSalvando(true);
    try {
      const res = await fetch(
        `/api/admin/agendamentos/${agendamentoSelecionadoId}/previsao`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ previsaoLiberacaoFinanceira: data }),
        }
      );

      if (!res.ok) {
        toast.error("Erro ao salvar previsão");
        return;
      }

      toast.success("Previsão de liberação aprovada! Cliente foi notificada.");
      setDataSelecionada(null);
      setShowingConfirmacao(false);
      setShowingModalAmarela(false);

      // Recarregar o calendário (a data escolhida passa a ficar ocupada/vermelha)
      await carregarCalendario();
    } finally {
      setSalvando(false);
    }
  }

  // Abre (disponibiliza) uma data cinza pra liberação financeira.
  async function liberarData(data: string) {
    setSalvandoGerenciamento(true);
    try {
      const res = await fetch("/api/admin/datas-liberacao-financeira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        toast.error("Não foi possível liberar essa data.");
        return;
      }
      toast.success("Data liberada para liberação financeira.");
      await carregarCalendario();
    } finally {
      setSalvandoGerenciamento(false);
    }
  }

  // Alterna bloqueado <-> disponível numa data já disponibilizada.
  async function alternarBloqueio(info: InfoGerenciamento) {
    setSalvandoGerenciamento(true);
    try {
      const novoStatus = info.status === "bloqueado" ? "disponivel" : "bloqueado";
      const res = await fetch(`/api/admin/datas-liberacao-financeira/${info.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) {
        toast.error("Não foi possível atualizar essa data.");
        return;
      }
      toast.success(novoStatus === "bloqueado" ? "Data bloqueada." : "Data desbloqueada.");
      await carregarCalendario();
    } finally {
      setSalvandoGerenciamento(false);
    }
  }

  const diasDoMes = useMemo(() => {
    if (!analise) return [];
    return analise.calendario.dias;
  }, [analise]);

  const diaDataSelecionada = useMemo(() => {
    if (!dataSelecionada || !analise) return null;
    return analise.calendario.dias.find((d) => d.data === dataSelecionada);
  }, [dataSelecionada, analise]);

  // Junta o estado vindo da análise de orçamento com a informação de
  // bloqueio manual: uma data "cinza" (sem previsão nem bloqueio) e uma
  // data bloqueada usam a mesma cor de base na API, mas aqui viram estados
  // visuais distintos pra habilitar as ações certas.
  function estadoVisual(dia: DiaAnalise): EstadoVisual {
    if (dia.estado === "passado" || dia.estado === "vermelho") return dia.estado;
    if (datasGerenciamento.get(dia.data)?.status === "bloqueado") return "bloqueado";
    return dia.estado;
  }

  // Estado REALMENTE exibido em cada dia: quando a agenda está bloqueada
  // globalmente (Configurações), simplifica tudo que não é "verde"/"amarelo"
  // (ou seja: vermelho, cinza e bloqueado) em "lotada" — riscada e sem
  // interação. Isso não altera o estado real (`estadoVisual`), só a pintura
  // e a possibilidade de clique; a lógica de negócio permanece a mesma.
  function estadoExibido(estado: EstadoVisual): EstadoVisual {
    if (!agendaBloqueadaGlobal) return estado;
    if (estado === "passado") return "passado";
    if (estado === "verde" || estado === "amarelo") return "verde";
    return "lotada";
  }

  const infoGerenciamentoSelecionada = dataSelecionada ? datasGerenciamento.get(dataSelecionada) : undefined;
  const estadoVisualSelecionado = diaDataSelecionada ? estadoVisual(diaDataSelecionada) : null;
  const estadoExibidoSelecionado = estadoVisualSelecionado ? estadoExibido(estadoVisualSelecionado) : null;

  const statusBadge = analise?.cliente?.status === "termos_assinados" ? "Termos assinados" : "Apta";
  const statusBadgeColor =
    analise?.cliente?.status === "termos_assinados" ? "bg-success/10 text-success" : "bg-gold/18 text-burgundy";

  return (
    <div className="animate-fadeUp space-y-6 pb-8">
      {/* SELETOR DE CLIENTE */}
      <Card className="p-6">
        <h2 className="font-heading text-base text-burgundy">Selecione a cliente</h2>
        <p className="mt-1 text-xs text-clay/50">
          O calendário se adapta automaticamente mostrando a melhor data de liberação para essa cliente.
        </p>

        <div className="mt-4">
          <Label htmlFor="cliente-select" className="mb-2">
            Cliente
          </Label>
          <Select
            id="cliente-select"
            value={agendamentoSelecionadoId}
            onChange={(e) => setAgendamentoSelecionadoId(e.target.value)}
          >
            <option value="">— Escolha uma cliente —</option>
            {todosClientes.map((c) => (
              <option key={c.agendamentoId} value={c.agendamentoId}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* INFORMAÇÕES DA CLIENTE */}
      {analise?.cliente && (
        <Card className="border-rose/20 bg-gradient-to-br from-blush/40 to-white p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[0.65rem] uppercase tracking-label text-clay/45">Cliente</p>
              <p className="mt-2 truncate text-sm font-medium text-burgundy">{analise.cliente.nome}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-label text-clay/45">Carta de Crédito</p>
              <p className="mt-2 text-base font-bold text-burgundy">
                {formatarMoeda(analise.cliente.valor)}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-label text-clay/45">Status</p>
              <span
                className={cn(
                  "mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold",
                  statusBadgeColor
                )}
              >
                {statusBadge}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* MELHOR DATA SUGERIDA — banner compacto; o destaque de verdade acontece no calendário */}
      {analise?.melhorData && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/35 bg-gold/10 px-5 py-4">
          <Sparkles className="h-[18px] w-[18px] shrink-0 text-gold" />
          <p className="flex-1 text-xs text-clay/70">
            <span className="font-semibold text-burgundy">Melhor data para esta cliente:</span>{" "}
            {String(analise.melhorData.dia).padStart(2, "0")}/{String(analise.melhorData.mes).padStart(2, "0")}/
            {analise.melhorData.ano} — dentro do orçamento, sem ultrapassar a meta mensal.
            {(analise.melhorData.mes === mes && analise.melhorData.ano === ano)
              ? " Está com a estrela ⭐ destacada no calendário abaixo — clique nela para revisar e confirmar."
              : " Fica em outro mês; toque em \"Ver esse mês\" para localizar a estrela ⭐ no calendário."}
          </p>
          {(analise.melhorData.mes !== mes || analise.melhorData.ano !== ano) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMes(analise.melhorData!.mes);
                setAno(analise.melhorData!.ano);
              }}
            >
              Ver esse mês
            </Button>
          )}
        </div>
      )}

      {/* CALENDÁRIO + PAINEL LATERAL — visão operacional compacta e proporcional */}
      {analise && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
          <Card className="p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base text-burgundy">Calendário de liberação financeira</h2>
              <p className="mt-1 text-xs text-clay/50">
                {agendaBloqueadaGlobal
                  ? "Só as datas disponíveis (verde) podem ser escolhidas; as demais aparecem como lotadas."
                  : analise.cliente
                  ? "As cores mudam conforme o impacto financeiro da cliente selecionada no mês exibido. Clique numa data cinza pra liberá-la, ou numa disponível pra bloqueá-la."
                  : "Clique num dia cinza pra liberá-lo, numa data disponível pra bloqueá-la, ou selecione uma cliente acima pra confirmar a previsão dela."}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-rose/12 bg-white/90 p-1.5 shadow-card">
              <button
                onClick={() => mudarMes(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-blush"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="w-32 text-center text-sm font-medium text-burgundy">
                {nomeMes(mes)} {ano}
              </span>
              <button
                onClick={() => mudarMes(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-blush"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grid do calendário */}
          <div className="mx-auto mt-6 w-full max-w-2xl">
            <div className="mb-2 grid grid-cols-7 gap-2.5 text-center text-[0.68rem] uppercase tracking-label text-rose">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
              {diasDoMes.map((dia, i) => {
                const ehHoje = dia.data === isoHoje;
                const selecionado = dia.data === dataSelecionada;
                const ehMelhorData = analise.melhorData?.data === dia.data;
                const estadoReal = estadoVisual(dia);
                const estado = estadoExibido(estadoReal);
                const clicavel = estado !== "passado" && estado !== "lotada";

                let bgColor = "border-transparent bg-clay/5 text-clay/30 hover:bg-clay/10 cursor-pointer";
                if (estado === "verde") {
                  bgColor = "border-success/50 bg-success/12 font-semibold text-success hover:bg-success/20 cursor-pointer";
                } else if (estado === "amarelo") {
                  bgColor = "border-gold/50 bg-gold/15 font-bold text-burgundy hover:bg-gold/25 cursor-pointer";
                } else if (estado === "vermelho") {
                  bgColor = "border-burgundy bg-burgundy font-bold text-cream hover:bg-burgundy-light cursor-pointer";
                } else if (estado === "bloqueado") {
                  bgColor = "border-transparent bg-clay/20 text-clay/50 hover:bg-clay/25 cursor-pointer";
                } else if (estado === "passado") {
                  bgColor = "border-transparent bg-clay/[0.03] text-clay/20 cursor-default";
                } else if (estado === "lotada") {
                  bgColor = "border-transparent bg-clay/10 text-clay/40 cursor-not-allowed";
                }

                return (
                  <button
                    key={i}
                    onClick={() => clicavel && clicarEmDia(dia.data, estadoReal)}
                    disabled={!clicavel}
                    title={
                      ehMelhorData
                        ? "Melhor data para esta cliente"
                        : estado === "lotada"
                        ? "Lotada"
                        : undefined
                    }
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border text-sm transition-all duration-150",
                      bgColor,
                      ehHoje && "ring-2 ring-gold ring-offset-1",
                      selecionado && "ring-2 ring-burgundy ring-offset-2",
                      ehMelhorData && "ring-2 ring-gold ring-offset-2 animate-pulse-slow"
                    )}
                  >
                    {ehMelhorData && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold shadow-sm">
                        <Star className="h-2.5 w-2.5 fill-white text-white" />
                      </span>
                    )}
                    <span className="text-sm font-semibold leading-none">{dia.dia}</span>
                    {estado === "amarelo" && <span className="text-[0.5rem] leading-none">⚠️</span>}
                    {estado === "bloqueado" && <Lock className="h-2.5 w-2.5 opacity-70" />}
                    {estado === "lotada" && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span className="h-[1.5px] w-[68%] rotate-45 rounded-full bg-clay/45" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="mt-5 space-y-2 text-[0.7rem] text-clay/55">
              {agendaBloqueadaGlobal ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-success" /> Verde: disponível para seleção
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-clay/15">
                      <span className="h-[1.5px] w-[65%] rotate-45 rounded-full bg-clay/50" />
                    </span>
                    Lotada
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold">
                      <Star className="h-2 w-2 fill-white text-white" />
                    </span>
                    Estrela: melhor data para a cliente selecionada
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    Verde: disponível{analise.cliente ? " e dentro do orçamento" : ""}
                  </div>
                  {analise.cliente && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gold" /> Amarelo: disponível, mas ultrapassa orçamento
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-burgundy" /> Vermelho: já ocupada por uma liberação confirmada
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-clay/20" /> Cinza: não foi liberada pela gestão
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-clay/40">
                      <Lock className="h-2 w-2 text-white" />
                    </span>
                    Bloqueada pela gestão
                  </div>
                </>
              )}
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-gold" /> Hoje
              </div>
            </div>

            {/* Painel de gestão da data selecionada — liberar / bloquear / desbloquear.
                Fica escondido quando o clique já abriu um dos modais (ocupada, atenção
                ou confirmação), pra não duplicar informação na tela. */}
            {dataSelecionada &&
              diaDataSelecionada &&
              estadoVisualSelecionado &&
              estadoExibidoSelecionado !== "lotada" &&
              !showingInfoOcupada &&
              !showingModalAmarela &&
              !showingConfirmacao && (
                <div className="mt-5 space-y-3 rounded-2xl border border-rose/10 bg-blush/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-burgundy">
                      Dia selecionado · {String(diaDataSelecionada.dia).padStart(2, "0")}/
                      {String(mes).padStart(2, "0")}/{ano}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {estadoVisualSelecionado === "cinza" && (
                        <Button
                          size="sm"
                          loading={salvandoGerenciamento}
                          onClick={() => liberarData(dataSelecionada)}
                        >
                          Liberar data
                        </Button>
                      )}
                      {estadoVisualSelecionado === "bloqueado" && infoGerenciamentoSelecionada && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={salvandoGerenciamento}
                          onClick={() => alternarBloqueio(infoGerenciamentoSelecionada)}
                        >
                          <Unlock className="h-3.5 w-3.5" /> Desbloquear
                        </Button>
                      )}
                      {(estadoVisualSelecionado === "verde" || estadoVisualSelecionado === "amarelo") &&
                        infoGerenciamentoSelecionada && (
                          <Button
                            size="sm"
                            variant="danger"
                            loading={salvandoGerenciamento}
                            onClick={() => alternarBloqueio(infoGerenciamentoSelecionada)}
                          >
                            <Lock className="h-3.5 w-3.5" /> Bloquear
                          </Button>
                        )}
                      {(estadoVisualSelecionado === "verde" || estadoVisualSelecionado === "amarelo") &&
                        agendamentoSelecionadoId && (
                          <Button
                            size="sm"
                            onClick={() =>
                              estadoVisualSelecionado === "amarelo"
                                ? setShowingModalAmarela(true)
                                : setShowingConfirmacao(true)
                            }
                          >
                            Confirmar previsão pra cliente selecionada
                          </Button>
                        )}
                    </div>
                  </div>

                  {estadoVisualSelecionado === "cinza" && (
                    <p className="text-xs text-clay/50">
                      Essa data ainda não foi disponibilizada pela gestão pra liberação financeira.
                    </p>
                  )}
                  {estadoVisualSelecionado === "bloqueado" && (
                    <p className="text-xs text-clay/50">
                      Data bloqueada — não aparece como opção pra nenhuma cliente.
                    </p>
                  )}
                  {(estadoVisualSelecionado === "verde" || estadoVisualSelecionado === "amarelo") &&
                    !agendamentoSelecionadoId && (
                      <p className="text-xs text-clay/50">
                        Data disponível. Selecione uma cliente acima pra confirmar a previsão dela nesse dia,
                        ou bloqueie a data pra tirá-la de circulação.
                      </p>
                    )}
                </div>
              )}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-label text-rose">
                  Marcador financeiro
                </p>
                <h3 className="mt-1 font-heading text-base text-burgundy">
                  Carta de crédito
                </h3>
              </div>
              <DollarSign className="h-4 w-4 text-gold" />
            </div>

            {analise.cliente ? (
              <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/10 p-4">
                <p className="truncate text-sm font-bold text-burgundy">{analise.cliente.nome}</p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-label text-clay/45">
                  Valor da carta
                </p>
                <p className="mt-1 text-2xl font-heading text-burgundy">
                  {formatarMoeda(analise.cliente.valor)}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="text-clay/55">Após a liberação</span>
                  <span className="font-semibold text-burgundy">
                    {formatarMoeda(
                      Math.max(
                        0,
                        (analise.melhorData?.comprometidoAntes ?? 0) + analise.cliente.valor
                      )
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-blush/35 p-4 text-xs leading-relaxed text-clay/55">
                Selecione uma cliente para calcular automaticamente a carta de crédito e o impacto no orçamento mensal.
              </div>
            )}
          </Card>

          <ResumoOrcamentoMensal
            ano={ano}
            mes={mes}
            onSelecionarMes={(novoAno, novoMes) => {
              setAno(novoAno);
              setMes(novoMes);
              setDataSelecionada(null);
            }}
          />

          {analise.cliente && (
            <div className="rounded-2xl border border-rose/10 bg-blush/20 p-4">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-label text-rose">
                    Orçamento do mês
                  </p>
                  <p className="mt-1 text-lg font-bold text-burgundy">
                    {formatarMoeda(
                      analise.melhorData?.comprometidoAntes ?? 0
                    )}
                  </p>
                </div>
                <span className="text-[0.65rem] text-clay/45">
                  meta {formatarMoeda(analise.orcamentoMensal)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    (analise.melhorData?.comprometidoAntes ?? 0) > analise.orcamentoMensal
                      ? "bg-alert"
                      : "bg-gradient-to-r from-rose to-burgundy"
                  )}
                  style={{
                    width: `${Math.min(
                      ((analise.melhorData?.comprometidoAntes ?? 0) /
                        Math.max(analise.orcamentoMensal, 1)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[0.68rem] text-clay/50">
                Comprometido com liberações confirmadas em {nomeMes(mes)}.
              </p>
            </div>
          )}
        </aside>
      </div>
      )}

      {/* MODAL: DATA JÁ OCUPADA (VERMELHA) */}
      {showingInfoOcupada && dataSelecionada && diaDataSelecionada && diaDataSelecionada.ocupante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm">
            <div className="space-y-6 p-6">
              <div className="flex items-start gap-3">
                <Calendar className="mt-1 h-5 w-5 shrink-0 text-burgundy" />
                <div>
                  <h2 className="font-heading text-base text-burgundy">Data de liberação</h2>
                  <p className="mt-2 text-xs text-clay/70">
                    {String(diaDataSelecionada.dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}/{ano}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-blush/40 p-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-burgundy" />
                  <span className="text-sm font-medium text-burgundy">{diaDataSelecionada.ocupante.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-burgundy" />
                  <span className="text-sm font-medium text-burgundy">
                    {formatarMoeda(diaDataSelecionada.ocupante.valor)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold text-success">Previsão confirmada</span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowingInfoOcupada(false);
                  setDataSelecionada(null);
                }}
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: ATENÇÃO - DATA AMARELA */}
      {showingModalAmarela && dataSelecionada && diaDataSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm">
            <div className="space-y-6 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-gold" />
                <div>
                  <h2 className="font-heading text-base text-burgundy">⚠️ Atenção</h2>
                  <p className="mt-2 text-xs text-clay/70">
                    Esta data está disponível, mas a inclusão desta cliente ultrapassará o orçamento mensal.
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-clay/5 p-4 text-xs text-clay/70">
                <div className="flex justify-between">
                  <span>Orçamento:</span>
                  <span className="font-semibold">{formatarMoeda(analise!.orcamentoMensal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Já comprometido:</span>
                  <span className="font-semibold">{formatarMoeda(diaDataSelecionada.oracamentoAntes)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Carta da cliente:</span>
                  <span className="font-semibold">{formatarMoeda(analise!.cliente!.valor)}</span>
                </div>
                <div className="border-t border-rose/10 pt-2">
                  <div className="flex justify-between font-bold text-burgundy">
                    <span>Novo total:</span>
                    <span>{formatarMoeda(diaDataSelecionada.oracamentoDepois)}</span>
                  </div>
                </div>
                <div className="border-t border-rose/10 pt-2">
                  <div className="flex justify-between text-rose">
                    <span>Excedente:</span>
                    <span className="font-bold">{formatarMoeda(diaDataSelecionada.ultrapassagem)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowingModalAmarela(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  loading={salvando}
                  onClick={() => salvarPrevisao(dataSelecionada)}
                  className="flex-1"
                >
                  Escolher mesmo assim
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO */}
      {showingConfirmacao && dataSelecionada && diaDataSelecionada && analise?.cliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm">
            <div className="space-y-6 p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-success" />
                <div>
                  <h2 className="font-heading text-base text-success">Confirmar previsão de liberação?</h2>
                  {analise.melhorData?.data === dataSelecionada && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gold/18 px-2.5 py-0.5 text-[0.65rem] font-semibold text-burgundy">
                      <Star className="h-3 w-3 fill-burgundy text-burgundy" /> Melhor data sugerida
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-blush/40 p-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-burgundy" />
                  <span className="text-sm font-medium text-burgundy">{analise.cliente.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-burgundy" />
                  <span className="text-sm font-medium text-burgundy">
                    {formatarMoeda(analise.cliente.valor)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-burgundy" />
                  <span className="text-sm font-medium text-burgundy">
                    {String(diaDataSelecionada.dia).padStart(2, "0")}/
                    {String(mes).padStart(2, "0")}/{ano}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className={cn("text-sm font-semibold", diaDataSelecionada.dentroOrcamento ? "text-success" : "text-gold")}>
                    {diaDataSelecionada.dentroOrcamento ? "Dentro do orçamento" : "Excede orçamento"}
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-rose/10 bg-clay/[0.03] p-3 text-xs text-clay/70">
                <div className="flex justify-between">
                  <span>Orçamento de {nomeMes(mes)}:</span>
                  <span className="font-semibold">{formatarMoeda(analise.orcamentoMensal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Já comprometido:</span>
                  <span className="font-semibold">{formatarMoeda(diaDataSelecionada.oracamentoAntes)}</span>
                </div>
                <div className="border-t border-rose/10 pt-2">
                  <div className="flex justify-between font-bold text-burgundy">
                    <span>Novo total:</span>
                    <span>{formatarMoeda(diaDataSelecionada.oracamentoDepois)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowingConfirmacao(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  loading={salvando}
                  onClick={() => salvarPrevisao(dataSelecionada)}
                  className="flex-1"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {carregandoAnalise && (
        <div className="text-center py-8">
          <p className="text-xs text-clay/40">Analisando orçamento e datas disponíveis…</p>
        </div>
      )}
    </div>
  );
}
