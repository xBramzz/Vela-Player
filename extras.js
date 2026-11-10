/* =====================================================================
   Detune extras.js  (full rewrite)
   - album-cover colour theme
   - lyrics panel (LRC / plain text) + LRCLIB lookup
   - full-screen Apple-Music-style lyric "shower" with a moving mesh
     background that PUNCHES on the kick drum

   Standalone: only reads the DOM, the <audio> element and (optionally)
   window.DetuneApp.audioGraph / window.DetuneFX / window.DetuneCore.

   What was fixed compared to the old file:
   - amaGlow / shXtap / shXsrc were used but never declared (strict-mode
     ReferenceErrors -> L stopped working, the bass probe silently died)
   - window.DetuneAMA lived outside the IIFE and could not see anything
   - meshColors returned raw 0..1 floats instead of "r g b" strings
   - the bass pulse followed LOUDNESS; it now detects KICK TRANSIENTS
     (own native AnalyserNode, no AudioMotion dependency needed)
   - old mesh wrappers leaked into the DOM on every track change
   - the audio blob URL was used as an <img> source (broken image)
   - one single rAF loop drives bass + drift (was two loops)
   ===================================================================== */
(() => {
"use strict";

/* ---------------------------------------------------------------------
   0. helpers
   --------------------------------------------------------------------- */
const $ = id => { const e = document.getElementById(id); return e && e.nodeType === 1 ? e : null; };
/* run one init block in isolation: a failure there is logged but can never stop the rest of the file (e.g. the L key) */
const safe = (label, fn) => { try { return fn(); } catch (e) { console.error("[extras] " + label + " failed:", e); } };
const R = document.documentElement;
const a = $("audio");
if (!a) { console.warn("[extras] #audio not found - extras disabled."); return; }
const lite = R.classList.contains("lite");
const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

function note(m) {
  const t = $("toast");
  if (!t) return;
  t.textContent = m;
  t.style.display = "block";
  clearTimeout(note.t);
  note.t = setTimeout(() => { t.style.display = "none"; }, 3000);
}

/* fx.js owns the reactive spin animation. If it never initialised, mark <html>
   so CSS falls back to a plain always-spin. */
if (!window.DetuneFX) setTimeout(() => { if (!window.DetuneFX) R.classList.add("no-fx"); }, 1200);

/* ---------------------------------------------------------------------
   1. cover colour theme
   --------------------------------------------------------------------- */
const tb = $("themeBtn"), S = R.style;
let coverTheme = LS.get("detune-cover-theme") === "1";
let lastHue = null;

function dominant(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data, bins = new Float32Array(36);
  let tw = 0, ts = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, df = mx - mn;
    if (df < .08) continue;
    let h = mx === r ? ((g - b) / df) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4;
    h = (h * 60 + 360) % 360;
    const w = df * (1 - Math.abs(2 * l - 1)) + .001;
    bins[(h / 10) | 0] += w;
    tw += w;
    ts += w * df / (1 - Math.abs(2 * l - 1) + .001);
  }
  if (tw < 1) return null;
  let p = 0;
  for (let i = 1; i < 36; i++) if (bins[i] > bins[p]) p = i;
  return { h: p * 10 + 5, s: Math.min(1, ts / tw) };
}

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360 | 0} ${Math.round(Math.min(1, s) * 100)}% ${Math.round(Math.min(1, l) * 100)}%)`;

const POOL_KEYS = ["--blood", "--blood-hi", "--blood-dk", "--accent", "--focus", "--edge", "--ink", "--muted", "--glass",
  "--pool0", "--pool1", "--pool2", "--moon", "--fog", "--grad-a", "--grad-b", "--thumb-a", "--thumb-b",
  "--edge-soft", "--tint-soft", "--tint-strong", "--glow", "--glow-hi"];
const WAVE_KEYS = ["--wave-lo", "--wave-mid", "--wave-hi", "--wave-glow"];

/* Retint via CSS custom properties (the pool reads --pool0/1/2 in index.html). */
function setTheme(h) {
  const set = (k, v) => S.setProperty(k, v);
  lastHue = h;
  /* fx.js draws the waveform on a canvas (CSS vars can't reach it) - publish the stops */
  set("--wave-lo", hsl(h, .85, .25)); set("--wave-mid", hsl(h, .9, .5));
  set("--wave-hi", hsl(h, .85, .82)); set("--wave-glow", hsl(h, .95, .55));
  set("--blood", hsl(h, .78, .30)); set("--blood-hi", hsl(h, .92, .56)); set("--blood-dk", hsl(h, .82, .13));
  set("--accent", hsl(h, .78, .26)); set("--focus", hsl(h, .88, .68));
  set("--edge", hsl(h, .72, .62) + " / .2"); set("--ink", hsl(h, .28, .94)); set("--muted", hsl(h, .24, .64));
  set("--glass", hsl(h, .55, .09) + " / .62");
  set("--pool0", hsl(h, .72, .42)); set("--pool1", hsl(h, .78, .26)); set("--pool2", hsl(h, .7, .09));
  set("--moon", hsl(h, .8, .5)); set("--fog", hsl(h, .75, .24));
  set("--grad-a", hsl(h, .55, .95)); set("--grad-b", hsl(h, .9, .6));
  set("--thumb-a", hsl(h, .85, .78)); set("--thumb-b", hsl(h, .85, .42));
  set("--edge-soft", hsl(h, .7, .6) + " / .18"); set("--tint-strong", hsl(h, .75, .35) + " / .7");
  set("--tint-soft", hsl(h, .8, .45) + " / .25");
  set("--glow", hsl(h, .8, .5) + " / .4"); set("--glow-hi", hsl(h, .9, .6) + " / .8");
}
function clearTheme() {
  lastHue = null;
  for (const k of POOL_KEYS.concat(WAVE_KEYS)) S.removeProperty(k);
}
/* exposed for other scripts: current cover hue/sat (or null on the classic theme) */
window.__detuneTheme = () => (lastHue == null ? null : { h: lastHue, s: .7 });

function syncTheme() {
  if (tb && typeof tb.setAttribute === "function") tb.setAttribute("aria-pressed", String(coverTheme));
  if (!coverTheme) { R.classList.remove("cover-theme"); clearTheme(); return; }
  const cov = $("cover"), img = cov && cov.querySelector("img");
  if (!img) { clearTheme(); R.classList.remove("cover-theme"); return; }
  const go = () => {
    try {
      const r = dominant(img);
      if (!r) setTheme(355); else setTheme(r.h);
      R.classList.add("cover-theme");
    } catch (e) { console.warn("Cover colour failed", e); }
  };
  if (img.complete && img.naturalWidth) go(); else img.addEventListener("load", go, { once: true });
}
safe("cover theme", () => {
  if (tb) tb.onclick = () => {
    coverTheme = !coverTheme;
    LS.set("detune-cover-theme", coverTheme ? "1" : "0");
    syncTheme();
    note(coverTheme ? "Colours now follow the album cover." : "Classic blood-red theme.");
  };
  const cov = $("cover");
  if (cov) new MutationObserver(syncTheme).observe(cov, { childList: true });
  syncTheme();
});

/* slider knob "pop" on release (paired with the .range.pop CSS animation) */
document.addEventListener("pointerup", e => {
  const t = e.target;
  if (t && t.classList && t.classList.contains("range")) {
    t.classList.add("pop");
    setTimeout(() => t.classList.remove("pop"), 240);
  }
}, { capture: true });

/* ---------------------------------------------------------------------
   2. lyrics store + side panel
   --------------------------------------------------------------------- */
const P = $("lyrics"), B = $("lyrBody"), EB = $("lyrEditBox"), TX = $("lyrText");
let lines = [], synced = false, idx = -1, raw = "", hold = 0;
const key = () => "detune-lyr:" + (($("title") && $("title").textContent) || "") + "|" + (($("artist") && $("artist").textContent) || "");
const hasTrack = () => { const t = $("title"); return !!t && t.textContent !== "Nothing playing"; };

function parse(txt) {
  txt = String(txt).replace(/\r/g, "");
  const out = [], tre = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  let off = 0, any = false;
  for (const ln of txt.split("\n")) {
    const om = ln.match(/^\[offset:\s*(-?\d+)\]/i);
    if (om) { off = +om[1] / 1000; continue; }
    if (/^\[[a-z]{2,6}:[^\]]*\]\s*$/i.test(ln)) continue;
    const times = [];
    let m;
    tre.lastIndex = 0;
    while ((m = tre.exec(ln))) times.push(+m[1] * 60 + +m[2] + (m[3] ? +("0." + m[3]) : 0));
    const s = ln.replace(tre, "").replace(/<\d+:\d+(?:\.\d+)?>/g, "").trim();
    if (times.length) { any = true; for (const t of times) out.push({ t: Math.max(0, t + off), s }); }
    else out.push({ t: null, s });
  }
  return any
    ? { synced: true, lines: out.filter(l => l.t !== null).sort((x, y) => x.t - y.t) }
    : { synced: false, lines: out };
}

function render() {
  if (!B) return;
  B.replaceChildren();
  idx = -1;
  if (!lines.length) {
    const e = document.createElement("div");
    e.className = "lyrempty";
    e.innerHTML = '<i class="fa-solid fa-microphone-lines"></i><p>No lyrics for this track yet.</p><span>Import a .lrc or .txt file, or use the pen to paste the text.</span>';
    B.append(e);
    return;
  }
  const f = document.createDocumentFragment();
  lines.forEach((l, i) => {
    const p = document.createElement("p");
    p.className = "lyr" + (synced ? " syn" : "") + (l.s ? "" : " gap");
    p.textContent = l.s || "\u266A";
    if (synced) { p.tabIndex = 0; p.dataset.i = i; }
    f.append(p);
  });
  B.append(f);
  tick(true);
}

/* reads the stored lyrics for the current track into lines/synced and redraws the panel */
function loadCore() {
  raw = LS.get(key()) || "";
  const r = raw ? parse(raw) : { synced: false, lines: [] };
  lines = r.lines;
  synced = r.synced;
  const lt = $("lyrTitle");
  if (lt) lt.textContent = hasTrack() ? $("title").textContent : "Lyrics";
  render();
}

function tick(force) {
  if (!B || !synced || !lines.length) return;
  const t = a.currentTime + .15;
  let i = -1;
  for (let k = 0; k < lines.length; k++) { if (lines[k].t <= t) i = k; else break; }
  if (i === idx && !force) return;
  if (B.children[idx]) B.children[idx].classList.remove("on");
  idx = i;
  const el = B.children[i];
  if (!el) return;
  el.classList.add("on");
  if (P && !P.hidden && Date.now() > hold) {
    B.scrollTo({ top: el.offsetTop - B.clientHeight / 2 + el.clientHeight / 2, behavior: (lite || force) ? "auto" : "smooth" });
  }
}
a.addEventListener("timeupdate", () => tick());
a.addEventListener("seeked", () => tick(true));
if (B) {
  for (const ev of ["wheel", "touchmove"]) B.addEventListener(ev, () => { hold = Date.now() + 3500; }, { passive: true });
  B.addEventListener("click", e => {
    const p = e.target.closest(".syn");
    const ln = p && lines[+p.dataset.i];
    if (ln) { a.currentTime = ln.t; hold = 0; }
  });
  B.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.classList.contains("syn")) e.target.click(); });
}

function save(txt) {
  if (!hasTrack()) return note("Pick a track first.");
  if (!txt.trim()) { LS.del(key()); load(); return; }
  if (!LS.set(key(), txt)) return note("Browser storage is full. Could not save the lyrics.");
  load();
  note(synced ? "Synced lyrics saved. Click a line to jump to it." : "Lyrics saved.");
}
function edit(v) {
  if (EB) EB.hidden = !v;
  if (B) B.hidden = v;
  if (v && TX) { TX.value = raw; TX.focus(); }
}
function open(v) {
  if (!P) return;
  P.hidden = !v;
  const lb = $("lyricsBtn");
  if (lb) lb.setAttribute("aria-expanded", String(v));
  if (v) { load(); setTimeout(() => tick(true), 30); } else edit(false);
}
bind("lyricsBtn", () => { if (P) open(P.hidden); });
bind("lyrClose", () => open(false));
bind("lyrEdit", () => { if (!hasTrack()) return note("Pick a track first."); edit(EB ? EB.hidden : true); });
bind("lyrCancel", () => edit(false));
bind("lyrSave", () => { save(TX ? TX.value : ""); edit(false); });
bind("lyrClear", () => { if (raw && confirm("Remove the lyrics for this track?")) save(""); });
bind("lyrImport", () => { if (!hasTrack()) return note("Pick a track first."); const f = $("lyrFile"); if (f) f.click(); });
{
  const lf = $("lyrFile");
  if (lf) lf.onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 1048576) return note("That file is too large for lyrics (max 1 MB).");
    try { save(await f.text()); } catch { note("Could not read that file."); }
  };
}

/* ---------------------------------------------------------------------
   3. LRCLIB lookup (https://lrclib.net/docs)
   Local-first: only title/artist/duration of the ONE track leave the browser.
   --------------------------------------------------------------------- */
const lrcBusy = { on: false };
async function lrcFetchJson(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
    clearTimeout(to);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}
async function fetchLrc(manual) {
  const C_ = window.DetuneCore;
  if (!C_) return note("Lyrics lookup needs core.js - reload the page.");
  if (!hasTrack()) return note("Pick a track first.");
  if (lrcBusy.on) return;
  const title = $("title").textContent.trim(), artist = $("artist").textContent.trim();
  const dur = Math.round(+a.duration || 0) || undefined;
  const net = $("lyrNet");
  lrcBusy.on = true;
  if (net) { net.setAttribute("aria-disabled", "true"); net.classList.add("busy"); }
  const finish = () => {
    lrcBusy.on = false;
    if (net) { net.removeAttribute("aria-disabled"); net.classList.remove("busy"); }
  };
  try {
    let txt = null;
    const u1 = C_.lrcSyncedUrl({ artist, title, duration: dur });
    if (u1) {
      try { txt = C_.lrcPick(await lrcFetchJson(u1)); }
      catch (e) { if (e.name !== "AbortError") console.warn("LRCLIB /get failed", e); }
    }
    if (!txt) {
      const u2 = C_.lrcSearchUrl({ artist, title });
      if (u2) {
        try { txt = C_.lrcPick(await lrcFetchJson(u2)); }
        catch (e) { if (e.name !== "AbortError") console.warn("LRCLIB /search failed", e); }
      }
    }
    if (txt) { save(txt); note("Lyrics fetched from LRCLIB."); }
    else note(manual ? "No lyrics found on LRCLIB for this track." : "Nothing found on LRCLIB.");
  } catch (e) {
    console.warn("LRCLIB request failed", e);
    note(e && e.name === "AbortError" ? "Lyrics lookup timed out - check your connection." : "Lyrics lookup unavailable offline.");
  } finally { finish(); }
}
bind("lyrNet", () => fetchLrc(true));

/* load = loadCore + refresh the full-screen shower + one automatic LRCLIB try.
   (kept identical to the old behaviour: the automatic lookup only runs while the
   cover-colour theme is on.) */
const autoFetched = new Set();
function load() {
  loadCore();
  shSync();
  if (coverTheme && window.DetuneCore && !raw && hasTrack() && navigator.onLine !== false) {
    const k = key();
    if (!autoFetched.has(k)) {
      autoFetched.add(k);
      setTimeout(() => { if (!raw && key() === k) fetchLrc(false); }, 400);
    }
  }
}
let loadT = 0;
const loadSoon = () => { clearTimeout(loadT); loadT = setTimeout(load, 60); };
for (const el of [$("title"), $("artist")]) {
  if (el) new MutationObserver(loadSoon).observe(el, { childList: true, characterData: true, subtree: true });
}

/* ---------------------------------------------------------------------
   4. full-screen lyric shower
   --------------------------------------------------------------------- */
const SH = $("lshower"), SHB = $("lshBody"), SHA = $("lshArt"), SHB2 = $("lshArtB"), SHC = $("lshCover");
const SHT = $("lshTitle"), SHAR = $("lshArtist"), SK = $("lshSeek");
const SHBG = SH ? SH.querySelector(".lshower-bg") : null;
let shIdx = -1, shHold = 0, shPrev = null, shBgTop = true, shSeeking = false, shLastSrc = "", shCloseT = 0, shClosing = false;
const shIsOpen = () => !!SH && !SH.hidden;

/* the shower and its close button must be direct children of the right parents so no
   transformed/overflowing ancestor can clip them (older cached markup nested them) */
try { if (SH && SH.parentNode !== document.body) document.body.appendChild(SH); } catch { /* ignore */ }
try { const CL = $("lshClose"); if (CL && SH && CL.parentNode !== SH) SH.prepend(CL); } catch { /* ignore */ }

const fmtT = n => (Number.isFinite(n) && n >= 0 ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}` : "0:00");
/* "/" separates multiple artists in the metadata - show ", " instead */
const shArtist = t => String(t == null ? "" : t).replace(/\//g, ", ").trim();

const shNoArt = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='38%25' r='75%25'%3E%3Cstop offset='0' stop-color='%236b0912'/%3E%3Cstop offset='1' stop-color='%230a0406'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23g)'/%3E%3Ctext x='200' y='248' font-size='150' text-anchor='middle' fill='%23ff3b47' fill-opacity='.5' font-family='Georgia,serif'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";
/* cover source: the <img> inside #cover, else a themed placeholder.
   (The audio element's blob URL is NOT an image - never use it here.) */
