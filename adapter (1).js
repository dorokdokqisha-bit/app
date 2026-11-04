/* Penghubung aplikasi Dorokdok Qisha ke Firebase (login + Firestore).
   Aplikasi memanggil claude.use('db' | 'user' | 'downloads'); file ini menyediakannya. */
(function () {
  var C = window.DQ_CONFIG || {};
  var low = function (a) { return (a || []).map(function (e) { return String(e).trim().toLowerCase(); }); };
  var OWN = low(C.pengelola), INV = low(C.investor);
  firebase.initializeApp(C.firebase);
  var auth = firebase.auth(), fs = firebase.firestore();
  try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

  var css =
    '.dq-gate{position:fixed;inset:0;z-index:70;display:grid;place-items:center;overflow:auto;padding:24px 16px;background:#2A0D10;font:15px/1.5 "Source Sans 3",system-ui,sans-serif;color:#1D1819}' +
    '.dq-card{width:min(400px,100%);background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}' +
    '.dq-card header{padding:28px 28px 20px;border-bottom:1px solid #E3DFDD;display:grid;justify-items:center;gap:12px;text-align:center}' +
    '.dq-card header img{height:64px;width:auto}' +
    '.dq-card header span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#786F71;font-weight:700}' +
    '.dq-card h1{margin:0;font:600 21px "Source Serif 4",Georgia,serif}' +
    '.dq-card form,.dq-card .dq-alt{padding:22px 28px;display:grid;gap:14px}' +
    '.dq-card label{display:grid;gap:5px;font-size:12.5px;font-weight:600;color:#4A4244}' +
    '.dq-card input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #CCC5C3;border-radius:4px;font:15px inherit;color:#1D1819;background:#fff}' +
    '.dq-card input:focus{outline:none;border-color:#5E161A;box-shadow:0 0 0 3px rgba(94,22,26,.14)}' +
    '.dq-btn{height:42px;border-radius:4px;border:1px solid #5E161A;background:#5E161A;color:#fff;font:600 15px inherit;cursor:pointer}' +
    '.dq-btn.ghost{background:#fff;color:#1D1819;border-color:#CCC5C3}' +
    '.dq-btn[disabled]{opacity:.6}' +
    '.dq-msg{font-size:13px;padding:10px 12px;border-radius:4px;background:#FAEAE8;color:#A3271F;border:1px solid rgba(163,39,31,.25)}' +
    '.dq-msg.info{background:#F6EFE0;color:#6E5017;border-color:rgba(164,122,46,.3)}' +
    '.dq-row{display:flex;justify-content:space-between;align-items:center;font-size:13px}' +
    '.dq-row a{color:#5E161A;font-weight:600}' +
    '.dq-sep{display:flex;align-items:center;gap:10px;color:#786F71;font-size:12px}.dq-sep:before,.dq-sep:after{content:"";flex:1;height:1px;background:#E3DFDD}' +
    '.dq-card footer{padding:14px 28px;background:#F8F7F6;border-top:1px solid #E3DFDD;font-size:12px;color:#786F71;text-align:center}' +
    '.dq-copy{margin-top:16px;color:rgba(255,255,255,.55);font-size:12px;text-align:center}';

  function gate(inner) {
    var g = document.querySelector('.dq-gate');
    if (!g) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      g = document.createElement('div'); g.className = 'dq-gate'; document.body.appendChild(g); }
    g.innerHTML = '<div><div class="dq-card"><header><img src="icon-512.png" alt="Dorokdok Qisha"><span>Sistem Informasi Usaha</span><h1>Masuk ke Dorokdok Qisha</h1></header>' + inner +
      '<footer>Akses terbatas untuk pengelola dan investor terdaftar.</footer></div><div class="dq-copy">© 2026 Dorokdok Qisha · Kulit Sapi Asli</div></div>';
    return g;
  }

  var PESAN = {
    'auth/invalid-credential': 'Email atau kata sandi salah.',
    'auth/wrong-password': 'Kata sandi salah.',
    'auth/user-not-found': 'Email ini belum dibuat di Firebase › Authentication › Users.',
    'auth/invalid-email': 'Format email tidak benar.',
    'auth/missing-password': 'Isi kata sandi.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
    'auth/operation-not-allowed': 'Metode masuk ini belum diaktifkan di Firebase › Authentication › Sign-in method.',
    'auth/unauthorized-domain': 'Domain website belum didaftarkan di Firebase › Authentication › Settings › Authorized domains.',
    'auth/popup-blocked': 'Pop-up diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi.',
    'auth/popup-closed-by-user': 'Jendela Google tertutup sebelum selesai.',
    'auth/network-request-failed': 'Koneksi internet terputus. Periksa sinyal lalu coba lagi.'
  };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function login(err, info) {
    var msg = err ? '<div class="dq-msg">' + esc(PESAN[err.code] || ('Gagal masuk (' + (err.code || err.message) + ').')) + '</div>'
      : info ? '<div class="dq-msg info">' + esc(info) + '</div>' : '';
    var last = ''; try { last = localStorage.getItem('dq-email') || ''; } catch (e) {}
    var g = gate('<form id="dq-form" novalidate>' + msg +
      '<label>Email<input id="dq-email" type="email" autocomplete="username" inputmode="email" value="' + esc(last) + '"></label>' +
      '<label>Kata sandi<input id="dq-pass" type="password" autocomplete="current-password"></label>' +
      '<div class="dq-row"><span></span><a href="#" id="dq-lupa">Lupa kata sandi?</a></div>' +
      '<button class="dq-btn" type="submit">Masuk</button>' +
      '<div class="dq-sep">atau</div><button class="dq-btn ghost" type="button" id="dq-google">Masuk dengan Google</button></form>');
    var f = g.querySelector('#dq-form');
    (last ? g.querySelector('#dq-pass') : g.querySelector('#dq-email')).focus();
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var em = g.querySelector('#dq-email').value.trim().toLowerCase(), pw = g.querySelector('#dq-pass').value;
      try { localStorage.setItem('dq-email', em); } catch (e) {}
      var b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Memeriksa…';
      auth.signInWithEmailAndPassword(em, pw).catch(function (e) { login(e); });
    };
    g.querySelector('#dq-lupa').onclick = function (ev) {
      ev.preventDefault();
      var em = g.querySelector('#dq-email').value.trim();
      if (!em) return login(null, 'Isi email terlebih dahulu, lalu pilih "Lupa kata sandi?".');
      auth.sendPasswordResetEmail(em).then(function () { login(null, 'Tautan untuk mengatur ulang kata sandi telah dikirim ke ' + em + '. Periksa kotak masuk atau folder spam.'); })
        .catch(function (e) { login(e); });
    };
    g.querySelector('#dq-google').onclick = function () {
      var p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
      auth.signInWithPopup(p).catch(function (e) { login(e); });
    };
  }
  function tolak(u) {
    var g = gate('<div class="dq-alt"><div class="dq-msg">Akun ' + esc(u.email) + ' belum terdaftar sebagai pengelola atau investor.</div><button class="dq-btn ghost" id="dq-out">Masuk dengan akun lain</button></div>');
    g.querySelector('#dq-out').onclick = function () { auth.signOut(); };
  }

  var ready = new Promise(function (res) {
    var whenBody = function (f) { document.body ? f() : document.addEventListener('DOMContentLoaded', f); };
    auth.onAuthStateChanged(function (u) {
      whenBody(function () {
        if (!u) return login();
        var e = (u.email || '').toLowerCase();
        if (OWN.indexOf(e) < 0 && INV.indexOf(e) < 0) return tolak(u);
        var g = document.querySelector('.dq-gate'); if (g) g.remove();
        var box = document.getElementById('userbox');
        if (box) {
          box.innerHTML = '<span>Masuk sebagai</span><b>' + esc(u.email) + '</b>';
          var b = document.createElement('button'); b.textContent = 'Keluar';
          b.onclick = function () { auth.signOut().then(function () { location.reload(); }); };
          box.appendChild(b);
        }
        res(u);
      });
    });
  });

  var api = {
    db: function () { return ready.then(function () { return { doc: function (p) { return fs.doc(p); }, collection: function (p) { return fs.collection(p); } }; }); },
    user: function () {
      return ready.then(function (u) {
        var e = (u.email || '').toLowerCase(), own = OWN.indexOf(e) >= 0;
        return { canEdit: function () { return Promise.resolve(own); }, isOwner: function () { return Promise.resolve(own); },
          me: function () { return Promise.resolve({ id: u.uid, name: u.displayName || '', email: u.email }); } };
      });
    },
    downloads: function () {
      return Promise.resolve({ save: function (r) {
        var blob = r.data instanceof Blob ? r.data : new Blob([r.data]);
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000); return Promise.resolve({});
      } });
    }
  };
  window.claude = { use: function (n) { return api[n] ? api[n]() : Promise.resolve(null); } };
})();
