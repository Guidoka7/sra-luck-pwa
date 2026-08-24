"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Banknote, Calendar, Check, ChevronLeft, ChevronRight, Clock3, Lock, RefreshCw, Search, Star, Unlock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, formatarMoeda, nomeMes } from "@/lib/utils";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
type Estado = "verde" | "amarelo" | "vermelho" | "cinza" | "passado";
type AcaoData = "liberar" | "fechar" | null;
interface Dia { data: string; dia: number; estado: Estado; oracamentoAntes: number; oracamentoDepois: number; ultrapassagem: number; dentroOrcamento: boolean; ocupante: { nome: string; valor: number } | null }
interface Analise { orcamentoMensal: number; calendario: { dias: Dia[] }; melhorData: { data: string } | null }
interface Solicitacao { id: string; cliente_id: string; forma_custeio: string; saldo_restante: number; status: string; clientes?: { nome_completo: string } | null; data_termos: string | null; previsao_sugerida: string | null }
interface ClienteAgenda { agendamentoId: string; clienteId: string; nome: string; dataTermos: string | null; previsaoAtual: string | null; valor: number; custeioConfirmado: boolean; cirurgiaRealizada: boolean; statusFinanceiro: string | null; formaCusteio: string | null; saldoRestante: number | null }
interface DataLiberacao { id: string; data: string; status: string; vagasOcupadas: number; clientes: { nome: string; valor: number }[] }

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const curta = (x: string | null) => x ? x.split("-").reverse().join("/") : "—";
const forma = (x: string | null) => x === "cartao" ? "Cartão de crédito" : x === "pix" ? "PIX" : x === "boleto_100" ? "100% boleto" : x === "cheques" ? "Cheques" : "—";
const diasAte = (x: string | null) => { if (!x) return null; const [y,m,d] = x.split("-").map(Number); const [hy,hm,hd] = hojeIso().split("-").map(Number); return Math.round((Date.UTC(y,m-1,d)-Date.UTC(hy,hm-1,hd))/86400000); };