function shCoverSrc() {
  try {
    const c = $("cover"), im = c && c.querySelector("img");
    if (im && im.src) return im.src;
  } catch { /* ignore */ }
  return shNoArt;
}
/* a cover that fails to decode falls back to the placeholder instead of a broken-image icon */
for (const im of [SHA, SHB2, SHC]) {
  if (im) im.onerror = () => { if (im.getAttribute("src") !== shNoArt) im.src = shNoArt; };
}

function shMeta() {
  const t = hasTrack() ? (($("title") && $("title").textContent) || "") : "";
  const ar = hasTrack() ? shArtist(($("artist") && $("artist").textContent) || "") : "";
  if (SHT) SHT.textContent = t || "Nothing playing";
  if (SHAR) SHAR.textContent = ar || "Add a song to begin";
}

/* two stacked blurred copies of the cover CROSSFADE on track change; the mesh is rebuilt from the
   new cover. Idempotent per cover URL so several triggers in a row cause only one rebuild. */
function shArt(force) {
  if (!SHA || !SHB2) return;
  const src = shCoverSrc();
  if (!force && src === shLastSrc) return;
  shLastSrc = src;
  const top = shBgTop ? SHA : SHB2, bot = shBgTop ? SHB2 : SHA;
  shBgTop = !shBgTop;
  if (top.getAttribute("src") !== src) top.src = src;
  top.classList.add("lsh-vis");
  top.classList.remove("lsh-gone");
  top.style.setProperty("--bg-bass", "0");
  bot.classList.remove("lsh-vis");
  bot.classList.add("lsh-gone");
  if (SHC) { SHC.src = src; SHC.style.display = ""; }
  meshForSrc(src);
}
let shArtT = 0;
const shArtSoon = () => { clearTimeout(shArtT); shArtT = setTimeout(() => { if (shIsOpen()) shArt(false); }, 80); };

