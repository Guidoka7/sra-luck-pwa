import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DEFINITIONS = {
  conta_azul: {
    title: "Conta Azul",
    description: "Arquitetura preparada para clientes, contas a receber, baixas e histórico.",
    fields: ["ambiente", "empresa"],
  },
  mercado_pago: {
    title: "Mercado Pago / Cartão",
    description: "Preparação para checkout, cartão de crédito e webhooks de pagamento.",
    fields: ["ambiente", "modulo"],
  },
  banco: {
    title: "Banco / Boletos",
    description: "Preparação para webhooks, conciliação e baixa automática de boletos.",
    fields: ["banco", "metodo"],
  },
  cartao_credito: {
    title: "Cartão de crédito",
    description: "Camada de integração para gateways futuros sem acoplar o Financeiro ao provedor.",
    fields: ["provedor", "ambiente"],
  },
};

export default function IntegracaoConfigDialog({ integrationId, open, onOpenChange }) {
  const definition = useMemo(() => DEFINITIONS[integrationId] || DEFINITIONS.conta_azul, [integrationId]);
  const [ambiente, setAmbiente] = useState("sandbox");
  const [modulo, setModulo] = useState("checkout");
  const [provedor, setProvedor] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [banco, setBanco] = useState("");
  const [metodo, setMetodo] = useState("webhook");

  const save = (event) => {
    event.preventDefault();
    toast.info("Configuração preparada", {
      description: "Nenhuma conexão externa foi executada. O backend e as credenciais entram em uma próxima etapa.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{definition.title}</DialogTitle>
          <DialogDescription>{definition.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {definition.fields.includes("ambiente") && (
            <Field label="Ambiente">
              <Select value={ambiente} onValueChange={setAmbiente}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sandbox">Sandbox / teste</SelectItem><SelectItem value="producao">Produção</SelectItem></SelectContent></Select>
            </Field>
          )}
          {definition.fields.includes("empresa") && <Field label="Identificação da empresa"><Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="ID da empresa / conta" /></Field>}
          {definition.fields.includes("modulo") && (
            <Field label="Fluxo inicial">
              <Select value={modulo} onValueChange={setModulo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checkout">Checkout / cartão</SelectItem><SelectItem value="webhook">Webhook de pagamento</SelectItem><SelectItem value="conciliacao">Conciliação</SelectItem></SelectContent></Select>
            </Field>
          )}
          {definition.fields.includes("provedor") && <Field label="Gateway"><Input value={provedor} onChange={(e) => setProvedor(e.target.value)} placeholder="Ex.: Mercado Pago" /></Field>}
          {definition.fields.includes("banco") && <Field label="Banco"><Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Instituição financeira" /></Field>}
          {definition.fields.includes("metodo") && (
            <Field label="Entrada futura">
              <Select value={metodo} onValueChange={setMetodo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="webhook">Webhook</SelectItem><SelectItem value="arquivo">Arquivo / retorno bancário</SelectItem><SelectItem value="api">API bancária</SelectItem></SelectContent></Select>
            </Field>
          )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Nenhuma chave, token ou credencial é persistida nesta etapa. Este formulário define apenas o contrato visual da futura integração.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar preparação</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
