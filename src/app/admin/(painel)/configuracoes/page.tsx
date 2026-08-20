"use client";
import { fetchInstant, refreshInstant, invalidateInstantCache, getInstantCache } from "@/lib/instantCache";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  Lock,
  MessageCircle,
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
const CAMPO_INPUT = "h-10 rounded-xl border border-burgundy/10 bg-white/75 px-3.5 text-sm text-clay shadow-sm outline-none transition placeholder:text-clay/35 focus:border-gold/60 focus:ring-2 focus:ring-gold/15 dark:border-white/10 dark:bg-white/[0.045] dark:text-pearl dark:placeholder:text-pearl/30";
const PANEL = "rounded-[24px] border border-burgundy/10 bg-white/75 shadow-[0_18px_55px_-35px_rgba(88,25,38,.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_18px_55px_-35px_rgba(0,0,0,.8)]";
const MINI = "rounded-2xl border border-burgundy/10 bg-white/55 dark:border-white/10 dark:bg-white/[0.025]";

function SectionTitle({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy dark:bg-white/[0.07] dark:text-rose">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-burgundy dark:text-pearl">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-clay/50 dark:text-pearl/40">{description}</p>
      </div>
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-4 text-clay/45 dark:text-pearl/35">{children}</p>;
}

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
    setDados(config);
    setNomeClinica(config?.nome_clinica ?? "");
    setMeta(String(config?.meta_orcamento_mensal ?? 0));
    setFrase(config?.frase_sonho ?? "");
    setPixChave(config?.pix_chave ?? "");
    setPixQrCode(config?.pix_qrcode_base64 ?? "");
    setPixDesconto(String(config?.pix_desconto_percentual ?? 0));
    setWhatsapp(config?.whatsapp_contato ?? "");
    setTelefone(config?.telefone_contato ?? "");
    setAgendaBloqueada(config?.agenda_liberacao_financeira_bloqueada ?? false);
  }

  async function carregar(force = false) {
    const url = "/api/admin/configuracoes";
    const cached = !force ? getInstantCache<{ configuracoes?: ConfiguracoesData }>(url) : null;
    const cacheValido = Boolean(cached?.configuracoes && typeof cached.configuracoes === "object");
    if (cacheValido) { aplicarConfiguracoes(cached!.configuracoes!); setCarregando(false); } else {
      invalidateInstantCache(url);
      setCarregando(true);
    }
    try {
      // Sempre valida a resposta real ao entrar nesta aba. O cache serve apenas
      // como renderização instantânea e nunca pode bloquear a tela em skeleton.
      const data = await refreshInstant<{ configuracoes?: ConfiguracoesData }>(url, { cache: "no-store" });
      if (data.configuracoes) aplicarConfiguracoes(data.configuracoes);
      else if (!cacheValido) throw new Error("Resposta de configurações inválida.");
    } catch {
      if (!cacheValido) toast.error("Não foi possível carregar as configurações.");
    } finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await fetch("/api/admin/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomeClinica, metaOrcamentoMensal: meta, fraseSonho: frase }),
    });
    const data = await res.json();
    setSalvando(false);
    if (!res.ok) { toast.error(data.erro ?? "Não foi possível salvar as configurações."); return; }
    toast.success("Identidade e orçamento atualizados.");
    setDados(data.configuracoes);
  }

  function selecionarArquivoQrCode(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem (PNG ou JPG) do QR Code."); return; }
    if (file.size > TAMANHO_MAXIMO_QRCODE) { toast.error("Imagem muito grande. Use um arquivo até 1.5MB."); return; }
    const leitor = new FileReader();
    leitor.onload = () => setPixQrCode(String(leitor.result));
    leitor.onerror = () => toast.error("Não foi possível ler a imagem.");
    leitor.readAsDataURL(file);
  }

  async function salvarPagamento(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoPagamento(true);
    const res = await fetch("/api/admin/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixChave, pixQrCodeBase64: pixQrCode, pixDescontoPercentual: Number(pixDesconto), whatsappContato: whatsapp, telefoneContato: telefone }),
    });
    const data = await res.json();
    setSalvandoPagamento(false);
    if (!res.ok) { toast.error(data.erro ?? "Não foi possível salvar pagamento e contato."); return; }
    toast.success("Pagamento e contatos atualizados.");
    setDados(data.configuracoes);
  }

  async function alternarBloqueioAgenda() {
    const novoValor = !agendaBloqueada;
    setSalvandoAgenda(true);
    try {
      const res = await fetch("/api/admin/configuracoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agendaLiberacaoFinanceiraBloqueada: novoValor }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.erro ?? "Não foi possível atualizar a agenda."); return; }
      setAgendaBloqueada(novoValor);
      setDados(data.configuracoes);
      toast.success(novoValor ? "Agenda de liberação financeira bloqueada." : "Agenda de liberação financeira desbloqueada.");
    } catch { toast.error("Erro de conexão. Tente novamente."); }
    finally { setSalvandoAgenda(false); }
  }

  const atualizado = dados?.updated_at ? new Date(dados.updated_at).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        eyebrow="Configurações"
        title="Central de controle"
        description="Organize identidade, orçamento, agenda, pagamentos e canais de atendimento em um único espaço, com uma leitura mais rápida e profissional."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-burgundy/10 bg-white/60 px-3 py-2 text-[11px] font-medium text-clay/55 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-pearl/45">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Atualizado em {atualizado}
          </span>
        }
      />

      {carregando || !dados ? <SkeletonRows count={4} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`${MINI} p-4`}><div className="flex items-center gap-3"><Building2 className="h-4 w-4 text-burgundy/60 dark:text-rose" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-clay/40 dark:text-pearl/35">Empresa</p><p className="mt-1 truncate text-sm font-semibold text-burgundy dark:text-pearl">{nomeClinica || "Não definida"}</p></div></div></div>
            <div className={`${MINI} p-4`}><div className="flex items-center gap-3"><WalletCards className="h-4 w-4 text-gold" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-clay/40 dark:text-pearl/35">Orçamento mensal</p><p className="mt-1 text-sm font-semibold text-burgundy dark:text-pearl">R$ {Number(meta || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div></div></div>
            <div className={`${MINI} p-4`}><div className="flex items-center gap-3"><CalendarClock className="h-4 w-4 text-success" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-clay/40 dark:text-pearl/35">Agenda financeira</p><p className={`mt-1 text-sm font-semibold ${agendaBloqueada ? "text-alert" : "text-success"}`}>{agendaBloqueada ? "Bloqueada" : "Aberta"}</p></div></div></div>
          </div>

          <section className={`${PANEL} overflow-hidden`}>
            <div className="border-b border-burgundy/8 px-5 py-4 dark:border-white/8 sm:px-6">
              <SectionTitle icon={Building2} title="Identidade & orçamento" description="Defina o que aparece no painel e a referência financeira usada nas liberações." />
            </div>
            <form onSubmit={salvar} className="p-5 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div><Label htmlFor="nomeClinica">Nome da empresa</Label><Input id="nomeClinica" value={nomeClinica} onChange={e => setNomeClinica(e.target.value)} placeholder="Nome exibido no painel" className={CAMPO_INPUT} /><FieldHint>Nome usado na experiência administrativa.</FieldHint></div>
                <div><Label htmlFor="metaMensal">Limite orçamentário mensal</Label><Input id="metaMensal" type="number" min="0" step="0.01" value={meta} onChange={e => setMeta(e.target.value)} placeholder="Ex.: 100000" className={CAMPO_INPUT} /><FieldHint>Referência para as liberações financeiras.</FieldHint></div>
                <div className="lg:col-span-2"><Label htmlFor="fraseSonho">Mensagem executiva</Label><Textarea id="fraseSonho" value={frase} onChange={e => setFrase(e.target.value)} placeholder="Mensagem principal exibida na visão inicial do painel." className="min-h-[78px] rounded-xl border border-burgundy/10 bg-white/75 py-2.5 text-sm text-clay shadow-sm outline-none dark:border-white/10 dark:bg-white/[0.045] dark:text-pearl" /></div>
              </div>
              <div className="mt-5 flex justify-end"><Button type="submit" size="sm" loading={salvando}><Save className="h-3.5 w-3.5" /> Salvar identidade</Button></div>
            </form>
          </section>

          <section className={`${PANEL} overflow-hidden`}>
            <div className="border-b border-burgundy/8 px-5 py-4 dark:border-white/8 sm:px-6"><SectionTitle icon={CalendarClock} title="Agenda de liberação financeira" description="Controle rápido para pausar ou reabrir a seleção de datas sem alterar os termos já confirmados." /></div>
            <div className="p-5 sm:p-6">
              <div className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${agendaBloqueada ? "border-alert/15 bg-alert/5" : "border-success/15 bg-success/5"}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${agendaBloqueada ? "bg-alert/10 text-alert" : "bg-success/10 text-success"}`}>{agendaBloqueada ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</span>
                  <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-burgundy dark:text-pearl">Agenda {agendaBloqueada ? "bloqueada" : "aberta"}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${agendaBloqueada ? "bg-alert/10 text-alert" : "bg-success/10 text-success"}`}>{agendaBloqueada ? "Pausada" : "Ativa"}</span></div><p className="mt-1 text-xs leading-5 text-clay/50 dark:text-pearl/40">{agendaBloqueada ? "Somente datas disponíveis permanecem selecionáveis." : "O calendário segue mostrando os estados normalmente."}</p></div>
                </div>
                <Button type="button" size="sm" variant={agendaBloqueada ? "secondary" : "danger"} loading={salvandoAgenda} onClick={alternarBloqueioAgenda} className="shrink-0">{agendaBloqueada ? <><Unlock className="h-3.5 w-3.5" /> Reabrir agenda</> : <><Lock className="h-3.5 w-3.5" /> Bloquear agenda</>}</Button>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-clay/40 dark:text-pearl/30">Esta opção afeta somente a aba de previsão de liberação financeira. Não altera datas já confirmadas nem a agenda de termos cirúrgicos.</p>
            </div>
          </section>

          <section className={`${PANEL} overflow-hidden`}>
            <div className="border-b border-burgundy/8 px-5 py-4 dark:border-white/8 sm:px-6"><SectionTitle icon={WalletCards} title="Pagamento & contato" description="Concentre PIX, desconto e canais de atendimento que aparecem para a cliente." /></div>
            <form onSubmit={salvarPagamento} className="p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                <div className="space-y-4">
                  <div><Label htmlFor="pixChave">Chave PIX</Label><Input id="pixChave" value={pixChave} onChange={e => setPixChave(e.target.value)} placeholder="CPF/CNPJ, e-mail, telefone ou chave aleatória" className={CAMPO_INPUT} /><FieldHint>A cliente poderá copiar a chave diretamente na área de pagamentos.</FieldHint></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="pixDesconto">Desconto via PIX</Label><select id="pixDesconto" value={pixDesconto} onChange={e => setPixDesconto(e.target.value)} className={CAMPO_INPUT}>{OPCOES_DESCONTO_PIX.map(valor => <option key={valor} value={valor}>{valor === 0 ? "Sem desconto" : `${valor}% de desconto`}</option>)}</select><FieldHint>Aplicado sobre juros e multa de parcela em atraso.</FieldHint></div>
                    <div><Label htmlFor="telefone">Telefone de contato</Label><div className="relative"><Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-clay/30 dark:text-pearl/25" /><Input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(61) 99999-9999" className={`${CAMPO_INPUT} pl-9`} /></div></div>
                  </div>
                  <div><Label htmlFor="whatsapp">WhatsApp de contato</Label><div className="relative"><MessageCircle className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-success/65" /><Input id="whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5561999999999" inputMode="numeric" className={`${CAMPO_INPUT} pl-9`} /></div><FieldHint>Informe DDI + DDD + número, sem espaços ou símbolos.</FieldHint></div>
                </div>

                <div>
                  <Label>QR Code do PIX</Label>
                  <div className="mt-1 flex min-h-[225px] flex-col items-center justify-center rounded-2xl border border-dashed border-burgundy/15 bg-burgundy/[0.025] p-4 text-center transition hover:border-gold/50 dark:border-white/10 dark:bg-white/[0.025]" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selecionarArquivoQrCode(e.dataTransfer.files?.[0] ?? null); }}>
                    <input ref={inputArquivoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={e => selecionarArquivoQrCode(e.target.files?.[0] ?? null)} />
                    {pixQrCode ? <>
                      <div className="relative rounded-2xl border border-burgundy/10 bg-white p-2 shadow-sm dark:border-white/10"><img src={pixQrCode} alt="Pré-visualização do QR Code PIX" className="h-32 w-32 rounded-xl object-contain" /></div>
                      <p className="mt-2 text-[11px] font-medium text-success">QR Code carregado</p>
                      <div className="mt-3 flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => inputArquivoRef.current?.click()}><UploadCloud className="h-3.5 w-3.5" /> Trocar</Button><Button type="button" variant="danger" size="sm" onClick={() => setPixQrCode("")}><Trash2 className="h-3.5 w-3.5" /> Remover</Button></div>
                    </> : <button type="button" onClick={() => inputArquivoRef.current?.click()} className="flex flex-col items-center gap-2"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold"><QrCode className="h-5 w-5" /></span><span className="text-sm font-semibold text-burgundy dark:text-pearl">Adicionar QR Code</span><span className="text-[11px] text-clay/40 dark:text-pearl/35">Clique ou arraste · PNG, JPG ou WEBP · até 1.5MB</span><span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-burgundy/50 dark:text-pearl/35"><ImagePlus className="h-3 w-3" /> Pré-visualização instantânea</span></button>}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-burgundy/8 pt-4 dark:border-white/8"><p className="hidden text-[11px] text-clay/40 dark:text-pearl/30 sm:block">As alterações são refletidas na área da cliente após o salvamento.</p><Button type="submit" size="sm" loading={salvandoPagamento}><Save className="h-3.5 w-3.5" /> Salvar pagamento e contato</Button></div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
