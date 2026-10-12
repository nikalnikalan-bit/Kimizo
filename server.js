require('dotenv').config();
console.log('Google login:', process.env.GOOGLE_CLIENT_ID ? 'ON' : 'OFF (key not found in .env)', '| SMS:', process.env.SMS_PROVIDER || 'console');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./auth');
const { readFromDrive, writeToDrive } = require('./drive-db');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Local memory cache populated from Google Drive
const cache = {
  users: [],
  products: [],
  orders: [],
  settings: {}
};

const file = n => path.join(__dirname, 'data', n + '.json');

// Read function maintains synchronous signature using cache, with local fallback
const read = n => {
  if (cache[n] !== undefined && (Array.isArray(cache[n]) ? cache[n].length > 0 : Object.keys(cache[n]).length > 0)) {
    return cache[n];
  }
  try { return JSON.parse(fs.readFileSync(file(n))); } catch { return cache[n] || []; }
};

// Write function updates in-memory cache immediately, attempts local write if available, and returns Drive sync promise
const write = (n, d) => {
  cache[n] = d;
  try { fs.writeFileSync(file(n), JSON.stringify(d, null, 2)); } catch (_) {}
  return writeToDrive(n, d).catch(err => console.error(`Failed to sync ${n} to Drive:`, err.message));
};

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })); // rawBody is needed for the Razorpay webhook signature
app.use(express.static(path.join(__dirname, 'public')));

// Serverless / Vercel middleware: Request varumbo cache empty-aa irundha Google Drive-la irundhu load pannum
app.use(async (req, res, next) => {
  if (!cache.users.length && !cache.products.length && process.env.GOOGLE_DRIVE_FOLDER_ID) {
    try {
      const [u, p, o, s] = await Promise.all([
        readFromDrive('users'),
        readFromDrive('products'),
        readFromDrive('orders'),
        readFromDrive('settings')
      ]);
      if (Array.isArray(u) && u.length) cache.users = u;
      if (Array.isArray(p) && p.length) cache.products = p;
      if (Array.isArray(o) && o.length) cache.orders = o;
      if (s && typeof s === 'object' && Object.keys(s).length) cache.settings = s;
    } catch (e) {
      console.warn('Drive background load warning:', e.message);
    }
  }
  next();
});

const normPhone = p => {
  const d = String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};
const users = () => read('users');
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role });

// Admin account creation helper
const ensureAdmin = async () => {
  const list = users();
  const email = (process.env.ADMIN_EMAIL || 'admin@zanoit.com').toLowerCase();
  if (!list.find(u => u.email === email)) {
    list.push({
      id: list.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      name: 'Admin',
      email,
      phone: '',
      role: 'admin',
      pass: hashPassword(process.env.ADMIN_PASSWORD || 'Admin@123'),
      createdAt: new Date().toISOString()
    });
    await write('users', list);
  }
};
ensureAdmin();

const authed = (req, res, next) => {
  const p = verifyToken((req.get('authorization') || '').replace(/^Bearer /, ''), SECRET);
  if (!p) return res.status(401).json({ error: 'Please log in' });
  req.user = p; next();
};
const admin = (req, res, next) =>
  authed(req, res, () => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access only' }));

// ---------- Auth ----------
const tries = {};
const limited = k => {
  const n = Date.now();
  tries[k] = (tries[k] || []).filter(t => n - t < 15 * 60 * 1000);
  return tries[k].length >= 10;
};

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!String(name || '').trim() || !/^\S+@\S+\.\S+$/.test(em) || String(password || '').length < 6)
    return res.status(400).json({ error: 'Name, a valid email and a password of 6+ characters are required' });
  const ph = normPhone(phone);
  if (!ph) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  const list = users();
  if (list.find(u => u.phone === ph)) return res.status(409).json({ error: 'This mobile number is already registered. Please log in.' });
  if (list.find(u => u.email === em)) return res.status(409).json({ error: 'This email is already registered. Please log in.' });
  const u = {
    id: list.reduce((m, x) => Math.max(m, x.id), 0) + 1,
    name: String(name).trim(),
    email: em,
    phone: ph,
    role: 'customer',
    pass: hashPassword(String(password)),
    createdAt: new Date().toISOString()
  };
  list.push(u);
  await write('users', list);
  res.status(201).json({ token: signToken({ id: u.id, role: u.role }, SECRET), user: publicUser(u) });
});

