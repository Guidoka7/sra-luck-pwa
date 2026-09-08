// Diálogos financeiros: registrar recebimento, negociar, cancelar, anexar comprovante.

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { contasReceberService } from "../services/financeiroService";
import { FORMA_LABEL, FORMA_PAGAMENTO, ORIGEM, ORIGEM_LABEL } from "../types";
import { formatCurrency } from "../utils/format";

export function RegistrarRecebimentoDialog({ parcela, open, onOpenChange }) {
  const [valor, setValor] = useState(parcela?.valor ?? "");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState(parcela?.formaPagamento || FORMA_PAGAMENTO.pix);
  const [origem, setOrigem] = useState(parcela?.origem || ORIGEM.manual);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (parcela) {
      setValor(parcela.valor);
      setForma(parcela.formaPagamento);
      setOrigem(parcela.origem);
      setObs("");
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [parcela]);

  const submit = async () => {
    if (!parcela) return;
    setSaving(true);
    try {
      await contasReceberService.registrarRecebimento(parcela.id, {
        valor: Number(valor),
        data: new Date(data).toISOString(),
        formaPagamento: forma,
        origem,
        observacoes: obs,
      });
      toast.success("Recebimento registrado", {
        description: `Parcela ${parcela.numero}/${parcela.totalParcelas} de ${parcela.clienteNome} marcada como recebida.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao registrar recebimento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-registrar-recebimento">
        <DialogHeader>
          <DialogTitle>Registrar recebimento</DialogTitle>
          <DialogDescription>
            {parcela ? `Parcela ${parcela.numero}/${parcela.totalParcelas} — ${parcela.clienteNome}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <Label className="text-xs">Valor recebido</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              data-testid="input-valor-recebido"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Original: {parcela ? formatCurrency(parcela.valor) : "—"}
            </div>
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger data-testid="select-forma-pagamento"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FORMA_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} data-testid="btn-confirmar-recebimento">
            {saving ? "Salvando…" : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NegociarDialog({ parcela, open, onOpenChange }) {
  const [novoVencimento, setNovoVencimento] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (parcela) {
      setNovoVencimento(new Date(parcela.vencimento).toISOString().slice(0, 10));
      setObs("");
    }
  }, [parcela]);

  const submit = async () => {
    if (!parcela) return;
    setSaving(true);
    try {
      await contasReceberService.negociar(parcela.id, {
        novoVencimento: new Date(novoVencimento).toISOString(),
        observacoes: obs,
      });
      toast.success("Negociação registrada");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao negociar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Negociar parcela</DialogTitle>
          <DialogDescription>
            Ajuste o vencimento e registre observações da negociação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Novo vencimento</Label>
            <Input type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelarDialog({ parcela, open, onOpenChange }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!parcela) return;
    setSaving(true);
    try {
      await contasReceberService.cancelar(parcela.id, motivo);
      toast.success("Parcela cancelada");
      onOpenChange(false);
      setMotivo("");
    } catch {
      toast.error("Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar parcela</DialogTitle>
          <DialogDescription>Esta ação altera o status da parcela para cancelada.</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">Motivo</Label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? "Cancelando…" : "Cancelar parcela"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnexarComprovanteDialog({ parcela, open, onOpenChange }) {
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState(ORIGEM.manual);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!parcela) return;
    setSaving(true);
    try {
      await contasReceberService.anexarComprovante(parcela.id, { nome: nome || "comprovante.pdf", origem });
      toast.success("Comprovante anexado");
      onOpenChange(false);
      setNome("");
    } catch {
      toast.error("Erro ao anexar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar comprovante</DialogTitle>
          <DialogDescription>
            Upload real será conectado ao storage do Sra. Luck em etapa futura.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do arquivo</Label>
            <Input placeholder="comprovante.pdf" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Anexando…" : "Anexar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
