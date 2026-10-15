let P=[],S={shippingFee:0,freeAbove:0};
// shipping: products with their own charge (p.ship) pay that x qty, others use the store default
function shipCalc(lines){let sub=0,manual=0,hasDef=false;lines.forEach(([p,q])=>{sub+=p.p*q;if(p.ship!=null&&p.ship!=="")manual+=Number(p.ship)*q;else hasDef=true});
  const def=hasDef&&sub>0&&!(S.freeAbove>0&&sub>=S.freeAbove)?S.shippingFee:0;return{amt:manual+def,hasDef,sub}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pic=p=>p.img?`<img src="${esc(p.img)}" alt="${esc(p.n)}">`:`<span class="emo">${p.e}</span>`;
const G=id=>P.find(p=>p.id==id);
const ORG=["All","Japan","Korea","China"];
const F={japan:"🇯🇵",korea:"🇰🇷",china:"🇨🇳"};
let cat="All",sub="All",org="All",cart=JSON.parse(localStorage.getItem("kz_cart")||"{}");
let sq=""; // search text that is actually applied (only changes on Search button / Enter / suggestion click)
const $=id=>document.getElementById(id);
let page=1,PER=15;
// products per page = full rows only (columns x rows), so every row is even on desktop and mobile
function calcPer(){
  const g=$("grid");if(!g)return 15;
  const cols=window.innerWidth<=700?2:Math.max(1,Math.floor((g.clientWidth+22)/232)); // 210px min card + 22px gap
  return cols*Math.max(1,Math.round(15/cols));
}
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
  const q=sq.trim().toLowerCase(),s=$("sort").value;
  let l=P.filter(p=>(org=="All"||p.o==org)&&(q?(p.n+" "+p.c+" "+(p.sub||"")+" "+p.o).toLowerCase().includes(q):(cat=="All"||p.c==cat)&&(sub=="All"||p.sub==sub)));
  const dc=x=>x.m>0?1-x.p/x.m:0;
  if(s=="1")l.sort((a,b)=>a.p-b.p);
  if(s=="2")l.sort((a,b)=>b.p-a.p);
  if(s=="3")l.sort((a,b)=>(+b.id||0)-(+a.id||0));      // newest = highest id first
  if(s=="4")l.sort((a,b)=>dc(b)-dc(a));                // biggest % discount first
  if(s=="5")l.sort((a,b)=>String(a.n).localeCompare(String(b.n)));
  PER=calcPer();
  const total=l.length,pages=Math.max(1,Math.ceil(total/PER));if(page>pages)page=pages;
  l=l.slice((page-1)*PER,page*PER);
  $("ttl").textContent=q?`Results for "${sq.trim()}"`:cat=="All"?"All products":(sub!="All"?cat+" · "+sub:cat);
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

/* ---------- Recently viewed (saved in this browser) ---------- */
const RK="kz_recent";
const recentIds=()=>{try{return JSON.parse(localStorage.getItem(RK)||"[]")}catch{return[]}};
function pushRecent(id){try{const a=recentIds().filter(x=>String(x)!==String(id));a.unshift(+id);localStorage.setItem(RK,JSON.stringify(a.slice(0,12)))}catch{}}
async function drawRecent(el,exclude){
  if(!el)return;
  const ids=recentIds().filter(x=>String(x)!==String(exclude));
  if(!ids.length){el.innerHTML="";return}
  let list=P;
  if(!list.length){try{list=await fetch("/api/products").then(r=>r.json())}catch{return}}
  const l=ids.map(id=>list.find(p=>p.id==id)).filter(Boolean).slice(0,8);
  if(!l.length){el.innerHTML="";return}
  el.innerHTML=`<div class="rc-head"><h2 class="rc-t">Recently viewed</h2><button type="button" class="rc-clear" data-rclear>Clear</button></div><div class="rc-row">${l.map(p=>`<a class="rc-card" href="/product.html?id=${p.id}"><span class="rc-pic">${p.img?`<img src="${esc(p.img)}" alt="" loading="lazy">`:esc(p.e)}</span><b>${esc(p.n)}</b><span class="rc-p">${inr(p.p)}${p.m>p.p?`<s>${inr(p.m)}</s>`:""}</span></a>`).join("")}</div>`;
}
function homeRecent(){
  if(!$("pager"))return;
  let s=$("recent");
  if(!s){s=document.createElement("section");s.id="recent";s.className="rc";$("pager").after(s)}
  drawRecent(s);
}

/* ---------- Search: suggestions while typing, filter only on Search click / Enter ---------- */
let sgI=-1;
function hideSg(){const sg=$("sg");if(sg){sg.hidden=true;sg.innerHTML="";sgI=-1}}
function suggest(){
  const sg=$("sg");if(!sg)return;
  const v=$("q").value.trim().toLowerCase();
  if(!v||!P.length){hideSg();return}
  const m=P.filter(p=>(p.n+" "+p.c+" "+(p.sub||"")).toLowerCase().includes(v)).slice(0,6);
  sgI=-1;
  sg.innerHTML=m.length
    ?m.map(p=>`<button type="button" role="option" data-sg="${esc(p.n)}"><span class="sg-t">${p.img?`<img src="${esc(p.img)}" alt="">`:esc(p.e)}</span><span class="sg-x"><b>${esc(p.n)}</b><small>${esc(p.c)}${p.sub?" · "+esc(p.sub):""}</small></span></button>`).join("")
    :`<div class="sg-none">No matching products</div>`;
  sg.hidden=false;
}
function doSearch(){
  const v=$("q").value.trim();
  hideSg();
  if($("grid")){sq=v;page=1;render();$("shop").scrollIntoView({behavior:"smooth"})}
  else if(v)location.href="/?q="+encodeURIComponent(v);
}
$("q").oninput=()=>{
  suggest();
  if(!$("q").value.trim()&&sq){sq="";page=1;render()} // search box cleared -> show all products again
};
$("q").onfocus=suggest;
$("q").onkeydown=e=>{
  const sg=$("sg"),items=sg&&!sg.hidden?[...sg.querySelectorAll("button[data-sg]")]:[];
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    if(!items.length)return;e.preventDefault();
    sgI=e.key==="ArrowDown"?(sgI+1)%items.length:(sgI<=0?items.length-1:sgI-1);
    items.forEach((b,i)=>b.classList.toggle("hit",i===sgI));
  }else if(e.key==="Enter"){
    e.preventDefault();
    if(sgI>=0&&items[sgI])$("q").value=items[sgI].dataset.sg;
    doSearch();
  }else if(e.key==="Escape")hideSg();
};
if($("sb"))$("sb").onclick=doSearch;

