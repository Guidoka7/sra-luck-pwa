import { notFound, redirect } from "next/navigation";
import { getColaboradorSessao, type CargoColaborador } from "@/lib/colaboradores";
import { ColaboradorDashboard } from "../_components/ColaboradorDashboard";

export const dynamic = "force-dynamic";

const CARGOS = ["vendedora", "sdr", "financeiro"] as const;

export default async function ColaboradorCargoPage({ params }: { params: { cargo: string } }) {
  if (!CARGOS.includes(params.cargo as (typeof CARGOS)[number])) notFound();
  const sessao = await getColaboradorSessao();
  if (!sessao.user) redirect("/colaboradores/login");
  if (!sessao.colaborador) redirect("/colaboradores/acesso-negado");
  if (sessao.colaborador.cargo !== params.cargo) redirect(`/colaboradores/${sessao.colaborador.cargo}`);
  return <ColaboradorDashboard cargo={params.cargo as Exclude<CargoColaborador, "administrativo">} />;
}