const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
if (!webhookUrl) throw new Error('Missing TELEGRAM_WEBHOOK_URL');
if (!secret) throw new Error('Missing TELEGRAM_WEBHOOK_SECRET');

const parsedUrl = new URL(webhookUrl);
if (parsedUrl.protocol !== 'https:') {
  throw new Error('TELEGRAM_WEBHOOK_URL must be an HTTPS URL');
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  throw new Error('TELEGRAM_WEBHOOK_SECRET must use only letters, numbers, underscore, and hyphen');
}
if (!parsedUrl.pathname.endsWith('/api/telegram/webhook')) {
  throw new Error('TELEGRAM_WEBHOOK_URL must end with /api/telegram/webhook');
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: parsedUrl.toString(),
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false
  })
});

const result = await response.json();
if (!response.ok || !result.ok) {
  throw new Error(result.description || 'Telegram rejected the webhook configuration');
}

console.log('Telegram webhook configured successfully.');
console.log(`Webhook endpoint: ${parsedUrl.origin}${parsedUrl.pathname}`);