/* ---- lyric lines ---- */
function shDepth() {
  if (lite || !synced || !SHB) return;
  const ch = SHB.children;
  for (let k = 0; k < ch.length; k++) {
    const c = ch[k];
    c.classList.remove("pn1", "pn2", "pn3", "pnf");
    if (k === shIdx || c.classList.contains("on")) continue;
    const d = Math.abs(k - shIdx);
    c.classList.add(d <= 1 ? "pn1" : d === 2 ? "pn2" : d === 3 ? "pn3" : "pnf");
  }
}
function shRender() {
  if (!SHB) return;
  SHB.replaceChildren();
  shIdx = -1;
  if (!lines.length) {
    const e = document.createElement("div");
    e.className = "lshower-empty";
    const i0 = document.createElement("i");
    i0.className = "fa-solid fa-align-left";
    const p0 = document.createElement("p");
    p0.textContent = "No lyrics for this track.";
    const s0 = document.createElement("span");
    s0.textContent = "Velo Player © 2026.";
    e.append(i0, p0, s0);
    SHB.append(e);
    return;
  }
  const f = document.createDocumentFragment();
  lines.forEach((l, i) => {
    const p = document.createElement("p");
    p.className = "lyr" + (synced ? " syn" : "") + (l.s ? "" : " gap");
    p.textContent = l.s || "";
    if (synced) p.dataset.i = i;
    f.append(p);
  });
  SHB.append(f);
  shTick(true);
}
function shScrollTo(el) {
  if (!el || !SHB) return;
  SHB.scrollTo({ top: Math.max(0, el.offsetTop - SHB.clientHeight / 3), behavior: (lite || R.dataset.shInit === "0") ? "auto" : "smooth" });
}
function shTick(force) {
  if (!SHB || !synced || !lines.length || !shIsOpen()) return;
  const t = a.currentTime + .25;
  let i = -1;
  for (let k = 0; k < lines.length; k++) { if (lines[k].t <= t) i = k; else break; }
  if (i === shIdx && !force) return;
  const prevEl = SHB.children[shIdx];
  if (!(prevEl && prevEl.classList.contains("on"))) shProgress(); /* lyric-jump / arrow-key seeks: fill must follow instantly */
  if (prevEl) prevEl.classList.remove("on");
  shIdx = i;
  const el = SHB.children[i];
  if (el) el.classList.add("on");
  shDepth();
  if (Date.now() > shHold) shScrollTo(el);
}

