// Mixage final : voix + lit musical ducké sous la parole, puis mux dans le film.
// usage : node motion/mix.mjs [suffixe]   -> stockely-motion-vo<suffixe>.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FFMPEG = "C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\ffmpeg\\node_modules\\ffmpeg-static\\ffmpeg.exe";
const OUT = path.resolve("motion/out");
const SUFFIX = process.argv[2] || "";

const voice = path.join(OUT, `stockely-vo${SUFFIX}.wav`);
const music = path.join(OUT, "music.wav");
const film = path.join(OUT, "stockely-motion.mp4");
const out = path.join(OUT, `stockely-motion-vo${SUFFIX}.mp4`);
const mixWav = path.join(OUT, `stockely-mix${SUFFIX}.wav`);

for (const f of [voice, music, film]) {
  if (!fs.existsSync(f)) throw new Error("fichier manquant : " + f);
}

// La musique est le signal principal, la voix sert de sidechain :
// elle fait baisser la nappe dès qu'elle parle, puis la laisse remonter.
const filter = [
  "[1:a]volume=0.85,highpass=f=90,lowpass=f=7000[bed]",
  "[bed][0:a]sidechaincompress=threshold=0.045:ratio=5:attack=25:release=520:makeup=1[ducked]",
  "[0:a][ducked]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.94[aout]",
].join(";");

execFileSync(FFMPEG, ["-y", "-i", voice, "-i", music, "-filter_complex", filter,
  "-map", "[aout]", "-ac", "2", "-ar", "48000", mixWav, "-loglevel", "error"]);

execFileSync(FFMPEG, ["-y", "-i", film, "-i", mixWav,
  "-map", "0:v:0", "-map", "1:a:0",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
  "-shortest", out, "-loglevel", "error"]);

console.log(`${out}  (${(fs.statSync(out).size / 1e6).toFixed(2)} MB)`);
