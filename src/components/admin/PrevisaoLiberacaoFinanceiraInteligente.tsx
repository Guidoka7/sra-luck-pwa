"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Lock,
  RefreshCw,
  Sparkles,
  Star,
  Unlock,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, nomeMes, formatarMoeda, formatarDataLonga } from "@/lib/utils";
import { ResumoOrcamentoMensal } from "@/components/admin/ResumoOrcamentoMensal";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
type EstadoVisual = "verde" | "amarelo" | "vermelho" | "cinza" | "bloqueado" | "passado" | "lotada";
interface InfoGerenciamento { id: string; status: string; }
interface ClienteInfo { id: string; nome: string; valor: number; status: "apta" | "termos_assinados"; dataTermos: string | null; }
interface DiaAnalise { data: string; dia: number; estado: "verde" | "amarelo" | "vermelho" | "cinza" | "passado"; vagasDisponiveis: boolean; oracamentoAntes: number; oracamentoDepois: number; ultrapassagem: number; dentroOrcamento: boolean; diasDisponibilizados: number; ocupante: { nome: string; valor: number } | null; }
interface MelhorData { data: string; dia: number; mes: number; ano: number; oracamentoMes: number; comprometidoAntes: number; valorCliente: number; totalDepois: number; dentroOrcamento: boolean; motivo: string; }
interface AlternativaData { data: string; dia: number; estado: "verde" | "amarelo"; oracamentoDepois: number; ultrapassagem: number; motivo: string; }
interface DadosAnalise { cliente: ClienteInfo | null; erro?: string; orcamentoMensal: number; calendario: { ano: number; mes: number; dias: DiaAnalise[] }; melhorData: MelhorData | null; alternativas: { verdes: AlternativaData[]; amarelas: AlternativaData[] }; }
interface Solicitacao { id: string; cliente_id: string; forma_custeio: "cartao" | "pix" | "cheques"; saldo_restante: number; taxa_cartao: number; total_com_taxa: number; status: "pendente" | "em_analise"; observacao: string | null; created_at: string; updated_at: string; clientes?: { nome_completo: string; cpf: string | null; quantidade_parcelas: number | null } | null; }
interface ClienteAgenda { agendamentoId: string; clienteId: string; nome: string; previsaoAtual: string | null; }

function formaLabel(forma: Solicitacao["forma_custeio"]) {
  return forma === "cartao" ? "Cartão" : forma === "pix" ? "Pix" : "Cheques";
}