/* ---------------------------------------------------------------------
   5. mesh background: colours from the cover -> big blurred blobs that drift,
      slowly rotate and PUNCH on the kick drum
   --------------------------------------------------------------------- */
const MPOS = [[46, 40], [16, 22], [78, 24], [24, 78], [74, 70]];
const MSZ = ["72vmax", "60vmax", "78vmax", "66vmax", "84vmax"];
const MF = [{ a: .30, b: .22, c: .16, d: .26 }, { a: .24, b: .34, c: .22, d: .14 }, { a: .34, b: .18, c: .12, d: .28 },
  { a: .2, b: .28, c: .32, d: .18 }, { a: .28, b: .22, c: .26, d: .32 }];
let meshWrap = null, mesh = null, meshSpinEl = null, meshBlobs = [], meshT = 0, meshSpin = 0, meshToken = 0;
let shEnv = 0; /* smoothed kick envelope 0..1 (written by the loop in section 6, read by meshDrift) */

/* up to 5 REAL dominant colours as "r g b" strings (0-255) for CSS rgb(var(--c) / a).
   Grayscale covers stay gray. Returns null if the canvas is unreadable (CORS-tainted). */
function meshColors(img) {
  try {
    if (!img || !img.complete || !img.naturalWidth) return null;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data; /* throws SecurityError if tainted -> caught -> null */

    /* 1. bucket pixels: 12 hues x 3 lightness steps; near-grays get 4 lightness buckets of their own */
    const bins = {};
    let count = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, df = mx - mn;
      let k;
      if (df <= .04) k = "A" + Math.min(3, (l * 4) | 0);
      else {
        let h = mx === r ? ((g - b) / df) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4;
        h = (h * 60 + 360) % 360;
        k = ((h / 30) | 0) + (l < .34 ? "L" : l < .67 ? "M" : "H");
      }
      const e = bins[k] || (bins[k] = { r: 0, g: 0, b: 0, n: 0 });
      e.r += r; e.g += g; e.b += b; e.n++;
      count++;
    }
    if (count < 6) return null;

    /* 2. average each bucket, rank by size x colourfulness (a small vivid accent can beat a big dull area) */
    const cand = Object.values(bins).filter(e => e.n >= 2).map(e => {
      const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return { r, g, b, l: (mx + mn) / 2, score: e.n * (.3 + (mx - mn) * 2) };
    }).sort((p, q) => q.score - p.score);

    /* 3. pick up to 5: strict distinctness first, then relax so the slots still fill */
    const out = [];
    for (const th of [.17, .08]) {
      for (const p of cand) {
        if (out.length >= 5) break;
        if (!out.includes(p) && out.every(o => Math.hypot(p.r - o.r, p.g - o.g, p.b - o.b) > th)) out.push(p);
      }
    }
    if (!out.length) return null;

    /* 4. to "r g b" strings with a real saturation boost (grays stay gray) */
    const res = out.map(p => {
      let { r, g, b } = p;
      if (p.l > .7) { r *= .82; g *= .82; b *= .82; } /* tame near-white so the lyrics stay readable */
      const y = .299 * r + .587 * g + .114 * b, k = 1.4;
      r = Math.max(0, Math.min(1, y + (r - y) * k));
      g = Math.max(0, Math.min(1, y + (g - y) * k));
      b = Math.max(0, Math.min(1, y + (b - y) * k));
      return `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
    });

    /* 5. always 5 colours (one per blob position): pad with lighter/darker variants */
    const base = res.length;
    while (res.length < 5) {
      const [r, g, b] = res[res.length % base].split(" ").map(Number), f = res.length % 2 ? .75 : 1.2;
      res.push(`${Math.min(255, Math.round(r * f))} ${Math.min(255, Math.round(g * f))} ${Math.min(255, Math.round(b * f))}`);
    }
    return res;
  } catch { return null; }
}
/* ONLY used when the cover can't be read: neutral dark grays (never theme red) */
function meshFallback() {
  return ["0.10 0.10 0.11", "0.16 0.16 0.18", "0.07 0.07 0.08", "0.22 0.22 0.24", "0.12 0.12 0.13"].map(s => {
    const [r, g, b] = s.split(" ").map(Number);
    return `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
  });
}
/* sample colours for a cover URL, then build the mesh. Uses an already-loaded <img> when possible
   (instant), otherwise decodes the URL first - never reads a half-loaded image. */
