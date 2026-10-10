'use strict';

const crypto = require('crypto');

// In-memory store for OTPs: { "9876543210": { otp: "123456", exp: 1712345678 } }
const otpStore = {};

module.exports = (
  app,
  { users, write, publicUser, hashPassword, signToken, SECRET, normPhone }
) => {
  const issue = user => ({
    token: signToken({ id: user.id, role: user.role }, SECRET),
    user: publicUser(user)
  });

  const adminBlocked = (user, res) => {
    if (user && user.role === 'admin') {
      res.status(403).json({
        error: 'Admin must log in with email and password.'
      });
      return true;
    }
    return false;
  };

  const nextId = list =>
    list.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;

  // Send Public configuration (Only Google Client ID, Firebase removed)
  app.get('/api/auth/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      google: process.env.GOOGLE_CLIENT_ID || null
    });
  });

  // ---------- In-House Phone OTP Flow ----------

  // 1. Send OTP
  app.post('/api/auth/otp/send', async (req, res) => {
    const rawPhone = req.body?.phone;
    const phone = normPhone(rawPhone);

    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const exp = Date.now() + 5 * 60 * 1000; // 5 mins validity
    otpStore[phone] = { otp, exp };

    const provider = process.env.SMS_PROVIDER || 'console';

    if (provider === 'console' || process.env.DEV_SHOW_OTP === 'true') {
      console.log(`\n================================`);
      console.log(`[OTP VERIFICATION] Phone: ${phone} | OTP: ${otp}`);
      console.log(`================================\n`);
    }

    // Return response (shows OTP if DEV_SHOW_OTP=true for easy testing)
    return res.json({
      ok: true,
      message: 'OTP sent successfully',
      ...(process.env.DEV_SHOW_OTP === 'true' && { devOtp: otp })
    });
  });

  // 2. Verify OTP and Login/Register
  app.post('/api/auth/otp/verify', (req, res) => {
    const phone = normPhone(req.body?.phone);
    const otp = String(req.body?.otp || '').trim();
    const name = String(req.body?.name || '').trim().slice(0, 100);

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    const record = otpStore[phone];
    if (!record || record.exp < Date.now()) {
      return res.status(400).json({ error: 'OTP expired or not requested. Please try again.' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Clear used OTP
    delete otpStore[phone];

    const list = users();
    let user = list.find(u => u.phone && normPhone(u.phone) === phone);

    if (adminBlocked(user, res)) return;

    // Create user if phone not registered
    if (!user) {
      if (!name) {
        return res.status(400).json({
          error: 'Enter your name to complete account registration.',
          needsName: true
        });
      }

      user = {
        id: nextId(list),
        name,
        email: null,
        phone,
        role: 'customer',
        pass: null,
        createdAt: new Date().toISOString()
      };

      list.push(user);
      write('users', list);
    }

    return res.json(issue(user));
  });

  // 3. Reset Password using OTP
  app.post('/api/auth/otp/reset-password', (req, res) => {
    const phone = normPhone(req.body?.phone);
    const otp = String(req.body?.otp || '').trim();
    const password = String(req.body?.password || '');

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }

    const record = otpStore[phone];
    if (!record || record.exp < Date.now()) {
      return res.status(400).json({ error: 'OTP expired or invalid' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    delete otpStore[phone];

    const list = users();
    const user = list.find(u => u.phone && normPhone(u.phone) === phone);

    if (!user) {
      return res.status(404).json({ error: 'No account found with this phone number' });
    }

    if (adminBlocked(user, res)) return;

    user.pass = hashPassword(password);
    write('users', list);

    return res.json({ ok: true, message: 'Password updated successfully' });
  });

  // ---------- Google Sign-In Flow ----------
  app.post('/api/auth/google', async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(503).json({
        error: 'Google login is not configured. Set GOOGLE_CLIENT_ID in .env.'
      });
    }

    try {
      const credential = String(req.body?.credential || '');
      if (!credential) {
        return res.status(400).json({ error: 'Google credential is required.' });
      }

      const response = await fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential)
      );

      const googleUser = await response.json();

      if (
        !response.ok ||
        googleUser.aud !== clientId ||
        String(googleUser.email_verified) !== 'true' ||
        !googleUser.email
      ) {
        return res.status(401).json({
          error: 'Google sign-in failed. Please try again.'
        });
      }

      const email = String(googleUser.email).trim().toLowerCase();
      const list = users();
      let user = list.find(item => String(item.email || '').toLowerCase() === email);

      if (adminBlocked(user, res)) return;

      if (!user) {
        user = {
          id: nextId(list),
          name: String(googleUser.name || email.split('@')[0]).slice(0, 100),
          email,
          phone: '',
          role: 'customer',
          pass: null,
          google: true,
          createdAt: new Date().toISOString()
        };

        list.push(user);
        write('users', list);
      }

      return res.json(issue(user));
    } catch (error) {
      console.error('Google login error:', error.message);
      return res.status(502).json({
        error: 'Could not complete Google login. Please try again.'
      });
    }
  });
};