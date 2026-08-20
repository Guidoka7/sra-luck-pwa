"use client";
import { fetchInstant, refreshInstant, getInstantCache, writeInstantCache } from "@/lib/instantCache";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarCheck2, ShieldCheck, Hourglass, ArrowUpRight, Lock, Unlock, CheckCircle2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader, StatusPill } from "@/components/admin/ExecutiveUI";
import { PrevisaoLiberacaoFinanceiraInteligente } from "@/components/admin/PrevisaoLiberacaoFinanceiraInteligente";
import { RevisaoFinanceiraCard } from "@/components/admin/RevisaoFinanceiraCard";
import { cn, nomeMes } from "@/lib/utils";
import type { ClienteAgendadaNaData, DataAgenda } from "@/types/database";

type ClienteNaData = ClienteAgendadaNaData;
type DataComOcupacao = DataAgenda & { vagasOcupadas: number; clientes: ClienteNaData[] };
type EstadoDia = "past" | "unset" | "open" | "partial" | "full" | "blocked";
type AbaAgenda = "termos" | "liberacao";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const VAGAS_PADRAO_AO_LIBERAR = 1;

const LEGENDA: { estado: EstadoDia; label: string; dotClass: string }[] = [
  { estado: "unset", label: "Livre", dotClass: "bg-clay/15" },
  { estado: "open", label: "Liberada", dotClass: "bg-success" },
  { estado: "partial", label: "Parcialmente ocupada", dotClass: "bg-gold" },
  { estado: "full", label: "Lotada", dotClass: "bg-burgundy" },
];

