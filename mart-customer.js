// ═══════════ SUPABASE DB ═══════════
const SB_URL='https://ufxnkchhaifxfyotxrnd.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeG5rY2hoYWlmeGZ5b3R4cm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk4NDEsImV4cCI6MjA4OTc2NTg0MX0.SwzX9VpYE1AgULfrR09eFeGqSyjbmIUbsI_16lK0JI8';
const SB_H={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=representation'};

async function ga(table){
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?select=*&order=id',{headers:SB_H});
  if(!r.ok){console.error('ga',table,r.status);return[];}
  return r.json();
}
async function gk(table,key){
  const col=table==='settings'?'key':'id';
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?'+col+'=eq.'+encodeURIComponent(key)+'&select=*',{headers:SB_H});
  if(!r.ok)return null;
  const rows=await r.json();return rows[0]||null;
}
async function pa(table,data){
  const payload=Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id'));
  const r=await fetch(SB_URL+'/rest/v1/'+table,{method:'POST',headers:SB_H,body:JSON.stringify(payload)});
  if(!r.ok){console.error('pa',table,r.status,await r.text());return null;}
  const rows=await r.json();return rows[0]?.id??null;
}
async function pu(table,data){
  if(table==='settings'){
    const r=await fetch(SB_URL+'/rest/v1/'+table+'?key=eq.'+encodeURIComponent(data.key),{method:'PATCH',headers:SB_H,body:JSON.stringify({value:data.value})});
    if(!r.ok||r.status===404){
      await fetch(SB_URL+'/rest/v1/'+table,{method:'POST',headers:SB_H,body:JSON.stringify(data)});
    }
    return;
  }
  if(!data.id){await pa(table,data);return;}
  const payload=Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id'));
  const r=await fetch(SB_URL+'/rest/v1/'+table+'?id=eq.'+data.id,{method:'PATCH',headers:SB_H,body:JSON.stringify(payload)});
  if(!r.ok)console.error('pu',table,data.id,r.status);
}
async function de(table,id){
  await fetch(SB_URL+'/rest/v1/'+table+'?id=eq.'+id,{method:'DELETE',headers:SB_H});
}
async function idb(){return true;}

// ═══════════ STATE ═══════════
let S={products:[],orders:[],customers:[],offers:[],bulkoffers:[],cashoffers:[],tiers:[],zones:[],notifications:[],complaints:[],settings:{},routes:[]};
let currentUser=null;
let selType='retail';
let cart=[];
let wishlist=[];
let delType='delivery';
let selPayment='cash';
let catFilter='all';
let searchQ='';
let pdProductId=null;

async function loadAll(){
  for(const k of['products','orders','customers','offers','bulkoffers','cashoffers','tiers','zones','notifications','complaints','routes']) S[k]=await ga(k);
  const sets=await ga('settings');sets.forEach(s=>S.settings[s.key]=s.value);
}

// ═══════════ AUTH ═══════════
function selType2(type){selType=type;document.getElementById('t-retail').classList.toggle('sel',type==='retail');document.getElementById('t-wholesale').classList.toggle('sel',type==='wholesale')}
function goLogin(){document.getElementById('auth-step1').style.display='none';document.getElementById('auth-login').style.display='block';document.getElementById('login-sub').textContent=selType==='retail'?'Retail ගිණුම':'Wholesale ගිණුම'}
function goReg(){document.getElementById('auth-step1').style.display='none';document.getElementById('auth-login').style.display='none';document.getElementById('auth-reg').style.display='block';document.getElementById('reg-sub').textContent=`නව ${selType} ගිණුම`;document.getElementById('ws-extra').style.display=selType==='wholesale'?'block':'none';if(selType==='wholesale')populateRoutesSel()}
function goBack(){['auth-login','auth-reg'].forEach(id=>document.getElementById(id).style.display='none');document.getElementById('auth-step1').style.display='block'}
async function populateRoutesSel(){const routes=await ga('routes');const sel=document.getElementById('r-route');sel.innerHTML='<option value="">Route තෝරන්න...</option>';routes.forEach(r=>{const o=document.createElement('option');o.value=r.name;o.textContent=`${r.name}${r.days&&r.days.length?' ('+r.days.join(', ')+')':''}`;sel.appendChild(o)})}

function fieldErr(id,msg){const el=document.getElementById(id);if(el){el.classList.add('err');const er=document.getElementById(id+'-err');if(er){er.textContent=msg;er.classList.add('show')}}}
function clearErrs(){document.querySelectorAll('.fi.err').forEach(e=>e.classList.remove('err'));document.querySelectorAll('.field-err.show').forEach(e=>{e.classList.remove('show');e.textContent=''})}

async function doLogin(){
  clearErrs();
  const email=document.getElementById('l-email').value.trim().toLowerCase();
  const pass=document.getElementById('l-pass').value;
  let ok=true;
  if(!email){fieldErr('l-email','ඊමේල් ලිපිනය ඇතුල් කරන්න');ok=false}
  if(!pass){fieldErr('l-pass','මුරපදය ඇතුල් කරන්න');ok=false}
  if(!ok) return;
  // Search by email and type
  const cust=S.customers.find(c=>c.email===email&&c.type===selType);
  if(!cust){
    // Check if email exists under a different type
    const otherType=S.customers.find(c=>c.email===email);
    if(otherType){
      fieldErr('l-email',`මෙම email ${otherType.type==='retail'?'Retail':'Wholesale'} ගිණුමක් සඳහා ය`);
    } else {
      fieldErr('l-email','මෙම ඊමේල් ගිණුමක් නොමැත');
    }
    return;
  }
  if(!cust.pwHash){fieldErr('l-pass','Password set කර නැත — POS හරහා ලියාපදිංචි නම admin password reset කරන්න');return}
  if(cust.pwHash!==btoa(pass)){fieldErr('l-pass','මුරපදය වැරදිය');return}
  currentUser=cust;sessionStorage.setItem('mUser',JSON.stringify(cust));startApp();toast(`ආයුබෝවන් ${cust.name}!`,'success');
}

async function doReg(){
  clearErrs();
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim().toLowerCase();
  const phone=document.getElementById('r-phone').value.trim();
  const addr=(document.getElementById('r-addr')?.value||'').trim();
  const pass=document.getElementById('r-pass').value;
  const pass2=document.getElementById('r-pass2').value;
  let ok=true;
  if(!name){fieldErr('r-name','නම ඇතුල් කරන්න');ok=false}
  if(!email){fieldErr('r-email','ඊමේල් ඇතුල් කරන්න');ok=false}
  else if(S.customers.find(c=>c.email===email)){fieldErr('r-email','මෙම ඊමේල් දැනටමත් ලියාපදිංචි ය');ok=false}
  if(!phone){fieldErr('r-phone','දුරකථන අංකය ඇතුල් කරන්න');ok=false}
  if(!addr){fieldErr('r-addr','ලිපිනය ඇතුල් කරන්න');ok=false}
  if(selType==='wholesale'){const rv=document.getElementById('r-route').value;if(!rv){fieldErr('r-route','Route තෝරන්න');ok=false}}
  if(!pass){fieldErr('r-pass','මුරපදය ඇතුල් කරන්න');ok=false}
  else if(pass.length<6){fieldErr('r-pass','මුරපදය අවම 6 අකුරු');ok=false}
  if(pass&&pass2&&pass!==pass2){fieldErr('r-pass2','මුරපද ගැලපෙන්නේ නැත');ok=false}
  if(!ok) return;
  const cust={
    name,email,phone,address:addr,location:addr,
    type:selType,pwHash:btoa(pass),
    loyaltyPoints:0,totalLoyaltySaved:0,balance:0,
    forwardBalance:0,defaultPayment:'cash',
    registeredSource:'customer',
    createdAt:new Date().toISOString()
  };
  if(selType==='wholesale'){
    cust.businessName=(document.getElementById('r-biz')?.value||'').trim();
    cust.route=document.getElementById('r-route').value;
  }
  const id=await pa('customers',cust);cust.id=id;S.customers.push(cust);
  currentUser=cust;sessionStorage.setItem('mUser',JSON.stringify(cust));startApp();
  toast(`ආයුබෝවන් ${name}! ✨`,'success');
}

function doLogout(){currentUser=null;sessionStorage.removeItem('mUser');cart=[];document.getElementById('app').style.display='none';document.getElementById('auth-screen').style.display='flex';document.getElementById('auth-step1').style.display='block';document.getElementById('auth-login').style.display='none';document.getElementById('auth-reg').style.display='none'}

// ═══════════ APP START ═══════════
async function startApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  await loadAll();
  selPayment=currentUser.type==='wholesale'?(currentUser.defaultPayment||'cash'):'cash';
  await loadCartDB();
  await loadWishlistDB();
  updateCartUI();
  renderNav();renderShop();renderTicker();checkNotifs();scheduleReminders();
}

function renderNav(){
  document.getElementById('u-av').textContent=currentUser.name[0].toUpperCase();
  document.getElementById('u-name').textContent=currentUser.name.split(' ')[0];
  document.getElementById('hero-sub').textContent=currentUser.type==='wholesale'?'Wholesale ගිණුම — Bulk pricing active':'Retail ගිණුම — හොඳම retail මිල';
  document.getElementById('mode-badge').textContent=currentUser.type==='wholesale'?'🏭 Wholesale':'🛍 Retail';
  updateLoyaltyBanner();
}

function getLoyaltySetting(type){
  const def=type==='retail'?{earnPer100:5,pointValue:0.5,minRedeem:100,maxRedeemPct:20}:{earnPer100:8,pointValue:0.75,minRedeem:200,maxRedeemPct:15};
  return S.settings[type==='retail'?'loyaltyRetail':'loyaltyWholesale']||def;
}

function getTier(pts,type){
  const rel=S.tiers.filter(t=>t.target==='all'||t.target===type).sort((a,b)=>b.minPoints-a.minPoints);
  return rel.find(t=>pts>=t.minPoints)||null;
}

function updateLoyaltyBanner(){
  const pts=currentUser.loyaltyPoints||0;
  const ls=getLoyaltySetting(currentUser.type);
  const val=(pts*ls.pointValue).toFixed(2);
  const tier=getTier(pts,currentUser.type);
  const lb=document.getElementById('loyalty-banner');
  lb.style.display=pts>0?'flex':'none';
  document.getElementById('lb-pts').textContent=pts;
  document.getElementById('lb-val').textContent=`රු. ${val}`;
  document.getElementById('lb-tier-name').textContent=tier?`${tier.name}${tier.discountPct?` · ${tier.discountPct}% off`:''}` : 'Bronze';
}

// ═══════════ SHOP ═══════════
function renderShop(){renderCats();renderProds();renderOfferBanner()}

function renderCats(){
  const cats=['all',...new Set(S.products.map(p=>p.category))];
  const icons={'all':'🏪','Grains & Rice':'🌾','Dairy':'🥛','Beverages':'🥤','Snacks':'🍿','Vegetables':'🍅','Fruits':'🍌','Meat & Fish':'🍗','Bakery':'🍞','Household':'🧴','Personal Care':'🧼'};
  document.getElementById('cat-list').innerHTML=cats.map(c=>`<div class="cat-item ${c===catFilter?'act':''}" onclick="setCat('${c}',this)"><span>${icons[c]||'📦'}</span>${c==='all'?'සියල්ල':c}</div>`).join('');
}
function setCat(c,el){catFilter=c;document.querySelectorAll('.cat-item').forEach(x=>x.classList.remove('act'));el.classList.add('act');renderProds()}
function fSearch(q){searchQ=q.toLowerCase();renderProds()}

function getOffer(p){
  const now=new Date();
  return S.offers.find(o=>{
    if(!o.active)return false;
    if(o.validUntil&&new Date(o.validUntil)<now)return false;
    if(o.target!=='all'&&o.target!==currentUser.type)return false;
    // Per-product: productIds array takes priority
    if(Array.isArray(o.productIds)&&o.productIds.length>0) return o.productIds.includes(p.id);
    // Legacy category fallback
    if(o.category&&o.category!=='all') return o.category===p.category;
    return true; // 'all' category
  })||null;
}

