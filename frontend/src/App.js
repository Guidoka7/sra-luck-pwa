import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import FinanceiroLayout from "@/pages/admin/financeiro/FinanceiroLayout";
import VisaoGeralPage from "@/pages/admin/financeiro/VisaoGeralPage";
import ContasReceberPage from "@/pages/admin/financeiro/ContasReceberPage";
import ClientesPage from "@/pages/admin/financeiro/ClientesPage";
import ClienteDetalhePage from "@/pages/admin/financeiro/ClienteDetalhePage";
import RecebimentosPage from "@/pages/admin/financeiro/RecebimentosPage";
import ComissoesPage from "@/pages/admin/financeiro/ComissoesPage";
import IntegracoesPage from "@/pages/admin/financeiro/IntegracoesPage";
import HistoricoPage from "@/pages/admin/financeiro/HistoricoPage";

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/financeiro" replace />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="financeiro" element={<FinanceiroLayout />}>
              <Route index element={<VisaoGeralPage />} />
              <Route path="contas-receber" element={<ContasReceberPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="clientes/:id" element={<ClienteDetalhePage />} />
              <Route path="recebimentos" element={<RecebimentosPage />} />
              <Route path="comissoes" element={<ComissoesPage />} />
              <Route path="integracoes" element={<IntegracoesPage />} />
              <Route path="historico" element={<HistoricoPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </>
  );
}
