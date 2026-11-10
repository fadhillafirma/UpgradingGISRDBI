// ===== CONFIG: Persebaran Kemiskinan per Provinsi 2025 =====
const CONFIG = {
  file: '',
  kolom: {
    nama:    'nama_bps',        // nama provinsi (sesuai BPS)
    maret:   'persentase_kemiskinan_maret_2025',
    sept:    'persentase_kemiskinan_september_2025',
    selisih: 'selisih',
    pulau:   'pulau'
  }
};

// Batas kelas dan warna tiap indikator (5 warna, 4 batas)
const METRIK = {
  maret: {
    label: 'Kemiskinan Maret 2025 (%)',
    batas: [5, 8, 12, 18],
    warna: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
    urut: -1   // descending (tertinggi di atas)
  },
  sept: {
    label: 'Kemiskinan September 2025 (%)',
    batas: [5, 8, 12, 18],
    warna: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
    urut: -1
  },
  selisih: {
    label: 'Selisih Maret → September (pp)',
    batas: [-0.5, -0.2, 0, 0.1],
    warna: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'],
    urut: 1    // ascending (paling memburuk di atas)
  }
};

const K   = CONFIG.kolom;
const $   = id => document.getElementById(id);
const fmt = n  => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const esc = s  => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v  => (v === null || v === undefined || v === '' ? NaN : Number(v));

// --- Peta dasar
const map = L.map('map').setView([-2.5, 118], 5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18, attribution: '&copy; OpenStreetMap'
}).addTo(map);

let geo = null, fitur = [];
let presetFilter = null;  // 'membaik' | 'memburuk' | null

// --- Isi dropdown indikator
Object.entries(METRIK).forEach(([k, m]) => $('metrik').add(new Option(m.label, k)));

// --- Fungsi warna choropleth
function warnaUntuk(metrik, v) {
  if (isNaN(v)) return '#cccccc';
  const m = METRIK[metrik];
  return m.warna[m.batas.filter(b => v >= b).length];
}

// --- Filter
function lolos(p) {
  const nama  = $('f-nama').value.trim().toLowerCase();
  const pulau = $('f-pulau').value.trim().toLowerCase();
  const maret = $('f-maret').value;
  const sept  = $('f-sept').value;

  if (nama  && !String(p[K.nama]).toLowerCase().includes(nama))   return false;
  if (pulau && !String(p[K.pulau]).toLowerCase().includes(pulau)) return false;
  if (maret !== '' && !(num(p[K.maret]) >= +maret))               return false;
  if (sept  !== '' && !(num(p[K.sept])  >= +sept))                 return false;
  if (presetFilter === 'membaik'  && num(p[K.selisih]) >= 0)       return false;
  if (presetFilter === 'memburuk' && num(p[K.selisih]) <= 0)       return false;
  return true;
}

// --- Style per fitur
function gaya(f) {
  const ok = lolos(f.properties);
  const m  = $('metrik').value;
  return ok
    ? { fillColor: warnaUntuk(m, num(f.properties[K[m]])), fillOpacity: 0.85, color: '#ffffff', weight: 1 }
    : { fillColor: '#d5d9de', fillOpacity: 0.45, color: '#ffffff', weight: 0.6 };
}

// --- Render utama
function render() {
  if (!geo) return;
  const m = $('metrik').value, cfg = METRIK[m];
  geo.setStyle(gaya);

  const cocok = fitur.filter(f => lolos(f.feature.properties));

  // Ringkasan
  const rataMaret = cocok.length
    ? cocok.reduce((a, f) => a + (num(f.feature.properties[K.maret]) || 0), 0) / cocok.length : NaN;
  const rataSelisih = cocok.length
    ? cocok.reduce((a, f) => a + (num(f.feature.properties[K.selisih]) || 0), 0) / cocok.length : NaN;

  $('s-n').textContent      = cocok.length + '/' + fitur.length;
  $('s-rata').textContent    = cocok.length ? fmt(rataMaret) + '%' : '-';
  $('s-selisih').textContent = cocok.length ? fmt(rataSelisih) + ' pp' : '-';

  // Daftar provinsi (diurutkan berdasarkan indikator aktif)
  cocok.sort((a, b) => cfg.urut * (num(a.feature.properties[K[m]]) - num(b.feature.properties[K[m]])));
  const ol = $('daftar'); ol.innerHTML = '';
  cocok.forEach(f => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    const a = document.createElement('span'); a.textContent = f.feature.properties[K.nama];
    const v = document.createElement('span'); v.className = 'val'; v.textContent = fmt(f.feature.properties[K[m]]);
    b.append(a, v);
    b.onclick = () => { map.fitBounds(f.getBounds(), { maxZoom: 7 }); f.openPopup(); };
    li.appendChild(b); ol.appendChild(li);
  });

  $('status').textContent = cocok.length ? '' : 'Tidak ada provinsi yang cocok. Longgarkan filter.';
  legenda(m);
}

