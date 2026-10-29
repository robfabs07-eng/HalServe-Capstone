import crypto from 'crypto';

// ============================================================================
// HELPER: VERIFY PAYMONGO WEBHOOK SIGNATURE
// ============================================================================
function verifyPaymongoWebhookSignature(signatureHeader, payloadBody, webhookSecret) {
  if (!webhookSecret || !signatureHeader) return false;
  try {
    const parts = signatureHeader.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts.t;
    const signature = parts.li || parts.te;
    if (!timestamp || !signature) return false;

    const now = Math.floor(Date.now() / 1000);
    const sentTime = parseInt(timestamp, 10);
    if (!isNaN(sentTime) && Math.abs(now - sentTime) > 300) {
      console.warn('[PayMongo Webhook] Signature timestamp outside 300s window:', sentTime);
    }

    const bodyString = typeof payloadBody === 'string'
      ? payloadBody
      : (Buffer.isBuffer(payloadBody) ? payloadBody.toString('utf8') : JSON.stringify(payloadBody));

    const payloadToSign = `${timestamp}.${bodyString}`;
    const expected = crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch (e) {
    console.warn('[PayMongo Webhook] Signature verification error:', e);
    return false;
  }
}

// ============================================================================
// HELPER: AUTOMATED EMAIL RECEIPT DISPATCH VIA RESEND
// ============================================================================
async function sendPayMongoReceiptEmail({ customerEmail, customerName, reservationId, paymentType, amount, paymentMethod, referenceId, transactionDate }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return;
  }

  const toEmail = customerEmail || 'jmlenncatering@gmail.com';
  const cleanResId = String(reservationId || '').slice(-6).toUpperCase();
  const fmtAmt = 'PHP ' + (parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #ecd8ab; border-radius: 14px; background: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #c49a3c; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #c49a3c; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-size: 20px;">Official Payment Receipt</h2>
        <p style="color: #666; margin: 6px 0 0; font-size: 13px;">Halden's Catering Services</p>
      </div>

      <p style="font-size: 15px; color: #222;">Dear <strong>${customerName || 'Valued Customer'}</strong>,</p>
      <p style="font-size: 14px; color: #555; line-height: 1.6;">
        We have successfully received and verified your payment through our PayMongo online payment gateway. Below is your official transaction summary:
      </p>

      <div style="background: #fdfaf2; border: 1px solid #ecd8ab; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 7px 0; color: #777;">Reference ID:</td>
            <td style="padding: 7px 0; font-weight: 700; text-align: right; font-family: monospace; color: #c49a3c; font-size: 14px;">${referenceId}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #777;">Reservation ID:</td>
            <td style="padding: 7px 0; font-weight: 700; text-align: right; color: #333;">#RES-${cleanResId}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #777;">Payment Type:</td>
            <td style="padding: 7px 0; font-weight: 700; text-align: right; color: #333;">${paymentType}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #777;">Amount Paid:</td>
            <td style="padding: 7px 0; font-weight: 800; text-align: right; color: #2ea043; font-size: 17px;">${fmtAmt}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #777;">Payment Gateway:</td>
            <td style="padding: 7px 0; font-weight: 600; text-align: right; color: #444;">${paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #777;">Transaction Date:</td>
            <td style="padding: 7px 0; text-align: right; color: #555;">${transactionDate}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #777; line-height: 1.5;">
        You can view your real-time payment history, download stacked receipts, and track your reservation schedule anytime by logging into your Customer Portal.
      </p>

      <div style="text-align: center; margin-top: 28px; padding-top: 18px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999;">
        Halden's Catering Services &bull; Powered by SmartServe
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Halden Catering <onboarding@resend.dev>',
        to: [toEmail],
        bcc: ['jmlenncatering@gmail.com'],
        subject: `[Payment Receipt] ${paymentType} - Ref #${referenceId}`,
        html: htmlContent
      })
    });
  } catch (err) {
    console.warn('[PayMongo Receipt] Error dispatching Resend email:', err);
  }
}

