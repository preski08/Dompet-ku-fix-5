/* ============================================================
   MARKETPLACE — Dompetku (Web3 Glass · full-screen · ramah APK/HP)
   - Hanya listing dari akun NYATA yang terdaftar (tanpa bot/demo)
   - Grid produk 2 kolom, kategori, pencarian, radius GPS
   - Detail produk, chat penjual, Google Maps, peta opsional
   ============================================================ */
(function () {
  'use strict';

  var MP_KEY = 'dk_marketplace';
  var myLat = null, myLng = null, gpsReady = false;
  var mapMP = null, markersMP = [], mapVisible = false;
  var curCat = 'semua';
  var searchTimer = null;

  var CATS = [
    { k: 'semua', l: 'Semua', e: '🛍️' },
    { k: 'kendaraan', l: 'Kendaraan', e: '🛵' },
    { k: 'elektronik', l: 'Elektronik', e: '📱' },
    { k: 'rumah', l: 'Rumah', e: '🪑' },
    { k: 'fashion', l: 'Fashion', e: '👕' },
    { k: 'lainnya', l: 'Lainnya', e: '📦' }
  ];

  function rd(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
  }
  function wr(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) {
      alert('Penyimpanan penuh. Hapus listing lama.');
      return false;
    }
  }
  function getUserId() {
    var s = rd('dk_session', null);
    return s && s.id ? s.id : null;
  }
  function realUser(id) {
    return rd('dk_users', []).some(function (u) { return u.id === id && !u.ghost; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtRp(n) {
    if (typeof window.dkFmtMoney === 'function') return window.dkFmtMoney(n);
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }
  function distText(km) {
    return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km';
  }
  function catEmoji(c) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].k === c) return CATS[i].e;
    return '📦';
  }

  /* ---------- DATA (hanya akun nyata, tanpa seed/bot) ---------- */
  function getListings() {
    var list = rd(MP_KEY, []);
    if (!Array.isArray(list)) list = [];
    var clean = list.filter(function (x) {
      return x && x.sellerId && String(x.id || '').indexOf('mp-demo') !== 0 && realUser(x.sellerId);
    });
    if (clean.length !== list.length) wr(MP_KEY, clean);
    return clean;
  }
  function saveListings(list) { return wr(MP_KEY, list); }

  /* ---------- CSS ---------- */
  function injectCSS() {
    if (document.getElementById('mp-styles')) return;
    var s = document.createElement('style');
    s.id = 'mp-styles';
    s.textContent = `
      /* ===== MARKETPLACE WEB3 GLASS ===== */
      .mp-overlay{display:none;position:fixed;inset:0;z-index:99997;
        background:#050508;color:#E9EDEF;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif}
      .mp-overlay.mp-open{display:block}
      .mp-overlay *{box-sizing:border-box}
      .mp-app{position:absolute;inset:0;display:flex;flex-direction:column;
        background:
          radial-gradient(ellipse 80% 50% at 20% -10%,rgba(124,58,237,.28),transparent 55%),
          radial-gradient(ellipse 60% 40% at 90% 20%,rgba(29,155,240,.18),transparent 50%),
          radial-gradient(ellipse 50% 35% at 50% 110%,rgba(16,185,129,.15),transparent 45%),
          #050508;
        overflow:hidden}
      .mp-app::before{
        content:'';position:absolute;inset:-40%;
        background:conic-gradient(from 0deg at 50% 50%,
          transparent 0deg,rgba(124,58,237,.12) 60deg,transparent 120deg,
          rgba(29,155,240,.1) 180deg,transparent 240deg,rgba(16,185,129,.08) 300deg,transparent 360deg);
        animation:mpSpin 28s linear infinite;pointer-events:none;z-index:0}
      @keyframes mpSpin{to{transform:rotate(360deg)}}
      .mp-app > *{position:relative;z-index:1}

      /* Top bar glass */
      .mp-top{display:flex;align-items:center;gap:10px;padding:12px 14px;
        padding-top:calc(12px + env(safe-area-inset-top));
        background:rgba(12,12,20,.55);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
        border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;
        box-shadow:0 8px 32px rgba(0,0,0,.35)}
      .mp-icon{width:42px;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.12);
        background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.03));
        color:#E9EDEF;font-size:18px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 4px 12px rgba(0,0,0,.25);
        transition:all .2s}
      .mp-icon:active{transform:scale(.95);background:rgba(124,58,237,.25)}
      .mp-icon.on{background:linear-gradient(135deg,rgba(124,58,237,.45),rgba(29,155,240,.35));
        border-color:rgba(167,139,250,.5);color:#fff;box-shadow:0 0 20px rgba(124,58,237,.4)}
      .mp-brand{flex:1;font-size:18px;font-weight:800;color:#fff;line-height:1.15;min-width:0;
        letter-spacing:-.3px;text-shadow:0 0 24px rgba(124,58,237,.4)}
      .mp-brand small{display:block;font-size:11px;font-weight:500;color:rgba(233,237,239,.55);margin-top:2px;
        letter-spacing:.3px}

      .mp-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 24px}

      /* Search glass */
      .mp-search{display:flex;align-items:center;gap:10px;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
        border-radius:18px;padding:0 16px;height:50px;
        backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 8px 24px rgba(0,0,0,.2)}
      .mp-search span{font-size:16px;opacity:.7}
      .mp-search input{flex:1;border:none;outline:none;background:none;font-size:14.5px;color:#fff;
        font-family:inherit;min-width:0}
      .mp-search input::placeholder{color:rgba(233,237,239,.4)}

      /* Chips */
      .mp-chips{display:flex;gap:8px;overflow-x:auto;padding:14px 0 6px;scrollbar-width:none}
      .mp-chips::-webkit-scrollbar{display:none}
      .mp-chip{flex-shrink:0;display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:22px;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(233,237,239,.75);
        font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;
        backdrop-filter:blur(10px);transition:all .2s}
      .mp-chip.on{background:linear-gradient(135deg,rgba(124,58,237,.5),rgba(29,155,240,.4));
        border-color:rgba(167,139,250,.55);color:#fff;
        box-shadow:0 0 18px rgba(124,58,237,.35),inset 0 1px 0 rgba(255,255,255,.2)}

      .mp-filter{display:flex;align-items:center;gap:8px;margin:12px 0}
      .mp-filter select{flex:1;min-width:0;height:40px;border-radius:12px;
        border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);
        color:#E9EDEF;padding:0 12px;font-size:13px;font-family:inherit;
        backdrop-filter:blur(10px)}
      .mp-gps{height:40px;padding:0 14px;border-radius:12px;
        border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.12);
        color:#34d399;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap;
        transition:all .2s}
      .mp-gps.ok{background:rgba(16,185,129,.25);box-shadow:0 0 16px rgba(16,185,129,.25)}
      .mp-count{font-size:12px;color:rgba(233,237,239,.5);margin:4px 2px 12px}

      .mp-map{width:100%;height:220px;border-radius:18px;overflow:hidden;margin-bottom:14px;
        border:1px solid rgba(255,255,255,.1);display:none;z-index:1;
        box-shadow:0 12px 40px rgba(0,0,0,.4)}
      .mp-map.show{display:block}

      /* Product grid glass cards */
      .mp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .mp-card{background:rgba(255,255,255,.05);border-radius:20px;overflow:hidden;
        border:1px solid rgba(255,255,255,.1);cursor:pointer;
        display:flex;flex-direction:column;
        backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
        box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08);
        transition:transform .18s,box-shadow .18s,border-color .18s}
      .mp-card:active{transform:scale(.975)}
      .mp-card:hover{border-color:rgba(124,58,237,.4);box-shadow:0 12px 40px rgba(124,58,237,.2)}
      .mp-img{position:relative;width:100%;aspect-ratio:1/1;
        background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(0,0,0,.2));
        display:flex;align-items:center;justify-content:center;font-size:44px;overflow:hidden}
      .mp-img img{width:100%;height:100%;object-fit:cover;display:block}
      .mp-cond{position:absolute;top:10px;left:10px;font-size:10px;font-weight:800;padding:4px 10px;
        border-radius:10px;letter-spacing:.4px;
        background:rgba(0,0,0,.55);backdrop-filter:blur(8px);color:#a7f3d0;
        border:1px solid rgba(255,255,255,.12)}
      .mp-cond.bekas{color:#fcd34d}
      .mp-cb{padding:12px 12px 14px;display:flex;flex-direction:column;gap:4px}
      .mp-cb h4{margin:0;font-size:13px;font-weight:600;color:#E9EDEF;line-height:1.3;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
      .mp-price{font-size:15px;font-weight:800;color:#34d399;text-shadow:0 0 12px rgba(16,185,129,.3)}
      .mp-meta{font-size:11px;color:rgba(233,237,239,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      .mp-empty{grid-column:1/-1;text-align:center;color:rgba(233,237,239,.5);font-size:13px;line-height:1.6;
        padding:52px 20px;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.12);
        border-radius:20px;backdrop-filter:blur(12px)}
      .mp-empty .ei{font-size:48px;margin-bottom:12px;opacity:.6}

      /* Bottom nav glass */
      .mp-nav{display:flex;background:rgba(10,10,18,.7);border-top:1px solid rgba(255,255,255,.08);
        flex-shrink:0;padding-bottom:env(safe-area-inset-bottom);
        backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
        box-shadow:0 -8px 32px rgba(0,0,0,.4)}
      .mp-nav button{flex:1;border:none;background:none;padding:10px 4px 9px;color:rgba(233,237,239,.45);
        font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;
        display:flex;flex-direction:column;align-items:center;gap:3px;transition:color .15s}
      .mp-nav button span{font-size:20px;line-height:1}
      .mp-nav button.on{color:#a78bfa;text-shadow:0 0 16px rgba(167,139,250,.5)}

      .mp-hidden{display:none!important}

      /* Sell form glass */
      .mp-form{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
        border-radius:22px;padding:18px;
        backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        box-shadow:0 12px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08)}
      .mp-form h3{margin:0 0 16px;font-size:17px;color:#fff;font-weight:800}
      .mp-field{margin-bottom:14px}
      .mp-field label{display:block;margin-bottom:6px;font-size:11px;color:rgba(233,237,239,.5);
        font-weight:700;text-transform:uppercase;letter-spacing:.6px}
      .mp-field input,.mp-field textarea,.mp-field select{width:100%;padding:13px 14px;border-radius:14px;
        border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.35);color:#fff;
        font-family:inherit;font-size:14px;outline:none}
      .mp-field input:focus,.mp-field textarea:focus,.mp-field select:focus{
        border-color:rgba(124,58,237,.55);background:rgba(0,0,0,.45);
        box-shadow:0 0 0 3px rgba(124,58,237,.15)}
      .mp-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .mp-photo-box{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;
        height:140px;border:2px dashed rgba(255,255,255,.15);border-radius:16px;
        background:rgba(255,255,255,.04);color:rgba(233,237,239,.45);font-size:13px;cursor:pointer;overflow:hidden}
      .mp-photo-box img{width:100%;height:100%;object-fit:cover}

      .mp-btn{width:100%;padding:15px;border:none;border-radius:16px;font-weight:700;font-size:14.5px;
        cursor:pointer;font-family:inherit;transition:all .15s}
      .mp-btn-pri{background:linear-gradient(135deg,#7C3AED,#3B82F6);color:#fff;
        box-shadow:0 8px 28px rgba(124,58,237,.4)}
      .mp-btn-pri:active{opacity:.9;transform:scale(.98)}
      .mp-btn-sec{background:rgba(255,255,255,.08);color:#E9EDEF;border:1px solid rgba(255,255,255,.12)}
      .mp-btn-del{background:rgba(244,33,46,.15);color:#f87171;border:1px solid rgba(244,33,46,.25)}
      .mp-btn-sm{width:auto;padding:10px 14px;font-size:12.5px}

      .mp-mine{display:flex;gap:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
        border-radius:18px;padding:12px;margin-bottom:10px;align-items:center;
        backdrop-filter:blur(14px)}
      .mp-mine .th{width:72px;height:72px;border-radius:14px;background:rgba(255,255,255,.06);
        overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:30px;flex-shrink:0}
      .mp-mine .th img{width:100%;height:100%;object-fit:cover}
      .mp-mine .in{flex:1;min-width:0}
      .mp-mine h4{margin:0 0 3px;font-size:14px;color:#E9EDEF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      /* Detail sheet glass */
      .mp-sheet-bg{position:absolute;inset:0;background:rgba(0,0,0,.65);display:none;z-index:5;
        align-items:flex-end;backdrop-filter:blur(6px)}
      .mp-sheet-bg.show{display:flex}
      .mp-sheet{width:100%;max-height:90%;overflow-y:auto;
        background:linear-gradient(180deg,rgba(22,22,36,.95),rgba(10,10,18,.98));
        border-radius:26px 26px 0 0;border:1px solid rgba(255,255,255,.1);
        padding-bottom:calc(16px + env(safe-area-inset-bottom));
        animation:mpUp .25s ease-out;
        box-shadow:0 -20px 60px rgba(0,0,0,.5)}
      @keyframes mpUp{from{transform:translateY(50px);opacity:.5}to{transform:none;opacity:1}}
      .mp-sheet .big{width:100%;aspect-ratio:4/3;
        background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(0,0,0,.3));
        display:flex;align-items:center;justify-content:center;font-size:80px;overflow:hidden;position:relative}
      .mp-sheet .big img{width:100%;height:100%;object-fit:cover}
      .mp-sheet .xx{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;
        border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.5);font-size:18px;cursor:pointer;
        color:#fff;backdrop-filter:blur(10px);box-shadow:0 4px 16px rgba(0,0,0,.3)}
      .mp-sheet .bd{padding:18px 18px 6px}
      .mp-sheet h2{margin:0 0 6px;font-size:19px;font-weight:700;color:#fff}
      .mp-sheet .pr{font-size:24px;font-weight:800;color:#34d399;margin-bottom:12px;
        text-shadow:0 0 16px rgba(16,185,129,.35)}
      .mp-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
      .mp-tag{font-size:11px;font-weight:700;padding:5px 12px;border-radius:12px;
        background:rgba(255,255,255,.08);color:rgba(233,237,239,.8);border:1px solid rgba(255,255,255,.08)}
      .mp-sheet p.ds{margin:0 0 14px;font-size:13.5px;color:rgba(233,237,239,.7);line-height:1.55;white-space:pre-wrap}
      .mp-seller{display:flex;align-items:center;gap:12px;padding:14px;
        background:rgba(255,255,255,.05);border-radius:16px;margin-bottom:16px;
        border:1px solid rgba(255,255,255,.08)}
      .mp-seller .av{width:42px;height:42px;border-radius:50%;
        background:linear-gradient(135deg,#7C3AED,#3B82F6);color:#fff;font-weight:800;
        display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(124,58,237,.4)}
      .mp-seller b{display:block;font-size:14px;color:#fff}
      .mp-seller small{color:rgba(233,237,239,.45);font-size:12px}
      .mp-acts{display:flex;gap:10px;padding:0 18px 8px}
      .mp-acts .mp-btn{flex:1}
    `;
    document.head.appendChild(s);
  }

  function injectLeaflet(cb) {
    if (window.L && window.L.map) { cb(); return; }
    if (!document.getElementById('mp-leaflet-css')) {
      var l = document.createElement('link');
      l.id = 'mp-leaflet-css';
      l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = cb;
    s.onerror = function () { console.warn('[MP] Leaflet gagal'); };
    document.head.appendChild(s);
  }

  /* ---------- UI ---------- */
  function injectModal() {
    if (document.getElementById('mpOverlay')) return;
    var chips = CATS.map(function (c) {
      return '<button type="button" class="mp-chip' + (c.k === 'semua' ? ' on' : '') + '" data-cat="' + c.k + '">' +
        c.e + ' ' + c.l + '</button>';
    }).join('');
    var catOpts = CATS.filter(function (c) { return c.k !== 'semua'; }).map(function (c) {
      return '<option value="' + c.k + '">' + c.l + '</option>';
    }).join('');

    var div = document.createElement('div');
    div.innerHTML =
      '<div class="mp-overlay" id="mpOverlay"><div class="mp-app">' +
        '<header class="mp-top">' +
          '<button type="button" class="mp-icon" onclick="MP_close()" aria-label="Tutup">←</button>' +
          '<div class="mp-brand">◈ Marketplace<small>Web3 · Jual · Beli · Terdekat</small></div>' +
          '<button type="button" class="mp-icon" id="mpMapToggle" onclick="MP_toggleMap()" aria-label="Peta">🗺️</button>' +
        '</header>' +
        '<div class="mp-scroll" id="mpScroll">' +
          '<section id="mpBrowse">' +
            '<div class="mp-search"><span>🔍</span>' +
              '<input type="search" id="mpSearch" placeholder="Cari barang: motor, hp, kursi…" autocomplete="off"></div>' +
            '<div class="mp-chips" id="mpChips">' + chips + '</div>' +
            '<div class="mp-filter">' +
              '<select id="mpRadius">' +
                '<option value="0" selected>Semua jarak</option>' +
                '<option value="5">≤ 5 km</option><option value="10">≤ 10 km</option>' +
                '<option value="25">≤ 25 km</option><option value="50">≤ 50 km</option>' +
                '<option value="100">≤ 100 km</option>' +
              '</select>' +
              '<button type="button" class="mp-gps" id="mpGpsBtn" onclick="MP_gps()">📍 GPS</button>' +
            '</div>' +
            '<div id="mpMap" class="mp-map"></div>' +
            '<div class="mp-count" id="mpCount"></div>' +
            '<div class="mp-grid" id="mpResults"></div>' +
          '</section>' +
          '<section id="mpSell" class="mp-hidden">' +
            '<div class="mp-form">' +
              '<h3>Pasang Iklan</h3>' +
              '<div class="mp-field"><label>Foto barang</label>' +
                '<label class="mp-photo-box" id="mpPhotoBox" for="mpPhoto"><span style="font-size:30px">📷</span>Ketuk untuk pilih foto</label>' +
                '<input type="file" id="mpPhoto" accept="image/*" style="display:none">' +
              '</div>' +
              '<div class="mp-field"><label>Judul barang</label><input type="text" id="mpTitle" placeholder="Contoh: Motor Beat 2020" maxlength="80"></div>' +
              '<div class="mp-row2">' +
                '<div class="mp-field"><label>Harga (Rp)</label><input type="number" id="mpPrice" placeholder="0" inputmode="numeric"></div>' +
                '<div class="mp-field"><label>Kondisi</label><select id="mpCond"><option value="baru">Baru</option><option value="bekas">Bekas</option></select></div>' +
              '</div>' +
              '<div class="mp-field"><label>Kategori</label><select id="mpCat">' + catOpts + '</select></div>' +
              '<div class="mp-field"><label>Deskripsi</label><textarea id="mpDesc" rows="3" placeholder="Kondisi, kelengkapan, alasan jual…"></textarea></div>' +
              '<div class="mp-field"><label>Alamat / lokasi</label>' +
                '<input type="text" id="mpAddress" placeholder="Kelurahan / jalan (opsional)">' +
                '<button type="button" class="mp-btn mp-btn-sec mp-btn-sm" style="margin-top:8px" id="mpGpsSellBtn" onclick="MP_gpsSell()">📍 Pakai Lokasi GPS Saya</button>' +
              '</div>' +
              '<button class="mp-btn mp-btn-pri" type="button" onclick="MP_publish()">Pasang Iklan</button>' +
            '</div>' +
          '</section>' +
          '<section id="mpMine" class="mp-hidden"><div id="mpMineList"></div></section>' +
        '</div>' +
        '<nav class="mp-nav">' +
          '<button type="button" id="mpTabBrowse" class="on" onclick="MP_tab(\'browse\')"><span>🏠</span>Jelajah</button>' +
          '<button type="button" id="mpTabSell" onclick="MP_tab(\'sell\')"><span>➕</span>Jual</button>' +
          '<button type="button" id="mpTabMine" onclick="MP_tab(\'mine\')"><span>📋</span>Iklan Saya</button>' +
        '</nav>' +
        '<div class="mp-sheet-bg" id="mpSheetBg"><div class="mp-sheet" id="mpSheet"></div></div>' +
      '</div></div>';
    document.body.appendChild(div.firstChild);

    document.getElementById('mpChips').addEventListener('click', function (e) {
      var b = e.target.closest('.mp-chip');
      if (!b) return;
      curCat = b.getAttribute('data-cat');
      this.querySelectorAll('.mp-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
      search();
    });
    document.getElementById('mpSearch').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(search, 200);
    });
    document.getElementById('mpRadius').addEventListener('change', search);
    document.getElementById('mpSheetBg').addEventListener('click', function (e) {
      if (e.target === this) closeSheet();
    });

    document.getElementById('mpPhoto').onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { alert('Pilih file gambar.'); this.value = ''; return; }
      compressImg(f, 900, 0.72).then(function (d) {
        var box = document.getElementById('mpPhotoBox');
        box.innerHTML = '<img src="' + d + '" alt="">';
        box.dataset.dataurl = d;
      }).catch(function (err) { alert('Gagal baca foto: ' + (err.message || err)); });
    };
  }

  function compressImg(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Gagal baca file')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Format tidak didukung')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { reject(e); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function tab(name) {
    ['browse', 'sell', 'mine'].forEach(function (n) {
      var sec = document.getElementById('mp' + n.charAt(0).toUpperCase() + n.slice(1));
      var btn = document.getElementById('mpTab' + n.charAt(0).toUpperCase() + n.slice(1));
      if (sec) sec.classList.toggle('mp-hidden', n !== name);
      if (btn) btn.classList.toggle('on', n === name);
    });
    var sc = document.getElementById('mpScroll');
    if (sc) sc.scrollTop = 0;
    document.getElementById('mpMapToggle').style.display = name === 'browse' ? '' : 'none';
    if (name === 'browse') search();
    if (name === 'mine') renderMine();
  }

  /* ---------- MAP (opsional) ---------- */
  function toggleMap() {
    mapVisible = !mapVisible;
    var el = document.getElementById('mpMap');
    document.getElementById('mpMapToggle').classList.toggle('on', mapVisible);
    el.classList.toggle('show', mapVisible);
    if (mapVisible) {
      injectLeaflet(function () {
        setTimeout(function () { initMap(); search(); }, 120);
      });
    }
  }
  function initMap() {
    if (!window.L) return;
    var el = document.getElementById('mpMap');
    if (!el) return;
    var lat = gpsReady ? myLat : -2.21, lng = gpsReady ? myLng : 113.92;
    if (!mapMP) {
      mapMP = L.map('mpMap').setView([lat, lng], gpsReady ? 13 : 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapMP);
    } else {
      mapMP.invalidateSize();
      if (gpsReady) mapMP.setView([lat, lng], 13);
    }
  }

  function requestGPS(cb) {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung GPS.');
      if (cb) cb(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      gpsReady = true;
      var b = document.getElementById('mpGpsBtn');
      if (b) { b.classList.add('ok'); b.textContent = '📍 GPS aktif'; }
      if (cb) cb(true);
    }, function (err) {
      alert('Gagal GPS: ' + err.message + '\nIzinkan lokasi di browser / pengaturan HP.');
      if (cb) cb(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  /* ---------- BROWSE ---------- */
  function search() {
    var results = document.getElementById('mpResults');
    if (!results) return;
    var q = (document.getElementById('mpSearch').value || '').toLowerCase().trim();
    var radius = parseFloat(document.getElementById('mpRadius').value) || 0;
    var count = document.getElementById('mpCount');

    markersMP.forEach(function (m) { if (mapMP) mapMP.removeLayer(m); });
    markersMP = [];

    var filtered = getListings().filter(function (item) {
      if (curCat !== 'semua' && item.category !== curCat) return false;
      item._dist = null;
      if (gpsReady && typeof item.lat === 'number' && typeof item.lng === 'number') {
        item._dist = haversineKm(myLat, myLng, item.lat, item.lng);
      }
      if (radius > 0) {
        if (item._dist == null || item._dist > radius) return false;
      }
      var hay = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.category || '') + ' ' +
        (item.address || '') + ' ' + (item.sellerId || '')).toLowerCase();
      return !q || hay.indexOf(q) !== -1;
    });
    filtered.sort(function (a, b) {
      if (a._dist != null && b._dist != null) return a._dist - b._dist;
      return (b.created || 0) - (a.created || 0);
    });

    if (!filtered.length) {
      count.textContent = '';
      var total = getListings().length;
      results.innerHTML = '<div class="mp-empty"><div class="ei">🛍️</div>' +
        (total
          ? 'Tidak ada barang yang cocok.<br>Coba ganti kata kunci, kategori, atau jarak.'
          : '<b>Belum ada barang dijual.</b><br>Jadilah yang pertama — buka tab <b>Jual</b> di bawah.') +
        '</div>';
      return;
    }

    count.textContent = filtered.length + ' barang' + (gpsReady ? ' · diurutkan terdekat' : ' · terbaru');
    results.innerHTML = '';
    filtered.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'mp-card';
      var img = (item.photos && item.photos[0])
        ? '<img src="' + item.photos[0] + '" alt="" loading="lazy">'
        : catEmoji(item.category);
      var loc = item._dist != null ? distText(item._dist) : (item.address || 'Lokasi belum diatur');
      card.innerHTML =
        '<div class="mp-img">' + img +
          '<span class="mp-cond ' + esc(item.condition || 'bekas') + '">' +
          (item.condition === 'baru' ? 'BARU' : 'BEKAS') + '</span></div>' +
        '<div class="mp-cb">' +
          '<h4>' + esc(item.title) + '</h4>' +
          '<div class="mp-price">' + fmtRp(item.price) + '</div>' +
          '<div class="mp-meta">📍 ' + esc(loc) + '</div>' +
          '<div class="mp-meta">oleh ' + esc(item.sellerId) + '</div>' +
        '</div>';
      card.onclick = function () { openSheet(item); };
      results.appendChild(card);

      if (mapMP && mapVisible && window.L && typeof item.lat === 'number' && typeof item.lng === 'number') {
        var mk = L.marker([item.lat, item.lng]).addTo(mapMP)
          .bindPopup('<b>' + esc(item.title) + '</b><br>' + fmtRp(item.price));
        markersMP.push(mk);
      }
    });
    if (markersMP.length && mapMP) {
      mapMP.invalidateSize();
      mapMP.fitBounds(new L.featureGroup(markersMP).getBounds().pad(0.25));
    }
  }

  /* ---------- DETAIL ---------- */
  function openSheet(item) {
    var me = getUserId();
    var mine = item.sellerId === me;
    var img = (item.photos && item.photos[0]) ? '<img src="' + item.photos[0] + '" alt="">' : catEmoji(item.category);
    var dist = '';
    if (gpsReady && typeof item.lat === 'number') dist = distText(haversineKm(myLat, myLng, item.lat, item.lng)) + ' dari Anda';
    var hasLoc = typeof item.lat === 'number' && typeof item.lng === 'number';
    var sh = document.getElementById('mpSheet');
    sh.innerHTML =
      '<div class="big">' + img + '<button type="button" class="xx" id="mpSheetX">✕</button></div>' +
      '<div class="bd">' +
        '<h2>' + esc(item.title) + '</h2>' +
        '<div class="pr">' + fmtRp(item.price) + '</div>' +
        '<div class="mp-tags">' +
          '<span class="mp-tag">' + (item.condition === 'baru' ? 'Baru' : 'Bekas') + '</span>' +
          '<span class="mp-tag">' + esc(item.category || 'lainnya') + '</span>' +
          (dist ? '<span class="mp-tag">📍 ' + esc(dist) + '</span>' : '') +
          (item.address ? '<span class="mp-tag">' + esc(item.address) + '</span>' : '') +
        '</div>' +
        (item.desc ? '<p class="ds">' + esc(item.desc) + '</p>' : '') +
        '<div class="mp-seller"><div class="av">' + esc(item.sellerId.charAt(0).toUpperCase()) + '</div>' +
          '<div><b>' + esc(item.sellerId) + '</b><small>Penjual · ' + new Date(item.created || Date.now()).toLocaleDateString('id-ID') + '</small></div></div>' +
      '</div>' +
      '<div class="mp-acts">' +
        (mine
          ? '<button type="button" class="mp-btn mp-btn-sec" id="mpShChat" disabled>Ini iklan Anda</button>'
          : '<button type="button" class="mp-btn mp-btn-pri" id="mpShChat">💬 Chat Penjual</button>') +
        (hasLoc ? '<button type="button" class="mp-btn mp-btn-sec" id="mpShMap">🗺️ Maps</button>' : '') +
      '</div>';
    document.getElementById('mpSheetBg').classList.add('show');
    document.getElementById('mpSheetX').onclick = closeSheet;
    var c = document.getElementById('mpShChat');
    if (c && !mine) c.onclick = function () { chatSeller(item.sellerId); };
    var m = document.getElementById('mpShMap');
    if (m) m.onclick = function () {
      window.open('https://www.google.com/maps?q=' + item.lat + ',' + item.lng, '_blank', 'noopener');
    };
  }
  function closeSheet() {
    var bg = document.getElementById('mpSheetBg');
    if (bg) bg.classList.remove('show');
  }

  function chatSeller(uid) {
    var me = getUserId();
    if (!me) { alert('Login dulu'); return; }
    if (uid === me) { alert('Ini listing Anda sendiri'); return; }
    if (!realUser(uid)) { alert('Akun penjual tidak ditemukan.'); return; }
    try {
      var all = rd('dk_connections', {});
      if (!all[me]) all[me] = {};
      if (!all[me][uid]) {
        all[me][uid] = { ts: Date.now(), fee: 0, source: 'marketplace' };
        if (!all[uid]) all[uid] = {};
        all[uid][me] = { ts: Date.now(), fee: 0, from: me, source: 'marketplace' };
        wr('dk_connections', all);
      }
    } catch (e) {}
    closeSheet();
    closeMP();
    if (typeof window.dkChatOpenRoom === 'function' && typeof window.dkChatOpen === 'function') {
      window.dkChatOpen();
      window.dkChatOpenRoom(uid);
    } else if (typeof window.dkChatOpen === 'function') {
      window.dkChatOpen();
    } else {
      alert('Buka Chat, ketik ID: ' + uid);
    }
  }

  /* ---------- JUAL ---------- */
  function publish() {
    var me = getUserId();
    if (!me) { alert('Login dulu'); return; }
    var title = (document.getElementById('mpTitle').value || '').trim();
    var price = parseInt(document.getElementById('mpPrice').value, 10) || 0;
    if (!title) { alert('Isi judul barang'); return; }
    if (price < 1) { alert('Isi harga'); return; }

    var box = document.getElementById('mpPhotoBox');
    var photo = (box && box.dataset.dataurl) || null;
    var item = {
      id: 'mp-' + Date.now() + Math.random().toString(36).slice(2, 5),
      sellerId: me,
      title: title,
      price: price,
      desc: (document.getElementById('mpDesc').value || '').trim(),
      condition: document.getElementById('mpCond').value || 'bekas',
      category: document.getElementById('mpCat').value || 'lainnya',
      photos: photo ? [photo] : [],
      lat: gpsReady ? myLat : null,
      lng: gpsReady ? myLng : null,
      address: (document.getElementById('mpAddress').value || '').trim(),
      created: Date.now()
    };
    var list = getListings();
    list.unshift(item);
    if (!saveListings(list)) return;

    document.getElementById('mpTitle').value = '';
    document.getElementById('mpPrice').value = '';
    document.getElementById('mpDesc').value = '';
    document.getElementById('mpAddress').value = '';
    box.innerHTML = '<span style="font-size:30px">📷</span>Ketuk untuk pilih foto';
    delete box.dataset.dataurl;
    document.getElementById('mpPhoto').value = '';
    alert('✅ Iklan dipasang!' + (gpsReady ? '' : '\nTips: aktifkan GPS agar pembeli terdekat bisa menemukan barang Anda.'));
    tab('browse');
  }

  function renderMine() {
    var me = getUserId();
    var box = document.getElementById('mpMineList');
    if (!box) return;
    var list = getListings().filter(function (x) { return x.sellerId === me; });
    if (!list.length) {
      box.innerHTML = '<div class="mp-empty" style="padding:48px 20px;background:#fff;border:1px dashed #d9dfd6;border-radius:16px;text-align:center;color:#7a857e;font-size:13px">' +
        '<div style="font-size:44px;margin-bottom:10px">📋</div>Belum ada iklan.<br>Buka tab <b>Jual</b> untuk memasang.</div>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (item) {
      var el = document.createElement('div');
      el.className = 'mp-mine';
      el.innerHTML =
        '<div class="th">' + ((item.photos && item.photos[0]) ? '<img src="' + item.photos[0] + '" alt="">' : catEmoji(item.category)) + '</div>' +
        '<div class="in"><h4>' + esc(item.title) + '</h4>' +
          '<div class="mp-price" style="font-size:14px">' + fmtRp(item.price) + '</div>' +
          '<div class="mp-meta">' + esc(item.condition) + ' · ' + esc(item.category) + '</div></div>' +
        '<button type="button" class="mp-btn mp-btn-del mp-btn-sm" data-id="' + esc(item.id) + '">Hapus</button>';
      box.appendChild(el);
    });
    box.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () {
        if (!confirm('Hapus iklan ini?')) return;
        var id = this.getAttribute('data-id');
        saveListings(getListings().filter(function (x) { return x.id !== id; }));
        renderMine();
      };
    });
  }

  /* ---------- OPEN / CLOSE ---------- */
  function openMP() {
    if (!getUserId()) { alert('Login dulu'); return; }
    injectCSS();
    injectModal();
    document.getElementById('mpOverlay').classList.add('mp-open');
    document.body.style.overflow = 'hidden';
    tab('browse');
    if (!gpsReady) requestGPSQuiet();
  }
  function requestGPSQuiet() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      gpsReady = true;
      var b = document.getElementById('mpGpsBtn');
      if (b) { b.classList.add('ok'); b.textContent = '📍 GPS aktif'; }
      search();
    }, function () {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
  }
  function closeMP() {
    closeSheet();
    var el = document.getElementById('mpOverlay');
    if (el) el.classList.remove('mp-open');
    document.body.style.overflow = '';
  }

  window.MP_open = openMP;
  window.MP_close = closeMP;
  window.MP_tab = tab;
  window.MP_search = search;
  window.MP_publish = publish;
  window.MP_toggleMap = toggleMap;
  window.MP_gps = function () {
    requestGPS(function (ok) {
      if (ok) {
        if (mapMP) mapMP.setView([myLat, myLng], 14);
        search();
      }
    });
  };
  window.MP_gpsSell = function () {
    requestGPS(function (ok) {
      if (ok) {
        var b = document.getElementById('mpGpsSellBtn');
        if (b) b.textContent = '✅ Lokasi GPS tersimpan';
      }
    });
  };

  console.log('[Marketplace] Web3 Glass · hanya akun nyata ✅');
})();
