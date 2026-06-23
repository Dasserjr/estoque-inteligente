const cron = require('node-cron');
const { enviarParaTodos } = require('./push');
const { enviarResumoSemanal } = require('./email');

function iniciarAgendador() {
  // Toda sexta-feira às 12h00 horário de Brasília
  cron.schedule('0 12 * * 5', async () => {
    console.log('[cron] Enviando lembrete semanal para a Delzita...');
    try {
      await enviarParaTodos({
        title: 'Estoque de Casa',
        body: 'Olá Delzita! Atualizar os itens da dispensa. Abra o aplicativo e ajuste as quantidades!',
        icon: '/icon.svg',
        url: '/'
      });
      console.log('[cron] Lembrete enviado.');
    } catch (e) {
      console.error('[cron] Erro ao enviar lembrete:', e.message);
    }
  }, { timezone: 'America/Sao_Paulo' });

  // Toda sexta-feira às 18h — resumo semanal por e-mail para o dono
  cron.schedule('0 18 * * 5', async () => {
    console.log('[cron] Enviando resumo semanal por e-mail...');
    try {
      await enviarResumoSemanal();
    } catch (e) {
      console.error('[cron] Erro ao enviar e-mail:', e.message);
    }
  }, { timezone: 'America/Sao_Paulo' });

  console.log('Agendador iniciado: push sexta 12h + e-mail sexta 18h (Brasília)');
}

module.exports = { iniciarAgendador };