export function PrevisaoLiberacaoFinanceiraInteligente() {
  const hoje = new Date();
  const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [agendamentoSelecionadoId, setAgendamentoSelecionadoId] = useState("");
  const [todosClientes, setTodosClientes] = useState<ClienteAgenda[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregandoSolicitacoes, setCarregandoSolicitacoes] = useState(true);
  const [analise, setAnalise] = useState<DadosAnalise | null>(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [showingModalAmarela, setShowingModalAmarela] = useState(false);
  const [showingConfirmacao, setShowingConfirmacao] = useState(false);
  const [showingInfoOcupada, setShowingInfoOcupada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [datasGerenciamento, setDatasGerenciamento] = useState<Map<string, InfoGerenciamento>>(new Map());
  const [salvandoGerenciamento, setSalvandoGerenciamento] = useState(false);
  const [agendaBloqueadaGlobal, setAgendaBloqueadaGlobal] = useState(false);

  async function carregarSolicitacoes() {
    try {
      const res = await fetch("/api/admin/solicitacoes-liberacao-financeira", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSolicitacoes(data.solicitacoes ?? []);
    } finally {
      setCarregandoSolicitacoes(false);
    }
  }

  useEffect(() => {
    carregarSolicitacoes();
    const timer = window.setInterval(carregarSolicitacoes, 5000);
    const onFocus = () => carregarSolicitacoes();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    fetch("/api/admin/clientes-agendamentos")
      .then((r) => r.json())
      .then((data) => setTodosClientes(data.clientes ?? []))
      .catch(() => {});
  }, []);

  async function carregarCalendario() {
    setCarregandoAnalise(true);
    try {
      const params = new URLSearchParams({ ano: String(ano), mes: String(mes) });
      if (agendamentoSelecionadoId) params.set("agendamento_id", agendamentoSelecionadoId);
      const [resAnalise, resGerenciamento, resConfig] = await Promise.all([
        fetch(`/api/admin/liberacao-inteligente?${params}`),
        fetch(`/api/admin/datas-liberacao-financeira?ano=${ano}&mes=${mes}`),
        fetch("/api/admin/configuracoes"),
      ]);
      const data = await resAnalise.json();
      if (resAnalise.ok) setAnalise(data);
      else toast.error(data.erro ?? "Erro ao carregar o calendário");

      const dg = await resGerenciamento.json();
      if (resGerenciamento.ok) {
        const mapa = new Map<string, InfoGerenciamento>();
        for (const d of dg.datas ?? []) mapa.set(d.data, { id: d.id, status: d.status });
        setDatasGerenciamento(mapa);
      }

      const dc = await resConfig.json();
      if (resConfig.ok) setAgendaBloqueadaGlobal(!!dc.configuracoes?.agenda_liberacao_financeira_bloqueada);
    } finally {
      setCarregandoAnalise(false);
    }
  }

  useEffect(() => {
    carregarCalendario();
  }, [agendamentoSelecionadoId, ano, mes]);

  function selecionarCliente(agendamentoId: string) {
    setAgendamentoSelecionadoId(agendamentoId);
    setDataSelecionada(null);
    setShowingConfirmacao(false);
    setShowingModalAmarela(false);
    window.setTimeout(() => {
      document.getElementById("calendario-previsao")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function selecionarSolicitacao(solicitacao: Solicitacao) {
    const cliente = todosClientes.find((item) => item.clienteId === solicitacao.cliente_id);
    if (!cliente) {
      toast.error("Não foi possível localizar a agenda desta cliente.");
      return;
    }
    selecionarCliente(cliente.agendamentoId);
  }

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
    setDataSelecionada(null);
  }

  function clicarEmDia(data: string, estadoVisual: EstadoVisual) {
    if (estadoVisual === "passado") return;
    if (estadoVisual === "vermelho") {
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
    setDataSelecionada(data);
  }

  async function salvarPrevisao(data: string) {
    if (!agendamentoSelecionadoId || !analise?.cliente) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/agendamentos/${agendamentoSelecionadoId}/previsao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previsaoLiberacaoFinanceira: data }),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar previsão");
        return;
      }
      toast.success("Previsão de liberação aprovada! Cliente foi notificada.");
      setDataSelecionada(null);
      setShowingConfirmacao(false);
      setShowingModalAmarela(false);
      await Promise.all([
        carregarCalendario(),
        fetch("/api/admin/clientes-agendamentos").then((r) => r.json()).then((d) => setTodosClientes(d.clientes ?? [])),
        carregarSolicitacoes(),
      ]);
    } finally {
      setSalvando(false);
    }
  }

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

  const diasDoMes = useMemo(() => analise?.calendario.dias ?? [], [analise]);
  const diaDataSelecionada = useMemo(
    () => !dataSelecionada || !analise ? null : analise.calendario.dias.find((d) => d.data === dataSelecionada),
    [dataSelecionada, analise]
  );

  function estadoVisual(dia: DiaAnalise): EstadoVisual {
    if (dia.estado === "passado" || dia.estado === "vermelho") return dia.estado;
    if (datasGerenciamento.get(dia.data)?.status === "bloqueado") return "bloqueado";
    return dia.estado;
  }

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
  const statusBadgeColor = analise?.cliente?.status === "termos_assinados" ? "bg-success/10 text-success" : "bg-gold/18 text-burgundy";
  const clientesAgendadas = todosClientes.filter((c) => Boolean(c.previsaoAtual)).sort((a, b) => (a.previsaoAtual ?? "").localeCompare(b.previsaoAtual ?? ""));

  return (
    <div className="animate-fadeUp space-y-4 pb-8">
      {analise?.cliente && (
        <Card className="border-rose/15 bg-[rgb(var(--surface-1))] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.58rem] font-bold uppercase tracking-label text-rose">Cliente selecionada</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="truncate text-sm font-bold text-burgundy">{analise.cliente.nome}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[0.58rem] font-semibold", statusBadgeColor)}>{statusBadge}</span>
                <span className="text-xs font-semibold text-clay/60">{formatarMoeda(analise.cliente.valor)}</span>
              </div>
            </div>
            <button type="button" onClick={() => selecionarCliente("")} className="rounded-full px-2.5 py-1 text-[0.62rem] font-semibold text-clay/50 transition hover:bg-white/10 hover:text-burgundy">Limpar</button>
          </div>
        </Card>
      )}

      {analise?.melhorData && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-gold/25 bg-gold/10 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-gold" />
          <p className="min-w-0 flex-1 text-xs text-clay/70">
            <span className="font-semibold text-burgundy">Melhor data:</span> {String(analise.melhorData.dia).padStart(2, "0")}/{String(analise.melhorData.mes).padStart(2, "0")}/{analise.melhorData.ano} — dentro do orçamento.
          </p>
          {(analise.melhorData.mes !== mes || analise.melhorData.ano !== ano) && (
            <Button size="sm" variant="secondary" onClick={() => { setMes(analise.melhorData!.mes); setAno(analise.melhorData!.ano); }}>Ver mês</Button>
          )}
        </div>
      )}

      {analise && (
        <div id="calendario-previsao" className="scroll-mt-20 grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.5fr)]">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold" />
                  <h2 className="font-heading text-base text-burgundy">Agenda de liberação</h2>
                </div>
                <p className="mt-1 text-[0.68rem] leading-relaxed text-clay/50">
                  {agendaBloqueadaGlobal ? "Escolha somente datas disponíveis." : analise.cliente ? "Selecione a data de previsão para a cliente escolhida." : "Libere ou bloqueie datas pelo calendário."}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-rose/12 bg-[rgb(var(--surface-2))] p-1 shadow-card">
                <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="flex h-7 w-7 items-center justify-center rounded-full text-burgundy transition-all hover:bg-rose/10 active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
                <span className="w-28 text-center text-xs font-semibold text-burgundy">{nomeMes(mes)} {ano}</span>
                <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês" className="flex h-7 w-7 items-center justify-center rounded-full text-burgundy transition-all hover:bg-rose/10 active:scale-90"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mx-auto mt-4 w-full max-w-2xl">
              <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[0.58rem] uppercase tracking-label text-rose">{DIAS_SEMANA.map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {diasDoMes.map((dia) => {
                  const ehMelhorData = analise.melhorData?.data === dia.data;
                  const estadoReal = estadoVisual(dia);
                  const estado = estadoExibido(estadoReal);
                  const clicavel = estado !== "passado" && estado !== "lotada";
                  let bg = "border-transparent bg-clay/5 text-clay/30 hover:bg-clay/10 cursor-pointer";
                  if (estado === "verde") bg = "border-success/40 bg-success/10 font-semibold text-success hover:bg-success/18 cursor-pointer";
                  else if (estado === "amarelo") bg = "border-gold/45 bg-gold/12 font-bold text-burgundy hover:bg-gold/20 cursor-pointer";
                  else if (estado === "vermelho") bg = "border-burgundy bg-burgundy font-bold text-cream cursor-pointer";
                  else if (estado === "bloqueado") bg = "border-transparent bg-clay/15 text-clay/50 cursor-pointer";
                  else if (estado === "passado") bg = "border-transparent bg-clay/5 text-clay/20";
                  else if (estado === "lotada") bg = "border-transparent bg-clay/8 text-clay/40 cursor-not-allowed";
                  return (
                    <button key={dia.data} type="button" onClick={() => clicavel && clicarEmDia(dia.data, estadoReal)} disabled={!clicavel} className={cn("relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-all duration-150", bg, dia.data === isoHoje && "ring-2 ring-gold ring-offset-1", dia.data === dataSelecionada && "ring-2 ring-burgundy ring-offset-2", ehMelhorData && "ring-2 ring-gold ring-offset-2 animate-pulse-slow")}>
                      {ehMelhorData && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold"><Star className="h-2.5 w-2.5 fill-white text-white" /></span>}
                      <span className="font-semibold leading-none">{dia.dia}</span>
                      {estado === "amarelo" && <span className="text-[0.45rem]">⚠️</span>}
                      {estado === "bloqueado" && <Lock className="h-2.5 w-2.5 opacity-70" />}
                      {estado === "lotada" && <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="h-px w-[65%] rotate-45 rounded-full bg-clay/45" /></span>}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-1.5 text-[0.62rem] text-clay/55 sm:grid-cols-2">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Verde: disponível</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> Amarelo: acima do orçamento</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-burgundy" /> Vermelho: já ocupada</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-clay/20" /> Cinza: não liberada</span>
              </div>

              {dataSelecionada && diaDataSelecionada && estadoVisualSelecionado && estadoExibidoSelecionado !== "lotada" && !showingInfoOcupada && !showingModalAmarela && !showingConfirmacao && (
                <div className="mt-4 rounded-xl border border-rose/10 bg-[rgb(var(--surface-2))] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-burgundy">Dia selecionado · {String(diaDataSelecionada.dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}/{ano}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {estadoVisualSelecionado === "cinza" && <Button size="sm" loading={salvandoGerenciamento} onClick={() => liberarData(dataSelecionada)}>Liberar</Button>}
                      {estadoVisualSelecionado === "bloqueado" && infoGerenciamentoSelecionada && <Button size="sm" variant="secondary" loading={salvandoGerenciamento} onClick={() => alternarBloqueio(infoGerenciamentoSelecionada)}><Unlock className="h-3 w-3" /> Desbloquear</Button>}
                      {(estadoVisualSelecionado === "verde" || estadoVisualSelecionado === "amarelo") && infoGerenciamentoSelecionada && <Button size="sm" variant="danger" loading={salvandoGerenciamento} onClick={() => alternarBloqueio(infoGerenciamentoSelecionada)}><Lock className="h-3 w-3" /> Bloquear</Button>}
                      {(estadoVisualSelecionado === "verde" || estadoVisualSelecionado === "amarelo") && agendamentoSelecionadoId && <Button size="sm" onClick={() => estadoVisualSelecionado === "amarelo" ? setShowingModalAmarela(true) : setShowingConfirmacao(true)}>Confirmar previsão</Button>}
                    </div>
                  </div>
                  <p className="mt-2 text-[0.68rem] text-clay/50">
                    {estadoVisualSelecionado === "cinza" ? "Data ainda não disponibilizada pela gestão." : estadoVisualSelecionado === "bloqueado" ? "Data bloqueada para novas liberações." : !agendamentoSelecionadoId ? "Selecione uma cliente na lista de solicitações abaixo para confirmar a previsão." : "Revise a data e confirme a previsão para a cliente."}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <aside className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[0.58rem] font-semibold uppercase tracking-label text-rose">Marcador financeiro</p><h3 className="mt-1 font-heading text-sm text-burgundy">Carta de crédito</h3></div>
                <DollarSign className="h-4 w-4 text-gold" />
              </div>
              {analise.cliente ? (
                <div className="mt-3 rounded-xl border border-gold/20 bg-gold/10 p-3">
                  <p className="truncate text-sm font-bold text-burgundy">{analise.cliente.nome}</p>
                  <p className="mt-1 text-[0.58rem] uppercase tracking-label text-clay/45">Valor</p>
                  <p className="mt-0.5 text-xl font-heading text-burgundy">{formatarMoeda(analise.cliente.valor)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[0.68rem]"><span className="text-clay/50">Após liberação</span><span className="font-semibold text-burgundy">{formatarMoeda(Math.max(0, (analise.melhorData?.comprometidoAntes ?? 0) + analise.cliente.valor))}</span></div>
                </div>
              ) : <div className="mt-3 rounded-xl bg-[rgb(var(--surface-2))] p-3 text-[0.68rem] leading-relaxed text-clay/55">Clique em uma solicitação abaixo para analisar a cliente.</div>}
            </Card>
            <ResumoOrcamentoMensal />
            {analise.cliente && <div className="rounded-xl border border-rose/10 bg-[rgb(var(--surface-2))] p-3"><div className="flex items-end justify-between gap-3"><div><p className="text-[0.58rem] uppercase tracking-label text-rose">Orçamento do mês</p><p className="mt-0.5 text-base font-bold text-burgundy">{formatarMoeda(analise.melhorData?.comprometidoAntes ?? 0)}</p></div><span className="text-[0.58rem] text-clay/45">meta {formatarMoeda(analise.orcamentoMensal)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-clay/10"><div className={cn("h-full rounded-full transition-all", (analise.melhorData?.comprometidoAntes ?? 0) > analise.orcamentoMensal ? "bg-alert" : "bg-gradient-to-r from-rose to-burgundy")} style={{ width: `${Math.min(((analise.melhorData?.comprometidoAntes ?? 0) / Math.max(analise.orcamentoMensal, 1)) * 100, 100)}%` }} /></div></div>}
          </aside>
        </div>
      )}

      <section className="rounded-2xl border border-rose/12 bg-[rgb(var(--surface-1))] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-gold" /><h2 className="font-heading text-sm text-burgundy">Solicitações de previsão</h2></div>
            <p className="mt-0.5 text-[0.65rem] text-clay/50">A cliente entra aqui após solicitar a liberação financeira e escolher o custeio.</p>
          </div>
          <button type="button" onClick={carregarSolicitacoes} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose/12 bg-[rgb(var(--surface-2))] px-2.5 text-[0.62rem] font-semibold text-burgundy transition-all hover:bg-rose/10 active:scale-95"><RefreshCw className="h-3 w-3" /> Atualizar</button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-gold/15 bg-[rgb(var(--surface-2))] p-2.5">
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <div><p className="text-[0.58rem] font-bold uppercase tracking-label text-rose">Aguardando previsão</p><p className="mt-0.5 text-[0.62rem] text-clay/45">Clique na cliente para abrir o calendário.</p></div>
              <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[0.62rem] font-bold text-burgundy">{solicitacoes.length}</span>
            </div>
            {carregandoSolicitacoes ? <p className="px-1 py-3 text-[0.68rem] text-clay/40">Carregando…</p> : solicitacoes.length === 0 ? <div className="rounded-lg bg-clay/5 px-3 py-3 text-[0.68rem] text-clay/45">Nenhuma solicitação aguardando previsão.</div> : (
              <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {solicitacoes.map((s) => {
                  const cliente = todosClientes.find((c) => c.clienteId === s.cliente_id);
                  const selecionada = cliente?.agendamentoId === agendamentoSelecionadoId;
                  return (
                    <button key={s.id} type="button" onClick={() => selecionarSolicitacao(s)} className={cn("w-full rounded-lg border px-2.5 py-2 text-left transition-all duration-150 hover:-translate-y-px hover:border-rose/25 hover:bg-rose/5 active:scale-[0.99]", selecionada ? "border-gold/45 bg-gold/10 ring-1 ring-gold/25" : "border-rose/8 bg-[rgb(var(--surface-1))]") }>
                      <div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-bold text-burgundy">{s.clientes?.nome_completo ?? cliente?.nome ?? "Cliente"}</p><span className="shrink-0 rounded-full bg-gold/10 px-1.5 py-0.5 text-[0.52rem] font-bold uppercase text-burgundy">{s.status === "em_analise" ? "Análise" : "Pendente"}</span></div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[0.58rem] text-clay/50"><span>{formaLabel(s.forma_custeio)}</span><strong className="text-burgundy">{formatarMoeda(Number(s.saldo_restante))}</strong></div>
                      {s.forma_custeio === "cartao" && <p className="mt-0.5 text-[0.55rem] text-clay/45">Com taxa: {formatarMoeda(Number(s.total_com_taxa))}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-success/15 bg-[rgb(var(--surface-2))] p-2.5">
            <div className="flex items-center justify-between gap-2 px-1 pb-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-label text-success">Previsões confirmadas</p><p className="mt-0.5 text-[0.62rem] text-clay/45">Clientes já programadas para liberação.</p></div><span className="rounded-full bg-success/10 px-2 py-0.5 text-[0.62rem] font-bold text-success">{clientesAgendadas.length}</span></div>
            {clientesAgendadas.length === 0 ? <div className="rounded-lg bg-clay/5 px-3 py-3 text-[0.68rem] text-clay/45">Nenhuma previsão confirmada.</div> : (
              <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {clientesAgendadas.map((c) => <button key={c.agendamentoId} type="button" onClick={() => selecionarCliente(c.agendamentoId)} className="flex items-center justify-between gap-2 rounded-lg border border-success/10 bg-[rgb(var(--surface-1))] px-2.5 py-2 text-left transition-all hover:border-success/25 hover:bg-success/5 active:scale-[0.99]"><div className="min-w-0"><p className="truncate text-xs font-bold text-burgundy">{c.nome}</p><p className="mt-0.5 text-[0.58rem] text-clay/45">{c.previsaoAtual ? formatarDataLonga(c.previsaoAtual) : "—"}</p></div><CheckCircle2 className="h-4 w-4 shrink-0 text-success" /></button>)}
              </div>
            )}
          </div>
        </div>
      </section>

      {showingInfoOcupada && dataSelecionada && diaDataSelecionada?.ocupante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm bg-[rgb(var(--surface-1))]"><div className="space-y-4 p-5"><div className="flex items-start gap-3"><Calendar className="mt-1 h-5 w-5 text-burgundy" /><div><h2 className="font-heading text-base text-burgundy">Data de liberação</h2><p className="mt-1 text-xs text-clay/65">{String(diaDataSelecionada.dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}/{ano}</p></div></div><div className="space-y-2 rounded-xl bg-[rgb(var(--surface-2))] p-3"><div className="flex items-center gap-2"><User className="h-4 w-4 text-burgundy" /><span className="text-sm font-medium text-burgundy">{diaDataSelecionada.ocupante.nome}</span></div><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-burgundy" /><span className="text-sm font-medium text-burgundy">{formatarMoeda(diaDataSelecionada.ocupante.valor)}</span></div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-sm font-semibold text-success">Previsão confirmada</span></div></div><Button variant="secondary" size="sm" onClick={() => { setShowingInfoOcupada(false); setDataSelecionada(null); }} className="w-full">Fechar</Button></div></Card>
        </div>
      )}

      {showingModalAmarela && dataSelecionada && diaDataSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm bg-[rgb(var(--surface-1))]"><div className="space-y-4 p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-1 h-5 w-5 text-gold" /><div><h2 className="font-heading text-base text-burgundy">Atenção</h2><p className="mt-1 text-xs text-clay/70">Esta data está disponível, mas ultrapassa o orçamento mensal.</p></div></div><div className="space-y-2 rounded-xl bg-[rgb(var(--surface-2))] p-3 text-xs text-clay/70"><div className="flex justify-between"><span>Orçamento</span><span className="font-semibold">{formatarMoeda(analise!.orcamentoMensal)}</span></div><div className="flex justify-between"><span>Já comprometido</span><span className="font-semibold">{formatarMoeda(diaDataSelecionada.oracamentoAntes)}</span></div><div className="flex justify-between"><span>Carta da cliente</span><span className="font-semibold">{formatarMoeda(analise!.cliente!.valor)}</span></div><div className="border-t border-rose/10 pt-2"><div className="flex justify-between font-bold text-burgundy"><span>Novo total</span><span>{formatarMoeda(diaDataSelecionada.oracamentoDepois)}</span></div></div><div className="border-t border-rose/10 pt-2"><div className="flex justify-between text-rose"><span>Excedente</span><span className="font-bold">{formatarMoeda(diaDataSelecionada.ultrapassagem)}</span></div></div></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setShowingModalAmarela(false)} className="flex-1">Cancelar</Button><Button size="sm" loading={salvando} onClick={() => salvarPrevisao(dataSelecionada)} className="flex-1">Escolher mesmo assim</Button></div></div></Card>
        </div>
      )}

      {showingConfirmacao && dataSelecionada && diaDataSelecionada && analise?.cliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm bg-[rgb(var(--surface-1))]"><div className="space-y-4 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-5 w-5 text-success" /><div><h2 className="font-heading text-base text-success">Confirmar previsão?</h2>{analise.melhorData?.data === dataSelecionada && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/18 px-2 py-0.5 text-[0.6rem] font-semibold text-burgundy"><Star className="h-3 w-3 fill-burgundy text-burgundy" /> Melhor data</span>}</div></div><div className="space-y-2 rounded-xl bg-[rgb(var(--surface-2))] p-3"><div className="flex items-center gap-2"><User className="h-4 w-4 text-burgundy" /><span className="text-sm font-medium text-burgundy">{analise.cliente.nome}</span></div><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-burgundy" /><span className="text-sm font-medium text-burgundy">{formatarMoeda(analise.cliente.valor)}</span></div><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-burgundy" /><span className="text-sm font-medium text-burgundy">{String(diaDataSelecionada.dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}/{ano}</span></div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /><span className={cn("text-sm font-semibold", diaDataSelecionada.dentroOrcamento ? "text-success" : "text-gold")}>{diaDataSelecionada.dentroOrcamento ? "Dentro do orçamento" : "Excede orçamento"}</span></div></div><div className="space-y-1.5 rounded-xl border border-rose/10 bg-clay/[0.03] p-3 text-xs text-clay/70"><div className="flex justify-between"><span>Orçamento</span><span className="font-semibold">{formatarMoeda(analise.orcamentoMensal)}</span></div><div className="flex justify-between"><span>Já comprometido</span><span className="font-semibold">{formatarMoeda(diaDataSelecionada.oracamentoAntes)}</span></div><div className="flex justify-between border-t border-rose/10 pt-1.5 font-bold text-burgundy"><span>Novo total</span><span>{formatarMoeda(diaDataSelecionada.oracamentoDepois)}</span></div></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setShowingConfirmacao(false)} className="flex-1">Cancelar</Button><Button size="sm" loading={salvando} onClick={() => salvarPrevisao(dataSelecionada)} className="flex-1">Confirmar</Button></div></div></Card>
        </div>
      )}

      {carregandoAnalise && <div className="py-5 text-center text-[0.68rem] text-clay/40">Atualizando agenda…</div>}
    </div>
  );
}
