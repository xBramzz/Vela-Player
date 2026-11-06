/* Detune pitch processor — real-time, duration-preserving pitch shifter (hybrid).

   Design notes (audited Oct 2026):
   • At |cents| ≤ 0.5 the processor is BIT-EXACT passthrough (verified by tests/pitch-test.js).
     The old build also had this property, so DSP coloration at neutral was NOT the cause of the
     "everything sounds too high" report — that was a signal-routing/latch bug in app.js
     (preservesPitch is latched by browsers at play() time; changing it together with
     playbackRate in one tick made linked/unlinked modes double-apply or drop the shift).
   • When engaged, four Hann-windowed read heads sweep a ring-buffer delay line:
       - grain span is a CONSTANT WMAX (≈100 ms). (An earlier version's W formula always
         evaluated to WMAX, so "shorter grains for large shifts" never actually happened.)
       - heads stay quarter-phase apart so the windows sum to exactly 1.
       - linear interpolation taps with per-channel shared phase → stereo-safe.
       - smooth wet ramp (one-pole, ≈65 ms to 99 % at 48 kHz, ≈105 ms until bypass resumes)
         prevents clicks on rapid slider movement.
       - NaN/runaway guard per sample.
   • ratio = 2^(cents/1200); 0 c = identity, +100 c = one semitone up, ±1200 c = octave.
   • No allocation inside process(). k-rate parameter (see browser harness note in tests). */
class DetunePitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: "cents", defaultValue: 0, minValue: -1200, maxValue: 1200, automationRate: "k-rate" }];
  }
  constructor() {
    super();
    this.WMAX = Math.max(256, Math.round(sampleRate * 0.1)); // grain span ≈ 100 ms
    let size = 1; while (size < this.WMAX * 4 + 8) size <<= 1; // max read delay is W+1 (+1 for interpolation); 4×W leaves wide headroom
    this.mask = size - 1;
    this.buf = [new Float32Array(size), new Float32Array(size)];
    this.w = 0;      // write index
    this.phase = 0;  // 0..1 sweep phase of head 0
    this.mix = 0;    // 0 = dry (bit-exact), 1 = shifted (smoothed)
  }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!output || !output.length) return true;
    const frames = output[0].length, chOut = output.length;
    const cents = params.cents[0];
    const ratio = Math.pow(2, cents / 1200);
    const W = this.WMAX; // constant grain span: phase/delay stay continuous when cents changes
    const inc = (1 - ratio) / W;
    const wetTarget = Math.abs(cents) > 0.5 ? 1 : 0;
    const mask = this.mask, TWO_PI = 2 * Math.PI;
    const b0 = this.buf[0], b1 = this.buf[1];
    /* Resolve input channels once per block (mono feeds both delay lines). */
    const nIn = input ? input.length : 0;
    const in0 = nIn ? input[0] : null, in1 = nIn ? input[nIn > 1 ? 1 : 0] : null;
    let w = this.w, phase = this.phase, mix = this.mix;
    for (let i = 0; i < frames; i++) {
      // write input into delay lines (mono sources feed both channels; silence fills gaps)
      b0[w] = in0 ? in0[i] : 0;
      b1[w] = in1 ? in1[i] : 0;
      mix += (wetTarget - mix) * 0.0015;
      if (mix > 0.0005) {
        let p1 = phase + 0.25, p2 = phase + 0.5, p3 = phase + 0.75;
        if (p1 >= 1) p1 -= 1; if (p2 >= 1) p2 -= 1; if (p3 >= 1) p3 -= 1;
        /* Hann heads a quarter-cycle apart: 0.25-0.25cos(θ+kπ/2) → one sin + one cos instead of four cos. */
        const th = TWO_PI * phase, sn = Math.sin(th), cs = Math.cos(th);
        const g0 = 0.25 - 0.25 * cs, g1 = 0.25 + 0.25 * sn, g2 = 0.25 + 0.25 * cs, g3 = 0.25 - 0.25 * sn;
        const d0 = phase * W + 1, d1 = p1 * W + 1, d2 = p2 * W + 1, d3 = p3 * W + 1;
        for (let c = 0; c < chOut; c++) {
          const b = c ? b1 : b0; // channels ≥2 reuse the right delay line
          const wet = g0 * this.tap(b, w, d0) + g1 * this.tap(b, w, d1) + g2 * this.tap(b, w, d2) + g3 * this.tap(b, w, d3);
          let o = b[w] * (1 - mix) + wet * mix;
          if (!(o > -4 && o < 4)) o = 0; // never emit NaN / runaway samples
          output[c][i] = o;
        }
      } else {
        // Bit-exact bypass: copy input through untouched (identity at 0 cents).
        for (let c = 0; c < chOut; c++) {
          const src = nIn ? input[c < nIn ? c : nIn - 1] : null;
          output[c][i] = src ? src[i] : 0;
        }
      }
      phase += inc;
      phase -= Math.floor(phase); // wrap into [0,1)
      w = (w + 1) & mask;
    }
    this.w = w; this.phase = phase; this.mix = mix;
    return true;
  }
  tap(b, w, d) {
    const pos = w - d, i0 = Math.floor(pos), f = pos - i0;
    const a = b[i0 & this.mask], c = b[(i0 + 1) & this.mask];
    return a + (c - a) * f;
  }
}
registerProcessor("detune-pitch", DetunePitchProcessor);