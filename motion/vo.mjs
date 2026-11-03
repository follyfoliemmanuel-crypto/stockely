import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { MsEdgeTTS, OUTPUT_FORMAT } = require("C:/Users/DELL/AppData/Local/Temp/opencode/tts/node_modules/msedge-tts");

const FFMPEG = "C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\ffmpeg\\node_modules\\ffmpeg-static\\ffmpeg.exe";
const OUT = path.resolve("motion/out");
const VO = path.join(OUT, "vo");
fs.mkdirSync(VO, { recursive: true });

const VOICE = process.argv[2] || "fr-FR-DeniseNeural";
const RATE = process.argv[3] || "+10%";
const SUFFIX = process.argv[4] || "";
const DUR = 13.6;

// [début en s, texte] — calés sur les plans du film
const LINES = [
  [0.25, "Un stock, c'est des milliers de détails."],
  [2.48, "En vrac, on perd le fil."],
  [4.06, "Une seule vue, toujours à jour."],
  [6.05, "Vos chiffres, en temps réel."],
  [8.02, "Chaque mouvement est compté."],
  [10.50, "Stockely."],
  [11.14, "Le stock, sous contrôle."],
];

const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse," +
  "silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,areverse";

const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

const clips = [];
for (const [i, [start, text]] of LINES.entries()) {
  const { audioStream } = tts.toStream(text, { rate: RATE, pitch: "-1Hz" });
  const chunks = [];
  for await (const c of audioStream) chunks.push(c);
  fs.writeFileSync(path.join(VO, `line${i + 1}.mp3`), Buffer.concat(chunks));

  const wav = path.join(VO, `line${i + 1}.wav`);
  execFileSync(FFMPEG, ["-y", "-i", path.join(VO, `line${i + 1}.mp3`), "-af", TRIM,
    "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", wav, "-loglevel", "error"]);

  const dur = (fs.statSync(wav).size - 44) / (24000 * 2);
  clips.push({ wav, start, dur, text });
  console.log(`  ${(start).toFixed(2)}s → ${(start + dur).toFixed(2)}s   « ${text} »`);
}

// --- montage voix ---
const inputs = clips.flatMap((c) => ["-i", c.wav]);
const delays = clips.map((c, i) => `[${i}:a]adelay=${Math.round(c.start * 1000)}|${Math.round(c.start * 1000)},volume=1[a${i}]`).join(";");
const mixIn = clips.map((_, i) => `[a${i}]`).join("");
const filter = `${delays};${mixIn}amix=inputs=${clips.length}:duration=longest:normalize=0,` +
  `highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${DUR}[aout]`;

const voiceWav = path.join(OUT, `stockely-vo${SUFFIX}.wav`);
execFileSync(FFMPEG, ["-y", ...inputs, "-filter_complex", filter, "-map", "[aout]",
  "-ac", "1", "-ar", "48000", voiceWav, "-loglevel", "error"]);

fs.writeFileSync(path.join(OUT, `vo-timing${SUFFIX}.json`),
  JSON.stringify({ voice: VOICE, rate: RATE, duration: DUR, lines: clips.map(({ text, start, dur }) => ({ text, start, end: +(start + dur).toFixed(3) })) }, null, 2));

console.log(`\n${voiceWav}`);
console.log(`voix : ${VOICE} · débit ${RATE} · −16 LUFS`);
