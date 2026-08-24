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
interface Solicitacao { id: string; cliente_id: string; forma_custeio: string; saldo_restante: number; status: string; clientes?: { nome_completo: string } | null; previsao_sugerida: string | null }
interface ClienteAgenda { agendamentoId: string; clienteId: string; nome: string; previsaoAtual: string | null; valor: number; custeioConfirmado: boolean; cirurgiaRealizada: boolean; statusFinanceiro: string | null; formaCusteio: string | null; saldoRestante: number | null }
interface DataLiberacao { id: string; data: string; status: string; vagasOcupadas: number; clientes: { nome: string; valor: number }[] }

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const curta = (x: string | null) => x ? x.split("-").reverse().join("/") : "—";
const forma = (x: string | null) => x === "cartao" ? "Cartão de crédito" : x === "pix" ? "PIX" : x === "boleto_100" ? "100% boleto" : "Cheques";
const diasAte = (x: string | null) => { if (!x) return null; const [y,m,d] = x.split("-").map(Number); const [hy,hm,hd] = hojeIso().split("-").map(Number); return Math.round((Date.UTC(y,m-1,d)-Date.UTC(hy,hm-1,hd))/86400000); };

export function CicloLiberacaoFinanceiraV2() {
  const hoje = hojeIso(), now = new Date();
  const [ano,setAno] = useState(now.getFullYear()), [mes,setMes] = useState(now.getMonth()+1), [selecionado,setSelecionado] = useState(""), [busca,setBusca] = useState("");
  const [solicitacoes,setSolicitacoes] = useState<Solicitacao[]>([]), [clientes,setClientes] = useState<ClienteAgenda[]>([]), [datasLiberacao,setDatasLiberacao] = useState<DataLiberacao[]>([]), [analise,setAnalise] = useState<Analise|null>(null);
  const [data,setData] = useState<string|null>(null), [modalCirurgia,setModalCirurgia] = useState<ClienteAgenda|null>(null), [confirmacao,setConfirmacao] = useState(false), [amarela,setAmarela] = useState(false), [acaoData,setAcaoData] = useState<AcaoData>(null), [salvando,setSalvando] = useState(false), [carregando,setCarregando] = useState(false);

  async function carregarDatasLiberacao() {
    const r = await fetch(`/api/admin/datas-liberacao-financeira?ano=${ano}&mes=${mes}`, { cache:"no-store" });
    if (!r.ok) return;
    const j = await r.json(); setDatasLiberacao(j.datas ?? []);
  }
  async function buscar() {
    const [a,b] = await Promise.all([fetch("/api/admin/solicitacoes-liberacao-financeira",{cache:"no-store"}), fetch("/api/admin/clientes-agendamentos",{cache:"no-store"}), carregarDatasLiberacao()]);
    if (a.ok) setSolicitacoes((await a.json()).solicitacoes ?? []);
    if (b.ok) setClientes((await b.json()).clientes ?? []);
  }
  async function calendario() {
    setCarregando(true);
    try { const q = new URLSearchParams({ano:String(ano),mes:String(mes)}); if (selecionado) q.set("agendamento_id",selecionado); const r = await fetch(`/api/admin/liberacao-inteligente?${q}`,{cache:"no-store"}); if (r.ok) setAnalise(await r.json()); }
    finally { setCarregando(false); }
  }
  useEffect(()=>{ void buscar(); const t=window.setInterval(()=>void buscar(),5000); return()=>clearInterval(t); },[ano,mes]);
  useEffect(()=>{ void calendario(); },[ano,mes,selecionado]);
  useEffect(()=>{ const due=clientes.find(c=>c.previsaoAtual&&c.previsaoAtual<=hoje&&!c.cirurgiaRealizada); if(!due)return; const k=`ciclo-${due.agendamentoId}-${due.previsaoAtual}`; if(sessionStorage.getItem(k))return; sessionStorage.setItem(k,"1"); setModalCirurgia(due); },[clientes,hoje]);

  const q=busca.trim().toLocaleLowerCase("pt-BR");
  const pendentes=useMemo(()=>solicitacoes.filter(s=>(s.clientes?.nome_completo??"").toLocaleLowerCase("pt-BR").includes(q)),[solicitacoes,q]);
  const confirmadas=useMemo(()=>clientes.filter(c=>Boolean(c.previsaoAtual)&&(!q||c.nome.toLocaleLowerCase("pt-BR").includes(q))).sort((a,b)=>(a.previsaoAtual??"").localeCompare(b.previsaoAtual??"")),[clientes,q]);
  const dias=analise?.calendario.dias??[], orc=analise?.orcamentoMensal??0, liberado=dias[0]?.oracamentoAntes??0;
  const datasMap=useMemo(()=>new Map(datasLiberacao.map(d=>[d.data,d])),[datasLiberacao]);

  function selecionar(s:Solicitacao){ const c=clientes.find(x=>x.clienteId===s.cliente_id); if(!c){toast.error("Agendamento não encontrado.");return;} setSelecionado(c.agendamentoId); setData(s.previsao_sugerida); if(s.previsao_sugerida){setMes(+s.previsao_sugerida.slice(5,7));setAno(+s.previsao_sugerida.slice(0,4));} }
  function mesDelta(n:number){let m=mes+n,a=ano;if(m>12){m=1;a++;}if(m<1){m=12;a--;}setMes(m);setAno(a);setData(null);}

  async function alternarLiberacaoData(){
    if(!data||!acaoData)return; setSalvando(true);
    try{
      const url="/api/admin/datas-liberacao-financeira";
      const r=acaoData==="liberar" ? await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})}) : await fetch(`${url}?data=${encodeURIComponent(data)}`,{method:"DELETE"});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){toast.error(j.erro??`Não foi possível ${acaoData==="liberar"?"liberar":"fechar"} a data.`);return;}
      toast.success(acaoData==="liberar"?"Data liberada para previsão financeira.":"Data fechada para novas previsões."); setAcaoData(null); await Promise.all([carregarDatasLiberacao(),calendario()]);
    }finally{setSalvando(false);}
  }
  async function salvarPrevisao(){
    if(!selecionado||!data)return;
    if(!datasMap.has(data)){toast.error("Primeiro libere essa data na agenda financeira.");return;}
    setSalvando(true);
    try{const r=await fetch(`/api/admin/agendamentos/${selecionado}/previsao`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({previsaoLiberacaoFinanceira:data})});const j=await r.json().catch(()=>({}));if(!r.ok)return toast.error(j.erro??"Não foi possível confirmar.");toast.success("Previsão confirmada.");setConfirmacao(false);setAmarela(false);setData(null);await Promise.all([buscar(),calendario(),carregarDatasLiberacao()]);}
    finally{setSalvando(false);}
  }
  async function ciclo(c:ClienteAgenda,field:"custeioConfirmado"|"cirurgiaRealizada",value=true){setSalvando(true);try{const r=await fetch(`/api/admin/agendamentos/${c.agendamentoId}/ciclo`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({[field]:value})});const j=await r.json().catch(()=>({}));if(!r.ok)return toast.error(j.erro??"Não foi possível atualizar.");toast.success(field==="custeioConfirmado"?"Custeio confirmado.":"Cirurgia realizada.");setModalCirurgia(null);await buscar();}finally{setSalvando(false);}}
  function clicarDia(x:Dia){
    if(x.estado==="passado"||x.estado==="vermelho")return;
    if(selecionado){if(!datasMap.has(x.data)){toast.error("Esta data ainda não está liberada. Desmarque a cliente para liberar a data.");return;}setData(x.data);if(x.estado==="amarelo")setAmarela(true);else setConfirmacao(true);return;}
    setData(x.data);setAcaoData(datasMap.has(x.data)?"fechar":"liberar");
  }

  return <div className="animate-fadeUp flex flex-col space-y-5 pb-8">
    {analise&&<Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose/10 bg-gradient-to-br from-blush/35 to-transparent px-5 py-4">
        <div>
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gold"/><h2 className="font-heading text-base text-burgundy">Agenda de liberação</h2></div>
          <p className="mt-1 text-xs text-clay/50">A sugestão do sistema é 90 dias após a assinatura dos termos.</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[0.58rem] font-semibold",liberado>=orc?"border-alert/20 bg-alert/10 text-alert":"border-success/20 bg-success/10 text-success")}>Valor já liberado esse mês {formatarMoeda(liberado)}/{formatarMoeda(orc)}</span>
      </div>
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between rounded-full border border-rose/12 bg-white/80 p-1">
          <button onClick={()=>mesDelta(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy hover:bg-blush"><ChevronLeft className="h-4 w-4"/></button>
          <span className="w-32 text-center text-sm font-medium text-burgundy">{nomeMes(mes)} {ano}</span>
          <button onClick={()=>mesDelta(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-burgundy hover:bg-blush"><ChevronRight className="h-4 w-4"/></button>
        </div>
      </div>
      <div className="p-5">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-2 grid grid-cols-7 text-center">{DIAS.map((x,i)=><span key={i} className="text-[0.62rem] font-semibold uppercase tracking-label text-rose/80">{x}</span>)}</div>
          <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
            {dias.map(x=>{const sug=analise.melhorData?.data===x.data,liberada=datasMap.has(x.data);const cl=x.estado==="vermelho"?"border-burgundy bg-burgundy font-semibold text-cream":x.estado==="amarelo"?"border-gold/60 bg-gold/15 font-semibold text-burgundy hover:bg-gold/25":x.estado==="passado"?"border-transparent bg-transparent text-clay/20":liberada?"border-success/40 bg-success/10 font-semibold text-success hover:bg-success/15":x.estado==="verde"?"border-success/25 bg-success/5 font-semibold text-success/80 hover:bg-success/10":"border-clay/[0.08] bg-clay/[0.035] text-clay/45 hover:bg-clay/[0.07]";return <button key={x.data} disabled={x.estado==="passado"||x.estado==="vermelho"} onClick={()=>clicarDia(x)} title={x.estado==="vermelho"?"Data ocupada":liberada?"Data liberada — clique para fechar":"Data fechada — clique para liberar"} className={cn("group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition-all",cl,!liberada&&x.estado!=="passado"&&x.estado!=="vermelho"&&"opacity-60",x.data===hoje&&"ring-2 ring-gold/70 ring-offset-1",x.data===data&&"ring-2 ring-burgundy ring-offset-2",sug&&"ring-2 ring-gold ring-offset-2")}>{x.dia}{sug&&<Star className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gold p-0.5 text-white"/>}{liberada&&x.estado!=="vermelho"&&<span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-success"/>}</button>})}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-rose/10 pt-4 text-[0.68rem] text-clay/55">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success"/>Liberada</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gold"/>Acima do orçamento</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-burgundy"/>Ocupada</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-clay/15"/>Fechada</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-gold"/>Hoje</span>
          </div>
          <p className="mt-3 text-[0.68rem] text-clay/45">{selecionado?"Cliente selecionada: clique em uma data liberada para definir a previsão.":"Sem cliente selecionada: clique em uma data para liberar ou fechar."}</p>
        </div>
      </div>
    </Card>}

    <section className="rounded-2xl border border-rose/12 bg-[rgb(var(--surface-1))] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-gold"/><h2 className="font-heading text-sm text-burgundy">Solicitações de previsão</h2></div><p className="mt-0.5 text-[0.65rem] text-clay/50">Sem previsão → aguardando. Com previsão → confirmada.</p></div><button onClick={()=>void buscar()} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose/12 bg-[rgb(var(--surface-2))] px-2.5 text-[0.62rem] font-semibold text-burgundy"><RefreshCw className="h-3 w-3"/> Atualizar</button></div>
      <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay/40"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente…" className="h-9 w-full rounded-xl border border-rose/10 bg-[rgb(var(--surface-2))] pl-9 pr-3 text-xs text-burgundy outline-none placeholder:text-clay/35"/></div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-gold/15 bg-[rgb(var(--surface-2))] p-2.5"><div className="flex items-center justify-between px-1 pb-2"><p className="text-[0.58rem] font-bold uppercase tracking-label text-rose">Aguardando previsão</p><span className="rounded-full bg-gold/12 px-2 py-0.5 text-[0.6rem] font-bold text-burgundy">{pendentes.length}</span></div>{pendentes.length?<div className="grid gap-1.5">{pendentes.slice(0,7).map(s=><button key={s.id} onClick={()=>selecionar(s)} className="rounded-lg border border-rose/8 bg-[rgb(var(--surface-1))] px-2.5 py-2 text-left"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-burgundy">{s.clientes?.nome_completo??"Cliente"}</span><span className="text-[0.52rem] font-bold uppercase text-burgundy">{s.status}</span></div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.57rem] text-clay/50"><span>{forma(s.forma_custeio)}</span><strong className="text-burgundy">{formatarMoeda(+s.saldo_restante)}</strong>{s.previsao_sugerida&&<span className="rounded-full bg-gold/10 px-1.5 py-0.5 font-semibold text-burgundy">Sugestão 90 dias: {curta(s.previsao_sugerida)}</span>}</div></button>)}</div>:<p className="rounded-lg bg-clay/5 px-3 py-3 text-[0.66rem] text-clay/45">Nenhuma cliente aguardando previsão.</p>}</div>
        <div className="rounded-xl border border-success/15 bg-[rgb(var(--surface-2))] p-2.5"><div className="flex items-center justify-between px-1 pb-2"><div><p className="text-[0.58rem] font-bold uppercase tracking-label text-success">Previsões confirmadas</p><p className="text-[0.6rem] text-clay/45">Ficam aqui até custeio + cirurgia serem concluídos.</p></div><span className="rounded-full bg-success/10 px-2 py-0.5 text-[0.6rem] font-bold text-success">{confirmadas.length}</span></div>{confirmadas.length?<div className="grid max-h-[22rem] gap-1.5 overflow-y-auto pr-1">{confirmadas.map(c=>{const due=(diasAte(c.previsaoAtual)??1)<=0;return <div key={c.agendamentoId} className="rounded-lg border border-success/10 bg-[rgb(var(--surface-1))] p-2.5"><button onClick={()=>{setSelecionado(c.agendamentoId);if(c.previsaoAtual){setMes(+c.previsaoAtual.slice(5,7));setAno(+c.previsaoAtual.slice(0,4));}}} className="flex w-full items-start justify-between gap-2 text-left"><div className="min-w-0"><p className="truncate text-xs font-bold text-burgundy">{c.nome}</p><div className="mt-1 flex flex-wrap gap-1"><span className="rounded-full bg-blush px-1.5 py-0.5 text-[0.52rem] text-clay/65">Liberação {curta(c.previsaoAtual)}</span><span className="rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[0.52rem] text-clay/65">{forma(c.formaCusteio)}</span>{c.saldoRestante!==null&&<span className="rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[0.52rem] text-clay/65">Restante {formatarMoeda(c.saldoRestante)}</span>}</div></div><Clock3 className={cn("h-4 w-4",due?"text-alert":"text-success")}/></button><div className="mt-2 flex flex-wrap gap-1.5"><button disabled={salvando} onClick={()=>void ciclo(c,"custeioConfirmado",!c.custeioConfirmado)} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.56rem] font-semibold",c.custeioConfirmado?"border-success/30 bg-success/10 text-success":"border-rose/10 bg-[rgb(var(--surface-2))] text-clay/65")}><Check className="h-3 w-3"/>{c.custeioConfirmado?"Custeio confirmado":"Confirmar custeio"}</button><button disabled={salvando||!due} onClick={()=>due&&void ciclo(c,"cirurgiaRealizada")} className={cn("rounded-full border px-2 py-1 text-[0.56rem] font-semibold",c.cirurgiaRealizada?"border-success/30 bg-success/10 text-success":due?"border-burgundy/15 bg-burgundy/5 text-burgundy":"border-clay/10 bg-clay/5 text-clay/35")}>{c.cirurgiaRealizada?"Cirurgia realizada":"Cirurgia realizada"}</button></div></div>})}</div>:<p className="rounded-lg bg-clay/5 px-3 py-3 text-[0.66rem] text-clay/45">Nenhuma previsão ativa.</p>}</div>
      </div>
    </section>

    {acaoData&&data&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><Card className="w-full max-w-sm p-5"><div className="flex gap-3"><div className="rounded-full bg-blush p-2">{acaoData==="liberar"?<Unlock className="h-4 w-4 text-burgundy"/>:<Lock className="h-4 w-4 text-burgundy"/>}</div><div><h2 className="font-heading text-base text-burgundy">{acaoData==="liberar"?"Liberar esta data?":"Fechar esta data?"}</h2><p className="mt-1 text-xs text-clay/60">{curta(data)}</p></div></div><p className="mt-3 rounded-xl bg-clay/5 p-3 text-[0.65rem] text-clay/60">{acaoData==="liberar"?"A data ficará disponível para que uma previsão financeira seja confirmada.":"A data deixará de aparecer como disponível para novas previsões. Datas com cliente já confirmada não podem ser fechadas."}</p><div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setAcaoData(null)} className="flex-1">Cancelar</Button><Button size="sm" loading={salvando} onClick={()=>void alternarLiberacaoData()} className="flex-1">{acaoData==="liberar"?"Liberar":"Fechar data"}</Button></div></Card></div>}
    {modalCirurgia&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><Card className="w-full max-w-sm p-5"><div className="flex gap-3"><AlertCircle className="h-5 w-5 text-burgundy"/><div><h2 className="font-heading text-base text-burgundy">Hoje é a previsão de liberação</h2><p className="mt-1 text-xs text-clay/60"><strong>{modalCirurgia.nome}</strong>: a cirurgia foi realizada?</p><p className="mt-1 text-[0.62rem] text-clay/45">Previsão: {curta(modalCirurgia.previsaoAtual)}</p></div></div><div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setModalCirurgia(null)} className="flex-1">Ainda não</Button><Button size="sm" loading={salvando} onClick={()=>void ciclo(modalCirurgia,"cirurgiaRealizada")} className="flex-1">Sim, realizada</Button></div></Card></div>}
    {(confirmacao||amarela)&&data&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><Card className="w-full max-w-sm p-5"><h2 className="font-heading text-base text-burgundy">{amarela?"Atenção ao orçamento":"Confirmar previsão?"}</h2><p className="mt-2 text-xs text-clay/60">Data: <strong>{curta(data)}</strong></p>{!amarela&&<p className="mt-2 rounded-xl bg-gold/10 p-3 text-[0.62rem] text-burgundy">A sugestão padrão é 90 dias após a assinatura dos termos.</p>}{amarela&&<p className="mt-2 rounded-xl bg-alert/10 p-3 text-[0.62rem] text-clay/65">Esta data ultrapassa o orçamento mensal.</p>}<div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={()=>{setConfirmacao(false);setAmarela(false)}} className="flex-1">Cancelar</Button><Button size="sm" loading={salvando} onClick={()=>void salvarPrevisao()} className="flex-1">Confirmar</Button></div></Card></div>}
    {carregando&&<p className="py-3 text-center text-[0.65rem] text-clay/40">Atualizando agenda…</p>}
  </div>;
}