function meshForSrc(src) {
  const token = ++meshToken;
  const apply = cols => { if (token === meshToken) meshSet(cols && cols.length ? cols : meshFallback()); };
  try {
    const cov = $("cover");
    for (const im of [SHC, cov && cov.querySelector("img")]) {
      if (im && im.complete && im.naturalWidth && (im.currentSrc || im.src) === src) {
        const c = meshColors(im);
        if (c) return apply(c);
      }
    }
  } catch { /* fall through to the probe */ }
  const p = new Image();
  try { if (/^https?:/i.test(src) && new URL(src, location.href).origin !== location.origin) p.crossOrigin = "anonymous"; } catch { /* ignore */ }
  p.onload = () => apply(meshColors(p));
  p.onerror = () => apply(null);
  p.src = src;
}
/* structure:  .bg-pulse (bass scale/opacity/brightness via --bg-bass, NO css animation on transform)
                 > .lsh-mesh > .lsh-spin (rotation only) > .lsh-blob (drift only) */
function meshSet(cols) {
  if (!SHBG) return;
  const w = document.createElement("div");
  w.className = "bg-pulse lsh-mesh-in";
  w.setAttribute("aria-hidden", "true");
  const m = document.createElement("div");
  m.className = "lsh-mesh";
  w.append(m);
  const sp = document.createElement("div");
  sp.className = "lsh-spin";
  m.append(sp);
  const blobs = [];
  cols.slice(0, 5).forEach((rgb, i) => {
    const b = document.createElement("div");
    b.className = "lsh-blob";
    b.style.setProperty("--c", rgb);
    b.style.setProperty("--x", MPOS[i][0] + "%");
    b.style.setProperty("--y", MPOS[i][1] + "%");
    b.style.setProperty("--sz", MSZ[i]);
    b.dataset.i = i;
    b.dataset.t = (Math.random() * 20).toFixed(2);
    b.dataset.ph = (Math.random() * 6.283).toFixed(2);
    sp.append(b);
    blobs.push(b);
  });
  const old = meshWrap ? { w: meshWrap, m: mesh } : null;
  SHBG.prepend(w);
  if (old) {
    if (reduceMotion || lite) old.w.remove();
    else { /* ~1 s crossfade old -> new colours, then drop the old layer for good */
      old.m.classList.remove("lsh-mesh-in");
      old.m.classList.add("lsh-mesh-out");
      setTimeout(() => old.w.remove(), 1100);
    }
  }
  meshWrap = w; mesh = m; meshSpinEl = sp; meshBlobs = blobs;
  meshDrift(0);
}
/* slow drift on lissajous paths; the kick envelope scales/brightens the blobs a little */
function meshDrift(dt) {
  if (!mesh) return;
  const bass = shEnv;
  meshT += dt * (1 + bass * .7);
  meshSpin += dt * (6 + bass * 4); /* deg/s: one turn per 60 s, up to ~1.7x faster on the kick */
  if (meshSpinEl) meshSpinEl.style.setProperty("--lshSpin", (meshSpin % 360).toFixed(2) + "deg");
  for (const b of meshBlobs) {
    const i = +b.dataset.i || 0, f = MF[i] || MF[0], ph = +b.dataset.ph;
    const x = meshT * (.55 + (+b.dataset.t || 0) * .05);
    b.style.setProperty("--tx", (Math.sin(x * f.a + ph) * 9).toFixed(2) + "%");
    b.style.setProperty("--ty", (Math.cos(x * f.b + ph * 1.7) * 8).toFixed(2) + "%");
    const sc = 1 + bass * .2;
    b.style.setProperty("--sx", sc.toFixed(3));
    b.style.setProperty("--sy", (sc * (1 + .05 * Math.sin(x * f.c + ph))).toFixed(3));
    b.style.opacity = (.62 + bass * .22).toFixed(3);
  }
}