// Save cart to IndexedDB (key: 'cart_<userId>')
async function saveCartDB(){
  if(!currentUser)return;
  const key='cart_'+currentUser.id;
  const ex=await ga('settings').then(arr=>arr.find(s=>s.key===key)).catch(()=>null);
  const val=JSON.stringify(cart);
  if(ex) await pu('settings',{key,value:val});
  else await pa('settings',{key,value:val}).catch(()=>pu('settings',{key,value:val}));
}
async function loadCartDB(){
  if(!currentUser)return;
  const key='cart_'+currentUser.id;
  try{
    const all=await ga('settings');
    const rec=all.find(s=>s.key===key);
    if(rec&&rec.value){
      const saved=JSON.parse(rec.value);
      // Validate saved cart items against current products
      cart=saved.filter(it=>S.products.some(p=>p.id===it.pid&&p.stock>0));
    }
  }catch(e){cart=[];}
}
function getBulkOffer(p,qty){return S.bulkoffers.filter(b=>b.productId===p.id&&b.active&&(b.target==='all'||b.target===currentUser.type)&&qty>=b.minQty).sort((a,b)=>b.minQty-a.minQty)[0]||null}
function getCashOffer(p){if(selPayment!=='cash')return null;if(currentUser.type!=='wholesale')return null;return S.cashoffers.find(c=>c.productId===p.id&&c.active)||null}

function hasAnyOffer(p){
  // Check if product has any active offer (special, bulk, or cash)
  const o=getOffer(p);
  const bo=S.bulkoffers.some(b=>b.productId===p.id&&b.active&&(b.target==='all'||b.target===currentUser.type));
  const co=currentUser.type==='wholesale'&&S.cashoffers.some(c=>c.productId===p.id&&c.active);
  return !!(o||bo||co);
}

function offerTagsFor(p){
  const tags=[];
  const o=getOffer(p);
  const bo=S.bulkoffers.filter(b=>b.productId===p.id&&b.active&&(b.target==='all'||b.target===currentUser.type)).sort((a,b2)=>b2.minQty-a.minQty)[0];
  const co=currentUser.type==='wholesale'?S.cashoffers.find(c=>c.productId===p.id&&c.active):null;
  if(o) tags.push({type:'special',label:`🏷 විශේෂ දීමනා — ${o.discount}% OFF`,color:'#b45309',bg:'rgba(245,158,11,.15)'});
  if(bo){const bAmt=bo.discountAmt||bo.discount||0;tags.push({type:'bulk',label:`📊 ප්‍රමාණ දීමනා — ${bo.minQty}+ ගත් විට රු. ${bAmt.toFixed(0)} off`,color:'var(--teal)',bg:'rgba(0,210,211,.12)'});}
  if(co){const cAmt=co.discountAmt||co.discount||0;tags.push({type:'cash',label:`💵 Cash දීමනා — රු. ${cAmt.toFixed(0)} off`,color:'#15803d',bg:'rgba(46,213,115,.12)'});}
  return tags;
}

function renderProds(){
  let prods=S.products.filter(p=>{const mc=catFilter==='all'||p.category===catFilter;const ms=!searchQ||p.name.toLowerCase().includes(searchQ);return mc&&ms});
  const grid=document.getElementById('products-grid');
  if(!prods.length){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text3)"><div style="font-size:36px;margin-bottom:10px;opacity:.3">🔍</div>නිෂ්පාදනය හමු නොවිණ</div>`;return}

  // Sort offer products: special first, then bulk, then cash, then rest
  const offerProds=prods.filter(p=>p.stock>0&&hasAnyOffer(p)).sort((a,b)=>{
    const score=p=>{
      const t=offerTagsFor(p);
      let s=0;
      if(t.find(x=>x.type==='special')) s+=100;
      if(t.find(x=>x.type==='bulk')) s+=10;
      if(t.find(x=>x.type==='cash')) s+=1;
      return s;
    };
    return score(b)-score(a);
  });
  const regularProds=prods.filter(p=>!hasAnyOffer(p)||p.stock<=0);

  // Count by type
  const specialCount=offerProds.filter(p=>getOffer(p)).length;
  const bulkCount=offerProds.filter(p=>S.bulkoffers.some(b=>b.productId===p.id&&b.active&&(b.target==='all'||b.target===currentUser.type))).length;
  const cashCount=offerProds.filter(p=>currentUser.type==='wholesale'&&S.cashoffers.some(c=>c.productId===p.id&&c.active)).length;

  let html='';

  // ── OFFER SECTION ──
  if(offerProds.length>0){
    // Build offer type badges
    const typeBadges=[
      specialCount>0?`<div style="display:flex;align-items:center;gap:6px;background:rgba(245,158,11,.18);border:2px solid rgba(245,158,11,.5);border-radius:8px;padding:7px 14px;font-weight:700;font-size:13px;color:#b45309">
        <span style="font-size:16px">🏷</span>
        <div><div style="font-family:'Syne',sans-serif;font-size:13px">විශේෂ දීමනා</div><div style="font-size:11px;opacity:.8">${specialCount} items</div></div>
      </div>`:'',
      bulkCount>0?`<div style="display:flex;align-items:center;gap:6px;background:rgba(0,210,211,.12);border:2px solid rgba(0,210,211,.4);border-radius:8px;padding:7px 14px;font-weight:700;font-size:13px;color:var(--teal)">
        <span style="font-size:16px">📊</span>
        <div><div style="font-family:'Syne',sans-serif;font-size:13px">ප්‍රමාණ දීමනා</div><div style="font-size:11px;opacity:.8">${bulkCount} items</div></div>
      </div>`:'',
      cashCount>0?`<div style="display:flex;align-items:center;gap:6px;background:rgba(46,213,115,.12);border:2px solid rgba(46,213,115,.4);border-radius:8px;padding:7px 14px;font-weight:700;font-size:13px;color:var(--green)">
        <span style="font-size:16px">💵</span>
        <div><div style="font-family:'Syne',sans-serif;font-size:13px">Cash දීමනා</div><div style="font-size:11px;opacity:.8">${cashCount} items</div></div>
      </div>`:'',
    ].filter(Boolean).join('');

    html+=`<div class="offer-section-header" style="grid-column:1/-1">
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.15) 0%,rgba(232,255,71,.08) 100%);border:2px solid rgba(245,158,11,.4);border-radius:12px;padding:14px 16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:22px">🔥</span>
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:900;color:var(--orange)">දීමනා නිෂ්පාදන</div>
            <div style="font-size:12px;color:var(--text3)">${offerProds.length} නිෂ්පාදනයක් දීමනාවේ ඇත — ඉක්මනින් ලබා ගන්න!</div>
          </div>
          <div style="margin-left:auto;background:var(--orange);color:#fff;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;padding:5px 14px;border-radius:20px">${offerProds.length}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${typeBadges}</div>
      </div>
    </div>
    ${offerProds.map(p=>renderProdCard(p,true)).join('')}`;

    if(regularProds.length>0){
      html+=`<div style="grid-column:1/-1;margin-top:20px;margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <span style="font-size:12px;color:var(--text3);padding:0 10px;white-space:nowrap">අනෙකුත් නිෂ්පාදන</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`;
    }
  }

  // ── REGULAR SECTION ──
  if(regularProds.length>0){
    if(catFilter!=='all'||offerProds.length>0){
      html+=regularProds.map(p=>renderProdCard(p,false)).join('');
    } else {
      // Group by category only when no offers and showing all
      const cats=[...new Set(regularProds.map(p=>p.category))];
      const icons={'ධාන්‍ය හා සහල්':'🌾','කිරිජන්‍ය':'🥛','පාන':'🥤','ස්නැක්ස්':'🍿','එළවළු':'🍅','පළතුරු':'🍌','මස් හා මාළු':'🍗','බේකරි':'🍞','ගෘහ භාණ්ඩ':'🧴','පෞද්ගලික සත්කාර':'🧼','Grains & Rice':'🌾','Dairy':'🥛','Beverages':'🥤','Snacks':'🍿','Vegetables':'🍅','Fruits':'🍌','Meat & Fish':'🍗','Bakery':'🍞','Household':'🧴','Personal Care':'🧼'};
      html+=cats.map(cat=>{
        const catProds=regularProds.filter(p=>p.category===cat);
        return `<div style="grid-column:1/-1;margin-top:18px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <span style="font-size:13px">${icons[cat]||'📦'}</span>
          <span style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--text)">${cat}</span>
          <span style="font-size:13px;color:var(--text3)">(${catProds.length})</span>
          <div style="flex:1;height:1px;background:var(--border);margin-left:4px"></div>
        </div>
        ${catProds.map(p=>renderProdCard(p,false)).join('')}`;
      }).join('');
    }
  }

  grid.innerHTML=html;
}

