import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export const CARGOS = ["vendedora", "sdr", "financeiro", "administrativo"] as const;
export type CargoColaborador = (typeof CARGOS)[number];

export interface ColaboradorSessao {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  cargo: CargoColaborador;
  ativo: boolean;
  permissoes: string[];
}

export async function getColaboradorSessao() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { user: null, colaborador: null, service: null, motivo: "configuracao_ausente" as const };
  }
  const authClient = createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { user: null, colaborador: null, service: null, motivo: "nao_autenticado" as const };

  const service = createServiceSupabaseClient();
  const { data: colaborador, error } = await service
    .from("colaboradores")
    .select("id, auth_user_id, nome, email, cargo, ativo, permissoes")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return { user, colaborador: null, service, motivo: "migration_pendente" as const, error: error.message };
  if (!colaborador || !colaborador.ativo) return { user, colaborador: null, service, motivo: "sem_acesso" as const };
  return { user, colaborador: colaborador as ColaboradorSessao, service, motivo: null };
}

export function cargoValido(cargo: unknown): cargo is CargoColaborador {
  return typeof cargo === "string" && CARGOS.includes(cargo as CargoColaborador);
}

export function dataSaoPaulo(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function inicioMesSaoPaulo(date = new Date()): string {
  const atual = dataSaoPaulo(date);
  return `${atual.slice(0, 7)}-01`;
}

export function fimMesExclusivoSaoPaulo(date = new Date()): string {
  const atual = dataSaoPaulo(date);
  const ano = Number(atual.slice(0, 4));
  const mes = Number(atual.slice(5, 7));
  const proximo = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
  return `${proximo}-01`;
}