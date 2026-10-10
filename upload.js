const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = (app, admin, express) => {
  const UP = path.join(__dirname, 'public', 'uploads');
  fs.mkdirSync(UP, { recursive: true });

  const sniff = b => {
    if (b.length < 12) return null;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (b.slice(0, 4).toString() === 'GIF8') return 'gif';
    if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp';
    return null;
  };

  app.post('/api/upload', admin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: '5mb' }),
    (req, res) => {
      const ext = Buffer.isBuffer(req.body) && sniff(req.body);
      if (!ext) return res.status(400).json({ error: 'Please upload a JPG, PNG, WEBP or GIF image' });
      const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(UP, name), req.body);
      res.status(201).json({ url: '/uploads/' + name });
    });
};