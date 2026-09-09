"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, FileDown, FileText, Landmark, LibraryBig, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, SectionHeading, StatusPill } from "@/components/admin/ExecutiveUI";
import { Button } from "@/components/ui/Button";
import { formatarMoeda } from "@/lib/utils";

const MODULOS = [
  { href: "/admin/importacao-boletos", label: "Importação", icon: FileDown, description: "Receba PDFs e acompanhe o processamento." },
  { href: "/admin/vinculacao-boletos", label: "Vinculação", icon: BrainCircuit, description: "Analise sugestões e confirme os vínculos." },
  { href: "/admin/carnes", label: "Carnês", icon: LibraryBig, description: "Consulte clientes, carnês e boletos existentes." },
  { href: "/admin/conciliacao-bancaria", label: "Conciliação", icon: Landmark, description: "Confira pagamentos recebidos sem baixa automática." },
];

type Resumo = {
  importacoes: { pendentes: number; naoIdentificadas: number };
  vinculacao: { pendentes: number; alta: number; media: number; baixa: number };
  carnes: { ativos: number };
  conciliacao: { pendentes: number; naoIdentificados: number; valorPendente: number };
};

const VAZIO: Resumo = {
  importacoes: { pendentes: 0, naoIdentificadas: 0 },
  vinculacao: { pendentes: 0, alta: 0, media: 0, baixa: 0 },
  carnes: { ativos: 0 },
  conciliacao: { pendentes: 0, naoIdentificados: 0, valorPendente: 0 },
};

async function jsonFetch(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || "Não foi possível carregar os dados.");
  return data;
}