/* ---------------------------------------------------------------------
   6. KICK DETECTOR (own native AnalyserNode - no external library)
   Taps the FINAL master gain of the app's existing audio graph as a pure probe:
   an AnalyserNode adds no audible path, createMediaElementSource is never called.
   Falls back to fx.js's analyser if the graph isn't published yet.
   Pulse = how far the 40-110 Hz band jumps ABOVE its own ~0.5 s average (a kick
   transient), auto-gained, with instant attack (~12 ms) and ~130 ms release.
   --------------------------------------------------------------------- */
const graph = () => window.DetuneApp && window.DetuneApp.audioGraph;
let shCtx = null, shAn = null, shMaster = null, shBnode = null, shBuf = null;
let shRun = false, shRaf = 0, shLast = 0, shLinkT = 0, shRaw = 0, shAvg = -1, shPeak = .05, driftAcc = 0;
let shDbg = null;

/* (re)connect the probe; cheap, safe to call repeatedly (graph may be published late or replaced) */
function shLink() {
  const G = graph();
  if (!G || !G.ctx || !G.master) return false;
  try {
    if (shCtx !== G.ctx) { shCtx = G.ctx; shAn = null; shMaster = null; shBnode = null; }
    if (!shAn) {
      shAn = shCtx.createAnalyser();
      shAn.fftSize = 2048;
      shAn.smoothingTimeConstant = .1;
      shAn.minDecibels = -90;
      shAn.maxDecibels = -20;
      shBuf = new Uint8Array(shAn.frequencyBinCount);
    }
    if (shMaster !== G.master) {
      if (shMaster) { try { shMaster.disconnect(shAn); } catch { /* ignore */ } }
      G.master.connect(shAn);
      shMaster = G.master;
    }
    const bn = G.bAnalyser || null; /* deck B tap, live during crossfades */
    if (bn !== shBnode) {
      if (shBnode) { try { shBnode.disconnect(shAn); } catch { /* ignore */ } }
      if (bn && bn !== shAn) { try { bn.connect(shAn); } catch { /* ignore */ } }
      shBnode = bn;
    }
    return true;
  } catch { return false; }
}
function shUnlink() {
  if (shAn) {
    if (shMaster) { try { shMaster.disconnect(shAn); } catch { /* ignore */ } }
    if (shBnode) { try { shBnode.disconnect(shAn); } catch { /* ignore */ } }
  }
  shMaster = null; shBnode = null;
}
/* suspended context (autoplay policy): resume on any user interaction */
for (const ev of ["pointerdown", "keydown", "touchstart", "click"]) {
  document.addEventListener(ev, () => {
    try { const G = graph(); if (G && G.ctx && G.ctx.state === "suspended") G.ctx.resume().catch(() => {}); } catch { /* ignore */ }
  }, { passive: true });
}
/* mean level (0..1) of the kick band, or -1 if no analyser exists at all */
function shReadLow() {
  let an = shMaster ? shAn : null;
  if (!an) { const FX = window.DetuneFX; an = (FX && FX.analyser) || null; }
  if (!an) return -1;
  const n = an.frequencyBinCount;
  if (!shBuf || shBuf.length !== n) shBuf = new Uint8Array(n);
  an.getByteFrequencyData(shBuf);
  const hz = an.context.sampleRate / an.fftSize;
  const lo = Math.max(1, Math.round(40 / hz));
  let hi = Math.min(n - 1, Math.round(110 / hz));
  if (hi < lo) hi = lo;
  let s = 0, c = 0;
  for (let i = lo; i <= hi; i++) { s += shBuf[i]; c++; }
  return c ? s / c / 255 : 0;
}
function shMeasure(dt) {
  const r = shReadLow();
  if (r < 0) { shRaw = 0; shEnv += (0 - shEnv) * (1 - Math.exp(-dt / .2)); return shEnv; }
  shRaw = r;
  if (shAvg < 0) shAvg = r; /* no start-up pop */
  shAvg += (r - shAvg) * (1 - Math.exp(-dt / .5));
  const kick = Math.max(0, r - shAvg);
  shPeak = Math.max(kick, shPeak * Math.exp(-dt / 3)); /* auto-gain: adapts to quiet / loud tracks */
  const hit = Math.pow(Math.min(1, kick / Math.max(.04, shPeak)), 1.3);
  const target = Math.min(1, hit * .92 + r * .08);
  shEnv += (target - shEnv) * (1 - Math.exp(-dt / (target > shEnv ? .012 : .13)));
  return shEnv;
}
/* the ONE animation loop: bass envelope (every frame, for punch) + drift (~30 fps) */
function shLoop(t) {
  if (!shRun) return;
  shRaf = requestAnimationFrame(shLoop);
  let dt = (t - shLast) / 1000;
  shLast = t;
  if (!(dt > 0) || dt > .25) dt = 1 / 60;
  if (document.hidden) return;
  if (t - shLinkT > 1000) { shLinkT = t; shLink(); }
  const env = shMeasure(dt);
  if (meshWrap) meshWrap.style.setProperty("--bg-bass", env.toFixed(3));
  if (mesh) {
    mesh.style.setProperty("--lshBass", env.toFixed(3));
    if (!lite) { driftAcc += dt; if (driftAcc >= 1 / 30) { meshDrift(driftAcc); driftAcc = 0; } }
  }
  if (shDbg) shDbg.textContent = "bass raw " + shRaw.toFixed(3) + " \u00B7 avg " + Math.max(0, shAvg).toFixed(3) + " \u00B7 hit " + shEnv.toFixed(3) + (shMaster ? "" : " \u00B7 (fx analyser)");
}
function shBassStart() {
  if (shRun || reduceMotion) return; /* reduced motion: static background, no pulse */
  shRun = true;
  shAvg = -1; shPeak = .05; shEnv = 0; driftAcc = 0;
  shLink();
  shLast = performance.now();
  shLinkT = shLast;
  shRaf = requestAnimationFrame(shLoop);
}
function shBassStop() {
  shRun = false;
  if (shRaf) { cancelAnimationFrame(shRaf); shRaf = 0; }
  if (meshWrap) meshWrap.style.removeProperty("--bg-bass");
  if (mesh) mesh.style.removeProperty("--lshBass");
  shEnv = 0;
  shUnlink();
}
function dbgToggle(on) {
  if (on) {
    if (shDbg) return;
    const d = document.createElement("div");
    d.id = "ama-dbg";
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = "position:fixed;left:12px;bottom:10px;z-index:2147483647;font:12px/1.2 ui-monospace,Consolas,monospace;color:rgba(255,255,255,.8);background:rgba(0,0,0,.5);padding:4px 8px;border-radius:6px;pointer-events:none";
    d.textContent = "bass ...";
    document.body.append(d);
    shDbg = d;
  } else if (shDbg) { shDbg.remove(); shDbg = null; }
}
/* console helpers:  DetuneAMA.state()   DetuneAMA.debug(true)  (shows a live readout bottom-left) */
window.DetuneAMA = {
  state: () => ({
    open: shIsOpen(), running: shRun, graph: !!graph(), wired: !!(shAn && shMaster),
    raw: +shRaw.toFixed(3), avg: +Math.max(0, shAvg).toFixed(3), hit: +shEnv.toFixed(3),
    colors: meshBlobs.map(b => b.style.getPropertyValue("--c"))
  }),
  debug: v => dbgToggle(v !== false),
  kill: () => shBassStop()
};

