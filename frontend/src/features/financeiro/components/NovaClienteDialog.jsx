import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { clientesService } from "../services/financeiroService";

const INITIAL = {
  nome: "",
  cpf: "",
  telefone: "",
  email: "",
  contrato: "",
  valorContrato: "",
  quantidadeParcelas: "",
};

export default function NovaClienteDialog({ open, onOpenChange }) {
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome da cliente.");
      return;
    }
    if (!form.cpf.trim()) {
      toast.error("Informe o CPF.");
      return;
    }

    try {
      setSaving(true);
      await clientesService.criar({
        nome: form.nome.trim(),
        cpf: form.cpf.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        contrato: form.contrato.trim(),
        valorContrato: form.valorContrato ? Number(form.valorContrato) : 0,
        quantidadeParcelas: form.quantidadeParcelas ? Number(form.quantidadeParcelas) : null,
      });
      toast.success("Cliente criada na Central Financeira.", {
        description: "A geração de parcelas permanece uma operação financeira separada.",
      });
      setForm(INITIAL);
      onOpenChange(false);
    } catch (error) {
      toast.error(error?.message || "Não foi possível criar a cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova cliente</DialogTitle>
          <DialogDescription>
            Cadastro financeiro preparado para receber a API real futuramente, sem duplicar a estrutura de clientes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome completo" required>
              <Input value={form.nome} onChange={set("nome")} placeholder="Nome da cliente" autoFocus />
            </Field>
            <Field label="CPF" required>
              <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" />
            </Field>
            <Field label="Telefone">
              <Input value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={set("email")} placeholder="cliente@email.com" />
            </Field>
            <Field label="Contrato">
              <Input value={form.contrato} onChange={set("contrato")} placeholder="Número do contrato" />
            </Field>
            <Field label="Valor do contrato">
              <Input type="number" min="0" step="0.01" value={form.valorContrato} onChange={set("valorContrato")} placeholder="0,00" />
            </Field>
            <Field label="Quantidade de parcelas">
              <Input type="number" min="1" step="1" value={form.quantidadeParcelas} onChange={set("quantidadeParcelas")} placeholder="Ex.: 12" />
            </Field>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            O cadastro não cria parcelas fictícias. A geração financeira deverá continuar usando a operação oficial de parcelas quando o backend estiver conectado.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Criar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }) {
  const id = `cliente-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      {React.cloneElement(children, { id })}
    </div>
  );
}
