/* DOPASOWANIE TEKSTU DO DŹWIĘKU (CTC), liczone na telefonie (nt-v101).
   Model: wav2vec2 MMS-300m do wymuszonego dopasowania (CC BY-NC 4.0), wagi int8 tylko dla MatMul, w kawałkach na gałęzi `model` tego repo (README tam opisuje pochodzenie i zmiany).
   Algorytm odtwarza pakiet ctc-forced-aligner: wejście 16 kHz mono, okna 30 s z kontekstem 2 s, log-softmax, kolumna <star> (31) z zerami, przed każdym słowem token <star>,
   Viterbi CTC. Krok czasu to dokładnie 0,02 s (pakiet zaokrągla go w górę do całych ms). Litery mają własne czasy (pojedyncza klatka 20 ms), więc początek sylaby = czas jej pierwszej litery.
   Plik działa w przeglądarce (window.NT_CTC) i w Node (testy: module.exports). */
(function (G) {
  'use strict';
  const VOC = {a:4,i:5,e:6,n:7,o:8,u:9,t:10,s:11,r:12,m:13,k:14,l:15,d:16,g:17,h:18,y:19,b:20,p:21,w:22,c:23,v:24,j:25,z:26,f:27,"'":28,q:29,x:30};
  const C = 32, STAR = 31, FR = 0.02, SR = 16000, CTX = 2 * SR, WIN = 30 * SR;
  const SPECIAL = {'ł':'l','ø':'o','đ':'d','ð':'d','ß':'ss','æ':'ae','œ':'oe','ı':'i','þ':'th'};
  const BASE = 'https://raw.githubusercontent.com/svvveri/notatnik/model/ctc/';
  const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  const CACHE = 'ctc-model-v1';

  /* litery słowa po normalizacji (małe, bez znaków diakrytycznych, tylko a-z i apostrof): [{oi: indeks znaku w oryginale, ch}] */
  function letters(word) {
    const w = String(word).toLowerCase(), out = [];
    for (let i = 0; i < w.length; i++) {
      let b = SPECIAL[w[i]];
      if (b === undefined) b = w[i].normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const c of b) if (VOC[c] !== undefined) out.push({oi: i, ch: c});
    }
    return out;
  }
  /* cele CTC: przed każdym słowem z literami token <star>; słowa bez liter (liczby, znaki) są pomijane */
  function prep(words, starEmpty) {
    const tg = [], tw = [], tl = [], L = words.map(letters);
    L.forEach((ls, wi) => {
      if (!ls.length) { if (starEmpty) { tg.push(STAR); tw.push(wi); tl.push(-1); } return; } /* starEmpty: jak pakiet (sama gwiazdka dla słowa bez liter), tylko do testów */
      tg.push(STAR); tw.push(wi); tl.push(-1);
      ls.forEach((x, li) => { tg.push(VOC[x.ch]); tw.push(wi); tl.push(li); });
    });
    return {tg: Int32Array.from(tg), tw, tl, L};
  }
  /* log-softmax z logitów okien (każde okno: Float32Array [Tw*31], Tw = klatek okna z kontekstem), przycięcie kontekstu, przycięcie dopełnienia, kolumna <star> */
  function emissions(wins, Tw, nSamples) {
    const keep0 = 100, keep1 = Tw - 99, per = keep1 - keep0;
    const ext = Math.ceil(nSamples / WIN) * WIN - nSamples, cut = Math.floor(ext / SR * 50);
    const T = wins.length * per - (cut > 0 ? cut : 0), em = new Float32Array(T * C);
    for (let t = 0; t < T; t++) {
      const wi = Math.floor(t / per), f = keep0 + (t - wi * per), src = wins[wi], o = f * 31;
      let mx = -1e30; for (let k = 0; k < 31; k++) if (src[o + k] > mx) mx = src[o + k];
      let s = 0; for (let k = 0; k < 31; k++) s += Math.exp(src[o + k] - mx);
      const ls = Math.log(s) + mx, d = t * C;
      for (let k = 0; k < 31; k++) em[d + k] = src[o + k] - ls;
      em[d + 31] = 0;
    }
    return {em, T};
  }
  /* Viterbi CTC: stany 2L+1 (blank, litera, blank…); zwraca dla każdego celu pierwszą i ostatnią klatkę oraz największe log-prawdopodobieństwo */
  function viterbi(em, T, tg) {
    const L = tg.length, S = 2 * L + 1;
    if (!L || T < 2) return null;
    const NEG = -1e30, bp = new Uint8Array(T * S);
    let prev = new Float32Array(S).fill(NEG), cur = new Float32Array(S);
    prev[0] = em[0]; prev[1] = em[tg[0]];
    for (let t = 1; t < T; t++) {
      const o = t * C, b = t * S;
      for (let s = 0; s < S; s++) {
        let best = prev[s], k = 0;
        if (s >= 1 && prev[s - 1] > best) { best = prev[s - 1]; k = 1; }
        if (s >= 3 && (s & 1) && tg[(s - 1) >> 1] !== tg[((s - 1) >> 1) - 1] && prev[s - 2] > best) { best = prev[s - 2]; k = 2; }
        cur[s] = best + em[o + ((s & 1) ? tg[(s - 1) >> 1] : 0)];
        bp[b + s] = k;
      }
      const x = prev; prev = cur; cur = x;
    }
    let s = prev[S - 1] >= prev[S - 2] ? S - 1 : S - 2;
    if (prev[s] <= NEG / 2) return null;
    const f0 = new Int32Array(L).fill(-1), f1 = new Int32Array(L).fill(-1), lp = new Float32Array(L).fill(-99);
    for (let t = T - 1; t >= 0; t--) {
      if (s & 1) { const j = (s - 1) >> 1; f0[j] = t; if (f1[j] < 0) f1[j] = t; const v = em[t * C + tg[j]]; if (v > lp[j]) lp[j] = v; }
      s -= bp[t * S + s];
    }
    return {f0, f1, lp, score: prev[S - 1] > prev[S - 2] ? prev[S - 1] : prev[S - 2]};
  }
  /* całość po stronie liczb: emisje + słowa → litery z czasami (s): words[wi] = {letters:[{ch,oi,t,e,p}], t, e} albo null, gdy słowo bez liter */
  function alignWords(em, T, words, starEmpty) {
    const P = prep(words, starEmpty), V = viterbi(em, T, P.tg);
    if (!V) return null;
    const out = words.map(() => null);
    for (let j = 0; j < P.tg.length; j++) {
      if (P.tl[j] < 0) continue;
      const wi = P.tw[j]; if (!out[wi]) out[wi] = {letters: []};
      const l = P.L[wi][P.tl[j]];
      out[wi].letters.push({ch: l.ch, oi: l.oi, t: V.f0[j] * FR, e: (V.f1[j] + 1) * FR, p: Math.exp(V.lp[j])});
    }
    out.forEach(w => { if (w) { w.t = w.letters[0].t; w.e = w.letters[w.letters.length - 1].e; } });
    return {words: out, score: V.score, T};
  }
  /* resampling do 16 kHz: filtr sinc z oknem Hanna (8 przejść przez zero), tablica 256 ułamków próbki */
  function resample16k(x, sr) {
    if (sr === SR) return x;
    const r = SR / sr, n = Math.floor(x.length * r), out = new Float32Array(n);
    const fc = 0.5 * Math.min(1, r) * 0.95, H = 8 / (2 * fc), taps = Math.ceil(H) * 2 + 1, NF = 256, tab = [];
    for (let q = 0; q < NF; q++) {
      const fr = q / NF, h = new Float32Array(taps); let sum = 0;
      for (let k = 0; k < taps; k++) {
        const tau = (k - Math.ceil(H)) - fr + 0 /* odległość próbki od środka */;
        const a = Math.abs(tau);
        if (a < H) { const z = 2 * Math.PI * fc * tau, sinc = Math.abs(z) < 1e-9 ? 1 : Math.sin(z) / z; h[k] = 2 * fc * sinc * (0.5 + 0.5 * Math.cos(Math.PI * a / H)); sum += h[k]; }
      }
      for (let k = 0; k < taps; k++) h[k] /= sum || 1;
      tab.push(h);
    }
    const hc = Math.ceil(H);
    for (let i = 0; i < n; i++) {
      const c = i / r, ci = Math.floor(c), q = Math.min(NF - 1, Math.floor((c - ci) * NF)), h = tab[q];
      let acc = 0;
      for (let k = 0; k < taps; k++) { const j = ci + k - hc; if (j >= 0 && j < x.length) acc += x[j] * h[k]; }
      out[i] = acc;
    }
    return out;
  }
  /* okna wejściowe modelu: 30 s + 2×2 s kontekstu, dopełnione zerami */
  function windows(x16) {
    const ext = Math.ceil(x16.length / WIN) * WIN - x16.length, pad = new Float32Array(CTX + x16.length + CTX + ext);
    pad.set(x16, CTX);
    const n = (pad.length - 2 * CTX) / WIN, out = [];
    for (let i = 0; i < n; i++) out.push(pad.slice(i * WIN, i * WIN + WIN + 2 * CTX));
    return out;
  }

  /* ---- przeglądarka: model, onnxruntime-web, sesja ---- */
  const loadScript = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('nie wczytano ' + src)); document.head.appendChild(s); });
  let manP = null;
  const manifest = () => manP || (manP = fetch(BASE + 'manifest.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error('manifest HTTP ' + r.status); return r.json(); }).catch(e => { manP = null; throw e; }));
  async function cached() {
    try {
      const c = await caches.open(CACHE), m = await manifest();
      for (const p of m.parts) if (!(await c.match(BASE + p.name))) return false;
      return true;
    } catch (_) { return false; }
  }
  /* pobiera brakujące kawałki do Cache Storage (z paskiem postępu: prog(część, wszystkich)); samo pobranie nie składa modelu w pamięci */
  async function download(prog) {
    const m = await manifest(), c = await caches.open(CACHE);
    for (let i = 0; i < m.parts.length; i++) {
      const p = m.parts[i];
      if (prog) prog(i, m.parts.length);
      if (await c.match(BASE + p.name)) continue;
      const r = await fetch(BASE + p.name);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + p.name);
      const clone = r.clone(), len = (await r.arrayBuffer()).byteLength;
      if (len !== p.size) throw new Error('zły rozmiar ' + p.name);
      await c.put(BASE + p.name, clone);
    }
    if (prog) prog(m.parts.length, m.parts.length);
  }
  async function modelBytes() {
    const m = await manifest(), c = await caches.open(CACHE), buf = new Uint8Array(m.total);
    let off = 0;
    for (const p of m.parts) {
      const r = await c.match(BASE + p.name); if (!r) throw new Error('brak kawałka ' + p.name + ' w pamięci');
      const ab = new Uint8Array(await r.arrayBuffer()); if (ab.length !== p.size) throw new Error('zły rozmiar ' + p.name);
      buf.set(ab, off); off += ab.length;
    }
    return buf;
  }
  async function makeSession() {
    if (!G.ort) await loadScript(ORT + 'ort.min.js');
    G.ort.env.wasm.wasmPaths = ORT; G.ort.env.wasm.simd = true; G.ort.env.wasm.numThreads = 1;
    let bytes = await modelBytes(), sess = null, err = null;
    /* najpierw praca w osobnym wątku onnxruntime (interfejs się nie zacina), przy błędzie w głównym */
    for (const proxy of [true, false]) {
      try { G.ort.env.wasm.proxy = proxy; sess = await G.ort.InferenceSession.create(bytes, {executionProviders: ['wasm'], graphOptimizationLevel: 'all'}); err = null; break; }
      catch (e) { err = e; }
    }
    bytes = null;
    if (!sess) throw err || new Error('nie utworzono sesji');
    return sess;
  }
  /* dopasowanie: x, sr = zdekodowane nagranie (mono), words = słowa tekstu po kolei; prog(etap, ułamek); zwraca {words, score, T, ms} */
  async function align(x, sr, words, prog) {
    const t0 = Date.now(), p = prog || (() => {});
    p('przygotowanie', 0);
    const x16 = resample16k(x, sr), wins = windows(x16);
    p('model', 0);
    const sess = await makeSession();
    try {
      const res = [];
      for (let i = 0; i < wins.length; i++) {
        p('liczenie', i / wins.length);
        const out = await sess.run({input_values: new G.ort.Tensor('float32', wins[i], [1, wins[i].length])});
        res.push(Float32Array.from(out.logits.data)); res.Tw = out.logits.dims[1];
      }
      p('liczenie', 1);
      const E = emissions(res, res.Tw, x16.length);
      p('dopasowanie', 0);
      const al = alignWords(E.em, E.T, words);
      if (!al) throw new Error('dopasowanie się nie powiodło');
      al.ms = Date.now() - t0;
      return al;
    } finally { try { await sess.release(); } catch (_) {} }
  }
  const api = {letters, prep, emissions, viterbi, alignWords, resample16k, windows, cached, download, align, FR, SR};
  G.NT_CTC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
