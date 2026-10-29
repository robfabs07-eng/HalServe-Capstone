// ============================================================================
// PAYMONGO WEBHOOK AUTO-REGISTRATION & MANAGEMENT ENDPOINT
// GET  /api/paymongo-webhook-register -> List registered webhooks & status
// POST /api/paymongo-webhook-register -> Auto-registers target webhook on PayMongo
// DELETE /api/paymongo-webhook-register -> Deletes or disables a webhook by ID
// ============================================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
  if (!PAYMONGO_SECRET_KEY) {
    return res.status(500).json({
      error: 'PayMongo Secret Key (PAYMONGO_SECRET_KEY) not configured in environment variables.'
    });
  }

  const authHeader = `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`;

  // Determine App URL for webhook callback
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'halden-s-catering-service.vercel.app';
  const derivedAppUrl = `${protocol}://${host}`;
  const defaultWebhookUrl = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/paymongo`
    : `${derivedAppUrl}/api/paymongo`;

  // Supported payment events for SmartServe
  const defaultEvents = [
    'checkout_session.payment.paid',
    'payment.paid'
  ];

  // -------------------------------------------------------------------------
  // GET: LIST REGISTERED WEBHOOKS
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const pmRes = await fetch('https://api.paymongo.com/v1/webhooks', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });

      const pmData = await pmRes.json();
      if (pmData.errors) {
        return res.status(400).json({
          error: pmData.errors[0]?.detail || 'Failed to list webhooks from PayMongo'
        });
      }

      const webhooks = (pmData.data || []).map(hook => ({
        id: hook.id,
        url: hook.attributes?.url,
        status: hook.attributes?.status,
        events: hook.attributes?.events || [],
        createdAt: hook.attributes?.created_at ? new Date(hook.attributes.created_at * 1000).toISOString() : null,
        updatedAt: hook.attributes?.updated_at ? new Date(hook.attributes.updated_at * 1000).toISOString() : null
      }));

      const activeHook = webhooks.find(h => h.url === defaultWebhookUrl);

      return res.status(200).json({
        success: true,
        count: webhooks.length,
        defaultWebhookUrl,
        isConfigured: !!activeHook,
        activeWebhook: activeHook || null,
        webhooks: webhooks
      });
    } catch (err) {
      console.error('[paymongo-webhook-register GET]', err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  }

  // -------------------------------------------------------------------------
  // POST: AUTO-REGISTER WEBHOOK
  // -------------------------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const targetUrl = (body.url || body.webhookUrl || defaultWebhookUrl).trim();
      const events = Array.isArray(body.events) && body.events.length > 0 ? body.events : defaultEvents;

      // 1. Check if webhook already exists on PayMongo
      const listRes = await fetch('https://api.paymongo.com/v1/webhooks', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });
      const listData = await listRes.json();
      const existingHooks = listData.data || [];
      const match = existingHooks.find(h => h.attributes?.url === targetUrl);

      if (match) {
        // If webhook exists but is disabled, enable it
        if (match.attributes?.status === 'disabled') {
          try {
            await fetch(`https://api.paymongo.com/v1/webhooks/${match.id}/enable`, {
              method: 'POST',
              headers: { 'Accept': 'application/json', 'Authorization': authHeader }
            });
          } catch (enErr) {
            console.warn('Could not auto-enable webhook:', enErr);
          }
        }

        return res.status(200).json({
          success: true,
          action: 'existing',
          message: 'Webhook is already registered for this endpoint.',
          webhookId: match.id,
          webhookUrl: match.attributes?.url,
          status: 'enabled',
          events: match.attributes?.events || events,
          secretKeyNote: 'Secret key is only visible during initial webhook creation. If you need a new signing secret, delete this webhook and re-register.'
        });
      }

      // 2. Register new webhook
      const regPayload = {
        data: {
          attributes: {
            url: targetUrl,
            events: events
          }
        }
      };

      const createRes = await fetch('https://api.paymongo.com/v1/webhooks', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(regPayload)
      });

      const createData = await createRes.json();
      if (createData.errors) {
        return res.status(400).json({
          error: createData.errors[0]?.detail || 'Failed to register webhook with PayMongo'
        });
      }

      const createdHook = createData.data;
      const secretKey = createdHook?.attributes?.secret_key;

      return res.status(201).json({
        success: true,
        action: 'created',
        message: 'PayMongo webhook successfully registered!',
        webhookId: createdHook.id,
        webhookUrl: createdHook.attributes?.url,
        events: createdHook.attributes?.events,
        secretKey: secretKey,
        instructions: secretKey
          ? `Add PAYMONGO_WEBHOOK_SECRET_KEY=${secretKey} to your Vercel / hosting environment variables for cryptographic webhook signature verification.`
          : 'Webhook registered successfully.'
      });

    } catch (err) {
      console.error('[paymongo-webhook-register POST]', err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  }

  // -------------------------------------------------------------------------
  // DELETE: REMOVE WEBHOOK BY ID
  // -------------------------------------------------------------------------
  if (req.method === 'DELETE') {
    try {
      const webhookId = req.query?.id || req.body?.id || req.body?.webhookId;
      if (!webhookId) {
        return res.status(400).json({ error: 'Missing webhook ID to delete.' });
      }

      const delRes = await fetch(`https://api.paymongo.com/v1/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });

      const delData = await delRes.json().catch(() => ({}));
      return res.status(200).json({
        success: true,
        message: `Webhook ${webhookId} successfully removed.`,
        details: delData
      });
    } catch (err) {
      console.error('[paymongo-webhook-register DELETE]', err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
