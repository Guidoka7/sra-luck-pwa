"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, FileText, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatarCpf } from "@/lib/cpf";
import { formatarMoeda } from "@/lib/utils";

type Importacao = any;

const statusLabel: Record<string, string> = {
  processando: "Processando",
  aguardando_vinculacao: "Aguardando vinculação",
  aguardando_confirmacao: "Aguardando confirmação",
  vinculado: "Vinculado",
  erro: "Erro",
};

function tone(status: string): "neutral" | "success" | "alert" | "gold" {
  if (status === "vinculado") return "success";
  if (status === "erro") return "alert";
  if (status === "aguardando_confirmacao") return "gold";
  return "gold";
}

function dataBR(value: string | null) {
  if (!value) return "—";
  const [a, m, d] = value.split("-").map(Number);
  return Number.isFinite(a) ? new Date(a, m - 1, d).toLocaleDateString("pt-BR") : "—";
}

function valor(value: unknown) {
  return value === null || value === undefined ? "—" : formatarMoeda(Number(value));
}

export default function ImportacaoBoletosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");

  async function carregar() {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/importacao-boletos?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || "Não foi possível carregar as importações.");
    setImportacoes(data.importacoes ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregar().catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao carregar importações.")); }, busca ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [busca, status]);

  function selecionarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O PDF não pode ultrapassar 10 MB.");
      event.target.value = "";
      return;
    }
    setArquivo(file);
  }

  async function importar() {
    if (!arquivo) return;
    setProcessando(true);
    const form = new FormData();
    form.append("arquivo", arquivo);
    try {
      const response = await fetch("/api/admin/importacao-boletos", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok && response.status !== 422) throw new Error(data.erro || "Não foi possível importar o PDF.");
      if (response.status === 422) toast.error(data.erro || "PDF sem texto extraível.");
      else toast.success("PDF processado. Revise a vinculação antes de confirmar.");
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar PDF.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Financeiro / Importação" title="Importação de Boletos" description="Importe boletos em PDF e vincule-os às clientes, carnês e parcelas existentes." />

      <Panel className="overflow-hidden">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <SectionHeading title="Importar boleto PDF" description="1 arquivo por vez. O sistema extrai somente informações realmente encontradas no documento." />
            <div className="mt-4 rounded-2xl border border-dashed border-burgundy/20 bg-blush/20 p-6 dark:border-white/12 dark:bg-white/[0.025]">
              <div className="flex flex-col items-center justify-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy/8 text-burgundy dark:bg-white/8 dark:text-[#e5c5c0]"><UploadCloud className="h-5 w-5" /></span>
                <p className="mt-3 text-sm font-semibold text-burgundy">Selecione o PDF do boleto</p>
                <p className="mt-1 max-w-md text-[11px] leading-5 text-clay/50">PDF com texto digital. Documentos digitalizados/imagem retornam erro nesta primeira versão, sem OCR.</p>
                <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={selecionarArquivo} className="sr-only" />
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={processando}>Escolher PDF</Button>
                  <Button type="button" onClick={importar} disabled={!arquivo || processando}>{processando ? "Processando…" : "Importar boleto PDF"}</Button>
                </div>
                {arquivo && <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose/10 bg-white/70 px-3 py-2 text-left dark:border-white/8 dark:bg-white/5"><FileText className="h-4 w-4 text-burgundy" /><div><p className="text-xs font-semibold text-burgundy">{arquivo.name}</p><p className="text-[10px] text-clay/45">{(arquivo.size / 1024 / 1024).toFixed(2)} MB · aguardando processamento</p></div></div>}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-rose/10 bg-white/60 p-5 dark:border-white/8 dark:bg-white/[0.025]">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-burgundy/45">Fluxo seguro</p>
            <div className="mt-3 space-y-3 text-[11px] text-clay/60">
              <p>1. PDF → texto extraível</p>
              <p>2. CPF → cliente existente</p>
              <p>3. Nome normalizado → confirmação</p>
              <p>4. Cliente → carnê existente</p>
              <p>5. Carnê → boleto existente</p>
              <p>6. Confirmação manual antes do vínculo definitivo</p>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-burgundy/[0.04] p-3 text-[10px] leading-4 text-clay/55 dark:bg-white/[0.035]"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-burgundy/60" />Nenhuma cliente, carnê ou boleto é criado automaticamente por esta importação.</div>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-rose/10 p-4 sm:p-5 dark:border-white/8">
          <SectionHeading title="Importações realizadas" description="Revise cada documento e conclua a vinculação somente quando a correspondência estiver correta." />
          <div className="mt-4 grid gap-2.5 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay/30" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Cliente, CPF, nosso número ou identificador…" className="pl-9" /></div><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left">
            <thead className="bg-blush/20 dark:bg-white/[0.025]"><tr>{["Data","Cliente","CPF","Banco","Nosso Número","Valor","Vencimento","Status","Ações"].map((head) => <th key={head} className="whitespace-nowrap px-4 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-rose/8 dark:divide-white/6">
              {importacoes.map((item) => <tr key={item.id} className="hover:bg-blush/15 dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-xs text-clay/55">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-xs font-semibold text-burgundy">{item.clientes?.nome_completo ?? item.nome_pagador_extraido ?? "Não identificada"}</td>
                <td className="px-4 py-3 text-xs text-clay/55">{item.clientes?.cpf ? formatarCpf(item.clientes.cpf) : item.cpf_pagador_extraido ? formatarCpf(item.cpf_pagador_extraido) : "—"}</td>
                <td className="px-4 py-3 text-xs text-clay/55">{item.instituicao_financeira ?? "Não identificado"}</td>
                <td className="px-4 py-3 text-xs font-medium text-clay/65">{item.nosso_numero ?? "Não identificado"}</td>
                <td className="px-4 py-3 text-xs font-bold text-burgundy">{valor(item.valor_extraido)}</td>
                <td className="px-4 py-3 text-xs text-clay/55">{dataBR(item.vencimento_extraido)}</td>
                <td className="px-4 py-3"><StatusPill tone={tone(item.status)}>{statusLabel[item.status] ?? item.status}</StatusPill></td>
                <td className="px-4 py-3"><Link href={`/admin/importacao-boletos/${item.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-rose/10 px-2.5 py-1.5 text-[10px] font-semibold text-burgundy hover:bg-blush dark:border-white/8 dark:hover:bg-white/5">Detalhes</Link></td>
              </tr>)}
            </tbody>
          </table>
          {importacoes.length === 0 && <div className="p-12 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-burgundy/30" /><p className="mt-3 text-sm font-semibold text-burgundy">Nenhuma importação encontrada.</p><p className="mt-1 text-[11px] text-clay/40">Ainda não há documentos processados com os filtros atuais.</p></div>}
        </div>
      </Panel>
    </div>
  );
}
