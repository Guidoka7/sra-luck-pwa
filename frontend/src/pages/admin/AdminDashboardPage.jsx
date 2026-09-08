// Dashboard placeholder do admin (não faz parte do módulo Financeiro).
import React from "react";
import { NavLink } from "react-router-dom";
import { Wallet, ArrowRight } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-slate-900">Painel do Sra. Luck</h2>
      <p className="text-sm text-slate-500 mt-1">
        Este é um shell mínimo. Módulos existentes do Sra. Luck permanecem intactos. O novo módulo Financeiro está pronto para uso.
      </p>
      <NavLink
        to="/admin/financeiro"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
        data-testid="go-financeiro"
      >
        <Wallet className="w-4 h-4" /> Abrir Financeiro <ArrowRight className="w-4 h-4" />
      </NavLink>
    </div>
  );
}