function formatarHora(iso: string | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarDataCurta(iso: string): string {
  return iso.split("-").reverse().join("/");
}

// Diferença em dias de calendário entre hoje e a data da assinatura (iso,
// formato YYYY-MM-DD). Positivo = está no futuro, 0 = é hoje, negativo = já
// passou.
function diasAte(iso: string, isoHoje: string): number {
  const [ay, am, ad] = iso.split("-").map(Number);
  const [hy, hm, hd] = isoHoje.split("-").map(Number);
  const alvo = Date.UTC(ay, am - 1, ad);
  const hoje = Date.UTC(hy, hm - 1, hd);
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

// Texto curto e profissional para a contagem regressiva até a assinatura.
function textoContagem(dias: number): string {
  if (dias < 0) return "Assinatura já realizada";
  if (dias === 0) return "É hoje";
  if (dias === 1) return "Falta 1 dia";
  return `Faltam ${dias} dias`;
}

export default function AgendaAdminPage() {
  return (
    <Suspense fallback={null}>
      <AgendaAdminConteudo />
    </Suspense>
  );
}

function AgendaAdminConteudo() {
  const searchParams = useSearchParams();
  const abaInicial = searchParams.get("aba") === "liberacao" ? "liberacao" : "termos";

  const hoje = new Date();
  const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [aba, setAba] = useState<AbaAgenda>(abaInicial);
  const [agendaLiberacaoBloqueada, setAgendaLiberacaoBloqueada] = useState(false);
  const [datas, setDatas] = useState<DataComOcupacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [vagasInput, setVagasInput] = useState(1);
  const [salvandoIso, setSalvandoIso] = useState<string | null>(null);
  const [salvandoVagas, setSalvandoVagas] = useState(false);
  const [acaoConfirmacao, setAcaoConfirmacao] = useState<"liberar" | "desfazer" | "desbloquear" | null>(null);
  const [clienteSelecionada, setClienteSelecionada] = useState<{
    clienteId: string | null;
    nome: string;
    data: string;
    criadoEm: string;
    statusRevisaoFinanceira: ClienteNaData["statusRevisaoFinanceira"];
    valor: number;
  } | null>(null);

  async function carregar(force = false) {
    const url = `/api/admin/datas?ano=${ano}&mes=${mes}`;
    const cached = !force ? getInstantCache<{ datas?: DataComOcupacao[] }>(url) : null;
    if (cached) { setDatas(cached.datas ?? []); setCarregando(false); } else setCarregando(true);
    try {
      const data = force ? await refreshInstant<{ datas?: DataComOcupacao[] }>(url) : await fetchInstant<{ datas?: DataComOcupacao[] }>(url);
      setDatas(data.datas ?? []);
    } finally { setCarregando(false); }
  }

  useEffect(() => {
    carregar();
  }, [ano, mes]);

  useEffect(() => {
    let ativo = true;

    async function carregarConfiguracoes() {
      try {
        const res = await fetch("/api/admin/configuracoes", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const bloqueada = Boolean(data.configuracoes?.agenda_liberacao_financeira_bloqueada);
        if (!ativo) return;
        setAgendaLiberacaoBloqueada(bloqueada);
      } catch {
        // Mantém a agenda disponível caso a leitura de configuração falhe.
      }
    }

    carregarConfiguracoes();
    return () => { ativo = false; };
  }, []);

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
    setDataSelecionada(null);
  }

  const diasDoMes = useMemo(() => {
    const primeiroDia = new Date(ano, mes - 1, 1);
    const totalDias = new Date(ano, mes, 0).getDate();
    const offset = primeiroDia.getDay();
    const dias: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= totalDias; d++) dias.push(d);
    return dias;
  }, [ano, mes]);

  const datasPorDia = useMemo(() => {
    const mapa = new Map<string, DataComOcupacao>();
    for (const d of datas) mapa.set(d.data, d);
    return mapa;
  }, [datas]);

  // Clientes previstas no mês: a informação principal é a data do compromisso.
  // Dentro de cada data, preservamos a ordem de criação para desempate.
  const clientesDoMes = useMemo(() => {
    const lista: {
      clienteId: string | null;
      nome: string;
      data: string;
      criadoEm: string;
      statusRevisaoFinanceira: ClienteNaData["statusRevisaoFinanceira"];
      valor: number;
    }[] = [];
    for (const d of datas) {
      for (const c of d.clientes) {
        lista.push({
          clienteId: c.clienteId,
          nome: c.nome,
          data: d.data,
          criadoEm: c.criadoEm,
          statusRevisaoFinanceira: c.statusRevisaoFinanceira,
          valor: c.valor,
        });
      }
    }
    return lista.sort((a, b) =>
      a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? "")
    );
  }, [datas]);

  const clientesPorData = useMemo(() => {
    const grupos = new Map<string, typeof clientesDoMes>();
    for (const cliente of clientesDoMes) {
      const atual = grupos.get(cliente.data) ?? [];
      atual.push(cliente);
      grupos.set(cliente.data, atual);
    }
    return Array.from(grupos.entries());
  }, [clientesDoMes]);

  function selecionarCliente(cliente: (typeof clientesDoMes)[number]) {
    setClienteSelecionada(cliente);
    setDataSelecionada(cliente.data);
  }

  // Próximo agendamento do mês, usado apenas como destaque dentro da lista de clientes.
  const proximoAgendamentoData = useMemo(() => {
    let melhor: string | null = null;
    let melhorDias = Infinity;
    for (const c of clientesDoMes) {
      const dias = diasAte(c.data, isoHoje);
      if (dias >= 0 && dias < melhorDias) {
        melhorDias = dias;
        melhor = c.data;
      }
    }
    return melhor;
  }, [clientesDoMes, isoHoje]);

  function isoDoDia(dia: number) {
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  function estadoDoDia(iso: string, info: DataComOcupacao | undefined): EstadoDia {
    if (iso < isoHoje) return "past";
    if (!info) return "unset";
    if (info.status === "bloqueado") return "blocked";
    if (info.vagasOcupadas <= 0) return "open";
    if (info.vagasOcupadas < info.vagas_totais) return "partial";
    return "full";
  }

  // Ações de agenda: o clique não executa alterações destrutivas imediatamente.
  // Primeiro abre uma confirmação; depois da API responder, atualizamos o
  // estado local imediatamente para a mudança aparecer sem esperar uma nova
  // consulta do mês.
  function clicarDia(iso: string, estado: EstadoDia, info: DataComOcupacao | undefined) {
    if (estado === "past" || salvandoIso) return;

    if (estado === "unset") {
      setDataSelecionada(iso);
      setAcaoConfirmacao("liberar");
      return;
    }

    if (estado === "blocked" && info) {
      setDataSelecionada(iso);
      setAcaoConfirmacao("desbloquear");
      return;
    }

    if (estado === "open" && info) {
      setDataSelecionada(iso);
      setAcaoConfirmacao("desfazer");
      return;
    }

    // partial ou full: seleciona para o ajuste rápido de vagas.
    const jaSelecionado = iso === dataSelecionada;
    setDataSelecionada(jaSelecionado ? null : iso);
    setVagasInput(info?.vagas_totais ?? 1);
  }

  async function confirmarAcaoAgenda() {
    if (!acaoConfirmacao || !dataSelecionada) return;
    const iso = dataSelecionada;
    const info = datasPorDia.get(iso);
    if ((acaoConfirmacao === "desfazer" || acaoConfirmacao === "desbloquear") && !info) return;

    setSalvandoIso(iso);
    try {
      if (acaoConfirmacao === "liberar") {
        const res = await fetch("/api/admin/datas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: iso, vagasTotais: VAGAS_PADRAO_AO_LIBERAR }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(payload.erro ?? "Não foi possível liberar essa data.");
          return;
        }
        const novaData = payload.data as DataAgenda;
        const dataAtualizada = { ...novaData, vagasOcupadas: 0, clientes: [] } as DataComOcupacao;
        setDatas(prev => {
          const next = [...prev.filter(d => d.data !== iso), dataAtualizada].sort((a, b) => a.data.localeCompare(b.data));
          writeInstantCache(`/api/admin/datas?ano=${ano}&mes=${mes}`, { datas: next });
          return next;
        });
        toast.success("Data liberada.");
      } else if (acaoConfirmacao === "desfazer") {
        const res = await fetch(`/api/admin/datas/${info!.id}`, { method: "DELETE" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(payload.erro ?? "Não foi possível desfazer a liberação dessa data.");
          return;
        }
        setDatas(prev => {
          const next = prev.filter(d => d.data !== iso);
          writeInstantCache(`/api/admin/datas?ano=${ano}&mes=${mes}`, { datas: next });
          return next;
        });
        toast.success("Liberação removida.");
      } else {
        const res = await fetch(`/api/admin/datas/${info!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "disponivel" }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(payload.erro ?? "Não foi possível desbloquear essa data.");
          return;
        }
        const atualizada = payload.data as DataAgenda;
        setDatas(prev => {
          const next = prev.map(d => d.id === atualizada.id ? { ...d, ...atualizada } : d);
          writeInstantCache(`/api/admin/datas?ano=${ano}&mes=${mes}`, { datas: next });
          return next;
        });
        toast.success("Data desbloqueada.");
      }
      setAcaoConfirmacao(null);
      setDataSelecionada(null);
    } finally {
      setSalvandoIso(null);
    }
  }

  async function salvarVagas() {
    if (!dataSelecionada || !infoSelecionada) return;
    setSalvandoVagas(true);
    const res = await fetch(`/api/admin/datas/${infoSelecionada.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vagasTotais: vagasInput }),
    });
    setSalvandoVagas(false);
    if (!res.ok) {
      toast.error("Não foi possível atualizar as vagas.");
      return;
    }
    setDatas(prev => {
      const next = prev.map(d => d.id === infoSelecionada.id ? { ...d, vagas_totais: vagasInput } : d);
      writeInstantCache(`/api/admin/datas?ano=${ano}&mes=${mes}`, { datas: next });
      return next;
    });
    toast.success("Vagas atualizadas.");
  }

  const infoSelecionada = dataSelecionada ? datasPorDia.get(dataSelecionada) : undefined;
  const estadoSelecionado = dataSelecionada ? estadoDoDia(dataSelecionada, infoSelecionada) : null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Operação"
        title="Agenda"
        description="Libere datas para os termos cirúrgicos ou acompanhe a previsão de liberação financeira."
        actions={
          aba === "termos" ? (
            <div className="flex items-center gap-1 rounded-full border border-rose/12 bg-white/90 p-1.5 shadow-card">
              <button
                onClick={() => mudarMes(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-blush"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="w-32 text-center text-sm font-medium text-burgundy">
                {nomeMes(mes)} {ano}
              </span>
              <button
                onClick={() => mudarMes(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy transition-colors hover:bg-blush"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto flex w-full max-w-md gap-1 rounded-full bg-blush/70 p-1.5">
        <button
          onClick={() => setAba("termos")}
          className={cn(
            "flex-1 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-label transition-all duration-200",
            aba === "termos" ? "bg-burgundy text-cream shadow-card" : "text-burgundy/60 hover:text-burgundy"
          )}
        >
          Termos cirúrgicos
        </button>
        <button
          onClick={() => setAba("liberacao")}
          className={cn(
            "flex-1 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-label transition-all duration-200",
            aba === "liberacao" ? "bg-burgundy text-cream shadow-card" : "text-burgundy/60 hover:text-burgundy"
          )}
        >
          Previsão de liberação financeira{agendaLiberacaoBloqueada ? " · bloqueada" : ""}
        </button>
      </div>

      {aba === "liberacao" ? (
        <div className="space-y-6">
          <PrevisaoLiberacaoFinanceiraInteligente />
        </div>
      ) : (
        <>
          <RevisaoFinanceiraCard />

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-rose/10 bg-gradient-to-br from-blush/35 to-transparent px-7 py-6">
              <h2 className="font-heading text-base text-burgundy">Calendário de vagas</h2>
              <p className="mt-1 text-xs leading-relaxed text-clay/55">
                Clique num dia livre para liberar na hora. Clique numa data liberada e vazia para desfazer.
              </p>
            </div>

            <div className="p-6">
              <div className="mx-auto w-full max-w-2xl">
                <div className="mb-2 grid grid-cols-7 text-center">
                  {DIAS_SEMANA.map((d, i) => (
                    <span key={i} className="text-[0.65rem] font-semibold uppercase tracking-label text-rose/80">
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
                  {diasDoMes.map((dia, i) => {
                    if (dia === null) return <div key={i} />;
                    const iso = isoDoDia(dia);
                    const info = datasPorDia.get(iso);
                    const estado = estadoDoDia(iso, info);
                    const ehHoje = iso === isoHoje;
                    const selecionado = iso === dataSelecionada;
                    const salvando = salvandoIso === iso;
                    const clicavel = estado !== "past" && !salvando;

                    return (
                      <button
                        key={i}
                        onClick={() => clicarDia(iso, estado, info)}
                        disabled={!clicavel}
                        title={
                          estado === "unset"
                            ? "Clique para liberar"
                            : estado === "open"
                              ? "Clique para desfazer a liberação"
                              : estado === "blocked"
                                ? "Clique para desbloquear"
                                : estado === "partial" || estado === "full"
                                  ? "Clique para ajustar as vagas"
                                  : undefined
                        }
                        className={cn(
                          "group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border text-base font-medium transition-all duration-150",
                          estado === "unset" &&
                            "border-clay/[0.08] bg-clay/[0.035] text-clay/45 hover:-translate-y-0.5 hover:border-clay/15 hover:bg-clay/[0.07] hover:shadow-sm cursor-pointer",
                          estado === "open" &&
                            "border-success/40 bg-success/10 font-semibold text-success hover:-translate-y-0.5 hover:border-success/60 hover:bg-success/15 hover:shadow-sm cursor-pointer",
                          estado === "partial" &&
                            "border-gold/70 bg-gold/15 font-semibold text-burgundy hover:-translate-y-0.5 hover:bg-gold/25 hover:shadow-sm cursor-pointer",
                          estado === "full" &&
                            "border-burgundy bg-burgundy font-semibold text-cream shadow-[0_10px_24px_-14px_rgba(122,38,50,0.55)] hover:-translate-y-0.5 hover:bg-burgundy-light cursor-pointer",
                          estado === "blocked" && "border-transparent bg-clay/5 text-clay/25",
                          estado === "past" && "border-transparent bg-transparent text-clay/20",
                          ehHoje && !selecionado && "ring-2 ring-gold/70 ring-offset-1",
                          selecionado && "ring-2 ring-burgundy ring-offset-2",
                          salvando && "opacity-50"
                        )}
                      >
                        <span className="text-[0.85rem] leading-none">{dia}</span>
                        {info && (estado === "partial" || estado === "full") ? (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-[1px] text-[0.6rem] font-bold leading-none tabular-nums",
                              estado === "full" ? "bg-white/20 text-cream" : "bg-white/60 text-burgundy"
                            )}
                          >
                            {info.vagasOcupadas}/{info.vagas_totais}
                          </span>
                        ) : (
                          <span className="h-[14px]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rose/10 pt-5 text-[0.72rem] text-clay/60">
                  {LEGENDA.map((item) => (
                    <span key={item.estado} className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", item.dotClass)} />
                      {item.label}
                    </span>
                  ))}
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-gold" /> Hoje
                  </span>
                </div>

                {estadoSelecionado === "partial" || estadoSelecionado === "full" ? (
                  <div className="mt-5 space-y-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-blush/40 to-cream p-4 shadow-sm">
                    <p className="text-sm font-medium text-burgundy">
                      Ajustar vagas · {formatarDataCurta(dataSelecionada as string)}
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor="vagas">Vagas nesse dia</Label>
                        <Input
                          id="vagas"
                          type="number"
                          min={infoSelecionada?.vagasOcupadas ?? 1}
                          value={vagasInput}
                          onChange={(e) => setVagasInput(Number(e.target.value))}
                        />
                      </div>
                      <Button onClick={salvarVagas} loading={salvandoVagas} size="sm">
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          {acaoConfirmacao && dataSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <Card className="w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="border-b border-rose/10 bg-blush/30 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    acaoConfirmacao === "liberar" ? "bg-success/10 text-success" : "bg-gold/10 text-gold"
                  )}>
                    {acaoConfirmacao === "liberar" ? <CalendarCheck2 className="h-5 w-5" /> : acaoConfirmacao === "desbloquear" ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <div>
                    <h2 className="font-heading text-base text-burgundy">
                      {acaoConfirmacao === "liberar" ? "Confirmar liberação da data?" : acaoConfirmacao === "desbloquear" ? "Confirmar desbloqueio da data?" : "Remover liberação da data?"}
                    </h2>
                    <p className="mt-0.5 text-xs text-clay/50">Esta ação será aplicada imediatamente à agenda.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setAcaoConfirmacao(null)} className="rounded-lg p-1 text-clay/40 hover:bg-white/70 hover:text-burgundy" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-rose/10 bg-clay/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-burgundy" />
                  <span className="text-sm font-semibold text-burgundy">{formatarDataCurta(dataSelecionada)}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-clay/55">
                  {acaoConfirmacao === "liberar"
                    ? "A data ficará disponível para novos agendamentos de termos cirúrgicos."
                    : acaoConfirmacao === "desbloquear"
                      ? "A data voltará a ficar disponível para utilização na agenda."
                      : "A data deixará de aparecer como liberada e ficará novamente livre."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setAcaoConfirmacao(null)} className="flex-1">Cancelar</Button>
                <Button size="sm" loading={salvandoIso === dataSelecionada} onClick={confirmarAcaoAgenda} className="flex-1">
                  {acaoConfirmacao === "liberar" ? "Confirmar liberação" : acaoConfirmacao === "desbloquear" ? "Desbloquear" : "Remover liberação"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {carregando && datas.length === 0 && (
            <p className="text-xs text-clay/40">Carregando ocupação do mês…</p>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-rose/10 bg-white/40 px-5 py-5 dark:bg-white/[0.018]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-rose">
                    Previsão da agenda
                  </p>
                  <h2 className="mt-1 font-heading text-lg text-burgundy">Clientes previstas</h2>
                  <p className="mt-1 text-xs text-clay/50">
                    {clientesDoMes.length} {clientesDoMes.length === 1 ? "cliente" : "clientes"} em {clientesPorData.length} {clientesPorData.length === 1 ? "data" : "datas"}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
                  <CalendarCheck2 className="h-4 w-4 text-gold" />
                </div>
              </div>

              {clientesDoMes.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-rose/10 bg-blush/20 px-4 py-8 text-center">
                  <CalendarCheck2 className="mx-auto h-5 w-5 text-clay/30" />
                  <p className="mt-2 text-sm font-medium text-clay/55">Nenhuma cliente prevista</p>
                  <p className="mt-1 text-xs text-clay/40">As clientes agendadas aparecerão aqui por data.</p>
                </div>
              ) : (
                <div className="mt-4 max-h-[570px] space-y-4 overflow-y-auto pr-1">
                  {clientesPorData.map(([data, clientes]) => {
                    const dias = diasAte(data, isoHoje);
                    const ehProximaData = data === proximoAgendamentoData;
                    const dataObj = new Date(`${data}T12:00:00`);
                    const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

                    return (
                      <section key={data} className="rounded-2xl border border-rose/10 bg-white/55 p-3.5 dark:bg-white/[0.025]">
                        <div className="flex items-center justify-between gap-3 border-b border-rose/10 pb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border",
                              ehProximaData
                                ? "border-gold/35 bg-gold/10"
                                : "border-rose/10 bg-blush/30"
                            )}>
                              <span className="text-[0.58rem] font-bold uppercase tracking-wide text-clay/50">{diaSemana}</span>
                              <span className="text-sm font-bold leading-none text-burgundy">{data.slice(8)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-burgundy">{formatarDataCurta(data)}</p>
                              <p className="mt-0.5 text-[0.68rem] text-clay/45">
                                {clientes.length} {clientes.length === 1 ? "cliente prevista" : "clientes previstas"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {ehProximaData ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-wide text-burgundy">
                                <CalendarCheck2 className="h-3 w-3" /> Próxima
                              </span>
                            ) : (
                              <span className={cn(
                                "text-[0.68rem] font-semibold",
                                dias < 0 ? "text-clay/35" : dias <= 3 ? "text-alert" : "text-clay/50"
                              )}>
                                {textoContagem(dias)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 space-y-1">
                          {clientes.map((c, i) => {
                            const diasCliente = diasAte(c.data, isoHoje);
                            const financeiroConfirmado = c.statusRevisaoFinanceira === "aprovada";
                            const revisaoPendente = c.statusRevisaoFinanceira === "pendente";

                            return (
                              <button
                                type="button"
                                key={`${c.clienteId ?? c.nome}-${c.criadoEm}-${i}`}
                                onClick={() => selecionarCliente(c)}
                                className={cn(
                                  "group w-full rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-rose/15 hover:bg-blush/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-rose/30",
                                  clienteSelecionada?.clienteId === c.clienteId && clienteSelecionada?.criadoEm === c.criadoEm
                                    ? "border-rose/20 bg-blush/30 shadow-sm"
                                    : ""
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blush/45 text-[0.68rem] font-bold text-burgundy">
                                    {i + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-burgundy">{c.nome}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] text-clay/45">
                                      <span>Cadastro às {formatarHora(c.criadoEm)}</span>
                                      {diasCliente < 0 && <span className="text-clay/30">• realizada</span>}
                                    </div>
                                  </div>
                                  <div className="ml-auto flex items-center gap-1.5">
                                    {financeiroConfirmado ? (
                                      <span title="Financeiro confirmado" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                      </span>
                                    ) : revisaoPendente ? (
                                      <span title="Aguardando confirmação do financeiro" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                                        <Hourglass className="h-3.5 w-3.5" />
                                      </span>
                                    ) : null}
                                    <ArrowUpRight className="h-3.5 w-3.5 text-clay/25 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-burgundy" />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          </div>
        </>
      )}
    </div>
  );
}

