"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Boleto { id: string; numero_parcela: number; total_parcelas: number; valor: number; data_vencimento: string | null; status: string; comprovante_url: string | null; }

export function ComprovantesClienteActions() {
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function carregar() {
    try {
      const res = await fetch("/api/cliente/boletos", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setBoletos((data.boletos ?? []).filter((b: Boleto) => Boolean(b.comprovante_url)));
    } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function trocar(boleto: Boleto, file: File | null) {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { toast.error("Use PDF, JPG ou PNG."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("O arquivo pode ter no máximo 5MB."); return; }
    setAcao(boleto.id);
    try {
      const form = new FormData(); form.append("arquivo", file);
      const res = await fetch(`/api/cliente/boletos/${boleto.id}/anexar`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível trocar o comprovante.");
      toast.success("Comprovante substituído."); await carregar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao trocar comprovante."); }
    finally { setAcao(null); if (inputRefs.current[boleto.id]) inputRefs.current[boleto.id]!.value = ""; }
  }

  async function excluir(boleto: Boleto) {
    if (!window.confirm(`Excluir o comprovante da parcela ${boleto.numero_parcela}/${boleto.total_parcelas}? A parcela voltará para Em aberto.`)) return;
    setAcao(boleto.id);
    try {
      const res = await fetch(`/api/cliente/boletos/${boleto.id}/comprovante`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Não foi possível excluir o comprovante.");
      toast.success("Comprovante excluído. A parcela voltou para Em aberto."); await carregar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir comprovante."); }
    finally { setAcao(null); }
  }

  if (carregando || boletos.length === 0) return null;
  return <Card className="mt-3 border border-rose/10 bg-white/70 p-3 dark:bg-white/[0.035]"><div className="flex items-center justify-between gap-3"><div><p className="text-[0.62rem] font-bold uppercase tracking-label text-rose">Comprovantes enviados</p><p className="mt-0.5 text-[0.68rem] text-clay/50">Você pode trocar ou excluir um anexo a qualquer momento.</p></div><Paperclip className="h-4 w-4 text-rose/70" /></div><div className="mt-2 space-y-1.5">{boletos.map(b => <div key={b.id} className="flex items-center gap-2 rounded-xl border border-clay/8 bg-white/70 px-2.5 py-2 dark:border-white/8 dark:bg-white/[0.025]"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose/10 text-rose"><FileText className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-[0.68rem] font-semibold text-burgundy dark:text-pearl">Parcela {b.numero_parcela}/{b.total_parcelas}</p><p className="text-[0.56rem] text-clay/45">Comprovante anexado · {b.status === "pago" ? "Pagamento registrado" : "Aguardando ajuste"}</p></div><a href={`/api/cliente/boletos/${b.id}/comprovante`} target="_blank" rel="noopener noreferrer" title="Visualizar comprovante" className="flex h-8 w-8 items-center justify-center rounded-lg text-clay/50 hover:bg-clay/5 hover:text-burgundy"><FileText className="h-3.5 w-3.5" /></a><input ref={el => { inputRefs.current[b.id] = el; }} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => trocar(b, e.target.files?.[0] ?? null)} /><button type="button" onClick={() => inputRefs.current[b.id]?.click()} disabled={acao === b.id} title="Trocar comprovante" className="flex h-8 w-8 items-center justify-center rounded-lg text-rose hover:bg-rose/10 disabled:opacity-40"><UploadCloud className="h-3.5 w-3.5" /></button><button type="button" onClick={() => excluir(b)} disabled={acao === b.id} title="Excluir comprovante" className="flex h-8 w-8 items-center justify-center rounded-lg text-alert hover:bg-alert/10 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></Card>;
}
