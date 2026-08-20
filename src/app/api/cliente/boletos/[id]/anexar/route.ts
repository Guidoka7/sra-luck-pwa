import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { CLIENTE_COOKIE_NAME, verificarTokenSessao } from "@/lib/session";

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5MB
const BUCKET = "boletos-clientes";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get(CLIENTE_COOKIE_NAME)?.value;
  const sessao = await verificarTokenSessao(token);
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const boletoId = params.id;
  const supabase = createServiceSupabaseClient();

  // Verifica que o boleto pertence à cliente autenticada
  const { data: boleto } = await supabase
    .from("boletos")
    .select("id, cliente_id, numero_parcela, status")
    .eq("id", boletoId)
    .single();

  if (!boleto || boleto.cliente_id !== sessao.clienteId) {
    return NextResponse.json({ erro: "Boleto não encontrado." }, { status: 404 });
  }
  if (boleto.status === "pago") {
    return NextResponse.json({ erro: "Essa parcela já está paga." }, { status: 409 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo) {
    return NextResponse.json({ erro: "Arquivo não fornecido." }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." },
      { status: 400 }
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: "Arquivo maior que 5MB." }, { status: 400 });
  }

  const extensao = arquivo.name.split(".").pop() || "pdf";
  const caminho = `${sessao.clienteId}/${boletoId}/${Date.now()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });

  if (erroUpload) {
    console.error("Erro upload comprovante:", erroUpload);
    return NextResponse.json({ erro: "Erro ao enviar o arquivo." }, { status: 500 });
  }

  const { error: erroUpdate } = await supabase
    .from("boletos")
    .update({
      status: "pendente_confirmacao",
      comprovante_url: caminho, // guardamos o caminho; URL assinada é gerada sob demanda
      observacoes: null,
    })
    .eq("id", boletoId);

  if (erroUpdate) {
    return NextResponse.json({ erro: "Erro ao salvar o comprovante." }, { status: 500 });
  }

  return NextResponse.json({
    sucesso: true,
    boleto_id: boletoId,
    status: "pendente_confirmacao",
  });
}
