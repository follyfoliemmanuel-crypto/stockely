const DUR = 13.6;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- easing ---------- */
const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (t, a, b) => cl((t - a) / (b - a));
const mix = (a, b, p) => a + (b - a) * p;
const lerpC = (c1, c2, p) => `rgb(${c1.map((v, i) => Math.round(mix(v, c2[i], p))).join(',')})`;
const oExpo = p => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const oQuart = p => 1 - Math.pow(1 - p, 4);
const oCubic = p => 1 - Math.pow(1 - p, 3);
const ioCubic = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const oBack = (p, s = 1.6) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
const oSine = p => Math.sin((p * Math.PI) / 2);

const INK = [23, 27, 22];
const PAPER = [244, 244, 237];

/* ---------- build ---------- */
const grid = $('#grid'), vig = $('#vig');
const prog = $('#prog'), chrome = $('#chrome');

// S1 letters
const wordEl = $('#word');
const LET = [...'STOCKELY'].map((ch, i) => {
  const w = document.createElement('span'); w.className = 'lt';
  const s = document.createElement('span'); s.className = 'ltr' + (i >= 5 ? ' g' : '');
  s.textContent = ch; w.appendChild(s); wordEl.appendChild(w);
  return { w, s };
});
const s1side = $('#s1side');
s1side.textContent = '';
['Entrepôts · Boutiques', 'Transferts · Inventaires'].forEach((line) => {
  s1side.appendChild(document.createTextNode(line));
  s1side.appendChild(document.createElement('br'));
});
const s1sideAccent = document.createElement('span');
s1sideAccent.style.color = '#2e7d5b';
s1sideAccent.textContent = 'Système unifié';
s1side.appendChild(s1sideAccent);

const swatch = $('#swatch');
['#2e7d5b', '#e9d66b', '#171b16'].forEach(c => {
  const d = document.createElement('div'); d.className = 'sw'; d.style.background = c;
  d.style.transformOrigin = 'bottom left'; d.style.transform = 'scaleY(0)';
  swatch.appendChild(d);
});

// S2 chips
const CHIPS = [
  ['SKU-0482', 'Ciment 25 kg', 124, 'ok'],
  ['SKU-1150', 'Fer à béton Ø8', 860, 'ok'],
  ['SKU-0207', 'Peinture satin', 42, 'low'],
  ['SKU-0931', 'Vis 5×60', 2400, 'ok'],
  ['SKU-1344', 'Parpaing 20', 512, 'ok'],
  ['SKU-0678', 'Gants EPI', 76, 'ok'],
  ['SKU-0112', 'Sable 0/4', 18, 'low'],
  ['SKU-1502', 'Colle carrelage', 205, 'ok'],
  ['SKU-0773', 'Disjoncteur 16A', 88, 'ok'],
  ['SKU-2001', 'Béton prêt', 0, 'out'],
  ['SKU-0310', 'Tuyau PVC 32', 340, 'ok'],
  ['SKU-1245', 'Échelle alu', 7, 'low'],
];
const GX = 96, GY = 496, CW = 412, CH = 88, GAP = 26;
const chipsBox = $('#chips');
const chips = CHIPS.map(([sku, nm, qt, st], i) => {
  const el = document.createElement('div'); el.className = 'chip';
  const dot = document.createElement('span');
  dot.classList.add('dot', st);
  const info = document.createElement('span');
  const skuEl = document.createElement('div'); skuEl.className = 'sku'; skuEl.textContent = sku;
  const nmEl = document.createElement('div'); nmEl.className = 'nm'; nmEl.textContent = nm;
  info.append(skuEl, nmEl);
  const qtEl = document.createElement('span'); qtEl.className = 'qt'; qtEl.textContent = String(qt);
  el.append(dot, info, qtEl);
  el.style.left = (GX + (i % 4) * (CW + GAP)) + 'px';
  el.style.top = (GY + Math.floor(i / 4) * (CH + GAP)) + 'px';
  el.style.transformOrigin = 'center center';
  chipsBox.appendChild(el);
  const rnd = (n) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
  const baseX = GX + (i % 4) * (CW + GAP);
  const rawX = baseX + (rnd(1) - .5) * 420;
  const rawY = GY + Math.floor(i / 4) * (CH + GAP) + (rnd(2) - .5) * 190;
  const x = cl(rawX, 56, 1920 - 56 - CW);
  const y = cl(rawY, 396, 800);
  el.style.zIndex = String(40 - i);
  return {
    el, i,
    dx: x - baseX, dy: y - (GY + Math.floor(i / 4) * (CH + GAP)),
    rot: (rnd(3) - .5) * 22,
  };
});

