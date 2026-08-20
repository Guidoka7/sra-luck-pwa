"use client";
import { refreshInstant, invalidateInstantCache, getInstantCache } from "@/lib/instantCache";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  Lock,
  MessageCircle,
  MonitorCog,
  Phone,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
  Unlock,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/admin/ExecutiveUI";

interface ConfiguracoesData {
  id: number;
  nome_clinica: string;
  meta_orcamento_mensal: number;
  frase_sonho: string;
  pix_chave: string;
  pix_qrcode_base64: string;
  pix_desconto_percentual: number;
  whatsapp_contato: string;
  telefone_contato: string;
  agenda_liberacao_financeira_bloqueada: boolean;
  updated_at: string;
}

const TAMANHO_MAXIMO_QRCODE = 1.5 * 1024 * 1024;
const OPCOES_DESCONTO_PIX = [0, 5, 10, 15, 20, 25, 30];
const CAMPO_INPUT = "h-9 rounded-lg border border-burgundy/10 bg-white/75 px-3 text-sm text-clay shadow-sm outline-none transition placeholder:text-clay/35 focus:border-gold/60 focus:ring-2 focus:ring-gold/15 dark:border-white/10 dark:bg-white/[0.045] dark:text-pearl dark:placeholder:text-pearl/30";
const PANEL = "rounded-2xl border border-burgundy/10 bg-white/75 shadow-[0_14px_45px_-32px_rgba(88,25,38,.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_14px_45px_-32px_rgba(0,0,0,.8)]";
const MINI = "rounded-xl border border-burgundy/10 bg-white/55 dark:border-white/10 dark:bg-white/[0.025]";

function SectionTitle({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-burgundy/8 text-burgundy dark:bg-white/[0.07] dark:text-rose"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><h2 className="text-sm font-semibold text-burgundy dark:text-pearl">{title}</h2><p className="truncate text-[11px] leading-4 text-clay/45 dark:text-pearl/35">{description}</p></div>
    </div>
  );
}
function FieldHint({ children }: { children: React.ReactNode }) { return <p className="mt-1 text-[10px] leading-4 text-clay/40 dark:text-pearl/30">{children}</p>; }

