const baseUrl = (process.env.NOTIFICACOES_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const secret = process.env.NOTIFICACOES_CRON_SECRET;
const intervaloMs = 30 * 60 * 1000;

if (!secret) {
  console.error('Defina NOTIFICACOES_CRON_SECRET antes de iniciar o worker.');
  process.exit(1);
}

async function executar() {
  try {
    const response = await fetch(`${baseUrl}/api/admin/notificacoes/automacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notificacoes-cron-secret': secret },
      body: JSON.stringify({ acao: 'verificar_atrasos' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || `HTTP ${response.status}`);
    console.log(`[notificacoes] ${new Date().toISOString()}`, data);
  } catch (error) {
    console.error('[notificacoes] falha:', error.message);
  }
}

await executar();
setInterval(executar, intervaloMs);