/* ---------------------------------------------------------------------
   7. shower chrome: title, progress, play state, shuffle/repeat mirrors
   --------------------------------------------------------------------- */
/* The bar is an <input type=range>; the white fill is painted by CSS from --progress.
   Always exactly currentTime/duration*100 (fx.js's global --p is frozen while the shower is open). */
function shProgress() {
  if (!SK) return;
  const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
  const t = Math.max(0, Math.min(a.currentTime || 0, d));
  const p = d ? Math.min(100, t / d * 100) : 0;
  SK.style.setProperty("--progress", p.toFixed(2) + "%");
  SK.style.setProperty("--p", p.toFixed(2) + "%");
  if (!shSeeking) SK.value = String(Math.round(p * 10));
}
/* mirror the MAIN player's real shuffle/repeat state onto the overlay buttons */
function shModes() {
  const s = $("shuffle"), r = $("repeat"), SB = $("lshShuffle"), RB = $("lshRepeat");
  if (SB && s) {
    const on = s.getAttribute("aria-pressed") === "true";
    SB.classList.toggle("on", on);
    SB.setAttribute("aria-pressed", String(on));
  }
  if (RB && r) {
    const m = /one/.test(r.textContent) ? "one" : /all/.test(r.textContent) ? "all" : "off";
    RB.classList.toggle("on", m !== "off");
    RB.classList.toggle("one", m === "one");
    RB.setAttribute("aria-pressed", String(m !== "off"));
    RB.title = "Repeat (" + m + ") (R)";
  }
}
function shUI() {
  if (!shIsOpen()) return;
  const cu = $("lshCur");
  if (cu) cu.textContent = fmtT(a.currentTime);
  /* Apple-style: elapsed on the left, REMAINING as -m:ss on the right */
  const du = $("lshDur");
  if (du) du.textContent = Number.isFinite(a.duration) ? "-" + fmtT(Math.max(0, a.duration - a.currentTime)) : fmtT(a.duration);
  shProgress();
  shModes();
  const playing = !a.paused && !a.ended;
  const pi = $("lshPlayIcon");
  if (pi) pi.innerHTML = playing ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
  const pb = $("lshPlay");
  if (pb) pb.setAttribute("aria-label", playing ? "Pause" : "Play");
}
/* a track change while open only updates CONTENT - the left column itself is static markup */
function shSync() {
  if (!shIsOpen() || shClosing) return;
  shMeta();
  shArt(false);
  shRender();
  shUI();
}

/* ---------------------------------------------------------------------
   8. open / close
   --------------------------------------------------------------------- */
