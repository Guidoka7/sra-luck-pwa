"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Check, FileText, IdCard, Paperclip, Receipt, Trash2, UserRound, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { formatarCpf } from "@/lib/cpf";
import { desmascararMoeda, formatarMoeda, mascararMoedaInput } from "@/lib/utils";
import type { Boleto, Cliente, QuantidadeParcelas } from "@/types/database";
import { QUANTIDADE_PARCELAS_OPCOES, STATUS_BOLETO_LABEL, TAXA_ADMINISTRATIVA_PADRAO } from "@/types/database";

const moeda = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (v: string | null) => v ? v.split("-").reverse().join("/") : "—";

function BadgeInput({ label, value, onChange, prefix = "", suffix = "", inputMode = "decimal" }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; inputMode?: "decimal" | "numeric" }) {
  return <div className="min-w-0"><Label>{label}</Label><div className="mt-1 flex h-10 items-center rounded-lg border border-white/10 bg-black/10 px-2 text-xs font-semibold text-rose transition focus-within:border-rose/45 focus-within:bg-rose/[0.04]"><span className="shrink-0 text-rose/75">{prefix}</span><input inputMode={inputMode} value={value} onChange={e => onChange(e.target.value)} className="min-w-0 w-full bg-transparent px-1.5 text-xs font-semibold text-rose outline-none placeholder:text-pearl/20" /><span className="shrink-0 text-rose/70">{suffix}</span></div></div>;
}

