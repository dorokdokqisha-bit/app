/* ===== Penasihat AI · Dorokdok Qisha =====
   Dimuat SEBELUM skrip utama. Semua fungsi memakai ST, bcalc, ledger, rp, dst. saat dipanggil.
   Bagian 1: mesin analisis lokal (KPI, SWOT, rekomendasi) dari data nyata aplikasi.
   Bagian 2: tanya-jawab dengan Claude memakai kunci API milik pengelola (disimpan hanya di perangkat). */
const PN={chat:[],busy:false,draft:''},PN_KEY='dq-ai-key',PN_MODEL='claude-sonnet-5-5',PN_RC=[1.42,1.53];
const PN_KB=`ILMU KERUPUK KULIT SAPI (Blueprint Garut, riset 2023):
- Pembanding Sukaregang (Sabrina dkk 2023, bukan audit; 2 usaha >15 thn): penerimaan Rp120,5 jt/bln; biaya Rp84,8 jt dan Rp78,7 jt; R/C 1,42 dan 1,53; biaya/penerimaan 70,4% dan 65,3%. Usaha 1 varian lebih untung dari 3 varian pada penerimaan sama: uji tiap SKU lewat kontribusi margin, bukan asumsi.
- Proses ±4 hari, rendam sampai 24 jam, manual, ±10 pekerja; tata letak kerja perlu dibenahi. Catat waktu per tahap, yield, susut, reject/rework, pemakaian minyak/gas/bumbu/kemasan.
- 8 pilar unggul: bahan baku (supplier scorecard: biaya total & yield, bukan harga beli saja), produksi (batch, bottleneck), mutu (QC tiap tahap), keuangan (HPP aktual, kas, utang/piutang), penjualan (harga per kanal, diskon, retur), persediaan (lot, umur simpan), SDM (output per jam kerja), ekspansi (ROI mesin/outlet/reseller).
- Prinsip: kejar kontribusi margin setelah diskon, komisi, ongkir, retur; jaga kas dan mutu saat volume naik; mulai dari satu lini dan beberapa SKU utama.
- KPI: HPP batch=bahan+tenaga langsung+overhead; HPP/unit; yield=output baik/input; reject=reject/output periksa; gross margin=(penjualan-HPP)/penjualan; R/C=penerimaan/total biaya; BEP=biaya tetap/(harga-biaya variabel); inventory days; receivable days; cash conversion cycle; proyeksi kas 13 minggu.
- Akuntansi: pisahkan biaya produksi (persediaan/HPP) dari biaya penjualan-administrasi; mesin = aset disusutkan, bukan biaya sekali; jurnal harus seimbang; transaksi posted dikoreksi lewat reversal.
- Keputusan mesin/shift/reseller/kanal digital baru setelah data stabil beberapa batch.
USAHA: Dorokdok Qisha, ±200 kg kulit/batch, 7 tahap (Lembaran, Rendam, Cincang, Jemur, Bumbu, Lapo, Goreng), 9 ukuran 20 gr-5 kg, 4 kanal harga (langganan, umum, reseller, distributor). Laba bersih batch dibagi 50:50 untuk 2 investor. Penyusutan garis lurus 48 bulan sejak 21 Okt 2026.`;
const pnPc=x=>(x*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%',pnRt=x=>x.toLocaleString('id-ID',{maximumFractionDigits:2});

function pnData(){
  const B=balances(ledger());
  const bs=vals(ST.batch).sort(byDate).map(b=>{const r=bcalc(b.id),a=b.arsip?(b.ringkasan||{}):null,bt=r.hpp+r.op+r.susut;
    const inKg=a?(a.bahanKg||0):bahanTotal(b),outKg=a?(a.hasilKg||0):r.gPack/1000;
    return{id:b.id,kode:b.kode,mulai:b.mulai,tutup:!!(b.tutup||b.arsip),pend:r.pend,biaya:r.biaya,hpp:r.hpp,op:r.op,susut:r.susut,lb:r.lb,
      gm:r.pend?r.lk/r.pend:0,nm:r.pend?r.lb/r.pend:0,rc:bt?r.pend/bt:0,cpk:outKg?r.biaya/outKg:0,inKg,outKg,rend:inKg?outKg/inKg:0,piut:r.piut}});
  const ok=bs.filter(b=>b.tutup&&b.pend>0),last=ok[ok.length-1],rec=ok.slice(-3);
  const sku={},cp={},kan={},pel={};
  for(const s of vals(ST.jual)){const rev=saleRev(s),c=(cp[s.batch]??=ST.batch[s.batch]?bcalc(s.batch).cpg:0);
    kan[s.kanal||'langganan']=(kan[s.kanal||'langganan']||0)+rev;
    const p=(pel[s.pelanggan||'(tanpa nama)']??={n:0,rev:0});p.n++;p.rev+=rev;
    for(const it of s.items||[]){const q=s.metode==='konsinyasi'?+it.laku||0:+it.qty||0;if(!q)continue;
      const x=(sku[it.u]??={q:0,rev:0,hpp:0});x.q+=q;x.rev+=q*(+it.harga||0);x.hpp+=q*(G[it.u]||0)*c}}
  const tetap=last?last.op+last.susut:0;
  return{bs,ok,last,kas:B.g('Kas'),piut:B.g('Piutang'),ek:B.ek,selisih:B.selisih,
    avgBiaya:rec.length?rec.reduce((a,b)=>a+b.biaya,0)/rec.length:0,sku,kan,pel,
    stokNilai:stokTotal(aktifBatch().map(b=>b.id)).nilai,bep:last&&last.gm>0?tetap/last.gm:null,
    total:{pend:ok.reduce((a,b)=>a+b.pend,0),lb:ok.reduce((a,b)=>a+b.lb,0)}}}

function pnSwot(d){const S=[],W=[],O=[],T=[],{ok,last:L}=d,f=ok[0];
  if(ok.length>=2&&ok.slice(-2).every(b=>b.lb>0))S.push(`Laba bersih positif ${ok.slice(-2).map(b=>b.kode).join(' dan ')} (total ${rp(ok.slice(-2).reduce((a,b)=>a+b.lb,0))}).`);
  if(f&&L&&f!==L&&f.cpk>L.cpk*1.1)S.push(`Biaya produksi per kg jadi turun dari ${rp(f.cpk)} (${f.kode}) ke ${rp(L.cpk)} (${L.kode}), turun ${pnPc(1-L.cpk/f.cpk)}.`);
  if(!d.selisih)S.push('Pembukuan berpasangan dan neraca seimbang; investor bisa memantau langsung dengan hak lihat saja.');
  S.push('Produk asli kulit sapi dengan 9 ukuran dan 4 kanal harga (langganan, umum, reseller, distributor) sudah terstruktur.');
  const rugi=ok.filter(b=>b.lb<0);if(rugi.length)W.push(`${rugi.map(b=>b.kode).join(', ')} rugi (${rp(rugi.reduce((a,b)=>a+b.lb,0))}); pelajari penyebab biaya dan harga.`);
  if(L&&L.rc<PN_RC[0])W.push(`R/C ${L.kode} = ${pnRt(L.rc)}, di bawah pembanding ${pnRt(PN_RC[0])}–${pnRt(PN_RC[1])} (skala pembanding ±10 kali lebih besar, jadi bandingkan arah, bukan angka mutlak).`);
  if(L&&d.avgBiaya&&d.kas<d.avgBiaya*1.2)W.push(`Kas ${rp(d.kas)} hanya setara ${pnRt(d.kas/d.avgBiaya)} batch biaya produksi; modal kerja tipis.`);
  if(L&&d.piut>L.pend*.1)W.push(`Piutang ${rp(d.piut)} lebih dari 10% penjualan batch terakhir.`);
  W.push('Belum ada data yield per tahap, reject/rework, dan supplier kulit; ini yang membedakan usaha unggul menurut blueprint.');
  O.push('Perbanyak reseller dan distributor: harga bertingkat dan MOQ sudah siap; ukur margin bersih tiap kanal.');
  O.push('Cari ukuran kemasan dengan kontribusi margin tertinggi lalu dorong penjualannya.');
  O.push('Supplier scorecard: pilih pemasok kulit dengan biaya per kg jadi terendah, bukan harga beli terendah.');
  O.push('Setelah data stabil 3 batch: uji kanal digital, pesanan terjadwal, dan ROI mesin pemotong atau pengering.');
  T.push('Harga kulit mentah naik atau mutu kulit tidak seragam menekan yield dan HPP.');
  T.push('Pesaing Sukaregang sudah berjalan lebih dari 15 tahun dengan skala jauh lebih besar.');
  T.push('Penjemuran 3 hari bergantung cuaca; hujan memperlambat batch dan menahan arus kas.');
  T.push('Legalitas pangan (PIRT, halal, label) perlu dipastikan untuk masuk toko modern dan marketplace.');
  return{S,W,O,T}}

function pnRec(d){const r=[],L=d.last;
  if(!Object.keys(d.sku).length)r.push(['bad','Input Batch 004 secara rinci (biaya, kemasan, penjualan per ukuran). Tanpa itu margin per ukuran belum bisa dihitung.']);
  if(L&&L.rc<PN_RC[0]){const mx=L.pend/PN_RC[0],gap=L.hpp+L.op+L.susut-mx;r.push(['bad',`Untuk mencapai R/C ${pnRt(PN_RC[0])} pada penjualan sebesar ${L.kode}, biaya total maksimum ${rp(mx)} (turun ${rp(gap)}), atau naikkan realisasi harga lewat bauran kanal.`])}
  if(d.bep)r.push(['run',`Titik impas ≈ ${rp(d.bep)} penjualan per batch (biaya tetap ${rp(d.last.op+d.last.susut)} ÷ margin kotor ${pnPc(d.last.gm)}).`]);
  if(L&&d.avgBiaya){const sisa=d.kas-Math.max(0,L.lb);r.push([sisa<d.avgBiaya?'bad':'ok',`Bagi hasil ${L.kode} (${rp(Math.max(0,L.lb))}) akan menyisakan kas ${rp(sisa)} vs biaya batch rata-rata ${rp(d.avgBiaya)}. Bagikan hanya bila sisa kas cukup untuk batch berikutnya.`])}
  r.push(['run','Timbang dan catat kg di tiap tahap (lembaran, keringan, lapoan, hasil jadi) untuk menghitung yield dan titik susut.']);
  r.push(['run','Catat nama supplier kulit di tiap pembelian agar biaya per kg jadi per pemasok bisa dibandingkan.']);
  r.push(['gold','Tunda beli mesin atau tambah shift sampai 3 batch berturut-turut laba dengan R/C naik.']);
  r.push(['gold','Unduh cadangan .json tiap akhir batch dan simpan di Google Drive.']);return r}

function pnSystem(){const d=pnData(),snap={batch:d.bs.map(b=>({...b,id:undefined})),kas:d.kas,piutang:d.piut,ekuitas:d.ek,nilaiStok:d.stokNilai,biayaBatchRataRata:d.avgBiaya,titikImpas:d.bep,marginUkuran:Object.fromEntries(Object.entries(d.sku).map(([u,x])=>[UL[u],{qty:x.q,pendapatan:x.rev,hpp:x.hpp}])),omzetKanal:d.kan,pelanggan:d.pel};
  return`Anda Penasihat AI Dorokdok Qisha: ahli keuangan bisnis, akuntan biaya manufaktur UMKM, dan konsultan ERP kerupuk kulit sapi Garut. Jawab dalam Bahasa Indonesia, pelan-pelan, ringkas (pengguna memakai HP), tanpa tabel markdown. Pakai hanya angka dari DATA_USAHA; jangan mengarang angka, tandai asumsi, dan katakan bila data belum ada. Benchmark kompetitor adalah penelitian 2023, bukan audit. Beri analisis, SWOT, dan beberapa opsi solusi dengan untung-ruginya. Untuk keputusan pajak, hukum, atau investasi besar, sarankan konsultasi akuntan atau penasihat berlisensi.\n\n${PN_KB}\n\nDATA_USAHA (per ${today()}, Rupiah):\n${JSON.stringify(snap)}`}

async function pnAsk(q){q=(q||'').trim();if(!q||PN.busy)return;
  const key=localStorage.getItem(PN_KEY);if(!key)return pnKeySheet();
  PN.chat.push({role:'user',content:q});PN.draft='';PN.busy=true;render();pnScroll();
  try{const h=PN.chat.filter(m=>!m.err).slice(-12).map(({role,content})=>({role,content}));while(h.length&&h[0].role!=='user')h.shift();
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:PN_MODEL,max_tokens:1500,system:pnSystem(),messages:h})});
    const j=await r.json();if(!r.ok)throw new Error(j.error?.message||r.status);
    PN.chat.push({role:'assistant',content:j.content.map(c=>c.text||'').join('')})}
  catch(e){PN.chat.push({role:'assistant',err:1,content:'Gagal menghubungi AI: '+e.message+'. Periksa kunci API, saldo, dan sinyal.'})}
  PN.busy=false;render();pnScroll()}
