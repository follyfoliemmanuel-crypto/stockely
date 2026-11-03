// Lit musical généré à la main : nappe d'accords filtrée, sans percussion.
// Sortie : motion/out/music.wav (48 kHz, stéréo, 16 bits)
import fs from "node:fs";
import path from "node:path";

const SR = 48000;
const DUR = 13.6;
const N = Math.round(SR * DUR);
const OUT = path.resolve("motion/out/music.wav");

// --- accordage -------------------------------------------------------------
// La mineur / do majeur élargi : chaud, neutre, sans tension.
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Chaque accord : [note midi, gain], tenu sur un intervalle de temps.
const CHORDS = [
  // Am9 — 0.0 → 6.6
  { t0: 0, t1: 6.6, notes: [[45, 0.55], [52, 0.34], [57, 0.26], [60, 0.22], [64, 0.13], [71, 0.07]] },
  // Fmaj7 — 6.6 → 10.9
  { t0: 6.6, t1: 10.9, notes: [[41, 0.55], [48, 0.32], [53, 0.26], [57, 0.22], [64, 0.14], [69, 0.07]] },
  // Cadd9 — 10.9 → 13.6
  { t0: 10.9, t1: 13.6, notes: [[36, 0.5], [48, 0.34], [55, 0.26], [60, 0.2], [67, 0.12], [74, 0.06]] },
];

const XF = 1.5; // fondu entre accords (s)

function chordWindow(t, c) {
  const inA = c.t0 === 0 ? 1 : Math.min(1, (t - c.t0) / XF);
  const outA = c.t1 >= DUR ? 1 : Math.min(1, (c.t1 - t) / XF);
  const w = Math.min(inA, outA);
  return w <= 0 ? 0 : Math.sin((w * Math.PI) / 2) ** 2; // courbe douce
}

// --- génération ------------------------------------------------------------
const L = new Float32Array(N);
const R = new Float32Array(N);

const rand = (seed) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};

CHORDS.forEach((c, ci) => {
  c.notes.forEach(([midi, gain], ni) => {
    const f = hz(midi);
    // léger désaccord entre canaux : donne de la largeur sans chorus audible
    const detL = 1 + (rand(ci * 31 + ni)() - 0.5) * 0.0012;
    const detR = 1 + (rand(ci * 57 + ni + 7)() - 0.5) * 0.0012;
    // vibrato très lent, déphasé par voix
    const lfoF = 0.06 + rand(ci * 13 + ni)() * 0.07;
    const lfoP = rand(ci * 71 + ni)() * Math.PI * 2;
    const harm = [1, 0.33, 0.14, 0.06];

    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const w = chordWindow(t, c);
      if (w === 0) continue;

      const vib = 1 + 0.0016 * Math.sin(2 * Math.PI * lfoF * t + lfoP);
      let sL = 0, sR = 0;
      for (let h = 0; h < harm.length; h++) {
        const ph = 2 * Math.PI * f * (h + 1) * t;
        sL += harm[h] * Math.sin(ph * vib * detL);
        sR += harm[h] * Math.sin(ph * vib * detR + 0.15);
      }
      // respiration : la nappe gonfle et se retire lentement
      const breath = 0.86 + 0.14 * Math.sin(2 * Math.PI * 0.09 * t + lfoP * 0.5);
      const a = w * gain * breath;
      L[i] += sL * a;
      R[i] += sR * a;
    }
  });
});

// --- souffle --------------------------------------------------------------
// Bruit filtré très bas niveau : évite le côté "synthé sale", donne de l'air.
{
  const r = rand(4242);
  let lpL = 0, lpR = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const nL = r() * 2 - 1;
    const nR = r() * 2 - 1;
    lpL += (nL - lpL) * 0.02;
    lpR += (nR - lpR) * 0.02;
    const sw = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / DUR - Math.PI / 2);
    L[i] += lpL * 0.5 * sw;
    R[i] += lpR * 0.5 * sw;
  }
}

// --- enveloppe globale + normalisation -------------------------------------
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fin = Math.min(1, t / 1.6) ** 1.6;
  const fout = Math.min(1, (DUR - t) / 2.0) ** 1.4;
  const g = fin * fout;
  L[i] *= g;
  R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}

// cible : nappe discrète, marge pour le ducking sous la voix
const target = 0.18;
const norm = peak > 0 ? target / peak : 1;

const data = Buffer.alloc(44 + N * 4);
data.write("RIFF", 0);
data.writeUInt32LE(36 + N * 4, 4);
data.write("WAVE", 8);
data.write("fmt ", 12);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28);
data.writeUInt16LE(4, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(N * 4, 40);

for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * norm));
  const r = Math.max(-1, Math.min(1, R[i] * norm));
  data.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  data.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}

fs.writeFileSync(OUT, data);
console.log(`music.wav : ${DUR}s, pic ${(20 * Math.log10(target)).toFixed(1)} dBFS, ${(data.length / 1e6).toFixed(1)} MB`);