function shFsOff() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      const p = document.exitFullscreen();
      if (p && p.catch) p.catch(() => {});
    }
  } catch { /* ignore */ }
}
function shOpen(v) {
  if (!SH) return;
  if (v) {
    if (shClosing) { /* re-opened during the fade-out: finish the close instantly, then open fresh */
      clearTimeout(shCloseT);
      shClosing = false;
      SH.hidden = true;
      R.classList.remove("lsh-out");
      document.body.classList.remove("lsh-out");
      shBassStop();
    }
    if (shIsOpen()) return;
    if (!hasTrack()) return note("Pick a track first.");
    R.classList.remove("lsh-out");
    SH.classList.remove("lsh-out");
    document.body.classList.remove("lsh-out");
    shPrev = document.activeElement;
    loadCore();
    SH.hidden = false;
    document.body.style.overflow = "hidden";
    document.body.classList.add("lyrshow-open");
    /* pause ALL background painting while fullscreen - the shower covers everything */
    if (window.DetuneFX) window.DetuneFX.freeze = true;
    /* real browser fullscreen from inside the user gesture; if denied, the fixed overlay already covers the viewport */
    try {
      const p = R.requestFullscreen && R.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch { /* ignore */ }
    shArt(false);
    shMeta();
    shRender();
    shUI();
    shBassStart();
    R.dataset.shInit = "0";
    setTimeout(() => {
      shTick(true);
      const el = SHB && SHB.children[Math.max(shIdx, 0)];
      if (el) SHB.scrollTop = Math.max(0, el.offsetTop - SHB.clientHeight / 3);
      R.dataset.shInit = "1";
      const cl = $("lshClose");
      if (cl) cl.focus();
    }, 60);
  } else {
    if (!shIsOpen() || shClosing) return;
    shFsOff();
    shClosing = true;
    /* fade ONLY the root overlay (one opacity transition); no child style is touched */
    const finish = () => { shClosing = false; SH.hidden = true; R.classList.remove("lsh-out"); document.body.classList.remove("lsh-out"); shBassStop(); };
    clearTimeout(shCloseT);
    /* extras.css: `body.lsh-out .lshower{opacity:0}` with a .42 s transition -> the class belongs on <body> */
    if (!lite) { document.body.classList.add("lsh-out"); shCloseT = setTimeout(finish, 430); } else finish();
    document.body.style.overflow = "";
    document.body.classList.remove("lyrshow-open");
    if (shPrev && document.contains(shPrev)) shPrev.focus();
    if (window.DetuneFX) {
      window.DetuneFX.freeze = false;
      if (!document.hidden && window.__detuneFxWake) window.__detuneFxWake();
    }
  }
  SH.dispatchEvent(new CustomEvent("detune-shower", { detail: v }));
}

/* ---------------------------------------------------------------------
   9. wiring (every lookup is null-guarded so a missing element can never break load)
   --------------------------------------------------------------------- */
bind("lshClose", () => shOpen(false));
bind("lshPlay", () => { if (a.paused) a.play().catch(() => {}); else a.pause(); });
bind("lshPrev", () => { const e = $("prev"); if (e) e.click(); });
bind("lshNext", () => { const e = $("next"); if (e) e.click(); });
/* shuffle / repeat proxy the MAIN player's buttons (single source of truth) */
bind("lshShuffle", () => { const e = $("shuffle"); if (e) e.click(); shModes(); });
bind("lshRepeat", () => { const e = $("repeat"); if (e) e.click(); shModes(); });

if (SK) {
  SK.addEventListener("input", () => {
    shSeeking = true;
    SK.classList.add("lsh-drag");
    if (Number.isFinite(a.duration)) { a.currentTime = a.duration * (+SK.value / 1000); shProgress(); }
  });
  const endSeek = () => { shSeeking = false; SK.classList.remove("lsh-drag"); shProgress(); };
  SK.addEventListener("change", endSeek);
  SK.addEventListener("pointerup", endSeek);
  shProgress();
}
/* #shuffle / #repeat can also be toggled from the main app or the S/R keys - follow them live */
for (const id of ["shuffle", "repeat"]) {
  const el = $(id);
  if (el) new MutationObserver(shModes).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
}
for (const ev of ["timeupdate", "durationchange", "play", "pause", "ended"]) a.addEventListener(ev, shUI);
a.addEventListener("seeked", shProgress); /* never leave the fill at a hover / seek-preview position */
a.addEventListener("timeupdate", () => shTick());
a.addEventListener("seeked", () => shTick(true));

/* title/artist text updates instantly while open; the heavy refresh goes through load() (debounced) */
for (const el of [$("title"), $("artist")]) {
  if (el) new MutationObserver(() => { if (shIsOpen()) shMeta(); }).observe(el, { childList: true, characterData: true, subtree: true });
}
{
  const cov = $("cover");
  if (cov) new MutationObserver(() => { if (shIsOpen()) shArtSoon(); }).observe(cov, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
}

if (SH) {
  SH.addEventListener("click", e => {
    if (e.target === SH || e.target.classList.contains("lshower-frost") || e.target.classList.contains("lshower-bg")) shOpen(false);
  });
}
if (SHB) {
  SHB.addEventListener("click", e => {
    const p = e.target.closest(".syn");
    if (!p) return;
    const ln = lines[+p.dataset.i];
    if (!ln) return;
    a.currentTime = Math.max(0, ln.t - .3);
    shHold = 0;
    shTick(true);
  });
  for (const ev of ["wheel", "touchmove"]) SHB.addEventListener(ev, () => { shHold = Date.now() + 4000; }, { passive: true });
  SHB.addEventListener("keydown", e => {
    if (!synced) return;
    let n = null;
    if (e.key === "ArrowDown") n = Math.min(lines.length - 1, shIdx + 1);
    else if (e.key === "ArrowUp") n = Math.max(0, shIdx - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = lines.length - 1;
    else if (e.key === "Enter" && e.target.classList.contains("syn")) { e.target.click(); return; }
    if (n != null) {
      e.preventDefault();
      const el = SHB.children[n];
      if (el) { a.currentTime = Math.max(0, lines[n].t - .3); shHold = Date.now() + 4000; shTick(true); shScrollTo(el); }
    }
  });
}

document.addEventListener("keydown", e => {
  const k = String(e.key || "");
  if (k === "Escape" && shIsOpen()) { shOpen(false); e.stopPropagation(); return; }
  if (k === "Escape" && P && !P.hidden) { open(false); return; }
  const tg = e.target;
  if ((tg && tg.matches && tg.matches("input,textarea,select")) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (k.toLowerCase() === "l" && SH) shOpen(!shIsOpen() || shClosing);
});

{
  const ul = $("shortcuts") && $("shortcuts").querySelector("ul");
  if (ul) ul.insertAdjacentHTML("beforeend", "<li><b>L</b> \u2014 lyrics</li>");
}
safe("initial load", load);
})();
let lyrAnim = 0;
function easeScroll(el, to, ms = 650) {
  cancelAnimationFrame(lyrAnim);
  const from = el.scrollTop, d = to - from, t0 = performance.now();
  if (Math.abs(d) < 1) return;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.scrollTop = from + d * (1 - Math.pow(1 - k, 4)); // ease-out quart
    if (k < 1) lyrAnim = requestAnimationFrame(step);
  };
  lyrAnim = requestAnimationFrame(step);
}
/* let the user grab the lyrics without fighting the animation */
const lyrBody = document.querySelector(".lshower-body");
["wheel", "touchstart"].forEach(ev => lyrBody.addEventListener(ev, () => cancelAnimationFrame(lyrAnim), { passive: true }));

/* usage, with the same line your code already treats as active */
const active = lyrBody.querySelector(".lyr.on");
if (active) easeScroll(lyrBody, active.offsetTop - lyrBody.clientHeight * 0.3);