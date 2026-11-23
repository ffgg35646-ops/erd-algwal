// Preview and local builds must never replace the live Telegram webhook.
// Vercel runs this build script for production and preview deployments alike.
if (process.env.VERCEL_ENV !== 'production') {
  console.log('[telegram] Webhook registration skipped: only production deployments may update the live webhook.');
  process.exit(0);
}

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