app.post('/api/auth/login', (req, res) => {
  const em = String((req.body || {}).email || '').trim().toLowerCase(), k = req.ip + em;
  if (limited(k)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const u = users().find(x => x.email === em);
  if (!u || !verifyPassword(String((req.body || {}).password || ''), u.pass)) {
    tries[k] = tries[k] || [];
    tries[k].push(Date.now());
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  res.json({ token: signToken({ id: u.id, role: u.role }, SECRET), user: publicUser(u) });
});

app.get('/api/auth/me', authed, (req, res) => {
  const u = users().find(x => x.id === req.user.id);
  u ? res.json(publicUser(u)) : res.status(401).json({ error: 'Account not found' });
});
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// Load extra auth endpoints (Google Login + Custom OTP Flow)
require('./auth-extra')(app, { users, write, publicUser, hashPassword, signToken, SECRET, normPhone });

// ---------- Image upload (admin only) ----------
const UP = path.join(__dirname, 'public', 'uploads');
try { fs.mkdirSync(UP, { recursive: true }); } catch (_) {}
const sniff = b => {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.slice(0, 4).toString() === 'GIF8') return 'gif';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
};
const dropFile = u => {
  if (typeof u !== 'string') return;
  if (u.startsWith('/uploads/')) { fs.unlink(path.join(UP, path.basename(u)), () => {}); return; }
  if (u.includes('.blob.vercel-storage.com/')) { try { require('@vercel/blob').del(u).catch(() => {}); } catch (_) {} }
};

app.post('/api/upload', admin,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: '4mb' }),
  async (req, res) => {
    const ext = Buffer.isBuffer(req.body) && sniff(req.body);
    if (!ext) return res.status(400).json({ error: 'Invalid image. Please try another file.' });
    const name = Date.now() + '-' + require('crypto').randomBytes(4).toString('hex') + '.' + ext;
    const mime = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext];
    try {
      // Vercel (and any host with a read-only disk): store in Vercel Blob
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = require('@vercel/blob');
        const blob = await put('products/' + name, req.body, { access: 'public', contentType: mime, addRandomSuffix: false });
        return res.status(201).json({ url: blob.url });
      }
      // Local development: save to public/uploads
      fs.writeFileSync(path.join(UP, name), req.body);
      res.status(201).json({ url: '/uploads/' + name });
    } catch (e) {
      console.error('Upload failed:', e.message);
      res.status(500).json({ error: process.env.VERCEL
        ? 'Image storage not set up. Add Vercel Blob to this project (BLOB_READ_WRITE_TOKEN).'
        : 'Upload failed: ' + e.message });
    }
  });

