const webpush = require('web-push');
const pool = require('../db');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         SERIAL PRIMARY KEY,
      endpoint   TEXT UNIQUE NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function salvarSubscription(subscription) {
  await ensureTable();
  const { endpoint, keys: { p256dh, auth } } = subscription;
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
     VALUES ($1,$2,$3)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh=$2, auth=$3`,
    [endpoint, p256dh, auth]
  );
}

async function enviarParaTodos(payload) {
  await ensureTable();
  const { rows } = await pool.query(`SELECT * FROM push_subscriptions`);
  const mortos = [];
  for (const row of rows) {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) mortos.push(row.id);
    }
  }
  if (mortos.length) {
    await pool.query(`DELETE FROM push_subscriptions WHERE id = ANY($1)`, [mortos]);
  }
}

module.exports = { salvarSubscription, enviarParaTodos, vapidPublicKey: () => process.env.VAPID_PUBLIC_KEY };
