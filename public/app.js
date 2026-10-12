let P=[],S={shippingFee:0,freeAbove:0};
// shipping: products with their own charge (p.ship) pay that x qty, others use the store default
function shipCalc(lines){let sub=0,manual=0,hasDef=false;lines.forEach(([p,q])=>{sub+=p.p*q;if(p.ship!=null&&p.ship!=="")manual+=Number(p.ship)*q;else hasDef=true});
  const def=hasDef&&sub>0&&!(S.freeAbove>0&&sub>=S.freeAbove)?S.shippingFee:0;return{amt:manual+def,hasDef,sub}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pic=p=>p.img?`<img src="${esc(p.img)}" alt="${esc(p.n)}">`:p.e;
const G=id=>P.find(p=>p.id==id);
const ORG=["All","Japan","Korea","China"];
const F={japan:"🇯🇵",korea:"🇰🇷",china:"🇨🇳"};
let cat="All",sub="All",org="All",cart=JSON.parse(localStorage.getItem("kz_cart")||"{}");
const $=id=>document.getElementById(id);
let page=1;const PER=15; // 15 products per page
const inr=n=>"₹"+n.toLocaleString("en-IN");
function nav(){
  const cats=["All",...new Set(P.map(p=>p.c))];
  $("nav").innerHTML=cats.map(c=>`<button class="${c==cat?'on':''}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  const subs=[...new Set(P.filter(p=>p.c==cat&&p.sub).map(p=>p.sub))];
  let sb=$("subs");if(!sb){sb=document.createElement("div");sb.id="subs";sb.className="subs";$("nav").after(sb)}
  sb.hidden=!(cat!="All"&&subs.length);
  sb.innerHTML=["All",...subs].map(s=>`<button class="${s==sub?'on':''}" data-s="${esc(s)}">${esc(s)}</button>`).join("");
  $("chips").innerHTML=ORG.map(o=>`<button class="${o==org?'on':''}" data-o="${o}">${F[o.toLowerCase()]||"🌏"} ${o}</button>`).join("");
}
function render(){
  if(!$("grid"))return;
  const q=$("q").value.trim().toLowerCase(),s=$("sort").value;
  let l=P.filter(p=>(org=="All"||p.o==org)&&(q?(p.n+" "+p.c+" "+(p.sub||"")+" "+p.o).toLowerCase().includes(q):(cat=="All"||p.c==cat)&&(sub=="All"||p.sub==sub)));
  if(s=="1")l.sort((a,b)=>a.p-b.p);if(s=="2")l.sort((a,b)=>b.p-a.p);
  const total=l.length,pages=Math.max(1,Math.ceil(total/PER));if(page>pages)page=pages;
  l=l.slice((page-1)*PER,page*PER);
  $("ttl").textContent=q?`Results for "${q}"`:cat=="All"?"All products":(sub!="All"?cat+" · "+sub:cat);
  $("grid").innerHTML=l.length?l.map(p=>`<article class="card" data-href="/product.html?id=${p.id}"><a class="pic" href="/product.html?id=${p.id}" aria-label="View ${esc(p.n)}"><i>${F[p.o.toLowerCase()]} ${p.o}</i>${pic(p)}</a><div class="info"><h3><a href="/product.html?id=${p.id}">${esc(p.n)}</a></h3><small>${p.c}${p.sub?" · "+p.sub:""}</small><div class="pr">${inr(p.p)}<s>${inr(p.m)}</s><em>${Math.round((1-p.p/p.m)*100)}% off</em></div><button class="add" data-a="${p.id}">Add to cart</button><button class="add buy" data-b="${p.id}">Buy now</button></div></article>`).join(""):`<div class="empty">No products found. Try another search or category.</div>`;
  pager(pages,total);nav();
}
function pager(pages,total){
  const el=$("pager");if(!el)return;
  if(total<=PER){el.innerHTML="";return}
  const nums=[];
  for(let i=1;i<=pages;i++){
    if(i==1||i==pages||Math.abs(i-page)<=1)nums.push(i);
    else if(nums[nums.length-1]!=="…")nums.push("…");
  }
  el.innerHTML=`<button data-pg="${page-1}" ${page==1?"disabled":""} aria-label="Previous page">‹ Prev</button>`
    +nums.map(n=>n==="…"?`<span>…</span>`:`<button class="${n==page?"on":""}" data-pg="${n}" ${n==page?'aria-current="page"':""}>${n}</button>`).join("")
    +`<button data-pg="${page+1}" ${page==pages?"disabled":""} aria-label="Next page">Next ›</button>`;
}
function drawCart(){
  if(!P.length&&Object.keys(cart).length)return;
  Object.keys(cart).forEach(id=>{if(!G(id))delete cart[id]});
  localStorage.setItem("kz_cart",JSON.stringify(cart));
  const ids=Object.keys(cart);let t=0,n=0;
  $("items").innerHTML=ids.length?ids.map(id=>{const p=G(id),q=cart[id];t+=p.p*q;n+=q;return `<div class="row"><div class="e">${pic(p)}</div><div><b>${p.n}</b><div>${inr(p.p)}</div><div class="qty"><button data-d="-1" data-i="${id}" aria-label="Decrease">−</button>${q}<button data-d="1" data-i="${id}" aria-label="Increase">+</button></div></div></div>`}).join(""):`<div class="empty">Your cart is empty. Add something you like.</div>`;
  const sc=shipCalc(ids.map(id=>[G(id),cart[id]])),ship=t?sc.amt:0;$("ship").textContent=t?(ship?"Shipping "+inr(ship)+(S.freeAbove&&sc.hasDef?" (free above "+inr(S.freeAbove)+")":""):"Free shipping"):"";$("tot").textContent=inr(t+ship);$("cc").textContent=n;
}
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.x);toast.x=setTimeout(()=>t.classList.remove("show"),1600)}
function open(v){$("dr").classList.toggle("open",v);$("veil").classList.toggle("open",v)}
document.addEventListener("click",e=>{
  const cd=e.target.closest(".card[data-href]");
  if(cd&&!e.target.closest("button,a")&&!e.metaKey&&!e.ctrlKey){location.href=cd.dataset.href;return}
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.c){cat=b.dataset.c;sub="All";page=1;render()}
  if(b.dataset.s){sub=b.dataset.s;page=1;render()}
  if(b.dataset.o){org=b.dataset.o;page=1;render()}
  if(b.dataset.pg&&!b.disabled){page=+b.dataset.pg;render();$("shop").scrollIntoView({behavior:"smooth"});return}
  if(b.dataset.b){cart[b.dataset.b]=(cart[b.dataset.b]||0)+1;drawCart();$("co").click();return}
  if(b.dataset.a){cart[b.dataset.a]=(cart[b.dataset.a]||0)+1;drawCart();toast("Added to cart")}
  if(b.dataset.d){const i=b.dataset.i;cart[i]+=+b.dataset.d;if(cart[i]<1)delete cart[i];drawCart()}
});
$("cb").onclick=()=>open(true);$("cx").onclick=()=>open(false);$("veil").onclick=()=>open(false);
$("q").oninput=()=>{page=1;render()};if($("sort"))$("sort").onchange=()=>{page=1;render()};
$("co").onclick=()=>{
  if(!Object.keys(cart).length)return toast("Cart is empty");
  if(!localStorage.getItem("kz_token")){location.href="/login.html?next=/checkout.html";return}
  location.href="/checkout.html";
};
const qp=new URLSearchParams(location.search).get("q");if(qp&&$("grid"))$("q").value=qp;
fetch("/api/products").then(r=>r.json()).then(d=>{P=d;render();drawCart()}).catch(()=>{$("grid").innerHTML='<div class="empty">Could not load products. Is the server running?</div>'});

function applySettings(){
  document.title=S.storeName+" – "+S.tagline;
  document.querySelectorAll("header .logo").forEach(l=>l.textContent=S.storeName);
  const hh=document.querySelector(".hero h1"),hp=document.querySelector(".hero p");
  if(hh)hh.textContent=S.heroTitle;if(hp)hp.textContent=S.heroText;
  document.querySelector("footer").innerHTML=`<span class="logo" style="color:#fff">${esc(S.storeName)}</span><br>${esc(S.tagline)}${S.phone?" · 📞 "+esc(S.phone):""}${S.email?" · "+esc(S.email):""}`;
  let a=document.querySelector(".announce");
  if(S.announcement){if(!a){a=document.createElement("div");a.className="announce";document.body.prepend(a)}a.textContent=S.announcement}else if(a)a.remove();
}
fetch("/api/settings").then(r=>r.json()).then(s=>{S=s;applySettings();drawCart()}).catch(()=>{});

const U=JSON.parse(localStorage.getItem("kz_user")||"null");
$("auth").innerHTML=U?'<a href="/orders.html">My orders</a>'+(U.role==="admin"?'<a href="/admin">Admin panel</a>':"")+`<span>Hi, ${esc(U.name.split(" ")[0])}</span><a href="#" id="lo">Logout</a>`:'<a href="/login.html">Login / Sign up</a>';
if($("lo"))$("lo").onclick=e=>{e.preventDefault();localStorage.removeItem("kz_token");localStorage.removeItem("kz_user");location.reload()};