function renderProdCard(p,isOffer=false){
  const base=currentUser.type==='retail'?p.retailPrice:p.wholesalePrice;
  const offer=getOffer(p);
  const cMap={};cart.forEach(i=>{cMap[i.pid]=i.qty});
  const qty=cMap[p.id]||1;
  const bOffer=getBulkOffer(p,qty);
  const cOffer=getCashOffer(p);
  let price=offer?base*(1-offer.discount/100):base;
  const ss=p.stock<=0?'out':p.stock<=(p.lowStock||10)?'low':'in';
  const sLabel={in:'ඇතිව ඇත',low:'⚠ අඩු ප්‍රමාණ',out:'✗ ඉවරයි'}[ss];
  const sBadge={in:'bi',low:'bl',out:'bo'}[ss];
  const imgC=p.image?`<img src="${p.image}" class="pc-photo" alt="${p.name}">`:`<span class="pc-emoji-el">${p.icon||'📦'}</span>`;
  const cashNote=cOffer&&cOffer.showSavings?`<span class="pc-cash-badge">💵 රු. ${(cOffer.discountAmt||cOffer.discount||0).toFixed(0)} Cash</span>`:'';
  const isWished=wishlist.includes(p.id);
  const btbNudge=(currentUser.type==='wholesale'&&selPayment!=='cash'&&cOffer&&cOffer.showSavings)?
    `<div style="font-size:12px;color:var(--green);background:rgba(46,213,115,.08);border:1px solid rgba(46,213,115,.15);border-radius:5px;padding:4px 8px;margin-top:4px">💵 Cash ගෙවූ විට ඒකකයකට <strong>රු. ${(cOffer.discountAmt||cOffer.discount||0).toFixed(0)}</strong> ඉතිරිය!</div>`:'';

  let dualPrice;
  if(currentUser.type==='retail'){
    const billingPrice=p.costPrice||price;
    dualPrice=`
    <div style="display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;margin-top:4px">
      <div>
        <div style="font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">විකිණීමේ මිල</div>
        <span class="pc-price-main" style="text-decoration:${p.costPrice?'line-through':'none'};color:${p.costPrice?'var(--text3)':'inherit'};font-size:${p.costPrice?'12px':'inherit'}">රු. ${price.toFixed(2)}</span>
      </div>
      <div style="background:rgba(232,255,71,.12);border:2px solid rgba(232,255,71,.4);border-radius:6px;padding:4px 10px;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:1px">⭐ අපේ මිල</div>
        <span style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--accent)">රු. ${billingPrice.toFixed(2)}</span>
      </div>
    </div>`;
  } else {
    dualPrice=`
    <div style="display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;margin-top:4px">
      <div>
        <div style="font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">විකිණීමේ මිල</div>
        <span style="font-size:12px;color:var(--text3);text-decoration:line-through">රු. ${p.retailPrice.toFixed(2)}</span>
      </div>
      <div style="background:rgba(232,255,71,.12);border:2px solid rgba(232,255,71,.4);border-radius:6px;padding:4px 10px;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:1px">⭐ අපේ මිල</div>
        <span style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--accent)">රු. ${price.toFixed(2)}</span>
      </div>
    </div>`;
  }

  const bAmt=bOffer?(bOffer.discountAmt||bOffer.discount||0):0;

  // Offer tags strip for highlighted cards — bigger and bolder
  const offerTags=isOffer?offerTagsFor(p).map(t=>
    `<div style="display:inline-flex;align-items:center;gap:5px;background:${t.bg};border:1.5px solid ${t.color}66;border-radius:6px;padding:4px 10px;margin:2px 3px 2px 0;font-size:12px;font-weight:800;color:${t.color};font-family:'Syne',sans-serif;white-space:nowrap">${t.label}</div>`
  ).join(''):'';

  // Highlighted border/glow when offer
  const cardBorder=isOffer?'border:2px solid rgba(245,158,11,.55);box-shadow:0 0 0 3px rgba(245,158,11,.1),0 6px 20px rgba(245,158,11,.15);position:relative':'';
  const fireBadge=isOffer?`<div style="position:absolute;top:-1px;left:-1px;background:linear-gradient(135deg,var(--orange),#f59e0b);color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px 0 6px 0;z-index:2;font-family:'Syne',sans-serif;letter-spacing:.5px">🔥 දීමනා</div>`:'';

  return `<div class="pc" style="${cardBorder}">
    ${fireBadge}
    <div class="pc-img" onclick="openPD(${p.id})">
      ${imgC}
      ${offer?`<span class="pc-offer-badge">${offer.discount}% OFF</span>`:''}
      <span class="pc-stock-badge ${sBadge}">${sLabel}</span>
      ${cashNote}
      <div class="pc-img-ov">👁 බලන්න</div>
      <div class="wish-btn ${isWished?'wishlisted':''}" onclick="event.stopPropagation();toggleWish(${p.id})" title="${isWished?'ලිස්ටෙන් ඉවත් කරන්න':'ලිස්ටට එකතු කරන්න'}">${isWished?'❤️':'🤍'}</div>
    </div>
    <div class="pc-body">
      <div class="pc-name">${p.name}</div>
      <div class="pc-cat">${p.category}</div>
      ${isOffer&&offerTags?`<div style="margin-top:5px;margin-bottom:3px;display:flex;flex-wrap:wrap">${offerTags}</div>`:''}
      ${dualPrice}
      ${bOffer&&bAmt>0?`<div style="font-size:12px;color:var(--teal);margin-top:3px">📊 ${bOffer.minQty}+ ගත් විට ඒකකයකට <strong>රු. ${bAmt.toFixed(0)} off!</strong></div>`:''}
      ${btbNudge}
    </div>
    <div class="pc-actions">
      <div class="qty-ctrl"><button class="qb" onclick="chQty(${p.id},-1)">−</button><input class="qv" id="qv-${p.id}" value="${qty}" type="number" min="1" max="${p.stock}" onchange="setQv(${p.id},this.value)"><button class="qb" onclick="chQty(${p.id},+1)">+</button></div>
      <button class="add-btn" onclick="addCart(${p.id})" ${p.stock<=0?'disabled':''}>🛒</button>
    </div>
  </div>`;
}

function chQty(id,d){const i=document.getElementById('qv-'+id);if(!i)return;const p=S.products.find(x=>x.id===id);i.value=Math.max(1,Math.min(parseInt(i.value)+d,p?p.stock:999));renderProds()}
function setQv(id,v){const p=S.products.find(x=>x.id===id);document.getElementById('qv-'+id).value=Math.max(1,Math.min(parseInt(v)||1,p?p.stock:999))}

function renderOfferBanner(){
  const o=S.offers.find(x=>x.active&&(x.target==='all'||x.target===currentUser.type));
  const b=document.getElementById('offer-banner');
  if(!o){b.innerHTML='';return}
  b.innerHTML=`<div style="background:linear-gradient(90deg,rgba(232,255,71,.1),rgba(255,165,2,.06));border:1px solid rgba(232,255,71,.18);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px"><span style="font-size:13px">🏷</span><div><div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--accent)">${o.title}</div><div style="font-size:13px;color:var(--text2)">${o.description}</div></div></div>
    <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:var(--accent)">${o.discount}%<span style="font-size:13px"> OFF</span></div>
  </div>`;
}

function toggleWish(pid){
  const i=wishlist.indexOf(pid);
  if(i>-1) wishlist.splice(i,1);
  else wishlist.push(pid);
  saveWishlistDB();
  renderProds();
  if(document.getElementById('page-wishlist').classList.contains('act')) renderWishlist();
}

async function saveWishlistDB(){
  if(!currentUser)return;
  const key='wish_'+currentUser.id;
  const val=JSON.stringify(wishlist);
  const all=await ga('settings');
  const ex=all.find(s=>s.key===key);
  if(ex) await pu('settings',{key,value:val});
  else await pa('settings',{key,value:val}).catch(()=>pu('settings',{key,value:val}));
}

async function loadWishlistDB(){
  if(!currentUser)return;
  try{
    const all=await ga('settings');
    const rec=all.find(s=>s.key==='wish_'+currentUser.id);
    if(rec&&rec.value) wishlist=JSON.parse(rec.value);
  }catch(e){wishlist=[];}
}
function renderWishlist(){
  const grid=document.getElementById('wish-grid');
  const prods=S.products.filter(p=>wishlist.includes(p.id));
  if(!prods.length){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text3)"><div style="font-size:48px;margin-bottom:10px;opacity:.25">❤️</div><div style="font-size:13px">ඔබ කිසිවක් සුරකින්නේ නැත</div><div style="font-size:13px;color:var(--text3);margin-top:6px">නිෂ්පාදනයකට ❤️ 누르ා ලිස්ට් එකට</div></div>`;return}
  grid.innerHTML=prods.map(p=>renderProdCard(p)).join('');
}

function renderTicker(){
  const active=S.offers.filter(o=>o.active&&(o.target==='all'||o.target===currentUser.type));
  const ticker=document.getElementById('ticker');
  if(!active.length){ticker.classList.remove('show');return}
  ticker.classList.add('show');
  const content=active.map(o=>`<span class="ticker-item">🏷 <strong>${o.title}</strong> — ${o.discount}% OFF ${o.category!=='all'?o.category:'all items'}</span>`).join('');
  document.getElementById('ticker-inner').innerHTML=content+content;
}

// ═══════════ PRODUCT QUICK-ADD POPUP ═══════════
let ppProductId=null;

function openPD(id){openProdPopup(id);}  // keep backward compat

function openProdPopup(id){
  const p=S.products.find(x=>x.id===id);if(!p)return;
  ppProductId=id;

  // Image
  document.getElementById('pp-img').innerHTML=p.image
    ?`<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">`
    :`<span style="font-size:60px">${p.icon||'📦'}</span>`;

  // Name + category
  document.getElementById('pp-name').textContent=p.name;
  document.getElementById('pp-cat').textContent=p.category;

  // Prices
  const billingBase=currentUser.type==='retail'?(p.costPrice||p.retailPrice):p.wholesalePrice;
  const offer=getOffer(p);
  const billingPrice=offer?billingBase*(1-offer.discount/100):billingBase;
  const mktPrice=p.retailPrice||billingBase;
  const saving=mktPrice-billingPrice;
  const cOffer=S.cashoffers.find(c=>c.productId===id&&c.active);

  let pricesHTML=`
    <div class="pp-price-cell" style="border-color:rgba(26,122,80,.25);background:var(--accent-dim)">
      <div class="pp-price-lbl" style="color:var(--accent)">⭐ අපේ මිල</div>
      <div class="pp-price-val" style="color:var(--accent)">රු. ${billingPrice.toFixed(2)}</div>
    </div>
    <div class="pp-price-cell">
      <div class="pp-price-lbl">වෙළඳපල මිල</div>
      <div class="pp-price-val"><span style="text-decoration:line-through;color:var(--text3)">රු. ${mktPrice.toFixed(2)}</span></div>
      ${saving>0?`<div style="font-size:12px;color:var(--green);margin-top:2px">🟢 රු. ${saving.toFixed(2)} ඉතිරිය</div>`:''}
    </div>`;
  if(cOffer&&currentUser.type==='wholesale'){
    const cAmt=cOffer.discountAmt||cOffer.discount||0;
    pricesHTML+=`<div class="pp-price-cell" style="border-color:rgba(46,213,115,.25);background:rgba(46,213,115,.06);grid-column:1/-1">
      <div class="pp-price-lbl" style="color:var(--green)">💵 Cash ගෙවූ විට</div>
      <div class="pp-price-val" style="color:var(--green)">රු. ${Math.max(0,billingPrice-cAmt).toFixed(2)} <span style="font-size:12px;font-weight:400">ඒකකයකට රු. ${cAmt.toFixed(2)} off</span></div>
    </div>`;
  }
  document.getElementById('pp-prices').innerHTML=pricesHTML;

  // Bulk offers
  const bulkEl=document.getElementById('pp-bulk');
  const bestBulk=S.bulkoffers.filter(b=>b.productId===id&&b.active&&(b.target==='all'||b.target===currentUser.type)).sort((a,b)=>a.minQty-b.minQty);
  if(bestBulk.length){bulkEl.style.display='block';bulkEl.innerHTML='📊 <strong>ප්‍රමාණ දීමනා:</strong> '+bestBulk.map(b=>`${b.minQty}+ ඒකක → <strong>${b.discount}% OFF</strong>`).join(' · ');}
  else bulkEl.style.display='none';

  // Badges
  const badges=[];
  if(offer) badges.push(`<span class="badge badge-yellow">🏷 ${offer.discount}% OFF</span>`);
  if(cOffer&&currentUser.type==='wholesale') badges.push(`<span class="badge badge-green">💵 Cash deal</span>`);
  document.getElementById('pp-badges').innerHTML=badges.join(' ');

  // Stock
  const ss=p.stock<=0?'out':p.stock<=(p.lowStock||10)?'low':'in';
  document.getElementById('pp-stock-lbl').textContent={in:`✓ ගබඩාවේ ඇත: ${p.stock} ඒකක`,low:`⚠ අඩු ප්‍රමාණ: ${p.stock} ඉතිරිය`,out:'✗ ගබඩාවේ නැත'}[ss];
  document.getElementById('pp-stock-lbl').style.color=ss==='out'?'var(--red)':ss==='low'?'var(--orange)':'var(--text3)';

  // Qty reset
  document.getElementById('pp-qty').value=1;
  document.getElementById('pp-qty').max=p.stock;
  document.getElementById('pp-add-btn').disabled=p.stock<=0;
  document.getElementById('pp-add-btn').textContent=p.stock<=0?'✗ ගබඩාවේ නැත':'🛒 Cart-ට එකතු කරන්න';

  // Open popup + overlay
  document.getElementById('prod-popup').classList.add('open');
  document.getElementById('pp-overlay').classList.add('open');
}

function closeProdPopup(){
  document.getElementById('prod-popup').classList.remove('open');
  document.getElementById('pp-overlay').classList.remove('open');
  ppProductId=null;
}

function ppQty(d){
  const i=document.getElementById('pp-qty');
  const p=S.products.find(x=>x.id===ppProductId);
  i.value=Math.max(1,Math.min(parseInt(i.value)+d,p?p.stock:999));
}

function ppAddCart(){
  const qty=parseInt(document.getElementById('pp-qty').value)||1;
  if(!ppProductId) return;
  addCartWithQty(ppProductId,qty);
  closeProdPopup();
  // Cart is now open and stays open
}

function pdQty(d){ppQty(d);}  // keep backward compat
function pdAddCart(){ppAddCart();}  // keep backward compat

// ═══════════ CART ═══════════
function addCart(pid){
  const qty=parseInt(document.getElementById('qv-'+pid)?.value)||1;
  addCartWithQty(pid,qty);
}