export default function ConfiguracoesPage() {
  const [dados, setDados] = useState<ConfiguracoesData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [nomeClinica, setNomeClinica] = useState("");
  const [meta, setMeta] = useState("");
  const [frase, setFrase] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixDesconto, setPixDesconto] = useState("0");
  const [whatsapp, setWhatsapp] = useState("");
  const [telefone, setTelefone] = useState("");
  const [agendaBloqueada, setAgendaBloqueada] = useState(false);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  function aplicarConfiguracoes(config: ConfiguracoesData) {
    setDados(config); setNomeClinica(config?.nome_clinica ?? ""); setMeta(String(config?.meta_orcamento_mensal ?? 0)); setFrase(config?.frase_sonho ?? ""); setPixChave(config?.pix_chave ?? ""); setPixQrCode(config?.pix_qrcode_base64 ?? ""); setPixDesconto(String(config?.pix_desconto_percentual ?? 0)); setWhatsapp(config?.whatsapp_contato ?? ""); setTelefone(config?.telefone_contato ?? ""); setAgendaBloqueada(config?.agenda_liberacao_financeira_bloqueada ?? false);
  }
  async function carregar(force = false) {
    const url = "/api/admin/configuracoes";
    const cached = !force ? getInstantCache<{ configuracoes?: ConfiguracoesData }>(url) : null;
    const cacheValido = Boolean(cached?.configuracoes && typeof cached.configuracoes === "object");
    if (cacheValido) { aplicarConfiguracoes(cached!.configuracoes!); setCarregando(false); } else { invalidateInstantCache(url); setCarregando(true); }
    try { const data = await refreshInstant<{ configuracoes?: ConfiguracoesData }>(url, { cache: "no-store" }); if (data.configuracoes) aplicarConfiguracoes(data.configuracoes); else if (!cacheValido) throw new Error("Resposta de configurações inválida."); } catch { if (!cacheValido) toast.error("Não foi possível carregar as configurações."); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true);
    try { const res = await fetch("/api/admin/configuracoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomeClinica, metaOrcamentoMensal: meta, fraseSonho: frase }) }); const data = await res.json(); if (!res.ok) { toast.error(data.erro ?? "Não foi possível salvar as configurações."); return; } toast.success("Identidade e orçamento atualizados."); setDados(data.configuracoes); } catch { toast.error("Erro de conexão. Tente novamente."); } finally { setSalvando(false); }
  }
  function selecionarArquivoQrCode(file: File | null) {
    if (!file) return; if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem (PNG ou JPG) do QR Code."); return; } if (file.size > TAMANHO_MAXIMO_QRCODE) { toast.error("Imagem muito grande. Use um arquivo até 1.5MB."); return; } const leitor = new FileReader(); leitor.onload = () => setPixQrCode(String(leitor.result)); leitor.onerror = () => toast.error("Não foi possível ler a imagem."); leitor.readAsDataURL(file);
  }
  async function salvarPagamento(e: React.FormEvent) {
    e.preventDefault(); setSalvandoPagamento(true);
    try { const res = await fetch("/api/admin/configuracoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pixChave, pixQrCodeBase64: pixQrCode, pixDescontoPercentual: Number(pixDesconto), whatsappContato: whatsapp, telefoneContato: telefone }) }); const data = await res.json(); if (!res.ok) { toast.error(data.erro ?? "Não foi possível salvar pagamento e contato."); return; } toast.success("Pagamento e contatos atualizados."); setDados(data.configuracoes); } catch { toast.error("Erro de conexão. Tente novamente."); } finally { setSalvandoPagamento(false); }
  }
  async function alternarBloqueioAgenda() {
    const novoValor = !agendaBloqueada; setSalvandoAgenda(true);
    try { const res = await fetch("/api/admin/configuracoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agendaLiberacaoFinanceiraBloqueada: novoValor }) }); const data = await res.json(); if (!res.ok) { toast.error(data.erro ?? "Não foi possível atualizar a agenda."); return; } setAgendaBloqueada(novoValor); setDados(data.configuracoes); toast.success(novoValor ? "Agenda de liberação financeira bloqueada." : "Agenda de liberação financeira desbloqueada."); } catch { toast.error("Erro de conexão. Tente novamente."); } finally { setSalvandoAgenda(false); }
  }
  const atualizado = dados?.updated_at ? new Date(dados.updated_at).toLocaleDateString("pt-BR") : "—";

  const topicos = [
    { href: "#identidade", icon: Building2, title: "Identidade & orçamento", description: "Empresa e metas" },
    { href: "#agenda", icon: CalendarClock, title: "Agenda financeira", description: "Bloqueio e liberação" },
    { href: "#pagamento", icon: WalletCards, title: "Pagamento & contato", description: "PIX e atendimento" },
    { href: "/admin/configuracoes/notificacoes", icon: Bell, title: "Notificações", description: "Enviar e acompanhar avisos" },
    { href: "/admin/configuracoes/monitoramento", icon: MonitorCog, title: "Monitoramento do app", description: "Web, PWA e notificações" },
  ];

  return (
    <div className="space-y-3 pb-6">
      <PageHeader eyebrow="Configurações" title="Central de controle" description="Tudo organizado por tópico. Selecione uma área para abrir diretamente a configuração desejada." actions={<span className="inline-flex items-center gap-1.5 rounded-full border border-burgundy/10 bg-white/60 px-2.5 py-1.5 text-[10px] font-medium text-clay/55 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-pearl/45"><CheckCircle2 className="h-3 w-3 text-success" /> Atualizado {atualizado}</span>} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {topicos.map((topico) => { const Icon = topico.icon; return <Link key={topico.href} href={topico.href} className={`${MINI} group flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:border-gold/35 hover:shadow-sm`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy dark:bg-white/[0.07] dark:text-rose"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-burgundy dark:text-pearl">{topico.title}</span><span className="mt-0.5 block truncate text-[10px] text-clay/45 dark:text-pearl/35">{topico.description}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-clay/25 transition group-hover:translate-x-0.5 group-hover:text-burgundy" /></Link>; })}
      </div>

      {carregando || !dados ? <SkeletonRows count={3} /> : <>
        <div id="identidade" className="grid gap-3 lg:grid-cols-[1.15fr_.85fr] scroll-mt-4">
          <section className={`${PANEL} overflow-hidden`}>
            <div className="border-b border-burgundy/8 px-4 py-3 dark:border-white/8 sm:px-5"><SectionTitle icon={Building2} title="Identidade & orçamento" description="Dados principais e referência financeira." /></div>
            <form onSubmit={salvar} className="p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="nomeClinica">Nome da empresa</Label><Input id="nomeClinica" value={nomeClinica} onChange={e => setNomeClinica(e.target.value)} placeholder="Nome exibido no painel" className={CAMPO_INPUT} /><FieldHint>Usado na experiência administrativa.</FieldHint></div><div><Label htmlFor="metaMensal">Limite orçamentário mensal</Label><Input id="metaMensal" type="number" min="0" step="0.01" value={meta} onChange={e => setMeta(e.target.value)} placeholder="Ex.: 100000" className={CAMPO_INPUT} /><FieldHint>Referência para liberações financeiras.</FieldHint></div><div className="sm:col-span-2"><Label htmlFor="fraseSonho">Mensagem executiva</Label><Textarea id="fraseSonho" value={frase} onChange={e => setFrase(e.target.value)} placeholder="Mensagem principal exibida na visão inicial do painel." className="min-h-[60px] rounded-lg border border-burgundy/10 bg-white/75 py-2 text-sm text-clay shadow-sm outline-none dark:border-white/10 dark:bg-white/[0.045] dark:text-pearl" /></div></div><div className="mt-3 flex justify-end"><Button type="submit" size="sm" loading={salvando}><Save className="h-3.5 w-3.5" /> Salvar identidade</Button></div></form>
          </section>
        </div>

        <section id="agenda" className={`${PANEL} overflow-hidden scroll-mt-4`}>
          <div className="border-b border-burgundy/8 px-4 py-3 dark:border-white/8 sm:px-5"><SectionTitle icon={CalendarClock} title="Agenda financeira" description="Pausar ou reabrir a seleção de datas." /></div>
          <div className="p-4 sm:p-5"><div className={`flex flex-col justify-between gap-3 rounded-xl border p-3 ${agendaBloqueada ? "border-alert/15 bg-alert/5" : "border-success/15 bg-success/5"}`}><div className="flex min-w-0 items-start gap-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${agendaBloqueada ? "bg-alert/10 text-alert" : "bg-success/10 text-success"}`}>{agendaBloqueada ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-burgundy dark:text-pearl">Agenda {agendaBloqueada ? "bloqueada" : "aberta"}</p><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${agendaBloqueada ? "bg-alert/10 text-alert" : "bg-success/10 text-success"}`}>{agendaBloqueada ? "Pausada" : "Ativa"}</span></div><p className="mt-1 text-[10px] leading-4 text-clay/45 dark:text-pearl/35">{agendaBloqueada ? "Somente datas disponíveis permanecem selecionáveis." : "O calendário segue mostrando os estados normalmente."}</p></div></div><Button type="button" size="sm" variant={agendaBloqueada ? "secondary" : "danger"} loading={salvandoAgenda} onClick={alternarBloqueioAgenda} className="w-full">{agendaBloqueada ? <><Unlock className="h-3.5 w-3.5" /> Reabrir agenda</> : <><Lock className="h-3.5 w-3.5" /> Bloquear agenda</>}</Button></div><p className="mt-2 text-[9px] leading-4 text-clay/35 dark:text-pearl/25">Não altera datas já confirmadas nem a agenda de termos cirúrgicos.</p></div>
        </section>

        <section id="pagamento" className={`${PANEL} overflow-hidden scroll-mt-4`}>
          <div className="border-b border-burgundy/8 px-4 py-3 dark:border-white/8 sm:px-5"><SectionTitle icon={WalletCards} title="Pagamento & contato" description="PIX, desconto e canais de atendimento exibidos para a cliente." /></div>
          <form onSubmit={salvarPagamento} className="p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-[1fr_220px]"><div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="pixChave">Chave PIX</Label><Input id="pixChave" value={pixChave} onChange={e => setPixChave(e.target.value)} placeholder="CPF/CNPJ, e-mail, telefone ou chave aleatória" className={CAMPO_INPUT} /><FieldHint>A cliente poderá copiar a chave diretamente na área de pagamentos.</FieldHint></div><div><Label htmlFor="pixDesconto">Desconto via PIX</Label><select id="pixDesconto" value={pixDesconto} onChange={e => setPixDesconto(e.target.value)} className={CAMPO_INPUT}>{OPCOES_DESCONTO_PIX.map(valor => <option key={valor} value={valor}>{valor === 0 ? "Sem desconto" : `${valor}% de desconto`}</option>)}</select><FieldHint>Aplicado sobre juros e multa de parcela em atraso.</FieldHint></div><div><Label htmlFor="telefone">Telefone de contato</Label><div className="relative"><Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-clay/30 dark:text-pearl/25" /><Input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(61) 99999-9999" className={`${CAMPO_INPUT} pl-9`} /></div></div><div className="sm:col-span-2"><Label htmlFor="whatsapp">WhatsApp de contato</Label><div className="relative"><MessageCircle className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-success/65" /><Input id="whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5561999999999" inputMode="numeric" className={`${CAMPO_INPUT} pl-9`} /></div><FieldHint>Informe DDI + DDD + número, sem espaços ou símbolos.</FieldHint></div></div><div><Label>QR Code do PIX</Label><div className="mt-1 flex min-h-[170px] flex-col items-center justify-center rounded-xl border border-dashed border-burgundy/15 bg-burgundy/[0.025] p-3 text-center transition hover:border-gold/50 dark:border-white/10 dark:bg-white/[0.025]" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selecionarArquivoQrCode(e.dataTransfer.files?.[0] ?? null); }}><input ref={inputArquivoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={e => selecionarArquivoQrCode(e.target.files?.[0] ?? null)} />{pixQrCode ? <><div className="relative rounded-xl border border-burgundy/10 bg-white p-1.5 shadow-sm dark:border-white/10"><img src={pixQrCode} alt="Pré-visualização do QR Code PIX" className="h-24 w-24 rounded-lg object-contain" /></div><p className="mt-1.5 text-[10px] font-medium text-success">QR Code carregado</p><div className="mt-2 flex gap-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => inputArquivoRef.current?.click()}><UploadCloud className="h-3.5 w-3.5" /> Trocar</Button><Button type="button" variant="danger" size="sm" onClick={() => setPixQrCode("")}><Trash2 className="h-3.5 w-3.5" /> Remover</Button></div></> : <button type="button" onClick={() => inputArquivoRef.current?.click()} className="flex flex-col items-center gap-1.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold"><QrCode className="h-4 w-4" /></span><span className="text-xs font-semibold text-burgundy dark:text-pearl">Adicionar QR Code</span><span className="text-[10px] text-clay/40 dark:text-pearl/35">Clique ou arraste · PNG, JPG ou WEBP · até 1.5MB</span><span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-medium text-burgundy/50 dark:text-pearl/35"><ImagePlus className="h-3 w-3" /> Pré-visualização instantânea</span></button>}</div></div></div><div className="mt-3 flex items-center justify-end gap-3 border-t border-burgundy/8 pt-3 dark:border-white/8"><p className="mr-auto hidden text-[10px] text-clay/35 dark:text-pearl/25 sm:block">As alterações aparecem para a cliente após o salvamento.</p><Button type="submit" size="sm" loading={salvandoPagamento}><Save className="h-3.5 w-3.5" /> Salvar pagamento e contato</Button></div></form>
        </section>
      </>}
    </div>
  );
}