// ---------- Settings ----------
const DEFAULTS = {
  storeName: 'kimizo', tagline: 'Global finds. Closer to you.',
  heroTitle: 'Trending global products, now in India',
  heroText: 'Carefully sourced from Japan, Korea and China to bring you unique, high-quality and affordable products.',
  announcement: '', phone: '', email: '', shippingFee: 49, freeAbove: 999
};
const getSettings = () => {
  try { return { ...DEFAULTS, ...(read('settings') || {}) }; } catch { return { ...DEFAULTS }; }
};
app.get('/api/settings', (req, res) => res.json(getSettings()));
app.put('/api/settings', admin, async (req, res) => {
  const cur = getSettings(), b = req.body || {};
  for (const k of Object.keys(DEFAULTS)) {
    if (b[k] === undefined) continue;
    cur[k] = typeof DEFAULTS[k] === 'number' ? Math.max(0, Number(b[k]) || 0) : String(b[k]).trim();
  }
  await write('settings', cur);
  res.json(cur);
});
app.get('/api/admin/check', admin, (req, res) => res.json({ ok: true }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ---------- Products ----------
app.get('/api/products', (req, res) => {
  const { q, category, origin } = req.query;
  let list = read('products');
  if (category) list = list.filter(p => p.c === category);
  if (origin) list = list.filter(p => p.o === origin);
  if (q) list = list.filter(p => (p.n + p.c + (p.sub || '') + p.o).toLowerCase().includes(String(q).toLowerCase()));
  res.json(list);
});

app.get('/api/products/:id', (req, res) => {
  const p = read('products').find(x => x.id == req.params.id);
  p ? res.json(p) : res.status(404).json({ error: 'Product not found' });
});

const clean = b => ({
  n: String(b.n || '').trim(), e: b.e || '📦', c: String(b.c || '').trim(),
  o: String(b.o || '').trim(), p: Number(b.p), m: Number(b.m || b.p),
  img: String(b.img || '').trim(),
  sub: String(b.sub || '').trim(),
  desc: String(b.desc || '').trim().slice(0, 2000)
});
const valid = p => p.n && p.c && p.o && p.p > 0;

app.post('/api/products', admin, async (req, res) => {
  const list = read('products'), p = clean(req.body);
  if (!valid(p)) return res.status(400).json({ error: 'n, c, o and p (price) are required' });
  p.id = list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  list.push(p);
  await write('products', list);
  res.status(201).json(p);
});

app.put('/api/products/:id', admin, async (req, res) => {
  const list = read('products'), i = list.findIndex(x => x.id == req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Product not found' });
  const p = { ...list[i], ...clean({ ...list[i], ...req.body }), id: list[i].id };
  if (!valid(p)) return res.status(400).json({ error: 'Invalid product data' });
  if (list[i].img && list[i].img !== p.img) dropFile(list[i].img);
  list[i] = p;
  await write('products', list);
  res.json(p);
});

app.delete('/api/products/:id', admin, async (req, res) => {
  const list = read('products'), next = list.filter(x => x.id != req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Product not found' });
  dropFile((list.find(x => x.id == req.params.id) || {}).img);
  await write('products', next);
  res.json({ ok: true });
});

// ---------- Razorpay ----------
const crypto = require('crypto');
const RZP_KEY = process.env.RAZORPAY_KEY_ID, RZP_SECRET = process.env.RAZORPAY_KEY_SECRET;
const rzpOn = !!(RZP_KEY && RZP_SECRET);
console.log('Razorpay:', rzpOn ? 'ON (' + (RZP_KEY.startsWith('rzp_live') ? 'LIVE' : 'TEST') + ' mode)' : 'OFF (keys not found in .env)');

const rzpCreateOrder = async (amountPaise, receipt, notes) => {
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(RZP_KEY + ':' + RZP_SECRET).toString('base64') },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: String(receipt), notes })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.description) || 'Razorpay order creation failed');
  return d;
};
const safeEq = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const markPaid = (o, paymentId) => {
  if (o.payment && o.payment.status === 'paid') return false;
  o.payment = { ...(o.payment || {}), method: 'razorpay', status: 'paid', rzpPaymentId: paymentId, paidAt: new Date().toISOString() };
  o.status = 'placed';
  o.history = [...(o.history || []), { status: 'placed', at: new Date().toISOString(), note: 'Payment received online (' + paymentId + ')' }];
  return true;
};

// public key id (safe to expose) so the checkout page knows if online payment is available
app.get('/api/payment/config', (req, res) => res.json({ razorpayKey: rzpOn ? RZP_KEY : null }));

// ---------- Orders ----------
app.post('/api/orders', authed, async (req, res) => {
  const { name, phone, address, items } = req.body || {};
  if (!name || !phone || !address || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'name, phone, address and items are required' });
  const online = (req.body || {}).paymentMethod === 'online';
  if (online && !rzpOn) return res.status(400).json({ error: 'Online payment is not available right now' });
  const products = read('products');
  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = products.find(x => x.id == it.id), qty = Math.floor(Number(it.qty));
    if (!p || !(qty > 0)) return res.status(400).json({ error: 'Invalid item in cart' });
    total += p.p * qty;
    lines.push({ id: p.id, name: p.n, price: p.p, qty });
  }
  const st = getSettings();
  const shipping = st.freeAbove > 0 && total >= st.freeAbove ? 0 : st.shippingFee;
  const orders = read('orders');
  const order = {
    id: orders.reduce((m, x) => Math.max(m, x.id), 1000) + 1,
    userId: req.user.id, name, phone, address, items: lines, subtotal: total, shipping, total: total + shipping,
    status: online ? 'payment_pending' : 'placed', createdAt: new Date().toISOString(),
    payment: { method: online ? 'razorpay' : 'cod', status: 'pending' },
    history: online ? [] : [{ status: 'placed', at: new Date().toISOString(), note: 'Order received' }]
  };
  orders.push(order);
  if (!online) {
    await write('orders', orders);
    return res.status(201).json(order);
  }
  try {
    // amount is calculated on the server from product prices; the browser can't change it
    const rz = await rzpCreateOrder(Math.round(order.total * 100), order.id, { orderId: String(order.id), userId: String(req.user.id) });
    order.payment.rzpOrderId = rz.id;
    await write('orders', orders);
    res.status(201).json({ ...order, razorpay: { key: RZP_KEY, orderId: rz.id, amount: rz.amount } });
  } catch (e) {
    orders.splice(orders.indexOf(order), 1);
    console.error('Razorpay order failed:', e.message);
    res.status(502).json({ error: 'Could not start online payment. Please try again or choose Cash on delivery.' });
  }
});

