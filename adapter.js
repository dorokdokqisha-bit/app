/* Jembatan: menghubungkan aplikasi Dorokdok Qisha ke Firebase (login Google + Firestore).
   Aplikasi tidak perlu diubah; ia memanggil claude.use('db' | 'user' | 'downloads'). */
(function () {
  var C = window.DQ_CONFIG || {};
  var low = function (a) { return (a || []).map(function (e) { return String(e).trim().toLowerCase(); }); };
  var OWN = low(C.pengelola), INV = low(C.investor);
  firebase.initializeApp(C.firebase);
  var auth = firebase.auth(), fs = firebase.firestore();
  try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}

  var css = '.dq-gate{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:#6A1B1F;color:#FBF3E6;font:15px "IBM Plex Sans",system-ui,sans-serif;padding:24px}' +
    '.dq-gate div{max-width:340px;text-align:center;display:grid;gap:14px}.dq-gate img{width:220px;margin:0 auto;background:#FFFDF9;border-radius:12px;padding:8px 12px}' +
    '.dq-gate button{background:#FBF3E6;color:#4E1215;border:0;border-radius:8px;padding:12px 18px;font:600 15px inherit;cursor:pointer}.dq-gate small{opacity:.8}';
  function gate(html) {
    var g = document.querySelector('.dq-gate');
    if (!g) { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      g = document.createElement('div'); g.className = 'dq-gate'; document.body.appendChild(g); }
    g.innerHTML = '<div><img src="icon-512.png" alt="Dorokdok Qisha">' + html + '</div>';
    return g;
  }
  function login() {
    var g = gate('<b>Masuk untuk membuka data usaha</b><button id="dq-in">Masuk dengan Google</button><small>Hanya email terdaftar yang dapat masuk.</small>');
    g.querySelector('#dq-in').onclick = function () {
      var p = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(p).catch(function () { auth.signInWithRedirect(p); });
    };
  }
  function tolak(u) {
    var g = gate('<b>Akses ditolak</b><small>' + u.email + ' belum terdaftar. Minta pengelola menambahkan email ini.</small><button id="dq-out">Ganti akun</button>');
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
        var chips = document.querySelector('.chips');
        if (chips && !document.getElementById('dq-keluar')) {
          var b = document.createElement('button'); b.id = 'dq-keluar'; b.className = 'chip'; b.style.background = 'none'; b.style.color = 'inherit'; b.style.cursor = 'pointer';
          b.textContent = 'Keluar'; b.onclick = function () { auth.signOut().then(function () { location.reload(); }); }; chips.appendChild(b);
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
