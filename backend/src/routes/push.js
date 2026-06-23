const router = require('express').Router();
const { autenticar } = require('../middleware/auth');
const { salvarSubscription, vapidPublicKey, enviarParaTodos } = require('../services/push');

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey() });
});

router.post('/subscribe', autenticar, async (req, res) => {
  try {
    await salvarSubscription(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Rota de teste — dispara a notificação na hora (só dono)
router.post('/testar', autenticar, async (req, res) => {
  try {
    await enviarParaTodos({
      title: 'Estoque de Casa',
      body: 'Olá Delzita! Atualizar os itens da dispensa. Abra o aplicativo e ajuste as quantidades!',
      icon: '/icon.svg',
      url: '/'
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