export function ModalClienteCompactoV3({ cliente, onClose, onSalvo }: { cliente: Cliente | null; onClose: () => void; onSalvo: () => void }) {
  const editando = Boolean(cliente);
  const [aba, setAba] = useState<"dados" | "boletos">(cliente ? "boletos" : "dados");
  const [nome, setNome] = useState(cliente?.nome_completo ?? "");
  const [cpf, setCpf] = useState(cliente ? formatarCpf(cliente.cpf) : "");
  const [nascimento, setNascimento] = useState(cliente?.data_nascimento ?? "");
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "");
  const [email, setEmail] = useState(cliente?.email ?? "");
  const [procedimento, setProcedimento] = useState(cliente?.procedimento ?? "");
  const [carta, setCarta] = useState(cliente ? moeda(cliente.valor_contrato) : "");
  const [quantidade, setQuantidade] = useState<QuantidadeParcelas>((cliente?.quantidade_parcelas ?? 12) as QuantidadeParcelas);
  const [taxa, setTaxa] = useState(cliente?.taxa_administrativa_percentual != null ? String(cliente.taxa_administrativa_percentual).replace(".", ",") : String(TAXA_ADMINISTRATIVA_PADRAO[(cliente?.quantidade_parcelas ?? 12) as QuantidadeParcelas]).replace(".", ","));
  const [total, setTotal] = useState(() => cliente ? moeda(cliente.valor_contrato * (1 + Number(cliente.taxa_administrativa_percentual ?? 0) / 100)) : "");
  const [parcela, setParcela] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [observacoes, setObservacoes] = useState(cliente?.observacoes_internas ?? "");
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [carregando, setCarregando] = useState(Boolean(cliente));
  const [salvando, setSalvando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const cartaNumero = Number(desmascararMoeda(carta)) || 0;
  const taxaNumero = Number(taxa.replace(",", ".")) || 0;
  const totalNumero = Number(desmascararMoeda(total)) || 0;
  const parcelaNumero = Number(desmascararMoeda(parcela)) || 0;
  const totalAutomatico = cartaNumero * (1 + taxaNumero / 100);
  const parcelaAutomatica = quantidade ? totalAutomatico / quantidade : 0;

  useEffect(() => {
    if (!parcela && parcelaAutomatica > 0) setParcela(moeda(parcelaAutomatica));
  }, [parcela, parcelaAutomatica]);

  function atualizarCarta(valor: string) {
    const novaCarta = mascararMoedaInput(valor); setCarta(novaCarta);
    const n = Number(desmascararMoeda(novaCarta)) || 0; const novoTotal = n * (1 + taxaNumero / 100);
    setTotal(moeda(novoTotal)); setParcela(moeda(quantidade ? novoTotal / quantidade : 0));
  }
  function atualizarTaxa(valor: string) {
    setTaxa(valor); const novaTaxa = Number(valor.replace(",", ".")) || 0; const novoTotal = cartaNumero * (1 + novaTaxa / 100);
    setTotal(moeda(novoTotal)); setParcela(moeda(quantidade ? novoTotal / quantidade : 0));
  }
  function atualizarQuantidade(valor: string) {
    const q = Number(valor) as QuantidadeParcelas; setQuantidade(q); setParcela(moeda(q ? totalNumero / q : 0));
  }
  function atualizarTotal(valor: string) {
    const novo = mascararMoedaInput(valor); setTotal(novo); const n = Number(desmascararMoeda(novo)) || 0; setCarta(mascararMoedaInput(String((n / (1 + taxaNumero / 100)).toFixed(2)))); setParcela(moeda(quantidade ? n / quantidade : 0));
  }
  function atualizarParcela(valor: string) {
    const novo = mascararMoedaInput(valor); setParcela(novo); const n = Number(desmascararMoeda(novo)) || 0; const novoTotal = n * quantidade; setTotal(moeda(novoTotal)); setCarta(mascararMoedaInput(String((novoTotal / (1 + taxaNumero / 100)).toFixed(2))));
  }

  async function carregarBoletos() {
    if (!cliente?.id) return; setCarregando(true);
    try { const r = await fetch(`/api/admin/clientes/${cliente.id}/boletos`, { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.erro ?? "Não foi possível carregar os boletos."); const lista = d.boletos ?? []; setBoletos(lista); if (lista[0]?.total_parcelas) setQuantidade(Number(lista[0].total_parcelas) as QuantidadeParcelas); if (lista[0]?.valor) setParcela(moeda(Number(lista[0].valor))); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar parcelas."); } finally { setCarregando(false); }
  }
  useEffect(() => { void carregarBoletos(); }, [cliente?.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!nome || !nascimento || totalNumero <= 0) return toast.error("Preencha nome, nascimento e valor total."); if (!editando && !vencimento) return toast.error("Informe o 1º vencimento para gerar as parcelas."); setSalvando(true);
    try {
      const cartaEfetiva = totalNumero / (1 + taxaNumero / 100);
      const r = await fetch(editando ? `/api/admin/clientes/${cliente!.id}` : "/api/admin/clientes", { method: editando ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomeCompleto: nome, cpf, dataNascimento: nascimento, telefone, email, procedimento, valorContrato: cartaEfetiva, taxaAdministrativaPercentual: taxaNumero, ativo, observacoes, recalcularBoletosAbertos: true, valorParcela: parcelaNumero > 0 ? parcelaNumero : undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.erro ?? "Não foi possível salvar.");
      if (!editando && d.cliente?.id) { const g = await fetch(`/api/admin/clientes/${d.cliente.id}/boletos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantidadeParcelas: quantidade, taxaPercentual: taxaNumero, primeiroVencimento: vencimento, valorParcela: parcelaNumero > 0 ? parcelaNumero : undefined }) }); if (!g.ok) { const gd = await g.json(); throw new Error(gd.erro ?? "Não foi possível gerar as parcelas."); } }
      toast.success(editando ? "Dados da cliente atualizados." : "Cliente cadastrada."); onSalvo(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setSalvando(false); }
  }

  async function ajustar() {
    if (!cliente) return; setAjustando(true);
    try { const r = await fetch(`/api/admin/clientes/${cliente.id}/boletos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantidadeParcelas: quantidade, taxaPercentual: taxaNumero, recalcularAbertas: true, primeiroVencimento: vencimento || undefined, valorParcela: parcelaNumero > 0 ? parcelaNumero : undefined }) }); const d = await r.json(); if (!r.ok) throw new Error(d.erro ?? "Não foi possível ajustar."); setBoletos(d.boletos ?? []); toast.success("Parcelamento atualizado."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao ajustar parcelas."); } finally { setAjustando(false); }
  }
  async function rejeitar(b: Boleto) { if (!b.comprovante_url) return; if (!window.confirm(`Rejeitar o comprovante da parcela ${b.numero_parcela}/${b.total_parcelas}? A parcela voltará para Em aberto.`)) return; setRejeitando(b.id); try { const r = await fetch(`/api/admin/boletos/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "rejeitar", observacoes: "Comprovante rejeitado pelo administrador." }) }); const d = await r.json(); if (!r.ok) throw new Error(d.erro ?? "Não foi possível rejeitar."); setBoletos(v => v.map(x => x.id === b.id ? { ...x, status: "nao_pago", data_pagamento: null } : x)); toast.success("Comprovante rejeitado. Parcela em aberto."); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao rejeitar."); } finally { setRejeitando(null); } }
  async function excluirCliente() { if (!cliente?.id) return; setExcluindo(true); try { const r = await fetch(`/api/admin/clientes/${cliente.id}`, { method: "DELETE" }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro ?? "Não foi possível excluir o perfil da cliente."); toast.success("Perfil da cliente excluído com sucesso."); setConfirmarExclusao(false); onSalvo(); onClose(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir o perfil."); } finally { setExcluindo(false); } }

  const visiveis = mostrarTodas ? boletos : boletos.slice(0, 8); const pagas = boletos.filter(b => b.status === "pago").length;
  return <Portal><div className="fixed inset-0 z-40 flex items-center justify-center bg-burgundy-dark/55 px-2 py-2.5 backdrop-blur-md sm:px-4 sm:py-4"><div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1b181b] text-pearl shadow-2xl">
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3.5 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose/15 text-rose"><UserRound className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-heading text-base font-semibold text-rose">{nome || "Nova cliente"}</p><p className="text-[0.58rem] uppercase tracking-[0.15em] text-pearl/35">{editando ? "Perfil compacto" : "Cadastro rápido"}</p></div></div><div className="flex items-center gap-1.5">{editando && <button type="button" onClick={() => setConfirmarExclusao(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-alert/30 bg-alert/10 px-2.5 py-2 text-[0.58rem] font-bold text-alert hover:bg-alert/20" title="Excluir perfil da cliente"><Trash2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Excluir cliente</span></button>}<button type="button" onClick={onClose} className="rounded-lg p-1.5 text-pearl/35 hover:bg-white/5"><X className="h-4 w-4" /></button></div></header>
    <div className="border-b border-white/8 bg-black/10 px-3 py-2"><div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.035] p-1"><button type="button" onClick={() => setAba("dados")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[0.68rem] font-semibold ${aba === "dados" ? "bg-rose text-white" : "text-pearl/45 hover:bg-white/5"}`}><IdCard className="h-3.5 w-3.5" /> Dados pessoais</button><button type="button" disabled={!editando} onClick={() => setAba("boletos")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[0.68rem] font-semibold disabled:opacity-30 ${aba === "boletos" ? "bg-rose text-white" : "text-pearl/45 hover:bg-white/5"}`}><Receipt className="h-3.5 w-3.5" /> Boletos {boletos.length > 0 && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[0.5rem]">{boletos.length}</span>}</button></div></div>
    <form id="cliente-v3-form" onSubmit={salvar} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      {aba === "dados" ? <div className="space-y-2.5">
        <section className="rounded-xl border border-rose/10 bg-white/[0.025] p-3"><div className="mb-2.5 flex items-center gap-2"><IdCard className="h-3.5 w-3.5 text-rose" /><h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-rose">Dados pessoais</h3></div><div className="grid grid-cols-2 gap-2"><div className="col-span-2"><Label>Nome completo</Label><Input value={nome} onChange={e => setNome(e.target.value)} required /></div><div><Label>CPF</Label><Input value={cpf} maxLength={14} disabled={editando} onChange={e => setCpf(formatarCpf(e.target.value))} /></div><div><Label>Nascimento</Label><Input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} required /></div><div><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} /></div><div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div><div className="col-span-2"><Label>Procedimento</Label><Input value={procedimento} onChange={e => setProcedimento(e.target.value)} /></div></div></section>
        <section className="rounded-xl border border-rose/10 bg-white/[0.025] p-3"><div className="mb-2 flex items-center gap-2"><WalletCards className="h-3.5 w-3.5 text-rose" /><h3 className="text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-rose">Configuração financeira</h3></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><div><Label>Plano</Label><Select value={String(quantidade)} onChange={e => atualizarQuantidade(e.target.value)}>{QUANTIDADE_PARCELAS_OPCOES.map(q => <option key={q} value={q}>{q}x</option>)}</Select></div><BadgeInput label="Taxa adm." value={taxa} suffix="%" onChange={atualizarTaxa} /><BadgeInput label="Carta de crédito" value={carta} prefix="R$" onChange={atualizarCarta} /><BadgeInput label="Valor da parcela" value={parcela} prefix="R$" onChange={atualizarParcela} /><BadgeInput label="Valor total" value={total} prefix="R$" onChange={atualizarTotal} /></div><p className="mt-2 text-[0.55rem] text-pearl/30">Os valores são calculados automaticamente, mas podem ser ajustados manualmente. Ao editar o total, a carta e a parcela são sincronizadas; ao editar a parcela, o total é recalculado.</p><div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2"><div><Label>1º vencimento</Label><Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} /></div>{editando && <Button type="button" size="sm" variant="secondary" disabled={ajustando} onClick={ajustar}><CalendarDays className="h-3.5 w-3.5" />{ajustando ? "Atualizando" : "Atualizar abertas"}</Button>}</div></section>
        <section className="rounded-xl border border-rose/10 bg-white/[0.025] p-3"><Label>Observações internas</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1.5" /></section><label className="flex items-center gap-2 text-xs text-pearl/55"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Cliente ativa</label>
      </div> : <div className="space-y-2.5"><section className="rounded-xl border border-rose/10 bg-white/[0.025] p-3"><div className="flex items-center justify-between"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-rose">Comprovantes por parcela</p><p className="mt-0.5 text-[0.62rem] text-pearl/35">{pagas} de {boletos.length} parcelas com pagamento registrado.</p></div><span className="rounded-full bg-success/10 px-2 py-1 text-[0.55rem] font-semibold text-success">Anexo = pago</span></div></section>{carregando ? <div className="p-6 text-center text-xs text-pearl/35">Carregando parcelas…</div> : <div className="overflow-hidden rounded-xl border border-white/8">{visiveis.map(b => <div key={b.id} className="grid grid-cols-[48px_1fr_auto] items-center gap-2 border-b border-white/6 px-2.5 py-2 last:border-0"><span className="text-[0.62rem] font-semibold text-pearl/65">{b.numero_parcela}/{b.total_parcelas}</span><div className="min-w-0"><div className="flex gap-2 text-[0.62rem] text-pearl/45"><span>{dataBr(b.data_vencimento)}</span><span className="font-semibold text-pearl/80">R$ {moeda(b.valor)}</span></div><p className={`mt-0.5 text-[0.52rem] ${b.status === "pago" ? "text-success" : b.comprovante_url ? "text-alert" : "text-pearl/30"}`}>{STATUS_BOLETO_LABEL[b.status]}{b.comprovante_url ? " · comprovante anexado" : ""}</p></div><div className="flex items-center gap-1">{b.comprovante_url ? <><a href={`/api/admin/boletos/${b.id}/comprovante`} target="_blank" rel="noopener noreferrer" title="Abrir comprovante" className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose/10 text-rose hover:bg-rose/20"><Paperclip className="h-4 w-4" /></a><button type="button" onClick={() => rejeitar(b)} disabled={rejeitando === b.id} title="Rejeitar comprovante" className="flex h-8 w-8 items-center justify-center rounded-lg bg-alert/10 text-alert hover:bg-alert/15 disabled:opacity-40"><X className="h-4 w-4" /></button></> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-pearl/20"><FileText className="h-4 w-4" /></span>}</div></div>)}</div>}{boletos.length > 8 && <button type="button" onClick={() => setMostrarTodas(v => !v)} className="w-full rounded-lg py-2 text-[0.62rem] font-semibold text-rose hover:bg-rose/5">{mostrarTodas ? "Mostrar menos" : `Ver todas as ${boletos.length} parcelas`}</button>}</div>}
      <footer className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3"><span className="text-[0.55rem] uppercase tracking-[0.14em] text-pearl/25">Financeiro e comprovantes</span><div className="flex gap-2"><Button type="button" variant="secondary" size="sm" onClick={onClose}>Fechar</Button>{aba === "dados" && <Button type="submit" disabled={salvando} size="sm"><Check className="h-3.5 w-3.5" />{salvando ? "Salvando" : "Salvar"}</Button>}</div></footer>
    </form>
  </div></div>
  {confirmarExclusao && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="confirmar-exclusao-titulo" className="w-full max-w-sm rounded-2xl border border-alert/20 bg-[#1b181b] p-4 text-pearl shadow-2xl"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-alert/10 text-alert"><AlertTriangle className="h-4 w-4" /></span><div className="min-w-0"><h2 id="confirmar-exclusao-titulo" className="font-heading text-sm font-semibold text-rose">Excluir perfil da cliente?</h2><p className="mt-1 text-[0.68rem] leading-relaxed text-pearl/55">Você está prestes a excluir permanentemente o perfil de <strong className="text-pearl/80">{nome}</strong>, incluindo parcelas, agendamentos e demais dados vinculados. Essa ação não pode ser desfeita.</p></div></div><div className="mt-4 flex gap-2"><Button type="button" variant="secondary" className="flex-1" disabled={excluindo} onClick={() => setConfirmarExclusao(false)}>Cancelar</Button><button type="button" disabled={excluindo} onClick={() => void excluirCliente()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-alert px-3 py-2 text-[0.65rem] font-bold text-white transition hover:opacity-90 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />{excluindo ? "Excluindo…" : "Excluir definitivamente"}</button></div></div></div>}
  </Portal>;
}
