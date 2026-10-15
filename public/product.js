(() => {
  const id = new URLSearchParams(location.search).get('id');
  const box = document.getElementById('pdb'), crumbs = document.getElementById('crumbs'), rel = document.getElementById('rel');
  const COLORS = ['var(--yellow)', 'var(--pink)', 'var(--teal)', 'var(--sky)', 'var(--orange)'];
  let qty = 1, cur = null;

  // search from this page -> home page results
  const goSearch = () => { const v = $('q').value.trim(); location.href = v ? '/?q=' + encodeURIComponent(v) : '/'; };
  $('sb').onclick = goSearch;
  $('q').onkeydown = e => { if (e.key === 'Enter') goSearch(); };

  const notFound = msg => {
    document.title = 'Product not found – Kimizo';
    box.innerHTML = `<p class="pd-msg">${esc(msg)}<br><br><a href="/">← Back to all products</a></p>`;
  };

  function draw(p, st) {
    cur = p;
    document.title = p.n + ' – ' + (st.storeName || 'Kimizo');
    const off = p.m > p.p ? Math.round((1 - p.p / p.m) * 100) : 0;
    const flag = F[String(p.o).toLowerCase()] || '🌏';
    const gal = [p.img, ...(Array.isArray(p.imgs) ? p.imgs : [])].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
    const desc = p.desc || `${p.n} from ${p.o}, part of our ${p.sub || p.c} range. Carefully selected for quality and value, and delivered across India.`;
    const free = st.freeAbove > 0 ? ` (free above ${inr(st.freeAbove)})` : '';
    const shipTxt = (p.ship !== undefined && p.ship !== null && p.ship !== '')
      ? (Number(p.ship) > 0 ? inr(p.ship) + ' per item' : 'free')
      : (st.shippingFee ? inr(st.shippingFee) + free : 'free');
    crumbs.innerHTML = `<a href="/">Home</a><span>›</span><span>${esc(p.c)}</span>${p.sub ? `<span>›</span><span>${esc(p.sub)}</span>` : ''}<span>›</span><span>${esc(p.n)}</span>`;
    box.innerHTML = `
    <div class="pd" style="--c:${COLORS[p.id % 5]}">
      <div class="pd-gal">
        <div class="pd-pic" id="pdpic"><i>${flag} ${esc(p.o)}</i>${gal.length ? `<img id="pdmain" src="${esc(gal[0])}" alt="${esc(p.n)}">` : pic(p)}${gal.length > 1 ? '<button type="button" class="pg-p" aria-label="Previous photo">‹</button><button type="button" class="pg-n" aria-label="Next photo">›</button>' : ''}${gal.length ? '<span class="pd-hint">🔍 Tap to zoom</span>' : ''}</div>
        ${gal.length > 1 ? `<div class="pd-thumbs">${gal.map((u, i) => `<button type="button" data-th="${i}" class="${i ? '' : 'on'}" aria-label="Photo ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="pd-box">
        <h1>${esc(p.n)}</h1>
        <div class="tags"><span>${esc(p.c)}</span>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}<span>${flag} ${esc(p.o)}</span></div>
        <div class="pd-price"><b>${inr(p.p)}</b>${off ? `<s>${inr(p.m)}</s><em>${off}% off</em>` : ''}</div>
        ${off ? `<p class="pd-save">You save ${inr(p.m - p.p)}</p>` : '<p class="pd-save"></p>'}
        <h2>About this product</h2>
        <p class="pd-desc">${esc(desc)}</p>
        <h2>Product details</h2>
        <table class="specs">
          <tr><th>Category</th><td>${esc(p.c)}</td></tr>
          ${p.sub ? `<tr><th>Type</th><td>${esc(p.sub)}</td></tr>` : ''}
          <tr><th>Sourced from</th><td>${flag} ${esc(p.o)}</td></tr>
          <tr><th>Price</th><td>${inr(p.p)}${off ? ` <small>(MRP ${inr(p.m)})</small>` : ''}</td></tr>
          <tr><th>Product ID</th><td>KZ-${String(p.id).padStart(4, '0')}</td></tr>
        </table>
        <div class="pd-buy">
          <div class="pd-qty"><button type="button" id="pdm" aria-label="Decrease quantity">−</button><span id="pdq" aria-live="polite">1</span><button type="button" id="pdp" aria-label="Increase quantity">+</button></div>
          <button type="button" class="add" id="pda">Add to cart</button>
          <button type="button" class="add buy" id="pdbuy">Buy now</button>
        </div>
        <div class="pd-note">
          <span>🚚 Shipping ${shipTxt}</span>
          <span>🛡️ Quality checked before dispatch</span>
          <span>🌐 Authentic products from Japan, Korea and China</span>
        </div>
      </div>
    </div>`;

    const q = () => { $('pdq').textContent = qty; };
    $('pdm').onclick = () => { qty = Math.max(1, qty - 1); q(); };
    $('pdp').onclick = () => { qty = Math.min(20, qty + 1); q(); };
    $('pda').onclick = () => { cart[p.id] = (cart[p.id] || 0) + qty; drawCart(); toast(qty > 1 ? qty + ' items added to cart' : 'Added to cart'); };
    $('pdbuy').onclick = () => { cart[p.id] = (cart[p.id] || 0) + qty; drawCart(); $('co').click(); };

    // photo gallery: thumbnails, arrows, swipe, tap to open full picture
    let gi = 0;
    const setG = n => {
      gi = (n + gal.length) % gal.length;
      $('pdmain').src = gal[gi];
      document.querySelectorAll('.pd-thumbs button').forEach((b, j) => b.classList.toggle('on', j === gi));
    };
    if (gal.length) {
      const pc = $('pdpic'); let sx = 0, moved = false;
      pc.onclick = e => {
        if (moved) { moved = false; return; }
        if (e.target.closest('.pg-p')) return setG(gi - 1);
        if (e.target.closest('.pg-n')) return setG(gi + 1);
        zoom(gal, gi);
      };
      pc.ontouchstart = e => { sx = e.touches[0].clientX; moved = false; };
      pc.ontouchend = e => { const dx = e.changedTouches[0].clientX - sx; if (gal.length > 1 && Math.abs(dx) > 50) { moved = true; setG(gi + (dx < 0 ? 1 : -1)); } };
      const th = document.querySelector('.pd-thumbs');
      if (th) th.onclick = e => { const b = e.target.closest('button[data-th]'); if (b) setG(+b.dataset.th); };
    }
  }

  function related(p) {
    fetch('/api/products?category=' + encodeURIComponent(p.c)).then(r => r.json()).then(list => {
      const l = list.filter(x => x.id !== p.id).sort((a, b) => (b.sub === p.sub) - (a.sub === p.sub)).slice(0, 4);
      if (!l.length) return;
      rel.innerHTML = `<h2 class="pd-rel">More in ${esc(p.c)}</h2><div class="grid">${l.map(x =>
        `<article class="card" data-href="/product.html?id=${x.id}"><a class="pic" href="/product.html?id=${x.id}" aria-label="View ${esc(x.n)}"><i>${F[String(x.o).toLowerCase()] || '🌏'} ${esc(x.o)}</i>${pic(x)}</a><div class="info"><h3><a href="/product.html?id=${x.id}">${esc(x.n)}</a></h3><small>${esc(x.c)}${x.sub ? ' · ' + esc(x.sub) : ''}</small><div class="pr">${inr(x.p)}<s>${inr(x.m)}</s>${x.m > x.p ? `<em>${Math.round((1 - x.p / x.m) * 100)}% off</em>` : ''}</div><button class="add" data-a="${x.id}">Add to cart</button></div></article>`).join('')}</div>`;
    }).catch(() => {});
  }

  /* ---------- Recently viewed ---------- */
  function recent(p) {
    let s = $('recent');
    if (!s) { s = document.createElement('section'); s.id = 'recent'; s.className = 'rc'; rel.after(s); }
    drawRecent(s, p.id);   // shows everything except this product
    pushRecent(p.id);      // then remember this product
  }

  /* ---------- Customer reviews: stars, text, photos ---------- */
  const TOKEN = () => localStorage.getItem('kz_token') || '';
  const stars = n => { const k = Math.max(0, Math.min(5, Math.round(n))); return `<span class="stars" aria-label="${k} out of 5 stars">${'★'.repeat(k)}<i>${'★'.repeat(5 - k)}</i></span>`; };
  const shortName = n => { const a = String(n || 'Customer').trim().split(/\s+/); return a[0] + (a[1] ? ' ' + a[1][0].toUpperCase() + '.' : ''); };
  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

  // shrink any photo to a small WEBP before upload (phone photos are huge)
  async function prepPhoto(f) {
    const img = await new Promise((ok, no) => {
      const i = new Image(), u = URL.createObjectURL(f);
      i.onload = () => { URL.revokeObjectURL(u); ok(i); };
      i.onerror = () => { URL.revokeObjectURL(u); no(new Error("This photo format can't be opened. Please use JPG or PNG.")); };
      i.src = u;
    });
    const w0 = img.naturalWidth || 800, h0 = img.naturalHeight || 800, k = Math.min(1, 900 / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
    const to = (t, q) => new Promise(r => c.toBlob(r, t, q));
    let blob = null;
    for (const q of [.82, .7, .6, .45]) { blob = await to('image/webp', q); if (!blob || blob.type !== 'image/webp') break; if (blob.size <= 250 * 1024) break; }
    if (!blob || blob.type !== 'image/webp') {
      x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      for (const q of [.8, .65, .5]) { blob = await to('image/jpeg', q); if (blob && blob.size <= 250 * 1024) break; }
    }
    if (!blob) throw new Error('Could not process this photo');
    return blob;
  }

  // full-screen photo viewer (works for one photo or many: arrows, swipe, keyboard)
  function zoom(urls, i) {
    urls = (Array.isArray(urls) ? urls : [urls]).filter(Boolean); if (!urls.length) return;
    i = i || 0;
    const many = urls.length > 1, o = document.createElement('div'); o.className = 'rv-lb';
    o.innerHTML = `<img alt="Photo"><button type="button" class="lb-x" aria-label="Close">✕</button>${many ? '<button type="button" class="lb-p" aria-label="Previous">‹</button><button type="button" class="lb-n" aria-label="Next">›</button><span class="lb-c"></span>' : ''}`;
    const im = o.querySelector('img'), c = o.querySelector('.lb-c');
    const show = n => { i = (n + urls.length) % urls.length; im.src = urls[i]; if (c) c.textContent = (i + 1) + ' / ' + urls.length; };
    const k = e => { if (e.key === 'Escape') close(); else if (many && e.key === 'ArrowLeft') show(i - 1); else if (many && e.key === 'ArrowRight') show(i + 1); };
    const close = () => { o.remove(); document.removeEventListener('keydown', k); };
    let sx = 0;
    o.ontouchstart = e => { sx = e.touches[0].clientX; };
    o.ontouchend = e => { const dx = e.changedTouches[0].clientX - sx; if (many && Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); };
    o.onclick = e => {
      if (e.target.closest('.lb-p')) return show(i - 1);
      if (e.target.closest('.lb-n')) return show(i + 1);
      if (e.target.tagName === 'IMG') return;
      close();
    };
    show(i); document.addEventListener('keydown', k); document.body.appendChild(o);
  }

  function reviews(p) {
    const sec = document.createElement('section'); sec.id = 'rev'; sec.className = 'rv';
    box.after(sec);
    const api = '/api/products/' + p.id + '/reviews';
    let list = [], rating = 0, imgs = [], shown = 5, busy = false, failed = false;

    sec.innerHTML = `<h2 class="rv-h">Customer reviews</h2>
      <div class="rv-top" id="rvsum"></div>
      <div class="rv-form" id="rvf"></div>
      <div id="rvl"></div>`;

    const msg = t => { const m = $('rvmsg'); if (m) m.textContent = t || ''; };

    function drawSummary() {
      const n = list.length, avg = n ? list.reduce((a, r) => a + Number(r.rating || 0), 0) / n : 0;
      const dist = [5, 4, 3, 2, 1].map(s => list.filter(r => Math.round(r.rating) === s).length);
      $('rvsum').innerHTML = n
        ? `<div class="rv-avg"><b>${avg.toFixed(1)}</b>${stars(avg)}<small>${n} review${n > 1 ? 's' : ''}</small></div>
           <div class="rv-bars">${dist.map((c, i) => `<div><span>${5 - i}★</span><em><u style="width:${(c / n) * 100}%"></u></em><span>${c}</span></div>`).join('')}</div>`
        : `<p class="rv-none">${failed ? 'Reviews are not available right now.' : 'No reviews yet. Be the first to review this product!'}</p>`;
      // small rating line under the product title
      let m = box.querySelector('.rv-mini');
      if (!m) { const t = box.querySelector('.tags'); if (t) { m = document.createElement('a'); m.className = 'rv-mini'; m.href = '#rev'; t.before(m); } }
      if (m) m.innerHTML = n ? `${stars(avg)} <span>${avg.toFixed(1)} · ${n} review${n > 1 ? 's' : ''}</span>` : '<span>No reviews yet</span>';
    }

    function drawList() {
      const l = list.slice(0, shown);
      $('rvl').innerHTML = l.map(r => {
        const d = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const photos = Array.isArray(r.images) ? r.images.filter(Boolean) : [];
        return `<article class="rv-item"><div class="rv-av" aria-hidden="true">${esc(String(r.name || 'C').trim()[0] || 'C').toUpperCase()}</div>
          <div class="rv-body"><div class="rv-meta"><b>${esc(shortName(r.name))}</b>${r.verified ? '<span class="rv-ver">✔ Verified buyer</span>' : ''}<small>${esc(d)}</small></div>
          ${stars(r.rating)}
          ${r.text ? `<p>${esc(r.text)}</p>` : ''}
          ${photos.length ? `<div class="rv-imgs">${photos.map(u => `<button type="button" data-zoom="${esc(u)}" aria-label="View photo"><img src="${esc(u)}" alt="Customer photo" loading="lazy"></button>`).join('')}</div>` : ''}
          </div></article>`;
      }).join('') + (list.length > shown ? '<button type="button" class="rv-more" data-more>Show more reviews</button>' : '');
    }

    function drawForm() {
      if (!TOKEN()) {
        const next = encodeURIComponent(location.pathname + location.search);
        $('rvf').innerHTML = `<h3>Bought this product?</h3><p class="rv-sub">Login to rate it and share photos with other customers.</p><a class="rv-send" href="/login.html?next=${next}">Login to write a review</a>`;
        return;
      }
      $('rvf').innerHTML = `<h3>Write a review</h3>
        <p class="rv-sub">Tell other customers what you think. Photos of the real product help a lot!</p>
        <div class="rv-pick" id="rvp" role="group" aria-label="Your rating">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-st="${i}" aria-label="${i} star${i > 1 ? 's' : ''}">★</button>`).join('')}<span id="rvpt"></span></div>
        <textarea id="rvtx" rows="4" maxlength="1000" placeholder="How is the quality? Does it match the photos? Would you recommend it?"></textarea>
        <div class="rv-up"><label class="rv-file">📷 Add photos<input id="rvfile" type="file" accept="image/*" multiple hidden></label><span>Up to 4 photos</span></div>
        <div class="rv-th" id="rvth"></div>
        <p class="rv-msg" id="rvmsg" role="status"></p>
        <button type="button" class="rv-send" id="rvsend">Submit review</button>`;
      drawPick();
    }

    function drawPick() {
      const w = $('rvp'); if (!w) return;
      w.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.st <= rating));
      $('rvpt').textContent = rating ? LABELS[rating] : 'Tap to rate';
    }
    function drawThumbs() {
      const t = $('rvth'); if (!t) return;
      t.innerHTML = imgs.map((u, i) => `<div class="rv-t"><img src="${esc(u)}" alt="Your photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove photo">✕</button></div>`).join('');
    }

    async function load() {
      try {
        const r = await fetch(api, { cache: 'no-store' }); if (!r.ok) throw new Error('x');
        const d = await r.json(); list = Array.isArray(d) ? d : (d.reviews || []); failed = false;
      } catch { list = []; failed = true; }
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      drawSummary(); drawList();
    }

    async function addFiles(files) {
      const room = 4 - imgs.length;
      if (room <= 0) { msg('You can add up to 4 photos.'); return; }
      msg('Uploading photos...');
      for (const f of [...files].slice(0, room)) {
        try {
          if (f.size > 25 * 1024 * 1024) throw new Error('Each photo must be under 25 MB.');
          const blob = await prepPhoto(f);
          const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': blob.type, Authorization: 'Bearer ' + TOKEN() }, body: blob });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Photo upload failed');
          imgs.push(d.url); drawThumbs();
        } catch (e) { msg(e.message); return; }
      }
      msg('');
    }

    async function send() {
      if (busy) return;
      if (!rating) { msg('Please tap the stars to rate this product.'); return; }
      const text = $('rvtx').value.trim();
      if (!text && !imgs.length) { msg('Please write a few words or add a photo.'); return; }
      busy = true; $('rvsend').disabled = true; msg('Submitting...');
      try {
        const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN() }, body: JSON.stringify({ rating, text, images: imgs }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 401 ? 'Your login has expired. Please login again.' : (d.error || 'Could not submit your review.'));
        rating = 0; imgs = []; $('rvtx').value = ''; drawPick(); drawThumbs(); msg('');
        toast('Thanks! Your review is posted.');
        await load();
      } catch (e) { msg(e.message); }
      busy = false; const b = $('rvsend'); if (b) b.disabled = false;
    }

    sec.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.st) { rating = +b.dataset.st; drawPick(); }
      else if (b.dataset.rm !== undefined) { imgs.splice(+b.dataset.rm, 1); drawThumbs(); }
      else if (b.dataset.zoom) { const all = [...b.parentElement.querySelectorAll('[data-zoom]')]; zoom(all.map(x => x.dataset.zoom), all.indexOf(b)); }
      else if (b.dataset.more !== undefined) { shown += 5; drawList(); }
      else if (b.id === 'rvsend') send();
    });
    sec.addEventListener('change', e => { if (e.target.id === 'rvfile') { addFiles(e.target.files); e.target.value = ''; } });

    drawForm(); drawSummary(); load();
  }

  if (!/^\d+$/.test(id || '')) return notFound('This product link is not valid.');
  Promise.all([
    fetch('/api/products/' + id).then(r => r.ok ? r.json() : null),
    fetch('/api/settings').then(r => r.json()).catch(() => ({}))
  ]).then(([p, st]) => {
    if (!p) return notFound('Sorry, this product is not available any more.');
    draw(p, st); related(p); reviews(p); recent(p);
  }).catch(() => notFound('Could not load the product. Is the server running?'));
})();