// ============================================================================
// UNIFIED PAYMENT PROCESSOR: STRICT ISOLATION & DEDUPLICATION
// Ensures a payment ID is recorded EXACTLY ONCE and ONLY in its intended fee type!
// ============================================================================
async function applyVerifiedPayment({
  resId,
  rawFeeType,
  payId,
  payAmount,
  payMethod,
  meetingId,
  custName,
  custEmail,
  supabaseUrl,
  sbHeaders
}) {
  if (!resId || !payId) {
    return { success: false, reason: 'missing_ids' };
  }

  // 1. Fetch current records
  const [rSnap, pSnap] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${resId}&select=*`, { headers: sbHeaders }),
    fetch(`${supabaseUrl}/rest/v1/reservation_payments?reservation_id=eq.${resId}&select=*`, { headers: sbHeaders })
  ]);
  const curRes = (await rSnap.json())[0] || {};
  const curPm = (await pSnap.json())[0] || {};

  // 2. Resolve Target Fee Type
  let targetFeeType = (
    rawFeeType ||
    curRes.paymongo_payment_type ||
    curPm.paymongo_payment_type ||
    ''
  ).toLowerCase().trim();

  if (targetFeeType.includes('final')) {
    targetFeeType = 'final_payment';
  } else if (targetFeeType.includes('downpayment') || targetFeeType === 'dp') {
    targetFeeType = 'downpayment';
  } else if (targetFeeType.includes('initial')) {
    targetFeeType = 'initial_fee';
  } else if (targetFeeType.includes('cancellation')) {
    targetFeeType = 'cancellation_fee';
  } else {
    // If unknown, inspect reservation status safely
    if (meetingId || (curRes.initial_fee_status !== 'paid' && payAmount <= 5000)) {
      targetFeeType = 'initial_fee';
    } else if (curRes.downpayment_status !== 'paid') {
      targetFeeType = 'downpayment';
    } else {
      targetFeeType = 'final_payment';
    }
  }

  // 3. Strict Deduplication Check across ALL histories
  const mergeHist = (a, b) => {
    const combined = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
    const seen = new Set();
    return combined.filter(r => {
      if (!r || typeof r !== 'object') return false;
      if (String(r.id || '').includes('LEGACY') || r.ref_id === 'LEGACY' || r.notes === 'Prior payment') return false;
      const key = r.paymongo_payment_id || r.payment_id || r.id || r.ref_id || `${r.paid_at}_${r.amount_paid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const allExistingHistories = [
    ...(Array.isArray(curPm.initial_fee_history) ? curPm.initial_fee_history : []),
    ...(Array.isArray(curRes.initial_fee_history) ? curRes.initial_fee_history : []),
    ...(Array.isArray(curPm.downpayment_history) ? curPm.downpayment_history : []),
    ...(Array.isArray(curRes.downpayment_history) ? curRes.downpayment_history : []),
    ...(Array.isArray(curPm.final_history) ? curPm.final_history : []),
    ...(Array.isArray(curRes.final_history) ? curRes.final_history : []),
    ...(Array.isArray(curPm.payment_history) ? curPm.payment_history : []),
    ...(Array.isArray(curRes.payment_history) ? curRes.payment_history : [])
  ];

  const alreadyProcessed = allExistingHistories.some(r => r && (r.paymongo_payment_id === payId || r.payment_id === payId));
  if (alreadyProcessed) {
    console.log(`[applyVerifiedPayment] Payment ${payId} already recorded on reservation ${resId}, skipping duplicate.`);
    return { success: true, alreadyRecorded: true, feeType: targetFeeType };
  }

  const now = new Date().toISOString();
  const transactionDate = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  const totalAmt = parseFloat(curRes.amount || 0);
  const basePrice = parseFloat(curRes.basePrice || curRes.base_price || (totalAmt > 0 ? totalAmt * 0.95 : totalAmt));

  const clientName = custName || curRes.client || curRes.client_name || curRes.customerName || 'Customer';
  const clientEmail = custEmail || curRes.email || curRes.client_email || '';

  // 4. Execute Isolated Update per Fee Type
  if (targetFeeType === 'initial_fee') {
    const initTotalDue = 5000;
    const prevReceived = parseFloat(curPm.initial_fee_received || curRes.initial_fee_received || 0);
    const newReceived = prevReceived + (payAmount > 0 ? payAmount : initTotalDue);
    const remaining = Math.max(0, initTotalDue - newReceived);
    const isSettled = remaining <= 0;
    const status = isSettled ? 'paid' : 'partial';
    const refId = payId || ('PAY-INIT-' + String(resId).slice(-6).toUpperCase() + '-' + Date.now().toString().slice(-4));

    let initHistory = mergeHist(curPm.initial_fee_history, curRes.initial_fee_history);
    initHistory = initHistory.filter(r => !r.fee_type || r.fee_type === 'initial_fee' || r.fee_type === 'initial');
    const newReceipt = {
      id: 'RCPT-INIT-' + Date.now(),
      fee_type: 'initial_fee',
      amount_paid: payAmount > 0 ? payAmount : initTotalDue,
      amount_due: initTotalDue,
      balance_remaining: remaining,
      change: 0,
      method: 'online',
      gateway: 'PayMongo',
      ref_id: payId || refId,
      paymongo_payment_id: payId,
      paid_at: now,
      received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
      status: status,
      notes: isSettled ? 'Initial fee settled online via PayMongo' : 'Partial initial fee paid online via PayMongo'
    };
    initHistory.push(newReceipt);

    let allHistory = mergeHist(curPm.payment_history, curRes.payment_history);
    allHistory.push(newReceipt);

    await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${resId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          initial_fee_status: status,
          payment_status: isSettled ? 'initial_paid' : 'partial',
          initial_fee_received: newReceived,
          initial_fee_remaining: remaining,
          initial_fee_paid_at: now,
          initial_fee_ref_id: payId || refId,
          initial_fee_paymongo_id: payId,
          initial_fee_history: initHistory,
          payment_history: allHistory,
          paymongo_payment_id: payId,
          paymongo_payment_type: 'initial_fee',
          updated_at: now
        })
      }),
      fetch(`${supabaseUrl}/rest/v1/reservation_payments?on_conflict=reservation_id`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          reservation_id: resId,
          initial_fee_amount: initTotalDue,
          initial_fee_status: status,
          initial_fee_method: 'online',
          initial_fee_received: newReceived,
          initial_fee_remaining: remaining,
          initial_fee_change: 0,
          initial_fee_paid_at: now,
          initial_fee_received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
          initial_fee_ref_id: payId || refId,
          initial_fee_paymongo_id: payId,
          initial_fee_history: initHistory,
          payment_history: allHistory,
          paymongo_payment_id: payId,
          paymongo_payment_type: 'initial_fee',
          updated_at: now
        })
      }),
      meetingId ? fetch(`${supabaseUrl}/rest/v1/meetings?id=eq.${meetingId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          initial_fee_status: status,
          initial_fee_method: 'online',
          initial_fee_received: newReceived,
          initial_fee_change: 0,
          initial_fee_paid_at: now,
          initial_fee_received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
          initial_fee_ref_id: payId || refId,
          initial_fee_paymongo_id: payId,
          paymongo_payment_id: payId
        })
      }) : Promise.resolve()
    ]);

    await sendPayMongoReceiptEmail({
      customerEmail: clientEmail,
      customerName: clientName,
      reservationId: resId,
      paymentType: 'Initial Reservation Fee',
      amount: payAmount,
      paymentMethod: `PayMongo Online Gateway (${payMethod.toUpperCase()})`,
      referenceId: refId,
      transactionDate
    });

    return { success: true, alreadyRecorded: true, feeType: 'initial_fee', refId };

  } else if (targetFeeType === 'downpayment') {
    const dpTotalDue = Math.round(basePrice * 0.5) || parseFloat(curPm.downpayment_amount || 0) || (payAmount > 0 ? payAmount : 0);
    const prevReceived = parseFloat(curPm.downpayment_received || curRes.downpayment_received || 0);
    const newReceived = prevReceived + (payAmount > 0 ? payAmount : dpTotalDue);
    const remaining = Math.max(0, dpTotalDue - newReceived);
    const isSettled = remaining <= 0;
    const status = isSettled ? 'paid' : 'partial';
    const refId = payId || ('PAY-DP-' + String(resId).slice(-6).toUpperCase() + '-' + Date.now().toString().slice(-4));

    let dpHistory = mergeHist(curPm.downpayment_history, curRes.downpayment_history);
    dpHistory = dpHistory.filter(r => !r.fee_type || r.fee_type === 'downpayment' || r.fee_type === 'dp' || r.fee_type === 'down_payment');
    const newReceipt = {
      id: 'RCPT-DP-' + Date.now(),
      fee_type: 'downpayment',
      amount_paid: payAmount > 0 ? payAmount : dpTotalDue,
      amount_due: dpTotalDue,
      balance_remaining: remaining,
      change: 0,
      method: 'online',
      gateway: 'PayMongo',
      ref_id: payId || refId,
      paymongo_payment_id: payId,
      paid_at: now,
      received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
      status: status,
      notes: isSettled ? 'Downpayment paid in full online via PayMongo' : 'Partial downpayment paid online via PayMongo'
    };
    dpHistory.push(newReceipt);

    let allHistory = mergeHist(curPm.payment_history, curRes.payment_history);
    allHistory.push(newReceipt);

    await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${resId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          downpayment_status: status,
          downpayment_method: 'online',
          downpayment_received: newReceived,
          downpayment_remaining: remaining,
          downpayment_paid_at: now,
          downpayment_ref_id: payId || refId,
          downpayment_paymongo_id: payId,
          downpayment_history: dpHistory,
          payment_history: allHistory,
          paymongo_payment_id: payId,
          paymongo_payment_type: 'downpayment',
          updated_at: now
        })
      }),
      fetch(`${supabaseUrl}/rest/v1/reservation_payments?on_conflict=reservation_id`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          reservation_id: resId,
          downpayment_amount: dpTotalDue,
          downpayment_status: status,
          downpayment_method: 'online',
          downpayment_received: newReceived,
          downpayment_remaining: remaining,
          downpayment_change: 0,
          downpayment_paid_at: now,
          downpayment_received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
          downpayment_ref_id: payId || refId,
          downpayment_paymongo_id: payId,
          downpayment_history: dpHistory,
          payment_history: allHistory,
          paymongo_payment_id: payId,
          paymongo_payment_type: 'downpayment',
          updated_at: now
        })
      })
    ]);

    await sendPayMongoReceiptEmail({
      customerEmail: clientEmail,
      customerName: clientName,
      reservationId: resId,
      paymentType: 'Downpayment',
      amount: payAmount,
      paymentMethod: `PayMongo Online Gateway (${payMethod.toUpperCase()})`,
      referenceId: payId || refId,
      transactionDate
    });

    return { success: true, alreadyRecorded: true, feeType: 'downpayment', refId: payId || refId };

  } else if (targetFeeType === 'final_payment') {
    const dpPart = Math.round(basePrice * 0.5);
    const finalTotalDue = Math.max(0, totalAmt - dpPart) || parseFloat(curPm.final_payment_amount || 0) || (payAmount > 0 ? payAmount : 0);
    const prevReceived = parseFloat(curPm.final_received || curRes.final_received || 0);
    const newReceived = prevReceived + (payAmount > 0 ? payAmount : finalTotalDue);
    const remaining = Math.max(0, finalTotalDue - newReceived);
    const isSettled = remaining <= 0;
    const status = isSettled ? 'paid' : 'partial';
    const refId = payId || ('PAY-FINAL-' + String(resId).slice(-6).toUpperCase() + '-' + Date.now().toString().slice(-4));

    let finalHistory = mergeHist(curPm.final_history, curRes.final_history);
    finalHistory = finalHistory.filter(r => !r.fee_type || r.fee_type === 'final_payment' || r.fee_type === 'final' || r.fee_type === 'final_settlement');
    const newReceipt = {
      id: 'RCPT-FINAL-' + Date.now(),
      fee_type: 'final_payment',
      amount_paid: payAmount > 0 ? payAmount : finalTotalDue,
      amount_due: finalTotalDue,
      balance_remaining: remaining,
      change: 0,
      method: 'online',
      gateway: 'PayMongo',
      ref_id: payId || refId,
      paymongo_payment_id: payId,
      paid_at: now,
      received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
      status: status,
      notes: isSettled ? 'Final payment settled in full online via PayMongo' : 'Partial final payment paid online via PayMongo'
    };
    finalHistory.push(newReceipt);

    let allHistory = mergeHist(curPm.payment_history, curRes.payment_history);
    allHistory.push(newReceipt);

    await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/reservations?id=eq.${resId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          final_payment_status: status,
          settled: isSettled,
          final_received: newReceived,
          final_remaining: remaining,
          final_ref_id: payId || refId,
          final_paymongo_id: payId,
          final_history: finalHistory,
          payment_history: allHistory,
          paymongo_payment_id: payId,
          paymongo_payment_type: 'final_payment',
          updated_at: now
        })
      }),
      fetch(`${supabaseUrl}/rest/v1/reservation_payments?on_conflict=reservation_id`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          reservation_id: resId,
          final_payment_amount: finalTotalDue,
          final_payment_status: status,
          final_method: 'online',
          final_received: newReceived,
          final_remaining: remaining,
          final_change: 0,
          final_paid_at: now,
          final_received_by: `PayMongo Gateway (${payMethod.toUpperCase()})`,
          final_ref_id: payId || refId,
          final_paymongo_id: payId,
          final_history: finalHistory,
          payment_history: allHistory,
          paymongo_payment_id: payId,
          paymongo_payment_type: 'final_payment',
          updated_at: now
        })
      })
    ]);

    await sendPayMongoReceiptEmail({
      customerEmail: clientEmail,
      customerName: clientName,
      reservationId: resId,
      paymentType: 'Final Payment',
      amount: payAmount,
      paymentMethod: `PayMongo Online Gateway (${payMethod.toUpperCase()})`,
      referenceId: refId,
      transactionDate
    });

    return { success: true, alreadyRecorded: true, feeType: 'final_payment', refId };
  }

  return { success: false, reason: 'unhandled_fee_type' };
}

// ============================================================================
// MAIN ROUTE HANDLER
// ============================================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, paymongo-signature');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
  if (!PAYMONGO_SECRET_KEY) {
    return res.status(500).json({ error: 'PayMongo Secret Key not configured in environment.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nukbdmyqizrnkmbusdtm.supabase.co';
  const SUPABASE_ANON = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51a2JkbXlxaXpybmttYnVzZHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjM3NTQsImV4cCI6MjA5ODg5OTc1NH0.WlKtqa8hBxLedDHS7-q10yoPne6VTjt5F4E86vTA5eY';

  const sbHeaders = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json'
  };

  const authHeader = `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`;

  // =========================================================================
  // 1. ACTION: WEBHOOK AUTO-REGISTRATION
  // =========================================================================
  if (req.query?.action === 'register_webhook' || req.body?.action === 'register_webhook') {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'halden-s-catering-service.vercel.app';
      const targetUrl = (req.body?.url || process.env.APP_URL ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/paymongo` : `${protocol}://${host}/api/paymongo`).trim();
      const events = ['checkout_session.payment.paid', 'payment.paid'];

      const lRes = await fetch('https://api.paymongo.com/v1/webhooks', {
        headers: { 'Accept': 'application/json', 'Authorization': authHeader }
      });
      const lData = await lRes.json();
      const existing = (lData.data || []).find(h => h.attributes?.url === targetUrl);

      if (existing) {
        return res.status(200).json({
          success: true,
          action: 'existing',
          message: 'Webhook already registered on PayMongo',
          webhookId: existing.id,
          webhookUrl: existing.attributes?.url,
          events: existing.attributes?.events
        });
      }

      const cRes = await fetch('https://api.paymongo.com/v1/webhooks', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ data: { attributes: { url: targetUrl, events } } })
      });
      const cData = await cRes.json();
      if (cData.errors) {
        return res.status(400).json({ error: cData.errors[0]?.detail || 'Registration failed' });
      }

      return res.status(201).json({
        success: true,
        action: 'created',
        message: 'PayMongo webhook registered successfully',
        webhookId: cData.data?.id,
        webhookUrl: cData.data?.attributes?.url,
        secretKey: cData.data?.attributes?.secret_key,
        events: cData.data?.attributes?.events
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Error registering webhook' });
    }
  }

  // =========================================================================
  // 2. ACTION: INCOMING WEBHOOK HANDLER
  // =========================================================================
  const sigHeader = req.headers['paymongo-signature'];
  const isWebhook = req.method === 'POST' && (
    !!sigHeader ||
    req.body?.data?.attributes?.type === 'checkout_session.payment.paid' ||
    req.body?.data?.attributes?.type === 'payment.paid' ||
    req.query?.action === 'webhook' ||
    req.body?.action === 'webhook'
  );

  if (isWebhook) {
    try {
      const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY || process.env.PAYMONGO_WEBHOOK_SECRET || '';
      let isVerified = false;

      if (sigHeader && webhookSecret) {
        isVerified = verifyPaymongoWebhookSignature(sigHeader, req.body, webhookSecret);
      }

      const evtType = req.body?.data?.attributes?.type || '';
      const evtData = req.body?.data?.attributes?.data || {};

      let sessionId = '';
      let paymentId = '';
      let payAmount = 0;
      let payMethod = 'online';
      let custName = 'Customer';
      let custEmail = '';
      let successUrl = '';
      let feeType = '';

      if (evtType === 'checkout_session.payment.paid') {
        sessionId = evtData.id || '';
        const attrs = evtData.attributes || {};
        const payments = attrs.payments || [];
        const pObj = payments[0] || {};
        paymentId = pObj.id || '';
        payAmount = pObj.attributes?.amount ? (pObj.attributes.amount / 100) : (attrs.line_items?.[0]?.amount ? attrs.line_items[0].amount / 100 : 0);
        payMethod = pObj.attributes?.source?.type || pObj.attributes?.payment_method_type || 'online';
        custName = attrs.billing?.name || 'Customer';
        custEmail = attrs.billing?.email || '';
        successUrl = attrs.success_url || '';
        feeType = attrs.metadata?.feeType || attrs.metadata?.paymentType || '';
      } else if (evtType === 'payment.paid') {
        paymentId = evtData.id || '';
        const attrs = evtData.attributes || {};
        payAmount = attrs.amount ? attrs.amount / 100 : 0;
        payMethod = attrs.source?.type || attrs.payment_method_type || 'online';
        feeType = attrs.metadata?.feeType || attrs.metadata?.paymentType || '';
      }

      // Cryptographic API fallback verification if signature header missing or failed
      if (!isVerified) {
        if (sessionId) {
          try {
            const chkRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
              headers: { 'Accept': 'application/json', 'Authorization': authHeader }
            });
            const chkJson = await chkRes.json();
            const sAttrs = chkJson?.data?.attributes;
            if (sAttrs?.status === 'paid' || (sAttrs?.payments || []).some(p => p.attributes?.status === 'paid')) {
              isVerified = true;
              if (!feeType) feeType = sAttrs?.metadata?.feeType || sAttrs?.metadata?.paymentType || '';
            }
          } catch (e) {}
        } else if (paymentId) {
          try {
            const chkRes = await fetch(`https://api.paymongo.com/v1/payments/${paymentId}`, {
              headers: { 'Accept': 'application/json', 'Authorization': authHeader }
            });
            const chkJson = await chkRes.json();
            if (chkJson?.data?.attributes?.status === 'paid') {
              isVerified = true;
              if (!feeType) feeType = chkJson?.data?.attributes?.metadata?.feeType || '';
            }
          } catch (e) {}
        }
      }

      if (!isVerified && webhookSecret) {
        return res.status(400).json({ error: 'Webhook signature verification failed.' });
      }

      // Resolve reservation ID and fee type
      let resId = '';
      let meetingId = '';

      if (successUrl) {
        try {
          const qUrl = new URL(successUrl);
          resId = qUrl.searchParams.get('resId') || '';
          meetingId = qUrl.searchParams.get('meetingId') || '';
          if (!feeType) feeType = qUrl.searchParams.get('type') || '';
        } catch (e) {}
      }

      if (!resId && sessionId) {
        try {
          const rGet = await fetch(`${SUPABASE_URL}/rest/v1/reservations?paymongo_session_id=eq.${sessionId}&select=id,paymongo_payment_type`, { headers: sbHeaders });
          const rRows = await rGet.json().catch(() => []);
          if (rRows && rRows[0]) {
            resId = rRows[0].id;
            if (!feeType) feeType = rRows[0].paymongo_payment_type || '';
          }
        } catch (e) {}
      }

      const result = await applyVerifiedPayment({
        resId,
        rawFeeType: feeType,
        payId: paymentId,
        payAmount,
        payMethod,
        meetingId,
        custName,
        custEmail,
        supabaseUrl: SUPABASE_URL,
        sbHeaders
      });

      return res.status(200).json({
        received: true,
        status: 'processed',
        event: evtType,
        result
      });

    } catch (err) {
      console.error('[PayMongo Webhook Error]:', err);
      return res.status(500).json({ error: err.message || 'Webhook processing failed' });
    }
  }

  // =========================================================================
  // 3. ACTION: CHECK PAYMENT STATUS
  // =========================================================================
  const isCheck = (req.method === 'GET' && req.query?.action !== 'register_webhook') || req.body?.action === 'check';
  if (isCheck) {
    let sessionId = req.query?.sessionId || req.body?.sessionId || '';
    let paymentId = req.query?.paymentId || req.body?.paymentId || '';
    const meetingId = req.query?.meetingId || req.body?.meetingId || '';
    let resId = req.query?.resId || req.query?.reservationId || req.body?.resId || req.body?.reservationId || '';
    let feeType = req.query?.type || req.query?.paymentType || req.body?.type || req.body?.paymentType || '';
    const reqAmount = parseFloat(req.query?.amount || req.body?.amount || 0);

    if (!sessionId && !paymentId && resId) {
      try {
        const [rGet, pGet] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${resId}&select=paymongo_session_id,paymongo_payment_id,paymongo_payment_type`, { headers: sbHeaders }),
          fetch(`${SUPABASE_URL}/rest/v1/reservation_payments?reservation_id=eq.${resId}&select=paymongo_session_id,paymongo_payment_id,paymongo_payment_type`, { headers: sbHeaders })
        ]);
        const rJson = await rGet.json().catch(() => null);
        const pJson = await pGet.json().catch(() => null);
        const rRow = Array.isArray(rJson) ? rJson[0] : null;
        const pRow = Array.isArray(pJson) ? pJson[0] : null;

        sessionId = rRow?.paymongo_session_id || pRow?.paymongo_session_id || '';
        paymentId = rRow?.paymongo_payment_id || pRow?.paymongo_payment_id || '';
        if (!feeType) feeType = rRow?.paymongo_payment_type || pRow?.paymongo_payment_type || '';
      } catch (e) {}
    }

    if (!sessionId && !paymentId) {
      return res.status(200).json({ paid: false, status: 'no_session' });
    }

    try {
      let isPaid = false;
      let payId = paymentId || '';
      let payMethod = 'gcash';
      let payAmount = reqAmount || 0;
      let sessionStatus = 'pending';

      // A. Check by payment ID
      if (paymentId) {
        try {
          const pRes = await fetch(`https://api.paymongo.com/v1/payments/${paymentId}`, {
            headers: { 'Accept': 'application/json', 'Authorization': authHeader }
          });
          const pData = await pRes.json();
          if (pData?.data?.attributes) {
            const attrs = pData.data.attributes;
            sessionStatus = attrs.status;
            isPaid = attrs.status === 'paid';
            payId = pData.data.id;
            payMethod = attrs.source?.type || attrs.payment_method_type || 'gcash';
            payAmount = attrs.amount ? attrs.amount / 100 : payAmount;
            if (!feeType) feeType = attrs.metadata?.feeType || attrs.metadata?.paymentType || '';
          }
        } catch (e) {}
      }

      // B. Check by Checkout Session ID
      if (!isPaid && sessionId) {
        const pmRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
          headers: { 'Accept': 'application/json', 'Authorization': authHeader }
        });
        const sessionData = await pmRes.json();
        if (sessionData?.data?.attributes) {
          const attrs = sessionData.data.attributes;
          sessionStatus = attrs.status;
          const payments = attrs.payments || [];
          isPaid = attrs.status === 'paid' || payments.some(p => p.attributes?.status === 'paid');

          if (isPaid && payments.length > 0) {
            const pObj = payments[0] || {};
            payId = pObj.id || payId || ('PAY-' + sessionId.slice(-8));
            payMethod = pObj.attributes?.source?.type || pObj.attributes?.payment_method_type || 'gcash';
            payAmount = pObj.attributes?.amount ? pObj.attributes.amount / 100 : (payAmount || 5000);
          }
          if (!feeType) feeType = attrs.metadata?.feeType || attrs.metadata?.paymentType || '';
        }
      }

      if (isPaid && resId && payId) {
        const result = await applyVerifiedPayment({
          resId,
          rawFeeType: feeType,
          payId,
          payAmount,
          payMethod,
          meetingId,
          supabaseUrl: SUPABASE_URL,
          sbHeaders
        });

        return res.status(200).json({
          paid: true,
          status: 'paid',
          paymentId: payId,
          method: payMethod,
          amount: payAmount,
          feeType: result.feeType || feeType,
          alreadyRecorded: !!result.alreadyRecorded
        });
      }

      return res.status(200).json({
        paid: isPaid,
        status: sessionStatus || 'active'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // =========================================================================
  // 4. ACTION: CREATE CHECKOUT SESSION
  // =========================================================================
  const { items, customerInfo, reservationId, meetingId, paymentType, returnUrl, source, tab } = req.body;

  const line_items = (items || []).map(item => {
    let amtCentavos = 0;
    if (typeof item.price === 'number') amtCentavos = Math.round(item.price * 100);
    else if (typeof item.amount === 'number') amtCentavos = Math.round(item.amount);
    else if (item.price) amtCentavos = Math.round(parseFloat(item.price) * 100);
    else if (item.amount) amtCentavos = Math.round(parseFloat(item.amount));
    if (!amtCentavos || isNaN(amtCentavos) || amtCentavos < 100) amtCentavos = 500000;
    return {
      name: item.name || 'Halden Catering Reservation Payment',
      amount: amtCentavos,
      currency: 'PHP',
      quantity: item.quantity || 1
    };
  });

  const origin = req.headers.origin || (req.headers.referer ? req.headers.referer.split('/').slice(0, 3).join('/') : null) || 'https://halden-s-catering-service.vercel.app';
  let basePath = returnUrl;
  if (!basePath) {
    basePath = (meetingId || paymentType === 'initial_fee' || paymentType === 'cancellation_fee')
      ? `${origin}/customer.html`
      : `${origin}/index.html`;
  }

  const separator = basePath.includes('?') ? '&' : '?';
  let successUrl = `${basePath}${separator}payment=success&resId=${encodeURIComponent(reservationId || '')}&type=${encodeURIComponent(paymentType || 'downpayment')}`;
  if (source && !basePath.includes('from=')) successUrl += `&from=${encodeURIComponent(source)}`;
  if (tab && !basePath.includes('tab=')) successUrl += `&tab=${encodeURIComponent(tab)}`;
  if (meetingId && source === 'meeting' && !basePath.includes('meetingId=')) successUrl += `&meetingId=${encodeURIComponent(meetingId)}`;
  if (line_items && line_items[0] && line_items[0].amount) {
    successUrl += `&amount=${encodeURIComponent(line_items[0].amount / 100)}`;
  }

  let cancelUrl = `${basePath}${separator}payment=cancel&resId=${encodeURIComponent(reservationId || '')}&type=${encodeURIComponent(paymentType || 'downpayment')}`;
  if (source && !basePath.includes('from=')) cancelUrl += `&from=${encodeURIComponent(source)}`;
  if (tab && !basePath.includes('tab=')) cancelUrl += `&tab=${encodeURIComponent(tab)}`;
  if (meetingId && source === 'meeting' && !basePath.includes('meetingId=')) cancelUrl += `&meetingId=${encodeURIComponent(meetingId)}`;

  try {
    const custName = customerInfo?.name || 'Customer';
    const custEmail = customerInfo?.email || undefined;
    const custPhone = customerInfo?.phone || undefined;

    const sessionPayload = {
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description: `${customerInfo?.type || 'Event'} Reservation — ${custName}`,
          line_items,
          payment_method_types: ['qrph', 'gcash', 'paymaya', 'card'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            reservationId: String(reservationId || ''),
            paymentType: String(paymentType || 'downpayment'),
            feeType: String(paymentType || 'downpayment'),
            meetingId: String(meetingId || '')
          }
        }
      }
    };

    if (custEmail || custPhone || custName) {
      sessionPayload.data.attributes.billing = {
        name: custName,
        email: custEmail,
        phone: custPhone
      };
    }

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(sessionPayload)
    });

    const data = await response.json();
    if (data.errors) {
      console.error('PayMongo API Error:', JSON.stringify(data.errors));
      return res.status(400).json({ error: data.errors[0].detail });
    }

    const sessionId = data.data.id;
    const checkoutUrl = data.data.attributes.checkout_url;

    if (reservationId) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${reservationId}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({
            paymongo_session_id: sessionId,
            paymongo_payment_type: paymentType || 'downpayment',
            updated_at: new Date().toISOString()
          })
        });
        await fetch(`${SUPABASE_URL}/rest/v1/reservation_payments?reservation_id=eq.${reservationId}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({
            paymongo_session_id: sessionId,
            paymongo_payment_type: paymentType || 'downpayment',
            updated_at: new Date().toISOString()
          })
        });
      } catch (rErr) {}
    }

    res.status(200).json({
      checkout_url: checkoutUrl,
      url: checkoutUrl,
      session_id: sessionId
    });

  } catch (error) {
    console.error('Checkout Session Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