export default function CentralBoletosPage() {
  const [resumo, setResumo] = useState<Resumo>(VAZIO);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const [importacao, vinculacao, carnes, conciliacao] = await Promise.all([
        jsonFetch("/api/admin/importacao-boletos"),
        jsonFetch("/api/admin/vinculacao-boletos"),
        jsonFetch("/api/admin/carnes"),
        jsonFetch(`/api/admin/conciliacao-bancaria?data=${hoje}`),
      ]);

      const imports = importacao.importacoes ?? [];
      const vinculos = vinculacao.importacoes ?? [];
      const listaCarnes = carnes.carnes ?? [];
      const pagamentos = conciliacao.pagamentos ?? [];
      const pendentesImportacao = imports.filter((i: any) => ["processando", "aguardando_vinculacao", "aguardando_confirmacao"].includes(i.status));
      const pendentesConciliacao = pagamentos.filter((p: any) => ["pendente", "nao_identificado", "divergencia"].includes(p.status));

      setResumo({
        importacoes: {
          pendentes: pendentesImportacao.length,
          naoIdentificadas: imports.filter((i: any) => !i.cliente_id || !i.carne_id || !i.boleto_id).length,
        },
        vinculacao: vinculacao.indicadores ?? VAZIO.vinculacao,
        carnes: { ativos: listaCarnes.filter((c: any) => c.status === "ativo").length },
        conciliacao: {
          pendentes: pendentesConciliacao.length,
          naoIdentificados: pagamentos.filter((p: any) => p.status === "nao_identificado").length,
          valorPendente: pendentesConciliacao.reduce((sum: number, p: any) => sum + Number(p.valor_recebido ?? 0), 0),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a Central de Boletos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  const proximaPendencia = useMemo(() => {
    if (resumo.importacoes.pendentes > 0) return { href: "/admin/importacao-boletos", label: "Revisar importações" };
    if (resumo.vinculacao.baixa > 0 || resumo.vinculacao.pendentes > 0) return { href: "/admin/vinculacao-boletos", label: "Resolver vinculações" };
    if (resumo.vinculacao.alta > 0 || resumo.vinculacao.media > 0) return { href: "/admin/vinculacao-boletos", label: "Confirmar sugestões" };
    if (resumo.conciliacao.pendentes > 0) return { href: "/admin/conciliacao-bancaria", label: "Revisar conciliação" };
    return null;
  }, [resumo]);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Financeiro / Operação" title="Central de Boletos" description="Um único workspace para importar, analisar, vincular, organizar e conciliar boletos existentes." />
        <Button type="button" variant="secondary" size="sm" onClick={() => void carregar()} disabled={carregando}><RefreshCw className={carregando ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Atualizar</Button>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-rose/10 bg-burgundy/[0.025] px-5 py-4 dark:border-white/8 dark:bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-burgundy/45">Fluxo operacional</p><p className="mt-1 text-xs text-clay/55">Cada etapa abre a funcionalidade existente. Nenhuma etapa cria boleto ou realiza baixa.</p></div>
            {proximaPendencia ? <Link href={proximaPendencia.href} className="inline-flex items-center gap-1.5 rounded-lg bg-burgundy px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-pearl shadow-sm hover:bg-burgundy-dark">{proximaPendencia.label}<ArrowRight className="h-3.5 w-3.5" /></Link> : <StatusPill tone="success">Nenhuma pendência encontrada</StatusPill>}
          </div>
        </div>
        <div className="grid divide-y divide-rose/8 md:grid-cols-6 md:divide-x md:divide-y-0 dark:divide-white/6">
          {["1. Importar", "2. Analisar", "3. Vincular", "4. Confirmar", "5. Organizar", "6. Conciliar"].map((etapa, index) => <div key={etapa} className="px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-burgundy">{etapa}</p><p className="mt-1 text-[10px] leading-4 text-clay/45">{["PDF do banco", "Regras e pontuação", "Cliente + carnê + boleto", "Confirmação humana", "Estrutura existente", "Pagamento recebido"][index]}</p></div>)}
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric title="Importações pendentes" value={resumo.importacoes.pendentes} description="Aguardando processamento/análise" loading={carregando} />
        <Metric title="Aguardando vinculação" value={resumo.vinculacao.pendentes} description="Sugestões ainda não confirmadas" loading={carregando} />
        <Metric title="Baixa confiança" value={resumo.vinculacao.baixa} description="Precisam de análise manual" loading={carregando} />
        <Metric title="Carnês ativos" value={resumo.carnes.ativos} description="Registros reais existentes" loading={carregando} />
        <Metric title="Pagamentos pendentes" value={resumo.conciliacao.pendentes} description={resumo.conciliacao.valorPendente ? formatarMoeda(resumo.conciliacao.valorPendente) + " em análise" : "Na data de hoje"} loading={carregando} />
      </div>

      <Panel>
        <SectionHeading title="Módulos da Central" description="As quatro operações continuam usando as páginas e APIs já existentes; esta tela apenas organiza o acesso." />
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          {MODULOS.map(({ href, label, icon: Icon, description }) => <Link key={href} href={href} className="group rounded-2xl border border-rose/10 bg-white/55 p-4 transition hover:-translate-y-0.5 hover:border-burgundy/15 hover:bg-white/80 dark:border-white/8 dark:bg-white/[0.025] dark:hover:bg-white/[0.05]"><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-burgundy/8 text-burgundy dark:bg-white/8 dark:text-[#e2bdb8]"><Icon className="h-4 w-4" /></span><ArrowRight className="h-3.5 w-3.5 text-clay/25 transition group-hover:translate-x-0.5 group-hover:text-burgundy" /></div><p className="mt-3 text-sm font-semibold text-burgundy">{label}</p><p className="mt-1 text-[10px] leading-4 text-clay/45">{description}</p></Link>)}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="p-4"><SectionHeading title="Confiança das vinculações" /><div className="mt-4 grid grid-cols-3 gap-2"><Confidence label="Alta" value={resumo.vinculacao.alta} tone="success" /><Confidence label="Média" value={resumo.vinculacao.media} tone="gold" /><Confidence label="Baixa" value={resumo.vinculacao.baixa} tone="alert" /></div><Link href="/admin/vinculacao-boletos" className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-burgundy hover:underline">Abrir central de vinculação <ArrowRight className="h-3 w-3" /></Link></Panel>
        <Panel className="p-4"><SectionHeading title="Pendências de hoje" /><div className="mt-4 space-y-2.5 text-[11px]"><Row label="Importações sem vínculo completo" value={resumo.importacoes.naoIdentificadas} /><Row label="Pagamentos não identificados" value={resumo.conciliacao.naoIdentificados} /><Row label="Pagamentos aguardando análise" value={resumo.conciliacao.pendentes} /></div></Panel>
        <Panel className="p-4"><SectionHeading title="Regra financeira" /><div className="mt-4 flex items-start gap-2.5 rounded-xl bg-success/[0.06] p-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-[10px] leading-4 text-clay/60">A Central somente organiza e direciona o trabalho. A vinculação exige confirmação administrativa e a conciliação permanece sem baixa automática.</p></div></Panel>
      </div>

      <div className="rounded-xl border border-rose/10 bg-white/45 px-4 py-3 text-[10px] text-clay/45 dark:border-white/8 dark:bg-white/[0.02]"><FileText className="mr-1.5 inline h-3.5 w-3.5" /> Dados exibidos são consultados das APIs administrativas existentes. Sem mocks, sem registros fictícios e sem alterações no banco nesta tela.</div>
    </div>
  );
}

function Metric({ title, value, description, loading }: { title: string; value: number; description: string; loading: boolean }) {
  return <Panel className="p-4"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-clay/40">{title}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-burgundy">{loading ? "—" : value}</p><p className="mt-1 text-[9px] leading-4 text-clay/40">{description}</p></Panel>;
}

function Confidence({ label, value, tone }: { label: string; value: number; tone: "success" | "gold" | "alert" }) {
  return <div className="rounded-xl border border-rose/8 bg-blush/15 p-3 text-center dark:border-white/6 dark:bg-white/[0.025]"><StatusPill tone={tone}>{label}</StatusPill><p className="mt-2 text-lg font-semibold text-burgundy">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3 border-b border-rose/8 pb-2 last:border-0 last:pb-0 dark:border-white/6"><span className="text-clay/55">{label}</span><span className="font-semibold text-burgundy">{value}</span></div>;
}
