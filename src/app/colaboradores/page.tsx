import { redirect } from "next/navigation";
import { getColaboradorSessao } from "@/lib/colaboradores";

export const dynamic = "force-dynamic";

export default async function ColaboradoresIndexPage() {
  const sessao = await getColaboradorSessao();
  if (!sessao.user) redirect("/colaboradores/login");
  if (!sessao.colaborador) redirect("/colaboradores/acesso-negado");
  redirect(`/colaboradores/${sessao.colaborador.cargo}`);
}