// S2 phase titles
function fillTitle(id, lines) {
  const el = $(id);
  return lines.map((line) => {
    const w = document.createElement('span'); w.className = 'ln';
    const s = document.createElement('span');
    if (typeof line === 'string') {
      s.textContent = line;
    } else {
      if (line.pre) s.appendChild(document.createTextNode(line.pre));
      if (line.em) {
        const em = document.createElement('span'); em.className = 'g'; em.textContent = line.em;
        s.appendChild(em);
      }
      if (line.post) s.appendChild(document.createTextNode(line.post));
    }
    w.appendChild(s); el.appendChild(w);
    return s;
  });
}
const T2A = fillTitle('#t2a', ['Le stock,', 'en vrac.']);
const T2B = fillTitle('#t2b', [{ em: 'Une seule vue', post: ',' }, 'à jour.']);

// S3 rows
const ROWS = [
  ['0482', 'Ciment 25 kg', 'A-01', 124, 'En stock'],
  ['1150', 'Fer à béton Ø8', 'A-04', 860, 'En stock'],
  ['0207', 'Peinture satin', 'B-12', 42, 'Faible'],
  ['0931', 'Vis 5×60', 'C-03', 2400, 'En stock'],
  ['1344', 'Parpaing 20', 'A-02', 512, 'En stock'],
  ['0678', 'Gants EPI', 'D-07', 76, 'En stock'],
  ['0112', 'Sable 0/4', 'E-01', 18, 'Faible'],
  ['2001', 'Béton prêt', 'E-04', 0, 'Rupture'],
];
const RY0 = 412, RH = 66;
const rowsBox = $('#rows');
const rows = ROWS.map(([ref, nm, emp, q, st], i) => {
  const el = document.createElement('div'); el.className = 'trow';
  el.style.top = (RY0 + i * RH) + 'px';
  const pct = Math.min(1, q / 1200);
  const col = st === 'Rupture' ? '#c4553f' : st === 'Faible' ? '#d8c24a' : '#2e7d5b';
  const c1 = document.createElement('div'); c1.className = 'c1'; c1.textContent = ref;
  const c2 = document.createElement('div'); c2.className = 'c2'; c2.textContent = nm;
  const c3 = document.createElement('div'); c3.className = 'c3'; c3.textContent = emp;
  const gauge = document.createElement('div'); gauge.style.width = '260px';
  const bar = document.createElement('div'); bar.className = 'bar';
  const barFill = document.createElement('i'); barFill.style.background = col;
  bar.appendChild(barFill); gauge.appendChild(bar);
  const c5 = document.createElement('div'); c5.className = 'c5'; c5.textContent = String(q);
  const c6 = document.createElement('div'); c6.className = 'c6'; c6.style.color = col; c6.textContent = st;
  el.append(c1, c2, c3, gauge, c5, c6);
  rowsBox.appendChild(el);
  return { el, i, pct, q, bar: barFill, qty: c5 };
});

// S4 nodes
const NODES = [[480, 700, 'ENT', 'Entrepôt'], [960, 700, 'BTQ', 'Boutique'], [1440, 700, 'CLI', 'Client']];
const nodesBox = $('#nodes');
const nodes = NODES.map(([x, y, code, lab]) => {
  const el = document.createElement('div'); el.className = 'node';
  el.style.left = (x - 60) + 'px'; el.style.top = (y - 60) + 'px';
  el.textContent = code; nodesBox.appendChild(el);
  const l = document.createElement('div'); l.className = 'nlab';
  l.style.left = x + 'px'; l.style.top = (y + 78) + 'px'; l.textContent = lab; nodesBox.appendChild(l);
  return { el, lab: l };
});

