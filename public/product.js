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
    const desc = p.desc || `${p.n} from ${p.o}, part of our ${p.sub || p.c} range. Carefully selected for quality and value, and delivered across India.`;
    const free = st.freeAbove > 0 ? ` (free above ${inr(st.freeAbove)})` : '';
    const shipTxt = (p.ship !== undefined && p.ship !== null && p.ship !== '')
      ? (Number(p.ship) > 0 ? inr(p.ship) + ' per item' : 'free')
      : (st.shippingFee ? inr(st.shippingFee) + free : 'free');
    crumbs.innerHTML = `<a href="/">Home</a><span>›</span><span>${esc(p.c)}</span>${p.sub ? `<span>›</span><span>${esc(p.sub)}</span>` : ''}<span>›</span><span>${esc(p.n)}</span>`;
    box.innerHTML = `
    <div class="pd" style="--c:${COLORS[p.id % 5]}">
      <div class="pd-pic"><i>${flag} ${esc(p.o)}</i>${pic(p)}</div>
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
  }

  function related(p) {
    fetch('/api/products?category=' + encodeURIComponent(p.c)).then(r => r.json()).then(list => {
      const l = list.filter(x => x.id !== p.id).sort((a, b) => (b.sub === p.sub) - (a.sub === p.sub)).slice(0, 4);
      if (!l.length) return;
      rel.innerHTML = `<h2 class="pd-rel">More in ${esc(p.c)}</h2><div class="grid">${l.map(x =>
        `<article class="card" data-href="/product.html?id=${x.id}"><a class="pic" href="/product.html?id=${x.id}" aria-label="View ${esc(x.n)}"><i>${F[String(x.o).toLowerCase()] || '🌏'} ${esc(x.o)}</i>${pic(x)}</a><div class="info"><h3><a href="/product.html?id=${x.id}">${esc(x.n)}</a></h3><small>${esc(x.c)}${x.sub ? ' · ' + esc(x.sub) : ''}</small><div class="pr">${inr(x.p)}<s>${inr(x.m)}</s>${x.m > x.p ? `<em>${Math.round((1 - x.p / x.m) * 100)}% off</em>` : ''}</div><button class="add" data-a="${x.id}">Add to cart</button></div></article>`).join('')}</div>`;
    }).catch(() => {});
  }

  if (!/^\d+$/.test(id || '')) return notFound('This product link is not valid.');
  Promise.all([
    fetch('/api/products/' + id).then(r => r.ok ? r.json() : null),
    fetch('/api/settings').then(r => r.json()).catch(() => ({}))
  ]).then(([p, st]) => {
    if (!p) return notFound('Sorry, this product is not available any more.');
    draw(p, st); related(p);
  }).catch(() => notFound('Could not load the product. Is the server running?'));
})();