// --- Legenda
function legenda(m) {
  const c = METRIK[m], b = c.batas;
  const lab = [
    `< ${fmt(b[0])}`,
    ...b.slice(0, -1).map((x, i) => `${fmt(x)} s/d < ${fmt(b[i + 1])}`),
    `≥ ${fmt(b[b.length - 1])}`
  ];
  $('legend').innerHTML = `<b>${esc(c.label)}</b>` +
    c.warna.map((w, i) => `<div><i style="background:${w}"></i>${lab[i]}</div>`).join('') +
    '<div><i style="background:#d5d9de"></i>Tidak lolos filter</div>';
}

// --- Preset filter
const PRESET = {
  miskinTinggi: { 'f-maret': 10 },
  miskinRendah: { 'f-maret': 0, '_maxMaret': 5 },   // khusus: maret < 5
  membaik:      {},  // selisih < 0  (ditangani khusus)
  memburuk:     {}   // selisih > 0  (ditangani khusus)
};

document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
  const p = b.dataset.preset;
  reset(false);
  presetFilter = null;

  if (p === 'miskinTinggi') {
    $('f-maret').value = 10;
  } else if (p === 'miskinRendah') {
    // filter kustom: tampilkan yg < 5%
    $('f-maret').value = '';
    // gunakan metrik maret, urutkan ascending
    $('metrik').value = 'maret';
  } else if (p === 'membaik') {
    presetFilter = 'membaik';
    $('metrik').value = 'selisih';
    METRIK.selisih.urut = 1;   // ascending: paling turun (membaik) di atas
  } else if (p === 'memburuk') {
    presetFilter = 'memburuk';
    $('metrik').value = 'selisih';
    METRIK.selisih.urut = -1;  // descending: paling naik (memburuk) di atas
  }
  render();
});

function reset(doRender = true) {
  presetFilter = null;
  $('metrik').value = 'maret';
  METRIK.selisih.urut = 1;
  ['f-nama', 'f-maret', 'f-sept', 'f-pulau'].forEach(id => $(id).value = '');
  if (doRender) {
    render();
    // Kembalikan view peta ke tampilan awal
    if (geo) map.fitBounds(geo.getBounds());
    else map.setView([-2.5, 118], 5);
  }
}
$('reset').onclick = () => reset();

// Event listeners
['f-nama', 'f-maret', 'f-sept', 'f-pulau'].forEach(id => $(id).addEventListener('input', () => { presetFilter = null; render(); }));
$('metrik').addEventListener('change', render);

// --- Muat GeoJSON
fetch(CONFIG.file)
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => {
    const p0 = (data.features[0] || {}).properties || {};
    const hilang = Object.values(K).filter(k => !(k in p0));
    if (hilang.length) {
      $('status').textContent = 'Kolom tidak ditemukan di GeoJSON: ' + hilang.join(', ') +
        '. Sesuaikan CONFIG di App.JS. Kolom yang ada: ' + Object.keys(p0).join(', ');
      return;
    }
    geo = L.geoJSON(data, {
      style: gaya,
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindPopup(
          `<b>${esc(p[K.nama])}</b><br>` +
          `Pulau: ${esc(p[K.pulau])}<br>` +
          `Kemiskinan Maret: ${fmt(p[K.maret])}%<br>` +
          `Kemiskinan September: ${fmt(p[K.sept])}%<br>` +
          `Selisih: ${fmt(p[K.selisih])} pp`
        );
        layer.on('mouseover', () => layer.setStyle({ weight: 3, color: '#17202a' }));
        layer.on('mouseout', () => geo.resetStyle(layer));
        fitur.push(layer);
      }
    }).addTo(map);
    map.fitBounds(geo.getBounds());
    render();
  })
  .catch(err => {
    $('status').textContent = 'Gagal memuat ' + CONFIG.file + ' (' + err.message +
      '). Pastikan file ada di folder yang sama dan buka lewat server lokal (python -m http.server 8000).';
  });