const pnScroll=()=>setTimeout(()=>{const l=$('pn_log');if(l)l.scrollTop=l.scrollHeight},40);
const pnMd=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#+\s*(.+)$/gm,'<b>$1</b>').replace(/^[-*]\s+/gm,'• ').replace(/\n/g,'<br>');
function pnKeySheet(){const has=!!localStorage.getItem(PN_KEY);
  sheet('Hubungkan AI',`<p class="mut" style="margin:0 0 10px">Langkah 1: buka <b>console.anthropic.com</b> › API keys › Create key.<br>Langkah 2: di Billing, isi saldo kecil dan pasang batas bulanan (mis. US$5).<br>Langkah 3: tempel kunci di bawah. Kunci hanya tersimpan di HP ini, tidak masuk Firebase maupun GitHub.</p><label class="f">Kunci API<input id="pn_key" type="password" autocomplete="off" placeholder="sk-ant-…"></label>`,
  `<button class="btn pri" data-pn="simpanKey">Simpan kunci</button>${has?'<button class="btn" data-pn="hapusKey">Hapus kunci</button>':''}`)}

function pPenasihat(){const d=pnData(),L=d.last,sw=L?pnSwot(d):null;
  let o=`<div class="head"><div><div class="eyebrow">Agen ERP · akuntansi cloud</div><h2>Penasihat AI</h2></div></div><div class="banner">Angka dihitung dari data aplikasi Anda. Pembanding Sukaregang dari penelitian 2023 (bukan audit). Penasihat hanya menyarankan dan tidak mengubah data.</div>`;
  if(!L)return o+'<section class="panel"><h3>Data belum cukup</h3><p class="mut">Penasihat mulai bekerja setelah ada batch yang selesai dan memiliki penjualan.</p></section>';
  o+=`<div class="kpis"><div class="kpi"><span class="eyebrow">R/C ${esc(L.kode)}</span><span class="v">${pnRt(L.rc)}</span><span class="s">Pembanding ${pnRt(PN_RC[0])}–${pnRt(PN_RC[1])}</span></div>
  <div class="kpi"><span class="eyebrow">Margin bersih</span><span class="v">${pnPc(L.nm)}</span><span class="s">Margin kotor ${pnPc(L.gm)}</span></div>
  <div class="kpi"><span class="eyebrow">Biaya per kg jadi</span><span class="v">${rp(L.cpk)}</span><span class="s">${nf.format(Math.round(L.outKg))} kg hasil</span></div>
  <div class="kpi"><span class="eyebrow">Modal kerja</span><span class="v">${d.avgBiaya?pnRt(d.kas/d.avgBiaya)+' batch':'—'}</span><span class="s">Kas ${rp(d.kas)}</span></div></div>`;
  o+=`<section class="panel"><h3>Tren per batch</h3><div class="list">${d.bs.map(b=>`<div class="li"><div class="t"><div><b>${esc(b.kode)}</b> · ${rp(b.pend)} penjualan</div><div class="mut">Laba ${rp(b.lb)} · biaya/kg ${rp(b.cpk)}${b.rend?` · ${pnRt(b.rend)} kg jadi per kg bahan`:''}</div></div><span class="tag ${b.lb<0?'bad':b.tutup?'ok':'run'}">${b.tutup?'R/C '+pnRt(b.rc):'Berjalan'}</span></div>`).join('')}</div></section>`;
  const box=(t,a)=>`<section class="panel"><h3>${t}</h3>${a.map(x=>`<p style="margin:0 0 8px">• ${esc(x)}</p>`).join('')}</section>`;
  o+=`<div class="grid g2">${box('Kekuatan',sw.S)}${box('Kelemahan',sw.W)}${box('Peluang',sw.O)}${box('Ancaman',sw.T)}</div>`;
  o+=`<section class="panel"><h3>Rekomendasi solusi</h3><div class="list">${pnRec(d).map(([t,x])=>`<div class="li"><div class="t"><div>${esc(x)}</div></div><span class="tag ${t}">${t==='bad'?'Utama':t==='ok'?'Aman':t==='run'?'Cek':'Info'}</span></div>`).join('')}</div></section>`;
  const sk=Object.entries(d.sku);
  if(sk.length)o+=`<section class="panel"><h3>Margin per ukuran (sebelum diskon nota)</h3><div class="list">${sk.map(([u,x])=>`<div class="li"><div class="t"><div><b>${UL[u]}</b> · ${nf.format(x.q)} pcs</div><div class="mut">Pendapatan ${rp(x.rev)} · HPP ${rp(x.hpp)}</div></div><span class="tag ${x.rev<x.hpp?'bad':'ok'}">${x.rev?pnPc((x.rev-x.hpp)/x.rev):'—'}</span></div>`).join('')}</div></section>`;
  const has=!!localStorage.getItem(PN_KEY),qs=['Buat rencana Batch 005','Layakkah beli mesin sekarang?','Cara menekan biaya per kg','Proyeksi kas 3 bulan'];
  o+=`<section class="panel"><div class="head" style="margin-bottom:8px"><h3>Tanya penasihat</h3>${canWrite?`<div class="row">${PN.chat.length?'<button class="btn sm" data-pn="baru">Percakapan baru</button>':''}<button class="btn sm" data-pn="key">${has?'Ubah kunci AI':'Hubungkan AI'}</button></div>`:''}</div>`;
  if(!canWrite)o+='<p class="mut" style="margin:0">Tanya-jawab AI hanya tersedia untuk pengelola. Analisis di atas tetap bisa Anda baca.</p>';
  else{o+=`<div id="pn_log" style="max-height:340px;overflow:auto;display:grid;gap:8px;margin-bottom:10px">${PN.chat.length?PN.chat.map(m=>`<div style="padding:10px 12px;border-radius:10px;line-height:1.5;${m.role==='user'?'background:var(--gold-soft);justify-self:end;max-width:88%':'background:var(--sunk);border:1px solid var(--line)'}">${pnMd(m.content)}</div>`).join(''):`<p class="mut" style="margin:0">${has?'Pilih pertanyaan atau tulis sendiri.':'Ketuk “Hubungkan AI” untuk mengaktifkan tanya-jawab. Analisis otomatis di atas sudah berjalan tanpa kunci.'}</p>`}${PN.busy?'<div class="mut">Penasihat sedang menganalisis…</div>':''}</div>
    <div class="row w" style="margin-bottom:8px">${qs.map(q=>`<button class="btn sm" data-pn="tanya" data-q="${q}">${q}</button>`).join('')}</div>
    <textarea id="pn_in" rows="2" style="width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit;background:var(--surface);color:var(--ink)" placeholder="Tulis pertanyaan…">${esc(PN.draft)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn pri" data-pn="kirim" ${PN.busy?'disabled':''}>Kirim</button></div>`}
  return o+'</section>'}

document.addEventListener('click',e=>{const t=e.target.closest('[data-pn]');if(!t)return;const a=t.dataset.pn;
  if(a==='kirim')pnAsk($('pn_in')?.value);else if(a==='tanya')pnAsk(t.dataset.q);else if(a==='key')pnKeySheet();
  else if(a==='simpanKey'){const v=$('pn_key')?.value.trim();if(v){localStorage.setItem(PN_KEY,v);toast('Kunci tersimpan di perangkat ini.');setTimeout(render,50)}}
  else if(a==='hapusKey'){localStorage.removeItem(PN_KEY);setTimeout(render,50)}
  else if(a==='baru'){PN.chat=[];render()}});
document.addEventListener('input',e=>{if(e.target.id==='pn_in')PN.draft=e.target.value});