// Called by the browser after Razorpay checkout succeeds: verifies the signature
app.post('/api/payment/verify', authed, async (req, res) => {
  if (!rzpOn) return res.status(400).json({ error: 'Online payment is not available' });
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  const orders = read('orders'), o = orders.find(x => x.id == orderId && x.userId === req.user.id);
  if (!o || !o.payment || !razorpay_order_id || o.payment.rzpOrderId !== razorpay_order_id)
    return res.status(400).json({ error: 'Order not found' });
  const expected = crypto.createHmac('sha256', RZP_SECRET).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
  if (!razorpay_payment_id || !razorpay_signature || !safeEq(expected, razorpay_signature))
    return res.status(400).json({ error: 'Payment verification failed' });
  if (markPaid(o, razorpay_payment_id)) await write('orders', orders);
  res.json(o);
});

// Razorpay webhook (backup if the customer closes the page right after paying)
// Dashboard → Settings → Webhooks → URL: https://YOUR-DOMAIN/api/payment/webhook, events: payment.captured, order.paid
app.post('/api/payment/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const sig = req.get('x-razorpay-signature');
  if (!secret || !sig || !req.rawBody) return res.status(400).end();
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  if (!safeEq(expected, sig)) return res.status(400).end();
  const ev = req.body || {};
  if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
    const pay = (ev.payload && ev.payload.payment && ev.payload.payment.entity) || {};
    const orders = read('orders'), o = orders.find(x => x.payment && x.payment.rzpOrderId && x.payment.rzpOrderId === pay.order_id);
    if (o && pay.amount === Math.round(o.total * 100) && markPaid(o, pay.id)) await write('orders', orders);
  }
  res.json({ ok: true });
});

app.get('/api/my-orders', authed, (req, res) => res.json(read('orders').filter(o => o.userId === req.user.id && o.status !== 'payment_pending').reverse()));
app.get('/api/orders', admin, (req, res) => res.json(read('orders').filter(o => o.status !== 'payment_pending').reverse()));

app.patch('/api/orders/:id', admin, async (req, res) => {
  const orders = read('orders'), o = orders.find(x => x.id == req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const body = req.body || {};
  const ok = ['placed', 'packed', 'shipped', 'delivered', 'cancelled'];
  if (body.status === undefined && body.shipping === undefined) return res.status(400).json({ error: 'Nothing to update' });

  // validate everything first, then apply
  if (body.status !== undefined && !ok.includes(body.status)) return res.status(400).json({ error: 'status must be one of ' + ok.join(', ') });
  let ship;
  if (body.shipping !== undefined) {
    if (o.payment && o.payment.status === 'paid') return res.status(400).json({ error: 'Shipping cannot be changed for orders already paid online' });
    ship = Number(body.shipping);
    if (body.shipping === '' || !isFinite(ship) || ship < 0 || ship > 100000) return res.status(400).json({ error: 'Enter a valid shipping amount (0 or more)' });
    ship = Math.round(ship * 100) / 100;
  }

  if (body.status !== undefined) {
    const note = String(body.note || '').trim().slice(0, 140);
    o.status = body.status;
    o.history = [...(o.history || []), { status: o.status, at: new Date().toISOString(), note }];
  }
  if (ship !== undefined) {
    const sub = typeof o.subtotal === 'number' ? o.subtotal : o.items.reduce((m, i) => m + i.price * i.qty, 0);
    o.subtotal = sub; o.shipping = ship; o.total = Math.round((sub + ship) * 100) / 100;
  }
  await write('orders', orders);
  res.json(o);
});

app.use((err, req, res, next) =>
  res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'Image is too large (max 4 MB)' : err.message || 'Server error' }));

// Initial data hydration from Google Drive and Server Launch
(async () => {
  try {
    const [u, p, o, s] = await Promise.all([
      readFromDrive('users'),
      readFromDrive('products'),
      readFromDrive('orders'),
      readFromDrive('settings')
    ]);

    if (Array.isArray(u) && u.length) cache.users = u;
    if (Array.isArray(p) && p.length) cache.products = p;
    if (Array.isArray(o) && o.length) cache.orders = o;
    if (s && typeof s === 'object' && Object.keys(s).length) cache.settings = s;

    await ensureAdmin();
  } catch (e) {
    console.warn('Initial Drive sync warning:', e.message);
  }

  app.listen(PORT, () => console.log(`Kimizo running → http://localhost:${PORT}  |  Admin → http://localhost:${PORT}/admin`));
})();

module.exports = app;