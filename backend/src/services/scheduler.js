const cron = require('node-cron');
const { enviarParaTodos } = require('./push');

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

  console.log('Agendador iniciado: lembrete toda sexta às 12h (Brasília)');
}

module.exports = { iniciarAgendador };
