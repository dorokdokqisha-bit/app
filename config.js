/* ============================================================
   KONFIGURASI DOROKDOK QISHA — ubah bagian ini saja
   ============================================================ */
window.DQ_CONFIG = {
  // 1) Tempel dari Firebase Console › Project settings › Your apps › Web app › SDK setup (Config)
  firebase: {
    apiKey: "ISI_API_KEY",
    authDomain: "ISI_PROJECT_ID.firebaseapp.com",
    projectId: "ISI_PROJECT_ID",
    storageBucket: "ISI_PROJECT_ID.appspot.com",
    messagingSenderId: "ISI_SENDER_ID",
    appId: "ISI_APP_ID"
  },

  // 2) Email Google yang boleh MENGUBAH data (pengelola / admin panel)
  pengelola: ["email-anda@gmail.com"],

  // 3) Email Google yang hanya boleh MELIHAT (penerima laporan)
  investor: ["email-investor1@gmail.com"]
};
/* Email di sini harus sama persis dengan yang ada di firestore.rules */