function addCartWithQty(pid,qty){
  const p=S.products.find(x=>x.id===pid);if(!p||p.stock<=0){toast('ගබඩාවේ නැත','error');return}
  const billingBase=currentUser.type==='retail'?(p.costPrice||p.retailPrice):p.wholesalePrice;
  const offer=getOffer(p);
  const price=offer?billingBase*(1-offer.discount/100):billingBase;
  const marketPrice=p.retailPrice||billingBase;
  const ex=cart.find(i=>i.pid===pid);
  if(ex) ex.qty=Math.min(ex.qty+qty,p.stock);
  else cart.push({pid,name:p.name,icon:p.icon||'📦',image:p.image||null,price,marketPrice,qty,offerApplied:!!offer,category:p.category});
  updateCartUI();saveCartDB();
  // Always open and keep cart open once first item added
  openCart();
  toast(`✓ ${p.name} cart-ට දැමිණ`,'success');
  // Flash the new/updated item
  setTimeout(()=>{
    const items=document.querySelectorAll('#cd-items .ci');
    const match=[...items].find(el=>el.textContent.includes(p.name));
    if(match){match.style.transition='background .35s';match.style.background='rgba(26,122,80,.18)';setTimeout(()=>{match.style.background=''},600);}
  },40);
}

function rmCart(pid){
  cart=cart.filter(i=>i.pid!==pid);
  updateCartUI();saveCartDB();
  // If cart becomes empty, allow close button and close the drawer
  if(cart.length===0){
    updateCloseBtn();
    // Auto-close when last item removed
    document.getElementById('cart-ov').classList.remove('open');
    document.getElementById('cart-drawer').classList.remove('open');
    document.body.classList.remove('cart-open');
    cartEverOpened=false;
  }
}
function cqChg(pid,d){
  const it=cart.find(i=>i.pid===pid);if(!it)return;
  const p=S.products.find(x=>x.id===pid);
  it.qty+=d;
  if(it.qty<=0) rmCart(pid);
  else if(p&&it.qty>p.stock) it.qty=p.stock;
  else{updateCartUI();saveCartDB();}
}

function getDeliveryFee(){
  // Only retail customers choosing home delivery pay a delivery charge
  if(currentUser.type!=='retail') return 0;
  if(delType!=='delivery') return 0;
  const zone=S.zones.find(z=>z.areas&&z.areas.some(a=>a.toLowerCase()===(currentUser.location||'').toLowerCase()));
  return zone?.deliveryFee||0;
}

function calcTotals(){
  let sub=0,specialDisc=0,cashDisc=0,bulkDisc=0,wsDisc=0,priceSavings=0;
  const isCash=selPayment==='cash';
  for(const it of cart){
    const lineBase=it.price*it.qty;
    sub+=lineBase;
    if(it.marketPrice&&it.marketPrice>it.price) priceSavings+=(it.marketPrice-it.price)*it.qty;
    // Special offer (% on line price)
    const p=S.products.find(x=>x.id===it.pid);
    if(p){const offer=getOffer(p);if(offer) specialDisc+=lineBase*(offer.discount/100);}
    // Bulk discount (රු. per unit)
    const bOffer=S.bulkoffers.filter(b=>b.productId===it.pid&&b.active&&(b.target==='all'||b.target===currentUser.type)&&it.qty>=b.minQty).sort((a,b2)=>b2.minQty-a.minQty)[0];
    if(bOffer){const bAmt=bOffer.discountAmt||bOffer.discount||0;bulkDisc+=bAmt*it.qty;}
    // Cash offer (wholesale only, රු. per unit)
    if(isCash&&currentUser.type==='wholesale'){
      const cOffer=S.cashoffers.find(c=>c.productId===it.pid&&c.active);
      if(cOffer){const cAmt=cOffer.discountAmt||cOffer.discount||0;cashDisc+=cAmt*it.qty;}
    }
  }
  // wsDisc removed — wholesale pricing is already applied via wholesalePrice, no extra % reduction
  const afterBase=sub-specialDisc-cashDisc-bulkDisc;
  const pts=currentUser.loyaltyPoints||0;
  const tier=getTier(pts,currentUser.type);
  const tierDisc=afterBase*((tier?.discountPct||0)/100);
  const afterDisc=afterBase-tierDisc;
  const deliveryFee=getDeliveryFee();
  return{sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,priceSavings,deliveryFee,tax:0,total:afterDisc+deliveryFee};
}

