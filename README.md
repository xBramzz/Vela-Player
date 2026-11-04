# Detune — a quieter kind of listening

**Detune** is a local-first, glassy web music player focused on *pitch, tempo and atmosphere*. Drop in your own audio files and shift them by up to ±1200 cents (±1 octave), stretch or squeeze the tempo, crossfade between tracks, follow along with lyrics, and watch the whole UI retint itself to your album covers — all offline, no server, no accounts.

## Features

- **Pitch shifting (±1200 cents)** — real-time, duration-preserving granular pitch shifter implemented as an AudioWorklet (`pitch-worklet.js`). Bit-exact passthrough at 0 cents; four Hann-windowed read heads, depth-scaled grains and a smooth wet ramp keep large shifts click- and warble-free.
- **Two playback models** (`core.js` → `computePlayback`):
  - **Detuned mode** (unlinked): the worklet does the pitch, `<audio>` does only the tempo with `preservesPitch` on — each transformation is applied exactly once.
  - **Vinyl mode** (linked): raw `playbackRate = tempo × 2^(cents/1200)` shifts pitch *and* tempo together like speed-up vinyl, worklet bypassed.
- **Tempo control** (0.5×–2×) with per-track overrides.
- **Library & playlists** — IndexedDB-backed track library ("My graveyard"), multiple playlists, drag-and-drop reorder, multi-select, search, sort, shuffle and repeat (off/all/one).
- **Tag reading** (`tags.js`) — dependency-free ID3v2.2/2.3/2.4, ID3v1 and WAV INFO/id3 parsing, embedded cover art extraction, plus `"Artist - Title"` filename fallback.
- **Album-cover theming** (`extras.js`) — dominant-hue analysis of the cover retints the entire interface via CSS custom properties (blood pool, moon, gradients and all).
- **Lyrics** — synced LRC and plain-text import, editable in-app, optional auto-fetch from LRCLIB, karaoke-style highlighting during playback.
- **Crossfade & auto-BPM** — two-deck engine (`audioB`) ramps a gapless crossfade into the next track; BPM detection powers a beat-match readout.
- **Music-reactive visuals** (`fx.js`) — analyser-driven waveform, ember particles, and kick-dominant beat detection published to CSS as `--bass/--mid/--treb/--beat`. Respects `prefers-reduced-motion`.
- **Extras** — reverb send, sleep timer, A/B loop points, skip-length control, WAV export, backup export/import, Media Session lock-screen controls, keyboard shortcuts (press `?`).
- **Installable PWA** — service worker precaches the shell for full offline use (`manifest.webmanifest`, `sw.js`).
- **Performance-aware** — a `lite` mode is auto-selected on small screens, coarse pointers or weak CPUs (fewer particles, lighter canvas).

## Architecture

Everything is plain ES5+/ES2020 JavaScript with zero build step and zero dependencies.

| File | Role |
|---|---|
| `index.html` | App shell: markup + inline critical CSS (backdrop, blood pool, theme variables) |
| `core.js` | Pure, environment-independent helpers (cents↔ratio math, playback model, LRC parsing, hashing, backup validation, LRCLIB URL builders). Exposed as `window.DetuneCore`; also loaded by the Node tests |
| `app.js` | Application shell: IndexedDB persistence, library/playlists/queue, playback, audio-graph wiring, crossfade + auto-BPM engine |
| `pitch-worklet.js` | AudioWorkletProcessor: hybrid granular pitch shifter (k-rate `cents` parameter) |
| `tags.js` | Metadata reader: ID3v2/v1, WAV chunks, cover art, filename fallback |
| `fx.js` | Music-reactive visual engine (waveform, embers, beat detection, CSS channels) |
| `extras.js` | Cover-derived theming + lyrics (LRC/plain text/LRCLIB) |
| `player.css`, `fit.css`, `fx.css`, `extras.css` | Player chrome, responsive/app-shell layout, effects styling, extras styling |
| `sw.js` | Service worker: cache-first app shell (`detune-shell-v14`) |
| `manifest.webmanifest` | PWA manifest |
| `tests/` | Node test suites (see below) |

The design principle throughout the playback path: **never let two stages apply the same transformation.** `core.js` documents this as the single source of truth, and `app.js` latches `preservesPitch` correctly around `play()` (a historical double-shift bug lived exactly there).

## Getting started

No build, no package manager. Serve the folder over HTTP (a service worker and AudioWorklet both require a secure context — `file://` won't cut it):

```bash
cd detune
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `caddy file-server`, GitHub Pages, …). Once loaded, drop audio files onto the page, or use the file picker. In supporting browsers you can install Detune as a standalone PWA.

## Testing

Both suites run under plain Node — no dependencies required:

```bash
node tests/unit-test.js   # unit tests for core.js (pure logic, no DOM)
node tests/pitch-test.js  # browser-harness simulation of pitch-worklet.js:
                          # FFT peak verification of shifted tones, bit-exactness
                          # at 0 cents, stereo independence, NaN guards
```

`unit-test.js` passes when every assertion holds; `pitch-test.js` prints a per-case table of expected vs. measured peak frequency (in cents error) so DSP regressions are visible at a glance.

## Browser support

Requires modern evergreen browsers (Chrome/Edge 90+, Firefox 113+, Safari 15+) for: AudioWorklet, `color-mix()`, CSS custom-property theming, IndexedDB, and Media Session. Older devices automatically get the reduced `lite` rendering path.

## Project info

- License: not specified in the repository yet.