// S4 pills
const PILLS = [
  [480, 556, '+120', 'in', 8.5], [960, 556, '+48', 'in', 8.68], [1440, 556, '+12', 'in', 8.86],
  [1440, 862, '−4', 'out', 8.62], [960, 862, '−2', 'out', 8.8], [480, 862, '−1', 'out', 8.98],
  [960, 556, '+8', 'in', 9.62], [1440, 862, '−3', 'out', 9.8],
];
const pillsBox = $('#pills');
const pills = PILLS.map(([x, y, txt, kind, t0]) => {
  const el = document.createElement('div'); el.className = 'pill ' + kind;
  el.textContent = txt; el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.transform = 'translate(-50%,-50%)'; el.style.opacity = 0;
  pillsBox.appendChild(el);
  return { el, x, y, t0 };
});

/* ---------- render ---------- */
window.render = function (t) {
  // progress + chrome
  prog.style.width = (cl(t / DUR) * 1920) + 'px';
  const sceneIdx = t < 2.35 ? 1 : t < 5.16 ? 2 : t < 7.86 ? 3 : t < 10.45 ? 4 : 5;
  $('#chr-scene').textContent = String(sceneIdx).padStart(2, '0') + ' / 05';
  const dark = seg(t, 4.92, 5.2) * (1 - seg(t, 7.5, 7.7));
  chrome.style.color = lerpC(INK, PAPER, dark);
  prog.style.background = lerpC([46, 125, 91], [233, 214, 107], dark);

  // paper
  grid.style.opacity = (0.55 * oCubic(seg(t, 0.05, 0.9))).toFixed(3);
  grid.style.transform = `translateY(${mix(0, -14, oSine(seg(t, 0, DUR)))}px)`;
  vig.style.opacity = 1;

  /* ---- S1 ---- */
  const s1out = seg(t, 2.02, 2.34);
  LET.forEach((L, i) => {
    const a = seg(t, 0.18 + i * 0.045, 0.95 + i * 0.045);
    L.s.style.transform = `translateY(${(1 - oExpo(a)) * 115 - oExpo(s1out) * 115}%)`;
  });
  $('#k1').style.opacity = seg(t, 0.05, 0.35) * (1 - seg(t, 2.0, 2.2));
  $('#s1rule').style.transform = `scaleX(${oExpo(seg(t, 0.9, 1.7))})`;
  $('#cap1').style.opacity = seg(t, 1.15, 1.55) * (1 - seg(t, 2.0, 2.2));
  $('#s1side').style.opacity = seg(t, 1.3, 1.9) * (1 - seg(t, 2.05, 2.3));
  $$('.sw', swatch).forEach((d, i) => {
    d.style.transform = `scaleY(${oExpo(seg(t, 1.25 + i * 0.09, 1.85 + i * 0.09))})`;
  });

  /* ---- S2 ---- */
  const z2 = 1 - seg(t, 4.78, 4.98);
  const titleIn = seg(t, 2.3, 2.7);
  $('#k2').style.opacity = titleIn * z2;
  T2A.forEach((s, i) => {
    const a = oExpo(seg(t, 2.38 + i * 0.1, 2.95 + i * 0.1));
    const b = oExpo(seg(t, 3.42 + i * 0.06, 3.72 + i * 0.06));
    s.style.transform = `translateY(${(1 - a) * 112 - b * 112}%)`;
  });
  T2B.forEach((s, i) => {
    const a = oExpo(seg(t, 3.95 + i * 0.09, 4.5 + i * 0.09));
    const b = oExpo(seg(t, 4.74 + i * 0.05, 4.96 + i * 0.05));
    s.style.transform = `translateY(${(1 - a) * 112 - b * 112}%)`;
  });
  chips.forEach((c, i) => {
    const inA = oExpo(seg(t, 2.32 + i * 0.028, 2.9 + i * 0.028));
    const snap = oExpo(seg(t, 3.55 + i * 0.026, 4.25 + i * 0.026));
    const x = mix(c.dx, 0, snap), y = mix(c.dy, 0, snap);
    const r = mix(c.rot, 0, snap);
    const sc = mix(0.9, 1, inA);
    c.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg) scale(${sc})`;
    c.el.style.opacity = inA * z2;
    c.el.style.boxShadow = `0 1px 2px rgba(23,27,22,.04), 0 ${mix(26, 18, snap)}px ${mix(56, 40, snap)}px -${mix(28, 32, snap)}px rgba(23,27,22,${mix(0.5, 0.4, snap)})`;
    // rupture warning
    if (i === 9) {
      const w = seg(t, 4.2, 4.5);
      c.el.style.background = w > 0 ? '#fbf5ce' : '#fafaf5';
      c.el.style.borderColor = w > 0 ? '#e9d66b' : '#e5e5da';
    }
  });
  const tr = seg(t, 4.32, 4.62);
  const tag = $('#tagrupt');
  tag.style.opacity = tr * (1 - seg(t, 4.86, 4.98));
  tag.style.left = (GX + 3 * (CW + GAP) - 6) + 'px';
  tag.style.top = (GY + 1 * (CH + GAP) - 22) + 'px';
  tag.style.transform = `scale(${mix(0.7, 1, oBack(tr))})`;
  $('#s2line').style.transform = `scaleX(${oExpo(seg(t, 4.62, 4.95))})`;

  /* ---- WIPE ---- */
  const wIn = ioCubic(seg(t, 4.9, 5.16));
  const wOut = ioCubic(seg(t, 7.5, 7.85));
  $('#wipe').style.clipPath = `inset(${(1 - wIn) * 100}% 0 ${wOut * 100}% 0)`;

  /* ---- S3 ---- */
  const s3o = seg(t, 5.14, 5.24) * (1 - seg(t, 7.45, 7.55));
  $('#k3').style.opacity = seg(t, 5.2, 5.5) * s3o;
  const c1v = Math.round(mix(0, 1284, oExpo(seg(t, 5.45, 6.85))));
  $('#stat1').textContent = String(c1v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  $('#stat1').style.opacity = seg(t, 5.4, 5.7) * s3o;
  $('#stat1lab').style.opacity = seg(t, 5.6, 5.9) * s3o;
  const c2v = Math.round(mix(0, 42900, oExpo(seg(t, 5.65, 7.1))));
  $('#stat2').textContent = String(c2v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  $('#stat2').style.opacity = seg(t, 5.55, 5.85) * s3o;
  $('#stat2lab').style.opacity = seg(t, 5.8, 6.1) * s3o;
  const mt = oExpo(seg(t, 6.4, 6.85));
  $('#s3meta').style.opacity = 0.85 * mt * s3o;
  $('#s3meta').style.transform = `translateY(${(1 - mt) * 12}px)`;

  $('#tblhead').style.opacity = seg(t, 5.35, 5.6) * s3o;
  rows.forEach((r, i) => {
    const a = oExpo(seg(t, 5.5 + i * 0.075, 6.05 + i * 0.075));
    r.el.style.opacity = a * s3o;
    r.el.style.transform = `translateX(${(1 - a) * -26}px)`;
    const w = oExpo(seg(t, 5.85 + i * 0.075, 6.6 + i * 0.075)) * r.pct;
    r.bar.style.transform = `scaleX(${w > 0 ? Math.max(w, 0.028) : 0})`;
    r.qty.style.opacity = a;
  });
  // highlight row 8 (rupture)
  const hl = $('#hl');
  const hlA = oCubic(seg(t, 6.55, 6.95));
  hl.style.top = (RY0 + 7 * RH) + 'px';
  hl.style.opacity = hlA * s3o;
  hl.style.transform = `scaleY(${mix(0.72, 1, hlA)})`;
  const nt = oExpo(seg(t, 6.95, 7.3));
  $('#s3note').style.opacity = nt * s3o;
  $('#s3note').style.transform = `translateY(${(1 - nt) * 10}px)`;

  /* ---- S4 ---- */
  const s4o = seg(t, 7.75, 7.95) * (1 - seg(t, 10.35, 10.5));
  $('#k4').style.opacity = seg(t, 7.95, 8.25) * s4o;
  ['h4a', 'h4b', 'h4c'].forEach((id, i) => {
    const a = oExpo(seg(t, 7.95 + i * 0.09, 8.5 + i * 0.09));
    const el = $('#' + id);
    el.style.display = 'inline-block';
    el.style.opacity = a * s4o;
    el.style.transform = `translateY(${(1 - a) * 26}px)`;
  });
  $('#h4').style.opacity = 1;
  const hc = oExpo(seg(t, 8.35, 8.75));
  $('#h4cap').style.opacity = hc * s4o;
  $('#h4cap').style.transform = `translateY(${(1 - hc) * 10}px)`;
  // dotted path draw
  const p = $('#path'), L = 960;
  p.style.strokeDashoffset = (1 - oCubic(seg(t, 8.3, 9.0))) * L;
  p.style.opacity = s4o;
  nodes.forEach((n, i) => {
    const a = oBack(seg(t, 8.1 + i * 0.12, 8.6 + i * 0.12), 1.2);
    n.el.style.opacity = seg(t, 8.1 + i * 0.12, 8.4 + i * 0.12) * s4o;
    n.el.style.transform = `scale(${mix(0.86, 1, a)})`;
    n.lab.style.opacity = seg(t, 8.35 + i * 0.12, 8.7 + i * 0.12) * s4o;
    n.lab.style.transform = `translateX(-50%) translateY(${(1 - oCubic(seg(t, 8.35 + i * 0.12, 8.75 + i * 0.12))) * 8}px)`;
  });
  pills.forEach((pl) => {
    const dir = pl.el.classList.contains('in') ? 1 : -1;
    const p = seg(t, pl.t0, pl.t0 + 0.85);
    const a = Math.min(seg(t, pl.t0, pl.t0 + 0.16), 1 - seg(t, pl.t0 + 0.6, pl.t0 + 0.85));
    pl.el.style.opacity = cl(a) * s4o;
    pl.el.style.transform = `translate(-50%,-50%) translateX(${mix(-64, 64, oCubic(p)) * dir}px) scale(${mix(0.92, 1, oExpo(p))})`;
  });
  const st = oBack(seg(t, 9.35, 9.75), 2.2);
  const stamp = $('#stamp');
  stamp.style.left = '1538px'; stamp.style.top = '666px';
  stamp.style.opacity = seg(t, 9.35, 9.5) * s4o;
  stamp.style.transform = `rotate(-7deg) scale(${mix(0.6, 1, st)})`;

  /* ---- S5 ---- */
  const s5o = seg(t, 10.4, 10.9);
  $('#lock').style.opacity = s5o;
  $('#lock').style.transform = `translateY(${(1 - oExpo(seg(t, 10.45, 11.4))) * 34}px) scale(${mix(0.97, 1, oExpo(seg(t, 10.45, 11.6))) * mix(1, 1.014, seg(t, 11.6, 13))})`;
  $('#mark').style.transform = `scale(${mix(0.8, 1, oBack(seg(t, 10.5, 11.1), 1.9))}) rotate(${mix(-6, 0, oExpo(seg(t, 10.5, 11.2)))}deg)`;
  $('#tag').style.opacity = seg(t, 11.05, 11.5) * s5o;
  $('#tag').style.letterSpacing = mix(0.62, 0.42, oExpo(seg(t, 11.05, 11.9))) + 'em';
  $('#tagrule').style.width = (oCubic(seg(t, 11.5, 12.1)) * 300) + 'px';
  $('#sub5').style.opacity = seg(t, 11.75, 12.2) * s5o;

  // fade all scenes cleanly
  $('#s1').style.opacity = t > 2.3 ? 0 : 1;
  $('#s2').style.opacity = t > 5.34 ? 0 : 1;
  $('#s3').style.opacity = t > 7.6 ? 0 : 1;
  $('#s4').style.opacity = t > 10.6 ? 0 : 1;
  $('#s5').style.opacity = t > 10.4 ? 1 : 0;

  document.body.dataset.t = t.toFixed(3);
};

window.DURATION = DUR;
document.fonts.ready.then(() => { window.READY = true; window.render(0); });
