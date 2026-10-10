const crypto = require('crypto');
const b64 = s => Buffer.from(s).toString('base64url');

exports.hashPassword = pw => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
};

exports.verifyPassword = (pw, stored) => {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

exports.signToken = (data, secret, ttl = 7 * 24 * 3600 * 1000) => {
  const body = b64(JSON.stringify({ ...data, exp: Date.now() + ttl }));
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
};

exports.verifyToken = (token, secret) => {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
};
