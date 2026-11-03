# Stockely — motion design

Pièce motion de 13,6 s, 1920×1080, 60 i/s, rendue image par image depuis du HTML/CSS/JS
puis encodée en H.264. Aucune dépendance ajoutée au projet : Playwright (déjà en
`devDependencies`) sert de rendu, ffmpeg est utilisé en local. Voix off et nappe
musicale sont synthétisées, pas samplées.

## Résultat

- `out/stockely-motion-vo.mp4` — version finale, voix **Denise** (fr-FR, féminine) + nappe
- `out/stockely-motion-vo-homme.mp4` — même montage, voix **Henri** (fr-FR, masculine)
- `out/stockely-motion.mp4` — version muette (H.264, yuv420p, faststart)
- `out/stockely-mix.wav` / `stockely-mix-homme.wav` — mix final (voix + musique)
- `out/music.wav` — la nappe seule
- `out/poster.png` — dernière image, utilisable en couverture
- `out/contact-sheet.png` — planche de contrôle (1 image / 1,4 s)

## Structure

| Fichier | Rôle |
| --- | --- |
| `scene.html` | La scène (structure et styles). Tout est piloté par `window.render(t)` : une fonction pure du temps, sans `requestAnimationFrame`, donc rendu parfaitement déterministe. |
| `scene.js` | Logique de la scène (chargée par `scene.html`). Construit le DOM avec `textContent` / `createElement`, sans `innerHTML`. |
| `render.mjs` | Boucle de rendu : `render(t)` → capture PNG → pipe vers ffmpeg (pas de fichiers intermédiaires). |
| `stills.mjs` | Rend des images fixes à des instants donnés, pour itérer sur la composition. |
| `vo.mjs` | Synthèse de la voix off (voix neuronales Edge), calage sur les plans, normalisation. |
| `music.mjs` | Génère la nappe musicale échantillon par échantillon (accords, souffle, enveloppes). |
| `mix.mjs` | Mixe voix + nappe avec ducking, puis muxe dans le film. |
| `preview.html` | Page de lecture locale. |

## Relancer un rendu

```bash
node motion/stills.mjs 1.6 4.4 6.9 12.6      # images fixes -> motion/out/stills
node motion/render.mjs                        # vidéo complète -> motion/out/stockely-motion.mp4
node motion/music.mjs                         # nappe -> out/music.wav
node motion/vo.mjs                            # voix Denise -> out/stockely-vo.wav
node motion/mix.mjs                           # mix + mux -> stockely-motion-vo.mp4
node motion/vo.mjs fr-FR-HenriNeural +10% -homme && node motion/mix.mjs -homme
```

`render.mjs` pointe vers `ffmpeg.exe` dans un dossier temporaire. Si le chemin change :

```bash
npm i ffmpeg-static --prefix "%TEMP%\ffmpeg"
```

## Grammaire visuelle

Elle reprend la charte de l'app (`src/app/globals.css`) : papier chaud `#f4f4ed`,
encre `#171b16`, vert `#2e7d5b`, beurre `#e9d66b`, Manrope + IBM Plex Mono.

Cinq mouvements :

1. **Inventaire** — le mot construit lettre par lettre sous masque, règle qui se trace.
2. **État du stock** — le vrac (cartes dispersées, rotations) se range sur une grille
   en une seule accélération (`easeOutExpo`), puis la rupture est signalée.
3. **Pilotage** — bascule sur fond encre : compteurs tabulaires, barres de niveau,
   ligne de rupture surlignée en beurre.
4. **Mouvements** — flux entrepôt → boutique → client, jetons qui circulent, tampon.
5. **End card** — verrouillage logo + signature.

Règles tenues : entrées en `easeOutExpo`, sorties rapides, une seule accélération par
geste, rien qui rebondit sauf le tampon, transitions portées par un élément (la barre
beurre, le wipe encre) plutôt que par des fondus.

## Voix off

Sept répliques, calées à la seconde sur les plans (voir `out/vo-timing.json`) :

| t | réplique |
| --- | --- |
| 0,25 | Un stock, c'est des milliers de détails. |
| 2,48 | En vrac, on perd le fil. |
| 4,06 | Une seule vue, toujours à jour. |
| 6,05 | Vos chiffres, en temps réel. |
| 8,02 | Chaque mouvement est compté. |
| 10,50 | Stockely. |
| 11,14 | Le stock, sous contrôle. |

Synthèse : voix neuronales Microsoft Edge (aucune clé d'API, installée dans un dossier
temporaire, rien ajouté au projet). Débit **+10 %** pour un rythme de pub plutôt que de
documentaire. Chaque réplique est générée séparément, silences début/fin retirés, puis
placée par `adelay` avant un `amix` et une normalisation `loudnorm` à −16 LUFS.

Changer de texte, de voix ou de débit = éditer `LINES` / les arguments dans `vo.mjs`.

## Nappe musicale

Générée en JS (`music.mjs`), pas d'échantillon : trois accords tenus (Am9 → Fmaj7 →
Cadd9) en ondes sinus avec harmoniques faibles, léger désaccord stéréo pour la largeur,
vibrato très lent, souffle filtré, fondus de 1,6 s au début et 2 s à la fin. Aucune
percussion : c'est un lit, pas une musique.

Niveau et ducking dans `mix.mjs` :

- nappe ramenée à `volume=0.85`, coupée sous 90 Hz et au-dessus de 7 kHz
- `sidechaincompress` piloté par la voix (`threshold=0.045`, `ratio=5`, attaque 25 ms,
  release 520 ms) : la nappe s'efface dès que ça parle et remonte dans les silences
- `alimiter` à 0,94 pour finir

Mesures du mix final : **−15,5 LUFS** intégrés, pic vrai **−3,9 dBFS**, nappe à
−30 dB en moyenne dans les respirations, ~10 dB sous la voix pendant la parole.


