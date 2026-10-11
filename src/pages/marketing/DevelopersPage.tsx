import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal, Key, Webhook, Shield, Copy, Check, ExternalLink,
  Code2, ArrowRight, Zap, RefreshCw, AlertCircle, FileText,
  Lock, Activity, BookOpen, Layers
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import MarketingLayout from './components/MarketingLayout';
import MarketingSEO from './components/MarketingSEO';
import { Button } from '../../components/ui';
import { globalToast } from '../../components/ui/Toast';

export default function DevelopersPage() {
  const { lang } = useLanguage();
  const isAm = lang === 'am';

  const [activeSnippetTab, setActiveSnippetTab] = useState<'menu' | 'create_order' | 'status' | 'reports'>('create_order');
  const [activeLang, setActiveLang] = useState<'curl' | 'js'>('curl');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    globalToast.success('Snippet copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const SNIPPETS = {
    menu: {
      title: 'Fetch Menu Catalog',
      endpoint: 'GET /api/v1/menu',
      curl: `curl -X GET "https://api.kushinapos.com/api/v1/menu" \\
  -H "Authorization: Bearer kpos_live_9f8a3c2e1b4d5e6f" \\
  -H "Accept: application/json"`,
      js: `const response = await fetch('https://api.kushinapos.com/api/v1/menu', {
  headers: {
    'Authorization': 'Bearer kpos_live_9f8a3c2e1b4d5e6f',
    'Accept': 'application/json'
  }
});
const { categories, items, restaurant } = await response.json();
console.log('Fetched ' + items.length + ' menu items for ' + restaurant.name);`,
    },
    create_order: {
      title: 'Place Partner Order (Idempotent)',
      endpoint: 'POST /api/v1/orders',
      curl: `curl -X POST "https://api.kushinapos.com/api/v1/orders" \\
  -H "Authorization: Bearer kpos_live_9f8a3c2e1b4d5e6f" \\
  -H "Idempotency-Key: dispatch_order_20261011_9841" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "menu_item_id": "aced7853-eac8-41de-b719-8a88f3634b91", "quantity": 2 }
    ],
    "order_type": "delivery",
    "customer_name": "Dawit Bekele",
    "customer_phone": "+251911223344",
    "delivery_address": "Bole Atlas, near Edna Mall, House 402"
  }'`,
      js: `const response = await fetch('https://api.kushinapos.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer kpos_live_9f8a3c2e1b4d5e6f',
    'Idempotency-Key': 'dispatch_order_20261011_9841',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [
      { menu_item_id: 'aced7853-eac8-41de-b719-8a88f3634b91', quantity: 2 }
    ],
    order_type: 'delivery',
    customer_name: 'Dawit Bekele',
    customer_phone: '+251911223344',
    delivery_address: 'Bole Atlas, near Edna Mall, House 402'
  })
});
const { order, request_id } = await response.json();
console.log('Created order #' + order.local_id + ' total: ' + order.total + ' ETB');`,
    },
    status: {
      title: 'Transition Order Status',
      endpoint: 'PATCH /api/v1/orders/:id/status',
      curl: `curl -X PATCH "https://api.kushinapos.com/api/v1/orders/5f788316-21c7-4cff-bb89-187abe51bc8f/status" \\
  -H "Authorization: Bearer kpos_live_9f8a3c2e1b4d5e6f" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "ready"
  }'`,
      js: `const response = await fetch('https://api.kushinapos.com/api/v1/orders/5f788316-21c7-4cff-bb89-187abe51bc8f/status', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer kpos_live_9f8a3c2e1b4d5e6f',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'ready'
  })
});
const { order } = await response.json();
console.log('Order status updated to: ' + order.status);`,
    },
    reports: {
      title: 'Sales & Revenue Summary',
      endpoint: 'GET /api/v1/reports/sales-summary',
      curl: `curl -X GET "https://api.kushinapos.com/api/v1/reports/sales-summary?date_from=2026-10-01&date_to=2026-10-11" \\
  -H "Authorization: Bearer kpos_live_9f8a3c2e1b4d5e6f"`,
      js: `const response = await fetch('https://api.kushinapos.com/api/v1/reports/sales-summary?date_from=2026-10-01&date_to=2026-10-11', {
  headers: {
    'Authorization': 'Bearer kpos_live_9f8a3c2e1b4d5e6f'
  }
});
const summary = await response.json();
console.log('Gross Sales: ' + summary.gross_sales + ' ETB across ' + summary.total_orders + ' orders');`,
    },
  };

  const WEBHOOK_VERIFY_CODE = `// Node.js Express Webhook Signature Verification
const crypto = require('crypto');

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = req.headers['x-kushina-signature'];
  const webhookSecret = process.env.KUSHINA_WEBHOOK_SECRET; // e.g. whsec_...

  if (!signatureHeader) {
    return res.status(400).send('Missing signature');
  }

  // Parse t=... and v1=...
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const signature = parts.find(p => p.startsWith('v1='))?.slice(3);

  // Compute HMAC-SHA256 signature
  const rawBody = req.body.toString('utf8');
  const signedPayload = timestamp + '.' + rawBody;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(rawBody);
  console.log('Received event: ' + event.event, event.data);

  // Always acknowledge with 200 OK within 10 seconds
  res.status(200).json({ received: true });
});`;

  return (
    <MarketingLayout>
      <MarketingSEO
        title="Developer API & Webhooks Guide | KushinaPOS"
        description="Connect third-party delivery dispatchers, accounting ERPs, and custom dashboards using the KushinaPOS REST API v1 and HMAC-SHA256 signed webhooks."
        canonicalUrl="/developers"
      />

      {/* Hero Header */}
      <section className="pt-12 pb-16 md:py-20 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
                <Terminal className="w-3.5 h-3.5" />
                KushinaPOS Partner & Developer API v1
              </div>
              <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white">
                Build with the Operating System for Ethiopian Restaurants
              </h1>
              <p className="text-base sm:text-lg text-stone-300 leading-relaxed">
                Seamlessly sync online menus, dispatch delivery orders, update kitchen lifecycle statuses,
                and receive real-time webhook events with cryptographic HMAC-SHA256 signatures.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="/api/v1/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  <Code2 className="w-4 h-4" />
                  Interactive Swagger UI
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="/api/v1/openapi.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-medium text-sm transition-all border border-stone-700"
                >
                  <FileText className="w-4 h-4" />
                  Download OpenAPI 3.1 Spec
                </a>
              </div>
            </div>

            {/* Quick Spec Card */}
            <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-2xl space-y-4 w-full lg:w-96 text-xs font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800 text-stone-400 font-sans">
                <span className="font-bold text-white text-sm">API Overview</span>
                <span className="text-emerald-400 font-mono">v1.0.0 Stable</span>
              </div>
              <div className="space-y-3 text-stone-300">
                <div>
                  <div className="text-stone-500 font-sans text-[11px]">BASE URL</div>
                  <div className="font-bold text-amber-300">https://api.kushinapos.com/api/v1</div>
                </div>
                <div>
                  <div className="text-stone-500 font-sans text-[11px]">AUTHENTICATION</div>
                  <div>Authorization: Bearer kpos_live_...</div>
                </div>
                <div>
                  <div className="text-stone-500 font-sans text-[11px]">RATE LIMIT</div>
                  <div>60 req/min (HTTP 429 + Retry-After)</div>
                </div>
                <div>
                  <div className="text-stone-500 font-sans text-[11px]">ERROR FORMAT</div>
                  <div>{`{ error: { code, message }, request_id }`}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-16 bg-stone-900 text-white border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-stone-950/50 border border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Scoped API Keys</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Granular scopes (<code className="text-amber-300">menu:read</code>, <code className="text-amber-300">orders:read</code>, <code className="text-amber-300">orders:write</code>, <code className="text-amber-300">customers:read</code>, <code className="text-amber-300">reports:read</code>). Keys are hashed with SHA-256 and never logged in plain text.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-950/50 border border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Idempotent Orders</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Pass an <code className="text-emerald-300">Idempotency-Key</code> header on <code className="text-stone-200">POST /orders</code>. Network retries will replay the original response and never duplicate food orders.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-950/50 border border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Webhook className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Signed Webhooks & SSRF Safety</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Every event delivery is signed with HMAC-SHA256 (<code className="text-purple-300">X-Kushina-Signature</code>). Target endpoints are validated to strictly block localhost, private IPs, and non-HTTPS URLs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Snippets Section */}
      <section className="py-16 md:py-24 bg-stone-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Interactive API Code Examples
              </h2>
              <p className="text-sm text-stone-400 mt-1">
                Explore common partner workflows with copy-ready curl and Node.js requests.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-stone-900 p-1.5 rounded-xl border border-stone-800">
              <button
                onClick={() => setActiveLang('curl')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeLang === 'curl' ? 'bg-amber-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-white'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveLang('js')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeLang === 'js' ? 'bg-amber-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-white'
                }`}
              >
                JavaScript / Node.js
              </button>
            </div>
          </div>

          {/* Snippet Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-stone-800 pb-3">
            {(Object.keys(SNIPPETS) as Array<keyof typeof SNIPPETS>).map((key) => {
              const snip = SNIPPETS[key];
              const active = activeSnippetTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSnippetTab(key)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-stone-800 text-amber-400 border border-stone-700'
                      : 'text-stone-400 hover:text-white hover:bg-stone-900/60'
                  }`}
                >
                  <span>{snip.title}</span>
                  <span className="font-mono text-[10px] text-stone-500 opacity-80">{snip.endpoint}</span>
                </button>
              );
            })}
          </div>

          {/* Code Window */}
          <div className="rounded-2xl border border-stone-800 bg-stone-900/90 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800 bg-stone-950/60">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="font-mono text-xs text-stone-400 ml-2">
                  {SNIPPETS[activeSnippetTab].endpoint}
                </span>
              </div>
              <button
                onClick={() =>
                  copyCode(
                    activeLang === 'curl'
                      ? SNIPPETS[activeSnippetTab].curl
                      : SNIPPETS[activeSnippetTab].js,
                    activeSnippetTab
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
              >
                {copiedId === activeSnippetTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Snippet</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-6 font-mono text-xs text-amber-200/90 overflow-x-auto leading-relaxed">
              <code>
                {activeLang === 'curl'
                  ? SNIPPETS[activeSnippetTab].curl
                  : SNIPPETS[activeSnippetTab].js}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Webhook Signature Verification Section */}
      <section className="py-16 md:py-24 bg-stone-900 text-white border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              Cryptographic Event Verification
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Verifying Webhook Signatures
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Each webhook delivery includes the <code className="text-purple-300">X-Kushina-Signature</code> header.
              The signature is formatted as <code className="text-stone-200">t=&lt;timestamp&gt;,v1=&lt;hmac&gt;</code>,
              where <code className="text-stone-200">hmac</code> is computed as the HMAC-SHA256 of{' '}
              <code className="text-purple-300">&lt;timestamp&gt;.&lt;raw_request_body&gt;</code> using your per-webhook secret.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800 bg-stone-900/60">
              <span className="font-mono text-xs text-stone-300 font-semibold">verifyWebhookSignature.js</span>
              <button
                onClick={() => copyCode(WEBHOOK_VERIFY_CODE, 'webhook_code')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
              >
                {copiedId === 'webhook_code' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-6 font-mono text-xs text-emerald-300/90 overflow-x-auto leading-relaxed">
              <code>{WEBHOOK_VERIFY_CODE}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 bg-gradient-to-br from-amber-600 to-amber-700 text-stone-950 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to integrate with KushinaPOS?
          </h2>
          <p className="text-stone-900/90 font-medium text-base max-w-xl mx-auto">
            Generate your API keys today in Settings &gt; Developers, or request a custom partner integration.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/integrations"
              className="px-6 py-3.5 rounded-xl bg-stone-950 hover:bg-stone-900 text-white font-bold text-sm shadow-xl transition-all"
            >
              Browse All Integrations
            </Link>
            <a
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-bold text-sm shadow-xl transition-all inline-flex items-center gap-2"
            >
              <Terminal className="w-4 h-4 text-amber-600" />
              Open Swagger Docs
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