document.addEventListener("click",e=>{
  const sgb=e.target.closest("#sg button[data-sg]");
  if(sgb){$("q").value=sgb.dataset.sg;doSearch();return}
  if(!e.target.closest(".search"))hideSg();
  const cd=e.target.closest(".card[data-href]");
  if(cd&&!e.target.closest("button,a")&&!e.metaKey&&!e.ctrlKey){location.href=cd.dataset.href;return}
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.rclear!==undefined){try{localStorage.removeItem(RK)}catch{}const r=$("recent");if(r)r.innerHTML="";return}
  if(b.dataset.c){cat=b.dataset.c;sub="All";page=1;render()}
  if(b.dataset.s){sub=b.dataset.s;page=1;render()}
  if(b.dataset.o){org=b.dataset.o;page=1;render()}
  if(b.dataset.pg&&!b.disabled){page=+b.dataset.pg;render();$("shop").scrollIntoView({behavior:"smooth"});return}
  if(b.dataset.b){cart[b.dataset.b]=(cart[b.dataset.b]||0)+1;drawCart();$("co").click();return}
  if(b.dataset.a){cart[b.dataset.a]=(cart[b.dataset.a]||0)+1;drawCart();toast("Added to cart")}
  if(b.dataset.d){const i=b.dataset.i;cart[i]+=+b.dataset.d;if(cart[i]<1)delete cart[i];drawCart()}
});
$("cb").onclick=()=>open(true);$("cx").onclick=()=>open(false);$("veil").onclick=()=>open(false);
if($("sort"))$("sort").onchange=()=>{page=1;render()};
/* ---------- Custom pop-art sort dropdown (replaces the native select, which stays hidden and keeps the value) ---------- */
(function(){
  const sel=$("sort");if(!sel)return;
  sel.style.display="none";
  const wrap=document.createElement("div");wrap.className="dd";
  wrap.innerHTML='<button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="dd-l"></span></button><ul class="dd-list" role="listbox" tabindex="-1" hidden></ul>';
  sel.after(wrap);
  const btn=wrap.querySelector(".dd-btn"),lab=wrap.querySelector(".dd-l"),ul=wrap.querySelector(".dd-list");
  const ic=["⭐","💸","💎","🆕","🔥","🔤"];
  ul.innerHTML=[...sel.options].map((o,i)=>`<li role="option" tabindex="-1" data-v="${esc(o.value)}">${ic[i]||""} ${esc(o.text)}</li>`).join("");
  const lis=()=>[...ul.querySelectorAll("li")];
  function sync(){
    lab.textContent=(ic[sel.selectedIndex]||"")+" "+sel.options[sel.selectedIndex].text;
    lis().forEach(li=>{const on=li.dataset.v===sel.value;li.classList.toggle("on",on);li.setAttribute("aria-selected",on)});
  }
  function toggle(v){ul.hidden=!v;wrap.classList.toggle("open",v);btn.setAttribute("aria-expanded",v)}
  function pick(li){sel.value=li.dataset.v;sync();toggle(false);btn.focus();page=1;render()}
  btn.onclick=e=>{e.stopPropagation();toggle(ul.hidden)};
  btn.onkeydown=e=>{
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();toggle(true);(ul.querySelector("li.on")||lis()[0]).focus()}
    else if(e.key==="Escape")toggle(false);
  };
  ul.onclick=e=>{const li=e.target.closest("li");if(li)pick(li)};
  ul.onkeydown=e=>{
    const a=lis(),i=a.indexOf(document.activeElement);
    if(e.key==="ArrowDown"){e.preventDefault();a[(i+1)%a.length].focus()}
    else if(e.key==="ArrowUp"){e.preventDefault();a[(i-1+a.length)%a.length].focus()}
    else if(e.key==="Enter"||e.key===" "){e.preventDefault();if(a[i])pick(a[i])}
    else if(e.key==="Escape"){toggle(false);btn.focus()}
  };
  document.addEventListener("click",e=>{if(!wrap.contains(e.target))toggle(false)});
  sync();
})();
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if($("grid")&&P.length&&calcPer()!==PER)render()},150)});
$("co").onclick=()=>{
  if(!Object.keys(cart).length)return toast("Cart is empty");
  if(!localStorage.getItem("kz_token")){location.href="/login.html?next=/checkout.html";return}
  location.href="/checkout.html";
};
const qp=new URLSearchParams(location.search).get("q");if(qp&&$("grid")){$("q").value=qp;sq=qp}
fetch("/api/products").then(r=>r.json()).then(d=>{P=d;render();drawCart();homeRecent()}).catch(()=>{$("grid").innerHTML='<div class="empty">Could not load products. Is the server running?</div>'});

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