function updateCartUI(){
  const count=cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cart-count').textContent=count;
  document.getElementById('checkout-btn').disabled=cart.length===0;
  updateCloseBtn();
  const{sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,priceSavings,deliveryFee,total}=calcTotals();
  const cartTotal=total-deliveryFee; // cart never shows delivery charge

  document.getElementById('cd-sub').textContent=`රු. ${sub.toFixed(2)}`;

  // Price savings row (market → ape mila)
  const spRow0=document.getElementById('cd-save-price-row');
  if(priceSavings>0){spRow0.style.display='flex';document.getElementById('cd-save-price-amt').textContent=`−රු. ${priceSavings.toFixed(2)}`;}
  else spRow0.style.display='none';

  // Special offer row
  const spRow=document.getElementById('cd-special-row');
  if(specialDisc>0){spRow.style.display='flex';document.getElementById('cd-special-disc').textContent=`−රු. ${specialDisc.toFixed(2)}`;}
  else spRow.style.display='none';

  // Bulk offer row
  const bRow=document.getElementById('cd-bulk-row');
  if(bulkDisc>0){bRow.style.display='flex';document.getElementById('cd-bulk-disc').textContent=`−රු. ${bulkDisc.toFixed(2)}`;}
  else bRow.style.display='none';

  const wRow=document.getElementById('cd-ws-row');wRow.style.display='none';
  const cRow=document.getElementById('cd-cash-row');cRow.style.display=cashDisc>0?'flex':'none';document.getElementById('cd-cash-disc').textContent=`−රු. ${cashDisc.toFixed(2)}`;
  const tier=getTier(currentUser.loyaltyPoints||0,currentUser.type);
  const tRow=document.getElementById('cd-tier-row');tRow.style.display=tierDisc>0?'flex':'none';
  if(tierDisc>0){document.getElementById('cd-tier-label').textContent=`⭐ ${tier?.name||''} Tier`;document.getElementById('cd-tier-disc').textContent=`−රු. ${tierDisc.toFixed(2)}`}

  // Total saved banner (NO delivery)
  const totalSaved=priceSavings+specialDisc+wsDisc+cashDisc+bulkDisc+tierDisc;
  const savedBanner=document.getElementById('cd-saved-banner');
  if(totalSaved>0){savedBanner.style.display='flex';document.getElementById('cd-save-amt').textContent=`රු. ${totalSaved.toFixed(2)}`;}
  else savedBanner.style.display='none';

  document.getElementById('cd-total').textContent=`රු. ${cartTotal.toFixed(2)}`;

  // Pay method toggle for wholesale
  const payInfo=document.getElementById('cd-pay-info');
  if(currentUser.type==='wholesale'){
    const isCash=selPayment==='cash';
    const cashTotal=calcCashSavingsTotal();
    const fb=currentUser.forwardBalance||0;
    const sub=cart.reduce((s,i)=>s+i.price*i.qty,0);
    const newBal=fb+sub;
    const partialEl=document.getElementById('cust-partial-pay');
    const partial=partialEl?parseFloat(partialEl.value)||0:0;
    const afterPartial=Math.max(0,newBal-partial);

    payInfo.innerHTML=`
      <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px">💳 ගෙවීමේ ක්‍රමය:</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div style="flex:1;padding:11px 8px;border:2px solid ${isCash?'var(--green)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;font-size:15px;font-weight:${isCash?'700':'400'};background:${isCash?'rgba(46,213,115,.1)':'transparent'};transition:.15s" onclick="setPayCart('cash')">
          💵 Cash${cashTotal>0?`<br><span style="color:var(--green);font-size:13px;font-weight:700">රු. ${cashTotal.toFixed(0)} save!</span>`:''}</div>
        <div style="flex:1;padding:11px 8px;border:2px solid ${!isCash?'var(--blue)':'var(--border)'};border-radius:10px;cursor:pointer;text-align:center;font-size:15px;font-weight:${!isCash?'700':'400'};background:${!isCash?'rgba(83,82,237,.1)':'transparent'};transition:.15s" onclick="setPayCart('bill_to_bill')">
          📄 B2B${fb>0?`<br><span style="color:#f87171;font-size:13px">ශේෂය: රු. ${fb.toFixed(0)}</span>`:''}</div>
      </div>
      ${!isCash?`<div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.18);border-radius:10px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px">
          <span style="color:var(--text2)">දැනට ඇති B2B ශේෂය</span>
          <span style="font-weight:800;color:${fb>0?'var(--red)':'var(--green)'}">රු. ${fb.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px">
          <span style="color:var(--text2)">මෙම ඇණවුම</span>
          <span style="font-weight:700;color:var(--orange)">රු. ${sub.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(239,68,68,.2);padding-top:6px;font-size:15px">
          <span style="font-weight:700">නව සම්පූර්ණ ශේෂය</span>
          <span style="font-weight:900;color:var(--red);font-family:'Syne',sans-serif" id="cd-b2b-new-bal">රු. ${newBal.toFixed(2)}</span>
        </div>
      </div>`:''}`;
    // Show/hide persistent partial pay row
    const partialRow=document.getElementById('cd-partial-row');
    if(partialRow) partialRow.style.display=(!isCash)?'block':'none';
    if(isCash){
      const pp=document.getElementById('cust-partial-pay');if(pp)pp.value='';
    }
    updatePartialPreview();
  } else {
    payInfo.innerHTML='';
    const partialRow=document.getElementById('cd-partial-row');
    if(partialRow) partialRow.style.display='none';
  }

  const items=document.getElementById('cd-items');
  if(!cart.length){items.innerHTML=`<div style="text-align:center;padding:50px 20px;color:var(--text3)"><div style="font-size:36px;margin-bottom:10px;opacity:.25">🛒</div><div style="font-size:13px">ලැයිස්තුව හිස් ය</div><div style="font-size:13px;margin-top:4px">නිෂ්පාදන select කර cart-ට දමන්න</div></div>`;return}
  items.innerHTML=cart.map(it=>{
    const p=S.products.find(x=>x.id===it.pid);
    const offer=p?getOffer(p):null;
    const bOffer=S.bulkoffers.filter(b=>b.productId===it.pid&&b.active&&(b.target==='all'||b.target===currentUser.type)&&it.qty>=b.minQty).sort((a,b2)=>b2.minQty-a.minQty)[0];
    const cOffer=selPayment==='cash'&&currentUser.type==='wholesale'?S.cashoffers.find(c=>c.productId===it.pid&&c.active):null;
    let offerTags='';
    if(offer) offerTags+=`<span style="font-size:13px;color:#facc15;background:rgba(250,204,21,.1);border-radius:4px;padding:1px 5px">🏷 ${offer.discount}% off</span> `;
    if(bOffer){const bAmt=bOffer.discountAmt||0;if(bAmt>0) offerTags+=`<span style="font-size:13px;color:var(--teal);background:rgba(20,184,166,.1);border-radius:4px;padding:1px 5px">📊 රු. ${bAmt.toFixed(0)}/ඒකක</span> `}
    if(cOffer){const cAmt=cOffer.discountAmt||0;if(cAmt>0) offerTags+=`<span style="font-size:13px;color:var(--green);background:rgba(46,213,115,.1);border-radius:4px;padding:1px 5px">💵 රු. ${cAmt.toFixed(0)} Cash</span>`}
    return `<div class="ci">
      <div class="ci-photo">${it.image?`<img src="${it.image}" style="width:100%;height:100%;object-fit:cover;border-radius:5px" alt="">`:`${it.icon}`}</div>
      <div class="ci-info">
        <div class="ci-name">${it.name}</div>
        <div class="ci-price">රු. ${it.price.toFixed(2)}${it.marketPrice&&it.marketPrice>it.price?`<span style="font-size:13px;color:var(--text3);text-decoration:line-through;margin-left:5px">රු. ${it.marketPrice.toFixed(2)}</span>`:''}${it.offerApplied?' 🏷':''}</div>
        ${offerTags?`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">${offerTags}</div>`:''}
        <div class="ci-qty"><button class="cqb" onclick="cqChg(${it.pid},-1)">−</button><span class="ci-qv">${it.qty}</span><button class="cqb" onclick="cqChg(${it.pid},+1)">+</button><span style="font-size:13px;color:var(--text3);margin-left:4px">= රු. ${(it.price*it.qty).toFixed(2)}</span></div>
      </div>
      <span class="ci-rm" onclick="rmCart(${it.pid})">✕</span>
    </div>`;
  }).join('');
}

function setPayCart(method){selPayment=method;updateCartUI()}

function updatePartialPreview(){
  const pp=document.getElementById('cust-partial-pay');
  const prev=document.getElementById('cd-partial-preview');
  const balEl=document.getElementById('cd-b2b-new-bal');
  if(!pp||!prev) return;
  const partial=parseFloat(pp.value)||0;
  const fb=currentUser?(currentUser.forwardBalance||0):0;
  const sub=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const newBal=Math.max(0,fb+sub-partial);
  if(partial>0){
    prev.textContent=`රු. ${partial.toFixed(2)} දැන් ගෙවා ශේෂය රු. ${newBal.toFixed(2)} වේ`;
    prev.style.color=newBal===0?'var(--green)':'var(--teal)';
  } else {
    prev.textContent='';
  }
  if(balEl) balEl.textContent=`රු. ${Math.max(0,fb+sub-partial).toFixed(2)}`;
}
let cartEverOpened=false;
function openCart(){
  document.getElementById('cart-ov').classList.add('open');
  document.getElementById('cart-drawer').classList.add('open');
  document.body.classList.add('cart-open');
  // Set exact cart width as CSS var so margin matches perfectly
  const cartW=Math.min(480,window.innerWidth);
  document.documentElement.style.setProperty('--cart-w', cartW+'px');
  cartEverOpened=true;
  updateCloseBtn();
}
function closeCart(){
  // Only allow close if cart is empty
  if(cart.length>0) return;
  document.getElementById('cart-ov').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.classList.remove('cart-open');
  cartEverOpened=false;
}
function tryCloseCart(){
  if(cart.length>0){
    // Flash a message instead of closing
    const btn=document.getElementById('cd-close-btn');
    if(btn){
      btn.textContent='ලැයිස්තුවේ items ඇත';
      btn.style.color='var(--orange)';
      setTimeout(()=>{btn.textContent='✕';btn.style.color='var(--text3)';},1500);
    }
    return;
  }
  document.getElementById('cart-ov').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.classList.remove('cart-open');
  cartEverOpened=false;
}
function updateCloseBtn(){
  const btn=document.getElementById('cd-close-btn');
  if(!btn) return;
  if(cart.length>0){
    btn.style.opacity='0.3';
    btn.title='Cart හිස් කරා පසු close කළ හැකිය';
  } else {
    btn.style.opacity='1';
    btn.title='';
  }
}
function setDelType(t){
  delType=t;
  document.getElementById('do-del').classList.toggle('sel',t==='delivery');
  document.getElementById('do-pick').classList.toggle('sel',t==='pickup');
  updateCartUI();
  // Show/hide address field based on delivery type
  const addrRow=document.getElementById('co-addr-row');
  const dateRow=document.getElementById('co-date-row');
  if(addrRow) addrRow.style.display=t==='delivery'?'block':'none';
  if(dateRow) dateRow.style.display=t==='delivery'?'block':'none';
  updateCheckoutTotals();
}

// ═══════════ CHECKOUT ═══════════
function openCheckout(){
  if(!cart.length)return;
  closeCart();
  buildCheckout();
  setDelivDate();
  buildPayOpts();
  om('checkout-modal');
}

function buildPayOpts(){
  const container=document.getElementById('pay-opts-container');
  if(currentUser.type==='wholesale'){
    const cashSavings=calcCashSavingsTotal();
    container.innerHTML=`
      <div class="pay-opt cash-highlight ${selPayment==='cash'?'sel':''}" onclick="setSelPay('cash')">
        <div class="po-ico">💵</div>
        <div class="po-info"><div class="po-lbl">💵 මුදල් ගෙවීම</div><div class="po-sub">ඉදිරිපත් ගෙවීම${cashSavings>0?` — රු. ${cashSavings.toFixed(2)} ඉතිරිය!`:''}</div></div>
        ${cashSavings>0?`<span class="po-badge">SAVE රු. ${cashSavings.toFixed(2)}</span>`:''}
      </div>
      <div class="pay-opt ${selPayment==='bill_to_bill'?'sel':''}" onclick="setSelPay('bill_to_bill')">
        <div class="po-ico">📄</div>
        <div class="po-info"><div class="po-lbl">Bill to Bill</div><div class="po-sub">ගිණුම් ගෙවීම</div></div>
      </div>`;
  } else {
    container.innerHTML=`
      <div class="pay-opt ${selPayment==='cash'?'sel':''}" onclick="setSelPay('cash')"><div class="po-ico">💵</div><div class="po-info"><div class="po-lbl">Cash</div><div class="po-sub">ගෙදර දොරා ගෙවීම</div></div></div>
      <div class="pay-opt ${selPayment==='card'?'sel':''}" onclick="setSelPay('card')"><div class="po-ico">💳</div><div class="po-info"><div class="po-lbl">Card Payment</div><div class="po-sub">Debit / Credit</div></div></div>`;
  }
  updateCheckoutTotals();
}

function calcCashSavingsTotal(){
  if(currentUser.type!=='wholesale') return 0;
  let s=0;
  for(const it of cart){
    const co=S.cashoffers.find(c=>c.productId===it.pid&&c.active);
    if(co){const cAmt=co.discountAmt||co.discount||0;s+=cAmt*it.qty;}
  }
  return s;
}

function setSelPay(method){
  selPayment=method;
  updateCartUI();
  buildPayOpts();
  buildCheckout();
  document.getElementById('card-fields').style.display=method==='card'?'block':'none';
  const cashSave=document.getElementById('co-cash-savings');
  const savings=calcCashSavingsTotal();
  if(method==='cash'&&savings>0&&currentUser.type==='wholesale'){
    cashSave.style.display='flex';
    cashSave.innerHTML=`💵 Cash ගෙවීමෙන් ඔබ <strong style="color:var(--green);margin:0 4px">රු. ${savings.toFixed(2)}</strong> ඉතිරි කරන්නේය!`;
  } else cashSave.style.display='none';
  updateCheckoutTotals();
}

function buildCheckout(){
  // Editable items
  document.getElementById('co-items').innerHTML=cart.map(it=>{
    const bOffer=S.bulkoffers.filter(b=>b.productId===it.pid&&b.active&&(b.target==='all'||b.target===currentUser.type)&&it.qty>=b.minQty).sort((a,b2)=>b2.minQty-a.minQty)[0];
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-bottom:5px">
      <div style="width:36px;height:36px;border-radius:5px;background:var(--bg3);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${it.image?`<img src="${it.image}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:13px">${it.icon}</span>`}</div>
      <div style="flex:1;min-width:0"><div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.name}</div>
      <div style="font-size:13px;color:var(--accent)">රු. ${it.price.toFixed(2)}</div>
      ${bOffer?`<div style="font-size:13px;color:var(--teal)">📊 රු. ${(bOffer.discountAmt||bOffer.discount||0).toFixed(0)} ඒකකයකට off!</div>`:''}</div>
      <div style="display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:5px;overflow:hidden">
        <button onclick="cqChg(${it.pid},-1);buildCheckout();updateCheckoutTotals()" style="width:22px;height:22px;background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:13px">−</button>
        <span style="font-size:13px;min-width:24px;text-align:center">${it.qty}</span>
        <button onclick="cqChg(${it.pid},+1);buildCheckout();updateCheckoutTotals()" style="width:22px;height:22px;background:transparent;border:none;color:var(--text2);cursor:pointer;font-size:13px">+</button>
      </div>
      <button onclick="rmCart(${it.pid});buildCheckout();updateCheckoutTotals()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px">✕</button>
    </div>`;
  }).join('');
  updateCheckoutTotals();
}

function updateCheckoutTotals(){
  const{sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,priceSavings,deliveryFee,total}=calcTotals();
  const redeemChk=document.getElementById('co-redeem');
  const pts=currentUser.loyaltyPoints||0;
  const ls=getLoyaltySetting(currentUser.type);
  const redeemSection=document.getElementById('loyalty-redeem-section');
  if(pts>=ls.minRedeem){
    redeemSection.style.display='block';
    document.getElementById('co-pts-bal').textContent=pts;
    document.getElementById('co-pts-val').textContent=`රු. ${(pts*ls.pointValue).toFixed(2)}`;
    const maxLKR=total*(ls.maxRedeemPct/100);
    const actualRedeem=Math.min(pts*ls.pointValue,maxLKR);
    document.getElementById('co-pts-limit').textContent=`උපරිම redeem: රු. ${maxLKR.toFixed(2)} (${ls.maxRedeemPct}%)`;
    const loyaltyDisc=redeemChk&&redeemChk.checked?actualRedeem:0;
    const finalTotal=total-loyaltyDisc;
    document.getElementById('cd-loyalty-row').style.display=loyaltyDisc>0?'flex':'none';
    document.getElementById('cd-loyalty-disc').textContent=`−රු. ${loyaltyDisc.toFixed(2)}`;
    document.getElementById('co-receipt').innerHTML=buildReceipt(sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,loyaltyDisc,priceSavings,deliveryFee,finalTotal);
  } else {
    redeemSection.style.display='none';
    document.getElementById('co-receipt').innerHTML=buildReceipt(sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,0,priceSavings,deliveryFee,total);
  }
}

function buildReceipt(sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,loyaltyDisc,priceSavings,deliveryFee,total){
  const tier=getTier(currentUser.loyaltyPoints||0,currentUser.type);
  const ls=getLoyaltySetting(currentUser.type);
  const earnEstimate=Math.floor((total/100)*ls.earnPer100*(1+(tier?.bonusEarn||0)/100));
  const totalDisc=(specialDisc||0)+(cashDisc||0)+(bulkDisc||0)+(tierDisc||0)+(loyaltyDisc||0)+(priceSavings||0);
  return `<div class="receipt">
    <div class="rc-head"><div class="rc-logo">◈ MART</div><div style="font-size:13px;color:var(--text3);margin-top:3px">${currentUser.type.toUpperCase()} · ${currentUser.name}</div></div>
    ${cart.map(it=>`<div class="rc-row"><span>${it.icon} ${it.name} ×${it.qty}</span><span>රු. ${(it.price*it.qty).toFixed(2)}</span></div>`).join('')}
    <hr class="rc-div">
    ${priceSavings>0?`<div class="rc-row" style="color:var(--green)"><span>💰 විකිණීමේ → අපේ මිල</span><span>−රු. ${priceSavings.toFixed(2)}</span></div>`:''}
    ${specialDisc>0?`<div class="rc-row" style="color:#facc15"><span>🏷 විශේෂ දීමනා</span><span>−රු. ${specialDisc.toFixed(2)}</span></div>`:''}
    ${cashDisc?`<div class="rc-row" style="color:var(--green)"><span>💵 Cash දීමනාව</span><span>−රු. ${cashDisc.toFixed(2)}</span></div>`:''}
    ${bulkDisc?`<div class="rc-row" style="color:var(--teal)"><span>📊 ප්‍රමාණ දීමනාව</span><span>−රු. ${bulkDisc.toFixed(2)}</span></div>`:''}
    ${tierDisc?`<div class="rc-row" style="color:#c084fc"><span>⭐ ${tier?.name||''} Tier</span><span>−රු. ${tierDisc.toFixed(2)}</span></div>`:''}
    ${loyaltyDisc?`<div class="rc-row" style="color:var(--gold)"><span>⭐ Loyalty Points</span><span>−රු. ${loyaltyDisc.toFixed(2)}</span></div>`:''}
    ${deliveryFee>0?`<div class="rc-row" style="color:var(--text2)"><span>🚚 බෙදාහැරීමේ ගාස්තු</span><span>+රු. ${deliveryFee.toFixed(2)}</span></div>`:''}
    <hr class="rc-div">
    <div class="rc-row" style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px"><span>සම්පූර්ණ</span><span style="color:var(--accent)">රු. ${total.toFixed(2)}</span></div>
    ${totalDisc>0?`<div style="background:rgba(46,213,115,.07);border:1px solid rgba(46,213,115,.15);border-radius:6px;padding:7px 10px;margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;color:var(--green)">💰 සම්පූර්ණ ඉතිරිය</span><span style="font-size:13px;font-weight:700;color:var(--green)">රු. ${totalDisc.toFixed(2)}</span></div>`:''}
    ${earnEstimate>0?`<div style="margin-top:6px;padding:6px 10px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.18);border-radius:6px;font-size:13px;color:var(--gold);text-align:center">⭐ ඇණවුම් කළ විට <strong>+${earnEstimate} points</strong> ලැබේ!</div>`:''}
  </div>`;
}

function setDelivDate(){
  const zone=S.zones.find(z=>z.areas&&z.areas.some(a=>a.toLowerCase()===currentUser.location?.toLowerCase()));
  const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today=new Date();const lead=zone?.leadDays||2;
  let d=new Date(today);d.setDate(d.getDate()+lead);
  if(zone?.days?.length){for(let i=0;i<14;i++){if(zone.days.includes(dayNames[d.getDay()])){document.getElementById('co-date').value=d.toISOString().split('T')[0];document.getElementById('co-date-note').textContent=`${zone.name} — ${zone.days.join(', ')}`;return}d.setDate(d.getDate()+1)}}
  document.getElementById('co-date').value=d.toISOString().split('T')[0];
  document.getElementById('co-date-note').textContent='Standard 2-day delivery';
}

async function placeOrder(){
  if(!cart.length)return;
  const addr=document.getElementById('co-addr').value.trim();
  if(delType==='delivery'&&!addr){toast('Delivery address ඇතුල් කරන්න','error');return}
  const{sub,specialDisc,wsDisc,cashDisc,bulkDisc,tierDisc,priceSavings,deliveryFee,total}=calcTotals();
  const redeemChk=document.getElementById('co-redeem');
  const ls=getLoyaltySetting(currentUser.type);
  const pts=currentUser.loyaltyPoints||0;
  let loyaltyDisc=0,loyaltyRedeem=0;
  if(redeemChk&&redeemChk.checked&&pts>=ls.minRedeem){
    const maxLKR=total*(ls.maxRedeemPct/100);
    loyaltyDisc=Math.min(pts*ls.pointValue,maxLKR);
    loyaltyRedeem=Math.ceil(loyaltyDisc/ls.pointValue);
  }
  const finalTotal=total-loyaltyDisc;
  // Earn points
  const tier=getTier(pts,currentUser.type);
  const bonusMult=1+(tier?.bonusEarn||0)/100;
  const earnedPts=Math.floor((finalTotal/100)*ls.earnPer100*bonusMult);

  const order={customerId:currentUser.id,customerName:currentUser.name,customerType:currentUser.type,items:[...cart],subtotal:sub,specialDiscount:specialDisc,wholesaleDiscount:0,cashDiscount:cashDisc,bulkDiscount:bulkDisc,tierDiscount:tierDisc,tierName:tier?.name||'',priceSavings,deliveryFee,loyaltyRedeemed:loyaltyRedeem,loyaltyDiscount:loyaltyDisc,loyaltyEarned:earnedPts,tax:0,total:finalTotal,paymentMethod:selPayment,deliveryType:delType,deliveryAddress:addr,deliveryDate:document.getElementById('co-date').value,note:document.getElementById('co-note').value,status:'pending',b2bPending:selPayment==='bill_to_bill',date:new Date().toISOString()};
  const oid=await pa('orders',order);order.id=oid;

  // Update customer loyalty + forward balance
  const cust=S.customers.find(x=>x.id===currentUser.id);
  if(cust){
    cust.loyaltyPoints=(cust.loyaltyPoints||0)+earnedPts-loyaltyRedeem;
    if(cust.loyaltyPoints<0) cust.loyaltyPoints=0;
    cust.totalLoyaltySaved=(cust.totalLoyaltySaved||0)+loyaltyDisc+cashDisc+bulkDisc+tierDisc;
    if(selPayment==='bill_to_bill'){
      const partialPaid=parseFloat(document.getElementById('cust-partial-pay')?.value)||0;
      cust.forwardBalance=Math.max(0,(cust.forwardBalance||0)+finalTotal-partialPaid);
    }
    await pu('customers',cust);
    currentUser=cust;sessionStorage.setItem('mUser',JSON.stringify(cust));
  }

  // Deduct stock
  for(const it of cart){const p=S.products.find(x=>x.id===it.pid);if(p){p.stock=Math.max(0,p.stock-it.qty);await pu('products',p)}}

  // Notify admin
  await pa('notifications',{type:'new_order',message:`🛒 ${currentUser.name} ගේ නව ${currentUser.type} ඇණවුම — රු. ${finalTotal.toFixed(2)}`,date:new Date().toISOString(),read:false,target:'admin'});

  cart=[];
  updateCartUI();updateLoyaltyBanner();saveCartDB();
  // Cart is now empty — allow and perform close
  cartEverOpened=false;
  document.getElementById('cart-ov').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.classList.remove('cart-open');
  cm('checkout-modal');showReceipt(order);
  toast('✓ ඇණවුම ලැබී ඇත! ⭐ +'+earnedPts+' points!','success');
  await loadAll();
}

function showReceipt(o){
  const totalSaved=(o.specialDiscount||0)+(o.cashDiscount||0)+(o.bulkDiscount||0)+(o.tierDiscount||0)+(o.loyaltyDiscount||0)+(o.priceSavings||0);
  document.getElementById('view-receipt').innerHTML=`
    <div class="receipt">
      <div class="rc-head"><div class="rc-logo">◈ MART</div><div style="font-size:13px;color:var(--text3);margin-top:3px">${new Date(o.date).toLocaleString()}</div><div style="font-size:13px;color:var(--accent)">#${String(o.id).padStart(4,'0')} · ${o.customerType.toUpperCase()}</div></div>
      ${o.items.map(it=>`<div class="rc-row"><span>${it.icon} ${it.name} ×${it.qty}</span><span>රු. ${(it.price*it.qty).toFixed(2)}</span></div>`).join('')}
      <hr class="rc-div">
      ${o.priceSavings?`<div class="rc-row" style="color:var(--green)"><span>💰 විකිණීමේ → අපේ මිල</span><span>−රු. ${o.priceSavings.toFixed(2)}</span></div>`:''}
      ${o.specialDiscount?`<div class="rc-row" style="color:#facc15"><span>🏷 විශේෂ දීමනා</span><span>−රු. ${o.specialDiscount.toFixed(2)}</span></div>`:''}
      ${o.cashDiscount?`<div class="rc-row" style="color:var(--green)"><span>💵 Cash දීමනාව</span><span>−රු. ${o.cashDiscount.toFixed(2)}</span></div>`:''}
      ${o.bulkDiscount?`<div class="rc-row" style="color:var(--teal)"><span>📊 ප්‍රමාණ දීමනාව</span><span>−රු. ${o.bulkDiscount.toFixed(2)}</span></div>`:''}
      ${o.tierDiscount?`<div class="rc-row" style="color:#c084fc"><span>⭐ ${o.tierName||'Tier'} වට්ටම</span><span>−රු. ${o.tierDiscount.toFixed(2)}</span></div>`:''}
      ${o.loyaltyDiscount?`<div class="rc-row" style="color:var(--gold)"><span>⭐ Loyalty Points</span><span>−රු. ${o.loyaltyDiscount.toFixed(2)}</span></div>`:''}
      ${o.deliveryFee>0?`<div class="rc-row" style="color:var(--text2)"><span>🚚 බෙදාහැරීමේ ගාස්තු</span><span>+රු. ${o.deliveryFee.toFixed(2)}</span></div>`:''}
      <hr class="rc-div">
      <div class="rc-row" style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px"><span>සම්පූර්ණ</span><span style="color:var(--accent)">රු. ${o.total.toFixed(2)}</span></div>
    </div>
    ${totalSaved>0?`<div style="background:rgba(46,213,115,.08);border:1px solid rgba(46,213,115,.2);border-radius:10px;padding:12px 16px;margin-top:10px">
      <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--green);margin-bottom:8px">💰 ඔබ ඉතිරි කළ මුදල:</div>
      ${o.priceSavings?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">💰 අපේ මිල</span><span style="color:var(--green)">රු. ${o.priceSavings.toFixed(2)}</span></div>`:''}
      ${o.specialDiscount?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">🏷 විශේෂ දීමනා</span><span style="color:#facc15">රු. ${o.specialDiscount.toFixed(2)}</span></div>`:''}
      ${o.wholesaleDiscount?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">🏭 Wholesale</span><span style="color:var(--green)">රු. ${o.wholesaleDiscount.toFixed(2)}</span></div>`:''}
      ${o.cashDiscount?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">💵 Cash</span><span style="color:var(--green)">රු. ${o.cashDiscount.toFixed(2)}</span></div>`:''}
      ${o.bulkDiscount?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">📊 ප්‍රමාණ</span><span style="color:var(--teal)">රු. ${o.bulkDiscount.toFixed(2)}</span></div>`:''}
      ${o.tierDiscount?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">⭐ ${o.tierName||'Tier'}</span><span style="color:#c084fc">රු. ${o.tierDiscount.toFixed(2)}</span></div>`:''}
      ${o.loyaltyDiscount?`<div class="rc-row" style="font-size:13px"><span style="color:var(--text3)">🎁 Loyalty</span><span style="color:var(--gold)">රු. ${o.loyaltyDiscount.toFixed(2)}</span></div>`:''}
      <div style="border-top:1px dashed rgba(46,213,115,.2);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;font-family:'Syne',sans-serif;font-size:13px;font-weight:800"><span style="color:var(--text)">සම්පූර්ණ ඉතිරිය</span><span style="color:var(--green)">රු. ${totalSaved.toFixed(2)}</span></div>
    </div>`:''}
    ${o.loyaltyEarned?`<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:12px;margin-top:10px;text-align:center">
      <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:var(--gold)">⭐ +${o.loyaltyEarned} Points ලැබුණා!</div>
      <div style="font-size:13px;color:rgba(255,255,255,.4);margin-top:3px">සම්පූර්ණ: ${(currentUser.loyaltyPoints||0)} pts</div>
    </div>`:''}
    <div style="text-align:center;margin-top:10px;background:var(--accent-dim);border:1px solid rgba(232,255,71,.15);border-radius:8px;padding:10px;font-size:13px;color:var(--accent)">ස්තූතියි! ඔබේ ඇණවුම ලැබිණ 🎉</div>
    ${o.b2bPending?`<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:12px 14px;margin-top:10px">
      <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#f87171;margin-bottom:6px">📋 Bill-to-Bill ඉදිරි Balance</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:6px">මෙම ඇණවුම Bill-to-Bill ගෙවීමෙන් කිරීමෙන් රු. ${o.total.toFixed(2)} ඔබේ ඉදිරි balance-ට add විය.</div>
      <div style="display:flex;justify-content:space-between;font-family:'Syne',sans-serif;font-weight:700"><span style="color:var(--text3)">සම්පූර්ණ ඉදිරි balance:</span><span style="color:#f87171">රු. ${(currentUser.forwardBalance||0).toFixed(2)}</span></div>
    </div>`:''}`;
  om('receipt-modal');
}

// ═══════════ ORDERS ═══════════
function renderOrders(){
  const mine=[...S.orders.filter(o=>o.customerId===currentUser.id)].reverse();
  const c=document.getElementById('my-orders');
  if(!mine.length){c.innerHTML=`<div style="text-align:center;padding:60px;color:var(--text3)"><div style="font-size:48px;margin-bottom:10px;opacity:.25">📋</div>ඇණවුම් නැත</div>`;return}
  const steps=['pending','confirmed','delivered'];
  c.innerHTML=mine.map(o=>{
    const si=steps.indexOf(o.status);
    const payLabel={cash:'💵 Cash',card:'💳 Card',bill_to_bill:'📄 Bill-to-Bill'}[o.paymentMethod]||o.paymentMethod;
    const colMap={pending:'badge-orange',confirmed:'badge-blue',delivered:'badge-green',cancelled:'badge-red'};
    return `<div class="order-card">
      <div class="oc-hd"><span class="oc-id">#${String(o.id).padStart(4,'0')}</span><div style="display:flex;gap:5px"><span class="badge ${colMap[o.status]||'badge-orange'}">${o.status}</span><span class="badge badge-teal">${payLabel}</span></div></div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:8px">${new Date(o.date).toLocaleString()}${o.deliveryDate?` · Delivery: ${o.deliveryDate}`:''}</div>
      ${o.status!=='cancelled'?`<div class="status-bar">${steps.map((s,i)=>`<div class="sb-step ${i<si?'done':i===si?'curr':''}"><div class="sb-dot"></div><div class="sb-lbl">${{pending:'බලාපොරොත්තු',confirmed:'තහවුරු',delivered:'ලැබුණා'}[s]}</div></div>`).join('')}</div>`:'<span class="badge badge-red">අවලංගු</span>'}
      <div style="font-size:13px;color:var(--text2);margin-top:8px">${o.items.map(i=>`${i.icon} ${i.name} ×${i.qty}`).join(' · ')}</div>
      ${o.loyaltyEarned?`<div style="font-size:13px;color:var(--gold);margin-top:4px">⭐ +${o.loyaltyEarned} points ලැබුණා</div>`:''}
      ${(o.priceSavings||o.cashDiscount||o.bulkDiscount||o.tierDiscount||o.loyaltyDiscount)?`<div style="font-size:13px;color:var(--green);margin-top:2px">💰 ඉතිරිය: රු. ${((o.priceSavings||0)+(o.cashDiscount||0)+(o.bulkDiscount||0)+(o.tierDiscount||0)+(o.loyaltyDiscount||0)).toFixed(2)}</div>`:''}
      ${o.deliveryFee>0?`<div style="font-size:13px;color:var(--text3);margin-top:2px">🚚 බෙදාහැරීම: රු. ${o.deliveryFee.toFixed(2)}</div>`:''}      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:13px;color:var(--text3)">${payLabel}</div>
        <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--accent)">රු. ${o.total.toFixed(2)}</div>
        <button class="btn btn-ghost btn-sm" onclick="viewRcpt(${o.id})">Receipt</button>
      </div>
    </div>`;
  }).join('');
}

function viewRcpt(id){const o=S.orders.find(x=>x.id===id);if(o)showReceipt(o)}

// ═══════════ ACCOUNT ═══════════
function renderAccount(){
  const u=currentUser;
  document.getElementById('acc-av').textContent=u.name[0].toUpperCase();
  document.getElementById('acc-name').textContent=u.name;
  document.getElementById('acc-type').textContent=u.type==='wholesale'?'🏭 Wholesale':'🛍 Retail';
  document.getElementById('acc-email').textContent=u.email;
  document.getElementById('acc-phone').textContent=u.phone||'—';
  document.getElementById('acc-loc').textContent=u.address||u.location||'—';
  const rRow=document.getElementById('acc-route-row');
  if(u.route){
    rRow.style.display='flex';
    const routeObj=S.routes.find(r=>r.name===u.route);
    const daysStr=routeObj&&routeObj.days&&routeObj.days.length?` · ${routeObj.days.join(', ')}` :'';
    document.getElementById('acc-route').textContent=u.route+daysStr;
  } else rRow.style.display='none';
  const payRow=document.getElementById('acc-pay-row');
  if(u.type==='wholesale'){payRow.style.display='flex';document.getElementById('acc-pay').textContent=u.defaultPayment==='bill_to_bill'?'📄 Bill-to-Bill':'💵 Cash'}
  // Loyalty
  const pts=u.loyaltyPoints||0;
  const ls=getLoyaltySetting(u.type);
  const val=(pts*ls.pointValue).toFixed(2);
  const tier=getTier(pts,u.type);
  const nextTiers=S.tiers.filter(t=>(t.target==='all'||t.target===u.type)&&t.minPoints>pts).sort((a,b)=>a.minPoints-b.minPoints);
  const nextT=nextTiers[0];
  document.getElementById('lc-tier-name').textContent=((tier?.name)||'Bronze').toUpperCase()+' MEMBER'+(tier?.discountPct?` · ${tier.discountPct}% OFF`:'');
  document.getElementById('lc-pts').textContent=pts;
  document.getElementById('lc-val').textContent=`රු. ${val}`;
  document.getElementById('lc-saved').textContent=`රු. ${(u.totalLoyaltySaved||0).toFixed(0)}`;
  const myOrds=S.orders.filter(o=>o.customerId===u.id&&o.status!=='cancelled');
  document.getElementById('lc-orders').textContent=myOrds.length;
  if(nextT){const prog=Math.min(100,(pts/(nextT.minPoints||1))*100);document.getElementById('lc-bar').style.width=prog+'%';document.getElementById('lc-next').textContent=`Next tier: ${nextT.name} — ${nextT.minPoints-pts} more points needed`}
  else{document.getElementById('lc-bar').style.width='100%';document.getElementById('lc-next').textContent='🎉 ශ්‍රේෂ්ඨ Tier වෙත ළඟා වී ඇත!'}
  const spent=myOrds.reduce((s,o)=>s+o.total,0);
  document.getElementById('sum-orders').textContent=myOrds.length;
  document.getElementById('sum-spent').textContent=`රු. ${spent.toFixed(0)}`;
  document.getElementById('sum-saved').textContent=`රු. ${(u.totalLoyaltySaved||0).toFixed(0)}`;
  document.getElementById('sum-pts').textContent=pts;

  // Savings breakdown by category
  const sbCash=myOrds.reduce((s,o)=>s+(o.cashDiscount||0),0);
  const sbBulk=myOrds.reduce((s,o)=>s+(o.bulkDiscount||0),0);
  const sbTier=myOrds.reduce((s,o)=>s+(o.tierDiscount||0),0);
  const sbLoyalty=myOrds.reduce((s,o)=>s+(o.loyaltyDiscount||0),0);
  const sbTotal=sbCash+sbBulk+sbTier+sbLoyalty;
  const sbCard=document.getElementById('savings-breakdown-card');
  if(sbTotal>0){
    sbCard.style.display='block';
    const mkRow=(icon,label,val,color)=>val>0?`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--text2)">${icon} ${label}</span><span style="color:${color};font-family:'Syne',sans-serif;font-weight:700">රු. ${val.toFixed(0)}</span></div>`:'';
    document.getElementById('savings-breakdown').innerHTML=`
      ${mkRow('💵','💵 Cash ගෙවීම ඉතිරිය',sbCash,'var(--green)')}
      ${mkRow('📊','Bulk Quantity',sbBulk,'var(--teal)')}
      ${mkRow('⭐','Loyalty Tier Discount',sbTier,'#c084fc')}
      ${mkRow('🎁','Loyalty Points Redeemed',sbLoyalty,'var(--gold)')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;font-family:'Syne',sans-serif;font-weight:800"><span style="color:var(--text)">සම්පූර්ණ ඉතිරිය</span><span style="color:var(--accent)">රු. ${sbTotal.toFixed(0)}</span></div>`;
  } else sbCard.style.display='none';
  const zone=S.zones.find(z=>z.areas?.some(a=>a.toLowerCase()===u.location?.toLowerCase()));
  document.getElementById('acc-delivery').innerHTML=zone?`<div style="margin-bottom:6px"><span style="color:var(--text3)">Zone:</span> <span style="color:var(--accent)">${zone.name}</span></div><div style="margin-bottom:6px"><span style="color:var(--text3)">Delivery Days:</span> ${zone.days.join(', ')}</div><div><span style="color:var(--text3)">Lead Time:</span> ${zone.leadDays} day(s)</div>`:`<div style="color:var(--text3)">Zone not found. Support contact කරන්න.</div>`;

  // B2B Forward Balance card (wholesale only)
  const b2bCard=document.getElementById('acc-b2b-card');
  if(u.type==='wholesale'&&u.defaultPayment==='bill_to_bill'){
    b2bCard.style.display='block';
    const fb=u.forwardBalance||0;
    const b2bOrds=S.orders.filter(o=>o.customerId===u.id&&o.b2bPending&&o.status!=='cancelled');
    const pendingAmt=b2bOrds.reduce((s,o)=>s+o.total,0);
    const isClear=fb<=0;
    document.getElementById('acc-b2b-inner').innerHTML=`
      <div style="background:${isClear?'rgba(46,213,115,.07)':'rgba(239,68,68,.07)'};border:1px solid ${isClear?'rgba(46,213,115,.2)':'rgba(239,68,68,.2)'};border-radius:10px;padding:14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:13px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">ගෙවිය යුතු Credit Balance</div>
            <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:${isClear?'var(--green)':'#f87171'}">${isClear?'රු. 0.00':`රු. ${fb.toFixed(2)}`}</div>
          </div>
          <span style="font-size:13px;padding:3px 10px;border-radius:20px;border:1px solid;${isClear?'background:rgba(46,213,115,.1);color:var(--green);border-color:rgba(46,213,115,.3)':'background:rgba(255,71,87,.1);color:#f87171;border-color:rgba(255,71,87,.3)'}">
            ${isClear?'✓ CLEAR':'OUTSTANDING'}
          </span>
        </div>
        ${!isClear?`<div style="background:rgba(0,0,0,.2);border-radius:7px;padding:10px;font-size:13px">
          <div style="display:flex;justify-content:space-between;color:var(--text2);margin-bottom:4px"><span>Pending ඇණවුම්</span><span>${b2bOrds.length}</span></div>
          <div style="display:flex;justify-content:space-between;color:var(--text2)"><span>Pending Amount</span><span style="color:#f87171;font-weight:700">රු. ${pendingAmt.toFixed(2)}</span></div>
        </div>`:'<div style="font-size:13px;color:var(--green)">✓ සියලු ඇණවුම් settle කර ඇත.</div>'}
      </div>
      <div style="font-size:13px;color:var(--text3);text-align:center">Admin විසින් settle කළ විට balance update වේ.</div>`;
  } else b2bCard.style.display='none';
}

// ═══════════ SUPPORT ═══════════
async function submitComplaint(){
  const type=document.getElementById('c-type').value;
  const sub=document.getElementById('c-sub').value.trim();
  const txt=document.getElementById('c-txt').value.trim();
  if(!txt){toast('Message ලියන්න','error');return}
  await pa('complaints',{customerId:currentUser.id,customerName:currentUser.name,type,subject:sub,text:txt,date:new Date().toISOString(),read:false,reply:null});
  await pa('notifications',{type:'complaint',message:`💬 ${currentUser.name} ගෙන් ${type}: "${sub||txt.slice(0,40)}"`,date:new Date().toISOString(),read:false,target:'admin'});
  await loadAll();document.getElementById('c-sub').value='';document.getElementById('c-txt').value='';
  renderMyComp();toast('ඉදිරිපත් කළා!','success');
}
function renderMyComp(){
  const mine=S.complaints.filter(c=>c.customerId===currentUser.id);
  document.getElementById('my-comp').innerHTML=mine.length?[...mine].reverse().map(c=>`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span class="badge badge-${c.type==='complaint'?'red':c.type==='request'?'blue':'orange'}">${c.type}</span><span style="font-size:13px;color:var(--text3)">${new Date(c.date).toLocaleDateString()}</span></div>
    <div style="font-size:13px;color:var(--text2)">${c.subject?`<strong style="color:var(--text)">${c.subject}</strong><br>`:''} ${c.text}</div>
    ${c.reply?`<div style="background:var(--accent-dim);border:1px solid rgba(232,255,71,.15);border-radius:6px;padding:8px;font-size:13px;color:var(--accent);margin-top:6px">📩 Admin: ${c.reply}</div>`:`<div style="font-size:13px;color:var(--text3);margin-top:5px">⏳ Reply pending</div>`}
  </div>`).join(''):`<div style="color:var(--text3);font-size:13px">ඉදිරිපත් කළ ඉල්ලීම් නැත</div>`;
}

// ═══════════ NOTIFICATIONS ═══════════
function checkNotifs(){
  const mine=S.notifications.filter(n=>n.target==='customer'&&(!n.customerId||n.customerId===currentUser.id));
  document.getElementById('ndot').style.display=mine.some(n=>!n.read)?'block':'none';
}
function toggleNP(){const p=document.getElementById('np');p.classList.toggle('open');if(p.classList.contains('open'))renderNP()}
function renderNP(){
  const mine=S.notifications.filter(n=>n.target==='customer'&&(!n.customerId||n.customerId===currentUser.id));
  document.getElementById('np-items').innerHTML=[...mine].reverse().map(n=>{
    const dest=n.type==='order_status'?'orders':n.type==='reply'?'support':n.type==='reminder'?'orders':'';
    return `<div class="npi ${n.read?'':'unread'}" onclick="npNavTo('${dest}')" style="cursor:pointer">
      <div class="npi-t">${n.message}</div>
      <div class="npi-s">${new Date(n.date).toLocaleString()}${dest?` · <span style="color:var(--accent)">${dest==='orders'?'→ ඇණවුම්':dest==='support'?'→ සහාය':''}</span>`:''}</div>
    </div>`;
  }).join('')||`<div style="text-align:center;padding:24px;font-size:13px;color:var(--text3)">දැනුම්දීම් නැත</div>`;
}
function npNavTo(dest){
  if(!dest) return;
  document.getElementById('np').classList.remove('open');
  navTo(dest,null);
}
async function markNR(){
  const mine=S.notifications.filter(n=>n.target==='customer'&&(!n.customerId||n.customerId===currentUser.id)&&!n.read);
  for(const n of mine){n.read=true;await pu('notifications',n)}
  await loadAll();renderNP();checkNotifs();
}

// ═══════════ REMINDERS ═══════════
function scheduleReminders(){
  const today=new Date();const dom=today.getDay();
  if(currentUser.type==='retail'){
    const pd=currentUser.payday||25;const diff=today.getDate()-pd;
    if(diff>=0&&diff<=7) sendReminder('retail_pay',`🛒 Payday Reminder — සාමග්‍රී නැවත ඇණවුම් කරන්නද?`);
    if(diff===7) sendReminder('retail_7day',`🛒 7 Day Reminder — ඔබේ ඇණවුම submit කරන්නද?`);
  } else if(currentUser.type==='wholesale'){
    const zone=S.zones.find(z=>z.areas?.some(a=>a.toLowerCase()===currentUser.location?.toLowerCase()));
    if(zone?.days?.length){
      const dayNms=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      zone.days.forEach(d=>{const di=dayNms.indexOf(d);if(di<0)return;const diff=(di-today.getDay()+7)%7;if(diff<=3&&diff>=1)sendReminder(`ws_del_${d}`,`🚚 Delivery Reminder — ${d} ${zone.name} delivery ඇත. ඔබේ ඇණවුම place කරන්නද?`)});
    }
  }
}
async function sendReminder(key,msg){
  const today=new Date().toDateString();
  const sk=`r_${currentUser.id}_${key}_${today}`;
  if(sessionStorage.getItem(sk)) return;
  sessionStorage.setItem(sk,'1');
  await pa('notifications',{type:'reminder',message:msg,date:new Date().toISOString(),read:false,target:'customer',customerId:currentUser.id});
  setTimeout(()=>toast(msg,'warn'),3000);
  checkNotifs();
}

// ═══════════ NAV ═══════════
function navTo(page,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
  document.querySelectorAll('.nl').forEach(n=>n.classList.remove('act'));
  document.getElementById('page-'+page).classList.add('act');
  if(el) el.classList.add('act');
  else document.querySelectorAll('.nl').forEach(n=>{if(n.textContent.toLowerCase().includes(page.slice(0,3))) n.classList.add('act')});
  const actions={shop:renderShop,orders:renderOrders,wishlist:renderWishlist,account:renderAccount,support:renderMyComp};
  if(actions[page]) actions[page]();
}

// Poll for updates — also syncs currentUser from DB so admin changes (payment method, route, balance) reflect live
setInterval(async()=>{
  if(!db||!currentUser)return;
  await loadAll();
  // Refresh currentUser from DB so admin changes (pay method, route, balance deductions) take effect
  const fresh=S.customers.find(c=>c.id===currentUser.id);
  if(fresh){currentUser=fresh;sessionStorage.setItem('mUser',JSON.stringify(fresh));}
  renderTicker();checkNotifs();updateLoyaltyBanner();
},8000);

// ═══════════ UTILS ═══════════
function om(id){document.getElementById(id).classList.add('open')}
function cm(id){document.getElementById(id).classList.remove('open')}
document.querySelectorAll('.mo').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
function toast(msg,type='info'){const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;document.getElementById('tc').appendChild(el);setTimeout(()=>el.remove(),4500)}

// ═══════════ INIT ═══════════
(async()=>{
  await idb();
  S.products=await ga('products');S.customers=await ga('customers');S.zones=await ga('zones');S.tiers=await ga('tiers');S.routes=await ga('routes');const sets=await ga('settings');sets.forEach(s=>S.settings[s.key]=s.value);
  const saved=sessionStorage.getItem('mUser');
  if(saved){const u=JSON.parse(saved);const fresh=S.customers.find(c=>c.id===u.id);if(fresh){currentUser=fresh;selType=fresh.type;await startApp();return}}
})();

// ══ APP UPDATE ══
const APP_VERSION='2.1.0';
const APP_DATE='2026-03-16';
const APP_CHANGES=[
  '📱 Responsive layout — works on mobile, tablet, and desktop',
  '🖨 Print bill is now a single inline button',
  '📉 Branch stock usage tab with daily item-by-item breakdown',
  '📄 Branch B2B balance tracking and partial payments',
  '👤 Customer/Branch selectors moved to floating bottom-right panels',
  '🔡 Font sizes adjusted for better readability',
  '🛒 Cart drawer is now wider with more item space',
  'රු. symbol used throughout (was LKR)',
];
function openUpdateModal(){
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML=`<div style="background:var(--bg1);border-radius:14px;max-width:420px;width:95vw;padding:0;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.3)">
    <div style="background:linear-gradient(135deg,var(--accent),var(--teal));padding:18px 20px;color:#fff">
      <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:900">◈ MART — App Update</div>
      <div style="font-size:12px;opacity:.85;margin-top:3px">Version ${APP_VERSION} · ${APP_DATE}</div>
    </div>
    <div style="padding:16px 20px;max-height:55vh;overflow-y:auto">
      <div style="font-size:13px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">මෙම version-ේ features:</div>
      ${APP_CHANGES.map(ch=>`<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="flex-shrink:0">✓</span><span>${ch}</span></div>`).join('')}
    </div>
    <div style="padding:14px 20px;background:var(--bg2);display:flex;gap:8px">
      <button onclick="location.reload(true)" style="flex:1;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px;font-family:'Syne',sans-serif;font-weight:700;font-size:14px;cursor:pointer">🔄 Reload App</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;cursor:pointer">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
}
// ══ GLOBAL ENTER KEY HANDLER ══
document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter') return;
  const active = document.activeElement;
  const tag = active?.tagName;
  if(tag === 'TEXTAREA') return;
  if(tag === 'SELECT') return;

  // 1. Any open modal — click primary button
  const openModal = document.querySelector('.mo.open .modal, .mo.open > div');
  if(openModal){
    const primary = openModal.querySelector('.btn-primary:not([disabled])');
    if(primary){ e.preventDefault(); primary.click(); return; }
  }

  // 2. Auth screen — login or register
  const authScreen = document.getElementById('auth-screen');
  if(authScreen && authScreen.style.display !== 'none'){
    // Login step
    const loginBtn = document.getElementById('auth-login');
    if(loginBtn && loginBtn.style.display !== 'none'){
      e.preventDefault(); doLogin(); return;
    }
    // Register step
    const regBtn = document.getElementById('auth-reg');
    if(regBtn && regBtn.style.display !== 'none'){
      e.preventDefault(); doReg(); return;
    }
    // Step 1 (email check)
    const step1 = document.getElementById('auth-step1');
    if(step1 && step1.style.display !== 'none'){
      e.preventDefault();
      document.getElementById('auth-next-btn')?.click();
      return;
    }
  }

  // 3. Checkout modal open — place order
  const checkoutModal = document.getElementById('checkout-modal');
  if(checkoutModal?.classList.contains('open') && tag !== 'INPUT'){
    e.preventDefault();
    document.getElementById('pdm-confirm-btn')?.click() || placeOrder();
    return;
  }

  // 4. Cart open + has items — open checkout
  if(cart?.length > 0 && tag !== 'INPUT'){
    const checkoutBtn = document.getElementById('checkout-btn');
    if(checkoutBtn && !checkoutBtn.disabled){ e.preventDefault(); checkoutBtn.click(); return; }
  }
});

// ══ CROSS-DEVICE: Pull from Firebase ══
let _fbUrl=null;
async function getFbUrl(){
  if(_fbUrl) return _fbUrl;
  _fbUrl=localStorage.getItem('mart_fb_url')||null;
  return _fbUrl;
}
async function custSyncPull(){
  const url=await getFbUrl();
  if(!url){
    const u=prompt('Firebase Database URL ඇතුල් කරන්න:\n(eg: https://your-app-default-rtdb.firebaseio.com)');
    if(!u)return;
    localStorage.setItem('mart_fb_url',u.trim());
    _fbUrl=u.trim();
  }
  toast('Cloud-ෙන් download කරමින්...','info');
  try{
    const res=await fetch(`${_fbUrl.replace(/\/+$/,'')}/mart.json`);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if(!data||!data.products){toast('Cloud-ෙ data නොමැත','error');return;}
    const stores=['products','orders','customers','offers','bulkoffers','cashoffers',
      'complaints','zones','reminders','notifications','tiers','routes','branches','branchStock'];
    for(const k of stores){
      if(!data[k])continue;
      await new Promise((res,rej)=>{const t=db.transaction(k,'readwrite');t.objectStore(k).clear().onsuccess=res;t.onerror=rej});
      for(const item of data[k]){
        await new Promise((res,rej)=>{const t=db.transaction(k,'readwrite');const r=t.objectStore(k).put(item);r.onsuccess=res;r.onerror=rej});
      }
    }
    if(data.settings_kv){for(const {key,value} of data.settings_kv)await pu('settings',{key,value});}
    await loadAll();renderShop();
    toast('✓ Cloud data loaded!','success');
  }catch(err){toast('Download failed: '+err.message,'error');}
}
