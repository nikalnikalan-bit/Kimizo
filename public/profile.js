(async () => {
  const box = document.getElementById('pf');
  const TOKEN = localStorage.getItem('kz_token');
  if (!TOKEN) { location.href = '/login.html?next=' + encodeURIComponent('/profile.html'); return; }
  const H = { Authorization: 'Bearer ' + TOKEN };

  const kickOut = () => { localStorage.removeItem('kz_token'); localStorage.removeItem('kz_user'); location.href = '/login.html?next=' + encodeURIComponent('/profile.html'); };
  const call = async (url, method = 'GET', body) => {
    const r = await fetch(url, { method, cache: 'no-store', headers: { ...H, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { kickOut(); throw new Error('login'); }
    if (!r.ok) throw new Error(d.error || 'Something went wrong');
    return d;
  };
  const fmt = (d, o) => d ? new Date(d).toLocaleDateString('en-IN', o || { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const stars = n => { const k = Math.max(0, Math.min(5, Math.round(n))); return `<span class="stars">${'★'.repeat(k)}<i>${'★'.repeat(5 - k)}</i></span>`; };

  let me, orders = [], revs = [];
  try {
    [me, orders, revs] = await Promise.all([call('/api/auth/me'), call('/api/my-orders').catch(() => []), call('/api/my-reviews').catch(() => [])]);
  } catch (e) {
    if (e.message !== 'login') box.innerHTML = `<p class="pd-msg">${esc(e.message)}<br><br><a href="/">← Back to shop</a></p>`;
    return;
  }

  const STATUS = { placed: 'Order placed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

  function draw() {
    const nm = me.name || 'Customer';
    document.title = nm + ' – My profile – Kimizo';
    box.innerHTML = `
    <section class="pf-card pf-head">
      <div class="pf-av" aria-hidden="true">${esc((nm.trim()[0] || 'C').toUpperCase())}</div>
      <div class="pf-id">
        <h1>${esc(nm)}${me.role === 'admin' ? ' <span class="pf-badge">Admin</span>' : ''}</h1>
        <p>✉️ ${esc(me.email)}</p>
        <p>📞 ${me.phone ? esc(me.phone) : '<i>No mobile number added</i>'}</p>
        <small>Member since ${esc(fmt(me.createdAt, { month: 'long', year: 'numeric' }) || '-')}</small>
      </div>
      <div class="pf-stats">
        <a href="/orders.html"><b>${orders.length}</b><span>Orders</span></a>
        <a href="#reviews"><b>${revs.length}</b><span>Reviews</span></a>
      </div>
    </section>

    <section class="pf-card">
      <h2>Edit details</h2>
      <div class="pf-grid">
        <label>Full name<input id="pfn" value="${esc(nm)}" maxlength="60" autocomplete="name"></label>
        <label>Mobile number<input id="pfp" value="${esc(me.phone || '')}" inputmode="numeric" maxlength="14" autocomplete="tel" placeholder="10-digit number"></label>
        <label>Email <small>(cannot be changed)</small><input value="${esc(me.email)}" disabled></label>
      </div>
      <p class="rv-msg" id="pfm" role="status"></p>
      <button type="button" class="rv-send" id="pfs">Save changes</button>
    </section>

    <section class="pf-card">
      <h2>Recent orders</h2>
      ${orders.length ? orders.slice(0, 3).map(o => `<div class="pf-row"><div><b>#${esc(o.id)}</b> <small>${esc(fmt(o.createdAt))}</small><br><small>${(o.items || []).map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</small></div><div class="pf-r"><b>${inr(o.total)}</b><span class="pf-chip s-${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</span></div></div>`).join('') + '<a class="rv-more" href="/orders.html" style="text-decoration:none;text-align:center">View all orders</a>'
        : '<p class="rv-none">You have not placed any orders yet. <a href="/">Start shopping</a></p>'}
    </section>

    <section class="pf-card" id="reviews">
      <h2>My reviews</h2>
      ${revs.length ? revs.map(r => `<article class="pf-rev">
        <a class="hr-pi pf-pi" href="/product.html?id=${r.productId}">${r.productImg ? `<img src="${esc(r.productImg)}" alt="">` : esc(r.productEmoji)}</a>
        <div class="pf-rb">
          <a class="pf-pn" href="/product.html?id=${r.productId}#rev">${esc(r.productName)}</a>
          <div>${stars(r.rating)} ${r.verified ? '<span class="rv-ver">✔ Verified buyer</span>' : ''} <small>${esc(fmt(r.createdAt))}</small></div>
          ${r.text ? `<p>${esc(r.text)}</p>` : ''}
          ${(r.images || []).length ? `<div class="rv-imgs">${r.images.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener" class="pf-ph"><img src="${esc(u)}" alt="My photo" loading="lazy"></a>`).join('')}</div>` : ''}
        </div>
        <button type="button" class="rc-clear" data-del="${r.id}">Delete</button>
      </article>`).join('')
        : '<p class="rv-none">You have not reviewed any product yet. Open a product and share your rating and photos!</p>'}
    </section>

    <p style="text-align:center"><button type="button" class="rv-send" id="pfo" style="background:var(--ink)">🚪 Logout</button></p>`;

    document.getElementById('pfs').onclick = save;
    document.getElementById('pfo').onclick = kickOutHome;
    if (location.hash === '#reviews') document.getElementById('reviews').scrollIntoView();
  }
  const kickOutHome = () => { localStorage.removeItem('kz_token'); localStorage.removeItem('kz_user'); location.href = '/'; };

  async function save() {
    const m = document.getElementById('pfm'), b = document.getElementById('pfs');
    const name = document.getElementById('pfn').value.trim(), phone = document.getElementById('pfp').value.trim();
    if (!name) { m.textContent = 'Please enter your name.'; return; }
    b.disabled = true; m.textContent = 'Saving...';
    try {
      me = await call('/api/auth/me', 'PUT', { name, phone });
      try { localStorage.setItem('kz_user', JSON.stringify({ ...JSON.parse(localStorage.getItem('kz_user') || '{}'), name: me.name, phone: me.phone })); } catch { }
      toast('Profile updated');
      setTimeout(() => location.reload(), 500);   // reload so the menu in the header shows the new name
    } catch (e) { m.textContent = e.message; b.disabled = false; }
  }

  box.addEventListener('click', async e => {
    const b = e.target.closest('button[data-del]'); if (!b) return;
    if (!confirm('Delete this review?')) return;
    b.disabled = true;
    try { await call('/api/my-reviews/' + b.dataset.del, 'DELETE'); revs = revs.filter(r => String(r.id) !== b.dataset.del); toast('Review deleted'); draw(); document.getElementById('reviews').scrollIntoView(); }
    catch (er) { toast(er.message); b.disabled = false; }
  });

  draw();
})();
