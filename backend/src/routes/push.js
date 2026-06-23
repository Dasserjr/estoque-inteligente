const router = require('express').Router();
const { autenticar } = require('../middleware/auth');
const { salvarSubscription, vapidPublicKey } = require('../services/push');

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

module.exports = router;
