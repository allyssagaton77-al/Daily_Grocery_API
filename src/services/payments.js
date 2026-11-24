import { config, isDemoPayments } from '../config.js';
import { ApiError } from '../lib/response.js';

/** Adds the order id to a configured return URL so the return page can load it. */
function withOrder(url, orderId) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('order_id', orderId);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Returns a hosted checkout URL. With no real keys, a local sandbox page is used
 * so the full redirect flow can still be demonstrated in class.
 */
export async function createCheckoutSession({ order, provider }) {
  if (isDemoPayments) {
    return {
      provider: provider || 'maya',
      checkoutUrl: `${config.apiBase}/payments/demo/checkout?order_id=${encodeURIComponent(order.id)}&provider=${encodeURIComponent(provider || 'maya')}`,
      providerPaymentId: `demo_${order.id}`,
    };
  }

  const successUrl = withOrder(config.mayaSuccessUrl, order.id);
  const failureUrl = withOrder(config.mayaFailureUrl, order.id);
  const cancelUrl = withOrder(config.mayaCancelUrl, order.id);
  const paymongoCancelUrl = withOrder(`${config.frontendUrl}/payment/cancelled`, order.id);

  if (provider === 'paymongo' && config.paymongoSecretKey) {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.paymongoSecretKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ name: `Daily Grocery order ${order.orderNumber}`, amount: Math.round(order.total * 100), quantity: 1 }],
            payment_method_types: ['gcash', 'card', 'paymaya'],
            success_url: successUrl,
            cancel_url: paymongoCancelUrl,
            metadata: { order_id: order.id, order_number: order.orderNumber },
          },
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', payload?.errors?.[0]?.detail || 'Could not start PayMongo checkout.');
    return { provider: 'paymongo', checkoutUrl: payload.data.attributes.checkout_url, providerPaymentId: payload.data.id };
  }

  if (provider === 'maya' && config.mayaApiKey) {
    // Create Checkout uses the PUBLIC key; the secret key is for webhooks/status calls.
    const response = await fetch(`${config.mayaBaseUrl}/checkout/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.mayaApiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        totalAmount: { value: order.total, currency: 'PHP' },
        buyer: { email: order.shipping?.email, firstName: order.shipping?.fullName },
        items: [{ name: `Daily Grocery order ${order.orderNumber}`, quantity: 1, amount: { value: order.total, currency: 'PHP' } }],
        redirectUrl: { success: successUrl, failure: failureUrl, cancel: cancelUrl },
        requestReferenceNumber: order.id,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', payload?.message || 'Could not start Maya checkout.');
    return { provider: 'maya', checkoutUrl: payload.redirectUrl || payload.checkoutUrl, providerPaymentId: payload.id || payload.checkoutId };
  }

  throw new ApiError(400, 'INVALID_PAYMENT_METHOD', 'Unsupported payment method.');
}

export async function verifyWithProvider(order) {
  if (isDemoPayments) return { paid: order.paymentStatus === 'paid', status: order.paymentStatus };
  // Real reconciliation is implemented by your payment webhook handler; this
  // returns the server's current authoritative status when no provider call is configured.
  return { paid: order.paymentStatus === 'paid', status: order.paymentStatus };
}

export function demoCheckoutPage(order, provider) {
  const total = Number(order.total).toFixed(2);
  const orderId = encodeURIComponent(order.id);
  const title = provider === 'maya' ? 'Maya' : 'PayMongo';
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const years = Array.from({ length: 6 }, (_, i) => String(2026 + i));

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} Sandbox — Daily Grocery</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f4f7f4;color:#1c2b20;padding:18px}
.wrap{max-width:760px;margin:0 auto}
.card{background:#fff;border:1px solid #e3e9e3;border-radius:18px;padding:24px;box-shadow:0 8px 26px rgba(20,92,42,.08);margin-bottom:16px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px}
h1{font-size:1.25rem;color:#145c2a;margin:0}.badge{background:#fff3cd;color:#92610a;font-size:.7rem;font-weight:800;padding:5px 9px;border-radius:99px;letter-spacing:.04em}
.summary{background:#f4faf4;border-radius:12px;padding:12px 14px;margin:16px 0;font-size:.9rem}.summary strong{color:#145c2a}
label{display:block;font-size:.78rem;font-weight:700;color:#4b6152;margin:12px 0 5px}
input,select{width:100%;min-height:46px;border:1px solid #cfdccf;border-radius:10px;padding:0 12px;font-size:1rem;background:#fff;color:#1c2b20}
input:focus,select:focus{outline:2px solid #208020;outline-offset:1px}
.row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.detected{font-size:.75rem;color:#4b6152;margin-top:6px}.detected b{color:#145c2a}
button.pay{width:100%;min-height:50px;border:0;border-radius:12px;background:#208020;color:#fff;font-size:1rem;font-weight:800;margin-top:18px;cursor:pointer}
a.cancel{display:block;text-align:center;color:#4b6152;font-size:.85rem;margin-top:12px;text-decoration:none}
.note{font-size:.78rem;color:#6b7f70;margin:10px 0 0}
</style></head>
<body><div class="wrap">
  <div class="card">
    <div class="top"><h1>${title} Sandbox</h1><span class="badge">TEST MODE</span></div>
    <div class="summary">Order <strong>${order.orderNumber}</strong> · Total <strong>₱${total}</strong></div>
    <form method="get" action="/api/v1/payments/demo/confirm">
      <input type="hidden" name="orderId" value="${orderId}"/>
      <label for="cardNumber">Card number</label>
      <input id="cardNumber" name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="Card number" pattern="[0-9 ]{15,23}" required/>
      <div class="detected">Card type: <b id="cardType">—</b></div>
      <div class="row">
        <div><label for="expMonth">Expiry month</label><select id="expMonth" name="expMonth" required><option value="" disabled selected>Month</option>${months.map((m) => `<option>${m}</option>`).join('')}</select></div>
        <div><label for="expYear">Expiry year</label><select id="expYear" name="expYear" required><option value="" disabled selected>Year</option>${years.map((y) => `<option>${y}</option>`).join('')}</select></div>
        <div><label for="cvv">CVV</label><input id="cvv" name="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="CVV" pattern="[0-9]{3,4}" maxlength="4" required/></div>
      </div>
      <button class="pay" type="submit">Pay ₱${total}</button>
    </form>
    <a class="cancel" href="/api/v1/payments/demo/cancel?orderId=${orderId}">Cancel payment</a>
    <p class="note">Local sandbox only — no real card is charged and no card data is stored.</p>
  </div>
</div>
<script>
(function(){
  var number = document.getElementById('cardNumber');
  var type = document.getElementById('cardType');
  function detect(){
    var v = number.value.replace(/\\D/g,'');
    type.textContent = v.charAt(0) === '4' ? 'VISA' : (v.charAt(0) === '5' ? 'MASTERCARD' : 'UNKNOWN');
  }
  number.addEventListener('input', detect);
})();
</script></body></html>`;
}
