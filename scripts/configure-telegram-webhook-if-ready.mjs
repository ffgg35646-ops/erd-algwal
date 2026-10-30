const required = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_URL',
  'TELEGRAM_WEBHOOK_SECRET'
];

const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.log('[telegram] Webhook registration skipped: deployment environment is missing required Telegram settings.');
} else {
  console.log('[telegram] Registering Telegram webhook for this deployment.');
  await import('./set-telegram-webhook.mjs');
}
