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
  try {
    await import('./set-telegram-webhook.mjs');
  } catch (error) {
    console.error('[telegram] Webhook registration failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}
