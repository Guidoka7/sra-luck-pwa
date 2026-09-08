import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

export async function getAdminOperator() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { user: null, service: null, error: "nao_autenticado" as const };

  const service = createServiceSupabaseClient();
  const { data: colaborador, error } = await service
    .from("colaboradores")
    .select("id, cargo, ativo")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) return { user, service, error: "migration_pendente" as const, detalhe: error.message };
  if (colaborador?.ativo && colaborador.cargo !== "administrativo") return { user, service, error: "sem_permissao" as const };
  return { user, service, error: null, colaborador };
}