export function CicloLiberacaoFinanceiraV2() {
  const hoje = hojeIso();
  const now = new Date();
  const [ano,setAno] = useState(now.getFullYear());
  const [mes,setMes] = useState(now.getMonth()+1);
  const [selecionado,setSelecionado] = useState("");
  const [busca,setBusca] = useState("");
  const [solicitacoes,setSolicitacoes] = useState<Solicitacao[]>([]);
  const [clientes,setClientes] = useState<ClienteAgenda[]>([]);
  const [datasLiberacao,setDatasLiberacao] = useState<DataLiberacao[]>([]);
  const [analise,setAnalise] = useState<Analise|null>(null);
  const [data,setData] = useState<string|null>(null);
  const [acaoData,setAcaoData] = useState<AcaoData>(null);
  const [confirmacao,setConfirmacao] = useState(false);
  const [amarela,setAmarela] = useState(false);
  const [modalCirurgia,setModalCirurgia] = useState<ClienteAgenda|null>(null);
  const [salvando,setSalvando] = useState(false);
  const [carregando,setCarregando] = useState(false);

  async function carregarDatasLiberacao() {
    const r = await fetch(`/api/admin/datas-liberacao-financeira?ano=${ano}&mes=${mes}`, { cache:"no-store" });
    if (!r.ok) return;
    const j = await r.json();
    setDatasLiberacao(j.datas ?? []);
  }

  async function buscar() {
    const [a,b] = await Promise.all([
      fetch("/api/admin/solicitacoes-liberacao-financeira", { cache:"no-store" }),
      fetch("/api/admin/clientes-agendamentos", { cache:"no-store" }),
      carregarDatasLiberacao(),
    ]);
    if (a.ok) setSolicitacoes((await a.json()).solicitacoes ?? []);
    if (b.ok) setClientes((await b.json()).clientes ?? []);
  }

  async function calendario() {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ ano:String(ano), mes:String(mes) });
      if (selecionado) q.set("agendamento_id", selecionado);
      const r = await fetch(`/api/admin/liberacao-inteligente?${q}`, { cache:"no-store" });
      if (r.ok) setAnalise(await r.json());
    } finally { setCarregando(false); }
  }

  useEffect(() => { void buscar(); const t = window.setInterval(() => void buscar(), 5000); return () => clearInterval(t); }, [ano,mes]);
  useEffect(() => { void calendario(); }, [ano,mes,selecionado]);

  useEffect(() => {
    const due = clientes.find(c => c.previsaoAtual && c.previsaoAtual <= hoje && !c.cirurgiaRealizada);
    if (!due) return;
    const k = `ciclo-${due.agendamentoId}-${due.previsaoAtual}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k,"1");
    setModalCirurgia(due);
  }, [clientes,hoje]);

  const q = busca.trim().toLocaleLowerCase("pt-BR");
  const pendentes = useMemo(() => solicitacoes.filter(s => ["pendente","em_analise"].includes(s.status) && (s.clientes?.nome_completo ?? "").toLocaleLowerCase("pt-BR").includes(q)), [solicitacoes,q]);
  const previsoes = useMemo(() => solicitacoes.filter(s => s.status === "aprovada" && (!q || (s.clientes?.nome_completo ?? "").toLocaleLowerCase("pt-BR").includes(q))), [solicitacoes,q]);
  const confirmadas = useMemo(() => clientes.filter(c => !q || c.nome.toLocaleLowerCase("pt-BR").includes(q)).sort((a,b) => (a.dataTermos ?? "").localeCompare(b.dataTermos ?? "")), [clientes,q]);
  const selecionada = useMemo(() => clientes.find(c => c.agendamentoId === selecionado) ?? null, [clientes,selecionado]);
  const dias = analise?.calendario.dias ?? [];
  const orc = analise?.orcamentoMensal ?? 0;
  const liberado = dias[0]?.oracamentoAntes ?? 0;
  const datasMap = useMemo(() => new Map(datasLiberacao.map(d => [d.data,d])), [datasLiberacao]);
  const solicitacaoSelecionada = useMemo(() => solicitacoes.find(s => s.id && s.cliente_id === selecionada?.clienteId && s.status === "aprovada" && !s.previsao_sugerida?.startsWith("0000")) ?? null, [solicitacoes,selecionada]);

  function mesDelta(n:number) {
    let m = mes+n, a = ano;
    if (m > 12) { m=1; a++; }
    if (m < 1) { m=12; a--; }
    setMes(m); setAno(a);
  }

  function selecionarCliente(clienteId:string, sugestao:string|null) {
    const c = clientes.find(x => x.clienteId === clienteId);
    if (!c) { toast.error("A data dos termos ainda não está disponível para esta solicitação."); return; }
    setSelecionado(c.agendamentoId);
    setData(sugestao);
    if (sugestao) { setMes(Number(sugestao.slice(5,7))); setAno(Number(sugestao.slice(0,4))); }
  }

  function selecionarSolicitacao(s:Solicitacao) {
    if (!s.data_termos) { toast.info("Aguardando a confirmação da assinatura dos termos para liberar a previsão financeira."); return; }
    selecionarCliente(s.cliente_id, s.previsao_sugerida);
  }

  async function confirmarCusteio(s:Solicitacao) {
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/solicitacoes-liberacao-financeira", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:s.id, status:"aprovada" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.erro ?? "Não foi possível confirmar o custeio."); return; }
      toast.success("Forma de custeio confirmada. A cliente já verá a liberação atualizada.");
      await buscar();
    } finally { setSalvando(false); }
  }

  async function alternarLiberacaoData() {
    if (!data || !acaoData) return;
    setSalvando(true);
    try {
      const url = "/api/admin/datas-liberacao-financeira";
      const r = acaoData === "liberar"
        ? await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})})
        : await fetch(`${url}?data=${encodeURIComponent(data)}`,{method:"DELETE"});
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.erro ?? "Não foi possível atualizar a data."); return; }
      toast.success(acaoData === "liberar" ? "Data liberada para previsão financeira." : "Data fechada para novas previsões.");
      setAcaoData(null);
      await Promise.all([carregarDatasLiberacao(),calendario()]);
    } finally { setSalvando(false); }
  }

  function clicarDia(x:Dia) {
    if (x.estado === "passado" || x.estado === "vermelho") return;
    if (selecionado) {
      if (!datasMap.has(x.data)) {
        setData(x.data);
        setAcaoData("liberar");
        return;
      }
      setData(x.data);
      if (x.estado === "amarelo") setAmarela(true); else setConfirmacao(true);
      return;
    }
    setData(x.data);
    setAcaoData(datasMap.has(x.data) ? "fechar" : "liberar");
  }

  async function salvarPrevisao() {
    if (!selecionado || !data) return;
    if (!datasMap.has(data)) { setAcaoData("liberar"); return; }
    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/agendamentos/${selecionado}/previsao`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({previsaoLiberacaoFinanceira:data}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.erro ?? "Não foi possível confirmar a previsão."); return; }
      toast.success("Previsão de liberação confirmada.");
      setConfirmacao(false); setAmarela(false); setData(null); setSelecionado("");
      await Promise.all([buscar(),calendario(),carregarDatasLiberacao()]);
    } finally { setSalvando(false); }
  }

  async function cirurgiaRealizada(c:ClienteAgenda) {
    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/agendamentos/${c.agendamentoId}/ciclo`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({cirurgiaRealizada:true}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.erro ?? "Não foi possível atualizar."); return; }
      toast.success("Cirurgia marcada como realizada.");
      setModalCirurgia(null);
      await buscar();
    } finally { setSalvando(false); }
  }

  return <div className="animate-fadeUp flex flex-col space-y-5 pb-8">
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose/10 bg-gradient-to-br from-blush/35 to-transparent px-5 py-4">
        <div>
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gold"/><h2 className="font-heading text-base text-burgundy">Agenda de liberação financeira</h2></div>
          <p className="mt-1 text-xs text-clay/50">Após a confirmação do custeio, a sugestão inicial é 90 dias após a assinatura dos termos. O administrador pode escolher outra data liberada.</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[0.58rem] font-semibold",liberado>=orc ? "border-alert/20 bg-alert/10 text-alert" : "border-success/20 bg-success/10 text-success")}>Liberado no mês {formatarMoeda(liberado)}/{formatarMoeda(orc)}</span>
      </div>
      {selecionada && <div className="mx-5 mt-4 rounded-xl border border-gold/20 bg-gold/10 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-[0.56rem] font-bold uppercase tracking-label text-gold">Cliente selecionada</p><p className="text-xs font-bold text-burgundy">{selecionada.nome}</p><p className="text-[0.6rem] text-clay/55">Termos: {curta(selecionada.dataTermos)} · Sugestão: {curta(data ?? null)}</p></div>
          <button onClick={()=>{setSelecionado("");setData(null)}} className="rounded-full border border-rose/12 px-2.5 py-1 text-[0.58rem] font-semibold text-clay/65">Trocar cliente</button>
        </div>
      </div>}
      <div className="px-5 pt-4"><div className="flex items-center justify-between rounded-full border border-rose/12 bg-white/80 p-1"><button onClick={()=>mesDelta(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy hover:bg-blush"><ChevronLeft className="h-4 w-4"/></button><span className="w-32 text-center text-sm font-medium text-burgundy">{nomeMes(mes)} {ano}</span><button onClick={()=>mesDelta(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy hover:bg-blush"><ChevronRight className="h-4 w-4"/></button></div></div>
      <div className="p-5"><div className="mx-auto w-full max-w-3xl"><div className="mb-2 grid grid-cols-7 text-center">{DIAS.map((x,i)=><span key={i} className="text-[0.62rem] font-semibold uppercase tracking-label text-rose/80">{x}</span>)}</div><div className="grid grid-cols-7 gap-2 sm:gap-2.5">{dias.map(x=>{const liberada=datasMap.has(x.data);const sugestao=data===x.data;const cl=x.estado==="vermelho"?"border-burgundy bg-burgundy font-semibold text-cream":x.estado==="amarelo"?"border-gold/60 bg-gold/15 font-semibold text-burgundy hover:bg-gold/25":x.estado==="passado"?"border-transparent bg-transparent text-clay/20":liberada?"border-success/40 bg-success/10 font-semibold text-success hover:bg-success/15":x.estado==="verde"?"border-success/25 bg-success/5 font-semibold text-success/80 hover:bg-success/10":"border-clay/[0.08] bg-clay/[0.035] text-clay/45 hover:bg-clay/[0.07]";return <button key={x.data} disabled={x.estado==="passado"||x.estado==="vermelho"} onClick={()=>clicarDia(x)} className={cn("group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition-all",cl,!liberada&&x.estado!=="passado"&&x.estado!=="vermelho"&&"opacity-60",x.data===hoje&&"ring-2 ring-gold/70 ring-offset-1",sugestao&&"ring-2 ring-gold ring-offset-2")}>{x.dia}{sugestao&&<Star className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gold p-0.5 text-white"/>}{liberada&&<span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-success"/>}</button>})}</div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-rose/10 pt-4 text-[0.68rem] text-clay/55"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success"/>Liberada</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gold"/>Acima do orçamento</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-burgundy"/>Ocupada</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-clay/15"/>Fechada</span></div><p className="mt-3 text-[0.68rem] text-clay/45">{selecionado ? "Clique em uma data para definir a previsão desta cliente." : "Clique em uma data para liberar ou fechar a agenda."}</p></div></div>
    </Card>

    <section className="rounded-2xl border border-rose/12 bg-[rgb(var(--surface-1))] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-gold"/><h2 className="font-heading text-sm text-burgundy">Fluxo financeiro</h2></div><p className="mt-0.5 text-[0.65rem] text-clay/50">Primeiro o administrador confirma o custeio. Depois a previsão de liberação é definida.</p></div><button onClick={()=>void buscar()} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose/12 bg-[rgb(var(--surface-2))] px-2.5 text-[0.62rem] font-semibold text-burgundy"><RefreshCw className="h-3 w-3"/> Atualizar</button></div>
      <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay/40"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar pelo nome..." className="h-9 w-full rounded-xl border border-rose/10 bg-[rgb(var(--surface-2))] pl-9 pr-3 text-xs text-burgundy outline-none placeholder:text-clay/35"/></div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gold/15 bg-[rgb(var(--surface-2))] p-2.5"><div className="flex items-center justify-between px-1 pb-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-label text-gold">Confirmar custeio</p><p className="text-[0.58rem] text-clay/45">A cliente escolheu e aguarda validação.</p></div><span className="rounded-full bg-gold/12 px-2 py-0.5 text-[0.6rem] font-bold text-burgundy">{pendentes.length}</span></div>{pendentes.length ? <div className="grid gap-1.5">{pendentes.slice(0,10).map(s=><div key={s.id} className="rounded-lg border border-rose/8 bg-[rgb(var(--surface-1))] p-2.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-burgundy">{s.clientes?.nome_completo ?? "Cliente"}</p><div className="mt-1 flex flex-wrap gap-1 text-[0.57rem] text-clay/55"><span>{forma(s.forma_custeio)}</span><span>{formatarMoeda(+s.saldo_restante)}</span>{s.data_termos&&<span>Termos {curta(s.data_termos)}</span>}</div></div><span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-burgundy">{s.status === "em_analise" ? "Em análise" : "Pendente"}</span></div><button disabled={salvando} onClick={()=>void confirmarCusteio(s)} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-burgundy px-2.5 py-2 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-cream disabled:opacity-50"><Check className="h-3 w-3"/> Confirmar forma de custeio</button></div>)}</div> : <p className="rounded-lg bg-clay/5 px-3 py-3 text-[0.66rem] text-clay/45">Nenhuma escolha aguardando validação.</p>}</div>

        <div className="rounded-xl border border-success/15 bg-[rgb(var(--surface-2))] p-2.5"><div className="flex items-center justify-between px-1 pb-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-label text-success">Solicitações de previsão</p><p className="text-[0.58rem] text-clay/45">Somente custeio já confirmado.</p></div><span className="rounded-full bg-success/10 px-2 py-0.5 text-[0.6rem] font-bold text-success">{previsoes.length}</span></div>{previsoes.length ? <div className="grid max-h-[18rem] gap-1.5 overflow-y-auto pr-1">{previsoes.map(s=><button key={s.id} onClick={()=>selecionarSolicitacao(s)} className="rounded-lg border border-success/10 bg-[rgb(var(--surface-1))] px-2.5 py-2 text-left"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-burgundy">{s.clientes?.nome_completo ?? "Cliente"}</span><span className="text-[0.52rem] font-bold uppercase text-success">Validado</span></div><div className="mt-1 flex flex-wrap gap-1.5 text-[0.57rem] text-clay/50"><span>{forma(s.forma_custeio)}</span><strong className="text-burgundy">{formatarMoeda(+s.saldo_restante)}</strong>{s.data_termos ? <span>Termos {curta(s.data_termos)}</span> : <span>Aguardando termos</span>}{s.previsao_sugerida&&<span className="rounded-full bg-gold/10 px-1.5 py-0.5 font-semibold text-burgundy">Sugestão: {curta(s.previsao_sugerida)}</span>}</div></button>)}</div> : <p className="rounded-lg bg-clay/5 px-3 py-3 text-[0.66rem] text-clay/45">Nenhuma solicitação pronta para previsão.</p>}</div>

        <div className="rounded-xl border border-rose/12 bg-[rgb(var(--surface-2))] p-2.5"><div className="flex items-center justify-between px-1 pb-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-label text-rose">Agendamentos confirmados</p><p className="text-[0.58rem] text-clay/45">A data dos termos já foi escolhida pela cliente.</p></div><span className="rounded-full bg-blush px-2 py-0.5 text-[0.6rem] font-bold text-burgundy">{confirmadas.length}</span></div>{confirmadas.length ? <div className="grid max-h-[18rem] gap-1.5 overflow-y-auto pr-1">{confirmadas.map(c=><button key={c.agendamentoId} onClick={()=>{setSelecionado(c.agendamentoId);if(c.previsaoAtual){setData(c.previsaoAtual);setMes(Number(c.previsaoAtual.slice(5,7)));setAno(Number(c.previsaoAtual.slice(0,4)));}else if(c.dataTermos){const d=new Date(`${c.dataTermos}T00:00:00`);d.setDate(d.getDate()+90);const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;setData(s);setMes(Number(s.slice(5,7)));setAno(Number(s.slice(0,4)));}}} className="rounded-lg border border-rose/8 bg-[rgb(var(--surface-1))] px-2.5 py-2 text-left"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-burgundy">{c.nome}</span>{c.previsaoAtual ? <span className="text-[0.52rem] font-bold text-success">Previsão {curta(c.previsaoAtual)}</span> : <span className="text-[0.52rem] font-bold text-gold">Aguardando previsão</span>}</div><div className="mt-1 flex flex-wrap gap-1.5 text-[0.57rem] text-clay/50"><span>Termos {curta(c.dataTermos)}</span>{c.formaCusteio&&<span>{forma(c.formaCusteio)}</span>}{c.saldoRestante!==null&&<span>{formatarMoeda(c.saldoRestante)}</span>}</div></button>)}</div> : <p className="rounded-lg bg-clay/5 px-3 py-3 text-[0.66rem] text-clay/45">Nenhum agendamento confirmado.</p>}</div>
      </div>
    </section>

    {selecionado && data && <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[0.56rem] font-bold uppercase tracking-label text-gold">Previsão em edição</p><p className="text-sm font-bold text-burgundy">{selecionada?.nome ?? "Cliente"}</p><p className="text-[0.62rem] text-clay/55">Sugestão padrão: 90 dias após os termos · selecionada: {curta(data)}</p></div><button onClick={()=>setData(selecionada?.dataTermos ?? null)} className="rounded-lg border border-rose/12 bg-[rgb(var(--surface-1))] px-3 py-2 text-[0.58rem] font-semibold text-burgundy">Voltar à sugestão</button></div></div>}

    {acaoData && data && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><Card className="w-full max-w-sm p-5"><div className="flex gap-3"><div className="rounded-full bg-blush p-2">{acaoData === "liberar" ? <Unlock className="h-4 w-4 text-burgundy"/> : <Lock className="h-4 w-4 text-burgundy"/>}</div><div><h2 className="font-heading text-base text-burgundy">{acaoData === "liberar" ? "Liberar esta data?" : "Fechar esta data?"}</h2><p className="mt-1 text-xs text-clay/60">{curta(data)}</p></div></div><p className="mt-3 rounded-xl bg-clay/5 p-3 text-[0.65rem] text-clay/60">{selecionado ? "Esta data será liberada para que a previsão desta cliente possa ser vinculada. Depois você poderá confirmar a previsão imediatamente." : acaoData === "liberar" ? "A data ficará disponível para novas previsões financeiras." : "A data deixará de aparecer como disponível para novas previsões."}</p><div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setAcaoData(null)} className="flex-1">Cancelar</Button><Button size="sm" loading={salvando} onClick={()=>void alternarLiberacaoData()} className="flex-1">{acaoData === "liberar" ? "Liberar" : "Fechar data"}</Button></div></Card></div>}

    {(confirmacao||amarela) && data && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><Card className="w-full max-w-sm p-5"><h2 className="font-heading text-base text-burgundy">{amarela ? "Atenção ao orçamento" : "Confirmar previsão?"}</h2><p className="mt-2 text-xs text-clay/60">Data: <strong>{curta(data)}</strong></p><p className="mt-2 rounded-xl bg-gold/10 p-3 text-[0.62rem] text-burgundy">A sugestão padrão é 90 dias após a assinatura dos termos. Você pode confirmar esta ou escolher qualquer outra data liberada.</p>{amarela && <p className="mt-2 rounded-xl bg-alert/10 p-3 text-[0.62rem] text-clay/65">Esta data ultrapassa o orçamento mensal.</p>}<div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={()=>{setConfirmacao(false);setAmarela(false)}} className="flex-1">Cancelar</Button><Button size="sm" loading={salvando} onClick={()=>void salvarPrevisao()} className="flex-1">Confirmar</Button></div></Card></div>}

    {modalCirurgia && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><Card className="w-full max-w-sm p-5"><div className="flex gap-3"><AlertCircle className="h-5 w-5 text-burgundy"/><div><h2 className="font-heading text-base text-burgundy">Hoje é a previsão de liberação</h2><p className="mt-1 text-xs text-clay/60"><strong>{modalCirurgia.nome}</strong>: a cirurgia foi realizada?</p><p className="mt-1 text-[0.62rem] text-clay/45">Previsão: {curta(modalCirurgia.previsaoAtual)}</p></div></div><div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setModalCirurgia(null)} className="flex-1">Ainda não</Button><Button size="sm" loading={salvando} onClick={()=>void cirurgiaRealizada(modalCirurgia)} className="flex-1">Sim, realizada</Button></div></Card></div>}

    {carregando && <p className="py-3 text-center text-[0.65rem] text-clay/40">Atualizando agenda…</p>}
  </div>;
}
