// A slide-out panel over the field. Hidden until asked for: the page is a
// calling card first, and a visitor who does not open it should not be able to
// tell it is there. Everything it writes goes through the field's own setters,
// so the panel has no second copy of any default.
//
// State is kept in localStorage, per browser. It survives a reload and a
// republish; it is not shared, and a cleared or blocked store just means the
// page comes up at its own defaults, which is why every read and write here is
// wrapped rather than trusted.

const KEY = "vc.field.v1";

const CSS = `
#fp-open { position:fixed; right:14px; top:14px; z-index:40;
	font:400 11px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing:.12em;
	text-transform:uppercase; color:rgba(243,236,230,.62); background:rgba(8,10,18,.55);
	border:1px solid rgba(243,236,230,.2); padding:8px 11px; cursor:pointer;
	backdrop-filter:blur(6px); transition:color .18s, border-color .18s; }
#fp-open:hover { color:rgba(243,236,230,.95); border-color:rgba(243,236,230,.55); }
#fp { position:fixed; top:0; right:0; bottom:0; width:min(384px, 94vw); z-index:41;
	background:rgba(6,8,14,.93); backdrop-filter:blur(14px);
	border-left:1px solid rgba(243,236,230,.14);
	font:400 12px/1.5 "IBM Plex Mono", ui-monospace, monospace; color:rgba(243,236,230,.92);
	padding:16px 16px 28px; overflow-y:auto; overscroll-behavior:contain;
	transform:translateX(100%); transition:transform .26s cubic-bezier(.4,0,.2,1); }
#fp[data-open="1"] { transform:translateX(0); }
#fp h2 { font-size:9.5px; letter-spacing:.17em; text-transform:uppercase;
	color:rgba(243,236,230,.5); margin:16px 0 7px; font-weight:500; }
#fp h2:first-of-type { margin-top:10px; }
#fp p { font-size:11px; color:rgba(243,236,230,.5); margin:0 0 10px; }
#fp .row { padding-bottom:5px; margin-bottom:5px;
	border-bottom:1px solid rgba(243,236,230,.08); }
#fp .row label { display:flex; justify-content:space-between; gap:8px;
	font-size:11px; color:rgba(243,236,230,.6); white-space:nowrap; }
#fp .row output { font-variant-numeric:tabular-nums; color:#e7c489; flex:none; }
#fp input[type=range] { width:100%; margin:3px 0 0; accent-color:#d8a05a; }
#fp button.act { display:block; width:100%; margin-top:8px; padding:6px 10px;
	font:inherit; font-size:11px; color:inherit; background:transparent;
	border:1px solid rgba(243,236,230,.3); cursor:pointer; }
#fp button.act:hover { border-color:rgba(243,236,230,.7); }
#fp-close { position:absolute; top:4px; right:10px; background:none; border:0;
	color:rgba(243,236,230,.55); font:inherit; font-size:15px; cursor:pointer; padding:4px; }
#fp-note { font-size:10.5px; color:rgba(243,236,230,.45); min-height:1.4em; margin-top:8px; }
#fp-tabs { display:flex; margin:18px 0 12px; position:sticky; top:-16px; z-index:2;
	background:rgba(6,8,14,.96); }
/* The buttons share a border by overlapping a pixel, so the selected one has to
   be ABOVE its neighbours or its lit border is drawn over by their dim ones. */
#fp-tabs button { flex:1; font:inherit; font-size:10px; letter-spacing:.1em;
	text-transform:uppercase; color:rgba(243,236,230,.6); background:rgba(6,8,14,.96);
	border:1px solid rgba(243,236,230,.22); padding:6px 0; cursor:pointer;
	position:relative; z-index:0; margin-right:-1px; }
#fp-tabs button:last-child { margin-right:0; }
#fp-tabs button[aria-selected="true"] { background:rgba(243,236,230,.13);
	border-color:rgba(243,236,230,.55); color:rgba(243,236,230,.95); z-index:1; }
#fp-map { width:100%; display:block; background:#070910; cursor:crosshair;
	touch-action:none; border:1px solid rgba(243,236,230,.16); }
#fp-key { display:flex; flex-wrap:wrap; gap:9px; font-size:9px; margin:6px 0 0;
	color:rgba(243,236,230,.5); }
#fp-key i { display:inline-block; width:10px; height:3px; vertical-align:middle; margin-right:4px; }
#fp-cov b { color:#e7c489; font-weight:400; }
#fp-prev { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin:0 0 6px; }
#fp-prev figure { margin:0; }
#fp-prev canvas { width:100%; aspect-ratio:3/2; display:block;
	border:1px solid rgba(243,236,230,.16); }
#fp-prev figcaption { font-size:9px; color:rgba(243,236,230,.5); margin-top:2px; }
/* The caption sits bottom-right, which is where the panel opens. Move it clear
   rather than hide it: it is the one line that says what is being looked at. */
body[data-fp="1"] footer { right:min(398px, calc(94vw + 14px)); transition:right .26s cubic-bezier(.4,0,.2,1); }
footer { transition:right .26s cubic-bezier(.4,0,.2,1); }
/* The light page needs its own version of the two corner controls. */
body.lit #about { background:rgba(249,248,244,.80); color:rgba(20,22,28,.78); }
body.lit footer { color:rgba(20,22,28,.7); }
body.lit footer button { color:rgba(20,22,28,.7); background:rgba(249,248,244,.74);
	border-color:rgba(20,22,28,.22); }
body.lit #fp-open { color:rgba(20,22,28,.7); background:rgba(249,248,244,.7);
	border-color:rgba(20,22,28,.22); }
/* Lifting the tone above zero lights the field, and dark text on a light ground
   needs its own palette -- style.css only carries the dark one. Carried over
   from the old site preview, where the tone slider first needed it. */
/* The dark scrim is three layers -- a directional wash plus two radials -- and
   replacing it with one flat gradient is why the light mode lost its backing.
   Same three layers, same stops, light ink. */
body.lit #scrim { background:
	linear-gradient(100deg, rgba(249,248,244,.95) 0%, rgba(249,248,244,.89) 30%,
		rgba(249,248,244,.40) 62%, rgba(249,248,244,.08) 100%),
	radial-gradient(70% 55% at 100% 100%, rgba(249,248,244,.74) 0%, rgba(249,248,244,0) 70%),
	radial-gradient(120% 90% at 8% 40%, rgba(249,248,244,.58) 0%, rgba(249,248,244,0) 60%); }
@media (max-width:720px) {
	body.lit #scrim { background:linear-gradient(180deg, rgba(249,248,244,.34) 0%,
		rgba(249,248,244,.88) 42%, rgba(249,248,244,.97) 100%); }
}
body.lit main, body.lit h1, body.lit .sentence { color:#14161c; }
body.lit .role, body.lit .row dt { color:#5d6470; }
body.lit .row dd { color:#2b3038; }
body.lit a { color:#2f5d52; }
body.lit .rule { background:rgba(20,22,28,.25); }
body.lit .row dd b { color:#14161c; }
body.lit footer { background:rgba(247,246,242,.72); color:rgba(20,22,28,.7); }
body.lit footer button { color:rgba(20,22,28,.7); border-color:rgba(20,22,28,.25); }
@media (max-width:520px){ #fp { width:100%; } body[data-fp="1"] footer { display:none; } }
`;

// [key, label, min, max, step, decimals]. `group` says which setter it reaches.
const CURSOR = [
	["swell", "hover · diffusion ×", 1, 16, 0.1, 1],
	["swellR", "hover · reach", 0.02, 0.8, 0.005, 3],
	["pushAmt", "press · strength", 0, 1, 0.01, 2],
	["pushR", "press · reach", 0.02, 1.0, 0.005, 3],
	["pushTime", "press · take-hold (s)", 0.05, 3, 0.05, 2],
	["xi", "target · along", 0, 1, 0.005, 3],
	["eta", "target · across", 0, 1, 0.005, 3],
];
const RATE = [
	["rate0", "drift · ξ (×1e-5)", 0, 40, 0.1, 2],
	["rate1", "drift · η (×1e-5)", 0, 40, 0.1, 2],
];
// The measured pattern region, as one bit per tile of the sweep that produced
// the band: 40x40 over f in [0.004, 0.090] and k in [0.030, 0.076], five seeds
// each, 8000 steps, a cell set if ANY seed got it patterning. 200 bytes, so it
// travels with the page rather than being fetched.
const PATT = { TN: 40, f0: 0.004, f1: 0.090, k0: 0.030, k1: 0.076, bits:
	"IAAAAAAgAAAAAAAAAAAAEAAAAAAQAAAAABAAAAAACAAAAAAIAAAAAAgAAAAALAAAAAA8AAAAAD4AAAAAPAAAAAA/AAAAAD+AAAAAHwAAAAAPgAAAAB/AAAAAD+AAAAAH8AAAAAf4AAAAA/wAAAAB/wAAAQH/wAAGAP/4ADwA/////AA////wAD///+AAH///4AAP///AAA///4AAB//+AAAH+f4AAAHxYAAAAeAAAAAAwAAAAABAAAAAAAAAAAAAAAAAAAAAAAA=" };

const SHAPE = [
	["cells0", "wavelength · ξ", 1, 24, 1, 0],
	["cells1", "wavelength · η", 1, 24, 1, 0],
	["octaves", "octaves", 1, 7, 1, 0],
	["lacun", "lacunarity", 1.2, 3.5, 0.05, 2],
	["persist", "persistence", 0.1, 0.95, 0.01, 2],
	["flatten", "flatten", 0, 1, 0.01, 2],
];

export function panel(field) {
	if (!field || !field.setCursor) return;

	const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
		catch { return {}; } };
	let saveT = 0;
	const save = () => { clearTimeout(saveT); saveT = setTimeout(() => {
		try { localStorage.setItem(KEY, JSON.stringify({
			cursor: field.getCursor(), layout: field.getLayout(),
			noise: field.getNoise(), tone: field.getTone ? field.getTone() : undefined,
			splines: typeof SP !== "undefined" ? SP : undefined,
		})); } catch { /* private window, blocked store: the page still works */ }
	}, 400); };

	// Restore BEFORE the panel is built, so the sliders read the restored values
	// rather than showing defaults the field is not actually running.
	const st = load();
	// With nothing stored, take the side the browser asks for. The magnitude is the
	// field's own default -- flipped, not invented -- so the light page is the mirror
	// of the dark one and there is a single number behind both. A stored tone wins:
	// someone who has moved the slider has said what they want.
	if (st.tone === undefined && field.getTone && field.setTone) {
		const wantsLight = window.matchMedia
			&& window.matchMedia("(prefers-color-scheme: light)").matches;
		const mag = Math.abs(field.getTone()) || 0.55;
		field.setTone(wantsLight ? mag : -mag);
	}
	try {
		if (st.cursor) field.setCursor(st.cursor);
		if (st.layout) field.setLayout(st.layout);
		if (st.noise) field.setNoise(st.noise);
		if (st.tone !== undefined && field.setTone) field.setTone(st.tone);
	} catch { /* a stored shape from an older build: fall through to defaults */ }

	const style = document.createElement("style");
	style.textContent = CSS;
	document.head.appendChild(style);

	const open = document.createElement("button");
	open.id = "fp-open"; open.type = "button"; open.textContent = "Controls";
	open.setAttribute("aria-expanded", "false");

	const fp = document.createElement("aside");
	fp.id = "fp"; fp.dataset.open = "0";
	fp.setAttribute("aria-label", "Field controls");
	fp.innerHTML = `<button id="fp-close" type="button" aria-label="Close">×</button>
		<div id="fp-tabs" role="tablist">
			<button role="tab" data-t="ctrl" aria-selected="true">cursor</button>
			<button role="tab" data-t="map" aria-selected="false">f, k map</button>
			<button role="tab" data-t="noise" aria-selected="false">fields</button>
		</div>

		<div data-pane="ctrl">
			<h2>The cursor is the controller</h2>
			<p>Two different things. <b>Hover</b> is a property of the medium: it scales
			both diffusivities, and the pattern's wavelength goes as √D, so the
			texture swells where you look. <b>Press</b> is an edit to the parameters: it
			drives that patch to the target point on the band, eased in while you hold
			and released when you let go, so it takes hold rather than pulsing. The
			target is the orange cross on the f, k map, and it is draggable there.</p>
			<div id="fp-cursor"></div>
			<h2>Time</h2>
			<p>The substrate's step. The page runs at half the largest the scheme
			allows, because the medium reads better when it is not hurrying — and
			the slider's top is that bound, not a preference.</p>
			<div id="fp-dt"></div>
			<h2>Ground</h2>
			<div id="fp-tone"></div>
			<button class="act" id="fp-seed">Reseed the substrate</button>
			<button class="act" id="fp-reset">Reset everything</button>
		</div>

		<div data-pane="map" hidden>
			<h2>Where the medium is put</h2>
			<p>Gray–Scott only patterns in one crescent of its (f, k) plane, and the
			blue region is that crescent as measured — 40×40 tiles, five seeds each,
			8000 steps, a cell counted if any seed got it there. The three curves are
			the band the page reads: the middle one is the line the maps run along, the
			outer two how far across it a pixel can sit. Drag a square to move the
			curve, a circle to bend the segment between two squares.</p>
			<canvas id="fp-map" width="620" height="410"></canvas>
			<div id="fp-key">
				<span><i style="background:#2b3550"></i>patterns</span>
				<span><i style="background:#6ec0ff"></i>saddle-node</span>
				<span><i style="background:#ff77b8"></i>Hopf</span>
				<span><i style="background:#ffd76a"></i>centreline</span>
				<span><i style="background:#7fe3b0"></i>edges</span>
			</div>
			<p style="margin-top:8px" id="fp-cov"></p>
			<button class="act" id="fp-band">Reset the band</button>
		</div>

		<div data-pane="noise" hidden>
			<h2>The two maps</h2>
			<p>Each is uniform on [0,1]: one says how far <em>along</em> the band a pixel
			sits, the other how far <em>across</em>. Together they are the whole of
			canvas → (f, k). Each is drawn once across the frame, so it is periodic
			at the edges and never repeats inside them.</p>
			<div id="fp-prev">
				<figure><canvas id="fp-p0"></canvas><figcaption>ξ — along</figcaption></figure>
				<figure><canvas id="fp-p1"></canvas><figcaption>η — across</figcaption></figure>
			</div>
			<h2>What they look like</h2>
			<p>Each of these rebuilds the noise — about half a second.</p>
			<div id="fp-shape"></div>
			<h2>Drift</h2>
			<p>How fast each map moves along the volume's time axis. Keep the two
			incommensurate or they come back into relation and the page repeats.</p>
			<div id="fp-rate"></div>
		</div>
		<div id="fp-note"></div>`;
	document.body.appendChild(open);
	document.body.appendChild(fp);

	const $ = id => fp.querySelector("#" + id);
	const note = $("fp-note");

	const setOpen = (on) => {
		fp.dataset.open = on ? "1" : "0";
		document.body.dataset.fp = on ? "1" : "0";
		open.setAttribute("aria-expanded", String(on));
		open.hidden = on;
	};
	open.addEventListener("click", () => setOpen(true));
	$("fp-close").addEventListener("click", () => setOpen(false));
	document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });

	function rows(host, defs, read, write) {
		host.innerHTML = defs.map(([k, lab, lo, hi, st, dp]) => `<div class="row">
			<label>${lab} <output data-o="${k}">${read(k).toFixed(dp)}</output></label>
			<input type="range" data-r="${k}" min="${lo}" max="${hi}" step="${st}" value="${read(k)}">
		</div>`).join("");
		for (const [k, , , , , dp] of defs) {
			const r = host.querySelector(`[data-r="${k}"]`), o = host.querySelector(`[data-o="${k}"]`);
			r.addEventListener("input", () => { o.textContent = (+r.value).toFixed(dp); write(k, +r.value); save(); });
		}
	}

	// cursor
	rows($("fp-cursor"), CURSOR, k => field.getCursor()[k],
		(k, v) => { field.setCursor({ [k]: v }); if (k === "xi" || k === "eta") drawMap(); });

	// drift rates, shown at 1e-5 because that is the scale they live at
	rows($("fp-rate"), RATE, k => field.getLayout().rate[+k.slice(-1)] * 1e5,
		(k, v) => { const a = [undefined, undefined]; a[+k.slice(-1)] = v * 1e-5;
			field.setLayout({ rate: a }); });

	// noise shape: every change rebuilds the volume, so debounce and say so
	let nT = 0; const nPend = {};
	const nread = k => k.startsWith("cells") ? field.getNoise().cells[+k.slice(-1)] : field.getNoise()[k];
	const nwrite = (k, v) => {
		if (k.startsWith("cells")) { const c = (nPend.cells || field.getNoise().cells).slice();
			c[+k.slice(-1)] = v; nPend.cells = c; } else nPend[k] = v;
		clearTimeout(nT); note.textContent = "rebuilding the noise…";
		nT = setTimeout(() => {
			field.setNoise({ ...nPend });
			for (const q of Object.keys(nPend)) delete nPend[q];
			note.textContent = ""; save(); drawPrev();
		}, 280);
	};
	rows($("fp-shape"), SHAPE, nread, nwrite);

	// tone, if the build exposes a getter for it
	// The field lightens continuously but the page's ink has to flip, so it flips
	// at the crossing rather than at an arbitrary threshold.
	if (field.dtMax) rows($("fp-dt"), [["dt", "time step", 0.02, field.dtMax(), 0.005, 3]],
		k => field.getCursor()[k], (k, v) => { field.setCursor({ dt: v }); save(); });
	else $("fp-dt").previousElementSibling.hidden = true;

	const lit = v => document.body.classList.toggle("lit", v > 0);
	if (field.getTone) { rows($("fp-tone"), [["tone", "dark ↔ light", -1, 1, 0.01, 2]],
		() => field.getTone(), (k, v) => { field.setTone(v); lit(v); }); lit(field.getTone()); }
	else $("fp-tone").previousElementSibling.hidden = true;

	// --- tabs ----------------------------------------------------------------
	const panes = [...fp.querySelectorAll("[data-pane]")];
	const tabs = [...fp.querySelectorAll("#fp-tabs button")];
	let tab = "ctrl";
	const show = (t) => {
		tab = t;
		for (const p of panes) p.hidden = p.dataset.pane !== t;
		for (const b of tabs) b.setAttribute("aria-selected", String(b.dataset.t === t));
		if (t === "map") drawMap();
		if (t === "noise") drawPrev();
	};
	for (const b of tabs) b.addEventListener("click", () => show(b.dataset.t));

	// --- the (f, k) map ------------------------------------------------------
	// The same three splines the field is running, over the measured region, with
	// the two bifurcation curves for orientation. Dragging writes straight through
	// to the field, which migrates rather than restarting -- watching the medium
	// walk to its new parameters is the informative part.
	const NM = ["lower", "centre", "upper"];
	const bits = (() => { try { const b = atob(PATT.bits), a = new Uint8Array(b.length);
		for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; } catch { return null; } })();
	const pAt = (i, j) => bits ? (bits[(j * PATT.TN + i) >> 3] >> (7 - ((j * PATT.TN + i) & 7))) & 1 : 0;

	const kSN = f => Math.sqrt(f) / 2 - f;
	// Hopf: tr J = 0 at v+^2 = k, with v+ the upper branch. Solved by a sign change
	// rather than in closed form -- the closed form is a quartic and this is a plot.
	function kHopf(f) {
		let prev = null;
		for (let i = 1; i <= 2400; i++) {
			const k = i * 0.12 / 2400, d = f * f - 4 * f * (f + k) * (f + k);
			if (d < 0) { prev = null; continue; }
			const g = Math.pow((f + Math.sqrt(d)) / (2 * (f + k)), 2) - k;
			if (prev && Math.sign(prev.g) !== Math.sign(g))
				return prev.k - prev.g * (k - prev.k) / (g - prev.g);
			prev = { k, g };
		}
		return NaN;
	}

	const mapCv = $("fp-map"), mcx = mapCv.getContext("2d"), MG = 16;
	const R = field.bandRange ? (() => { const r = field.bandRange();
		return { f0: r.F0, f1: r.F0 + r.DF, k0: r.K0, k1: r.K0 + r.DK }; })()
		: { f0: PATT.f0, f1: PATT.f1, k0: PATT.k0, k1: PATT.k1 };
	let SP = field.getSplines ? field.getSplines() : null;
	const DEF = SP ? JSON.parse(JSON.stringify(SP)) : null;
	if (st.splines && NM.every(k => st.splines[k] && Array.isArray(st.splines[k].k))) {
		SP = st.splines; if (field.setSplines) field.setSplines(SP, false);
	}

	const PWd = () => mapCv.width - 2 * MG, PHt = () => mapCv.height - 2 * MG;
	const toPx = (f, k) => [ MG + (f - R.f0) / (R.f1 - R.f0) * PWd(),
		MG + PHt() - (k - R.k0) / (R.k1 - R.k0) * PHt() ];
	const toFK = (x, y) => [ R.f0 + (R.f1 - R.f0) * (x - MG) / PWd(),
		R.k0 + (R.k1 - R.k0) * (MG + PHt() - y) / PHt() ];
	const clampFK = (f, k) => [ Math.min(Math.max(f, R.f0), R.f1), Math.min(Math.max(k, R.k0), R.k1) ];
	const curve = (sp) => { const out = [];
		for (let i = 0; i < sp.k.length - 1; i++)
			for (let j = 0; j <= 48; j++) { const t = j / 48, u = 1 - t;
				out.push([ u*u*sp.k[i][0] + 2*u*t*sp.c[i][0] + t*t*sp.k[i+1][0],
				           u*u*sp.k[i][1] + 2*u*t*sp.c[i][1] + t*t*sp.k[i+1][1] ]); }
		return out; };

	// (xi, eta) -> (f, k) exactly as the shader reads it: xi picks a station along
	// the arc-resampled centreline, eta blends toward the lower or upper edge.
	// Resampled by ARC LENGTH, because that is what the shader's LUT is.
	const BN = 256;
	let arcLo = null, arcCe = null, arcUp = null;
	function arcResample(P, N) {
		const d = [0];
		for (let i = 1; i < P.length; i++)
			d.push(d[i-1] + Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]));
		const L = d[d.length-1] || 1, out = [];
		let j = 0;
		for (let i = 0; i < N; i++) {
			const t = i / (N - 1) * L;
			while (j < d.length - 2 && d[j+1] < t) j++;
			const a = (t - d[j]) / Math.max(d[j+1] - d[j], 1e-12);
			out.push([ P[j][0] + (P[j+1][0]-P[j][0])*a, P[j][1] + (P[j+1][1]-P[j][1])*a ]);
		}
		return out;
	}
	function rebuildArcs() {
		arcLo = arcResample(curve(SP.lower), BN);
		arcCe = arcResample(curve(SP.centre), BN);
		arcUp = arcResample(curve(SP.upper), BN);
	}
	function bandFK(xi, eta) {
		const i = Math.max(0, Math.min(BN - 1, Math.round(xi * (BN - 1))));
		const c = arcCe[i];
		const e = eta < 0.5 ? arcLo[i] : arcUp[i];
		const t = eta < 0.5 ? 1 - eta * 2 : (eta - 0.5) * 2;
		return [ c[0] + (e[0] - c[0]) * t, c[1] + (e[1] - c[1]) * t ];
	}
	// And the way back, by search. There is no closed form -- the band is three
	// hand-drawn splines -- so: nearest station on a coarse grid, then a local
	// refinement. Scaled by the plot's own extent so f and k weigh equally.
	function fkBand(f, k) {
		const sf = 1 / (R.f1 - R.f0), sk = 1 / (R.k1 - R.k0);
		let best = [0, 0.5], bd = Infinity;
		const scan = (x0, x1, e0, e1, nx, ne) => {
			for (let a = 0; a <= nx; a++) for (let b2 = 0; b2 <= ne; b2++) {
				const xi = x0 + (x1 - x0) * a / nx, eta = e0 + (e1 - e0) * b2 / ne;
				const p = bandFK(xi, eta);
				const d = Math.pow((p[0]-f)*sf, 2) + Math.pow((p[1]-k)*sk, 2);
				if (d < bd) { bd = d; best = [xi, eta]; }
			}
		};
		scan(0, 1, 0, 1, 160, 40);
		const w = 1 / 160, v = 1 / 40;
		scan(Math.max(0, best[0]-w), Math.min(1, best[0]+w),
		     Math.max(0, best[1]-v), Math.min(1, best[1]+v), 12, 12);
		return best;
	}

	// What fraction of the band actually lands on measured pattern. The one number
	// that says whether a drag improved anything.
	function coverage() {
		const lo = curve(SP.lower), ce = curve(SP.centre), up = curve(SP.upper);
		const N = Math.min(lo.length, ce.length, up.length);
		let n = 0, hit = 0;
		for (let i = 0; i < N; i += 2) for (let e = 0.05; e < 1; e += 0.1) {
			const o = e < 0.5 ? [(lo[i][0]-ce[i][0])*(1-2*e), (lo[i][1]-ce[i][1])*(1-2*e)]
			                  : [(up[i][0]-ce[i][0])*(2*e-1), (up[i][1]-ce[i][1])*(2*e-1)];
			const f = ce[i][0] + o[0], k = ce[i][1] + o[1];
			const a = Math.max(0, Math.min(PATT.TN-1, Math.floor((f-PATT.f0)/(PATT.f1-PATT.f0)*PATT.TN)));
			const b2 = Math.max(0, Math.min(PATT.TN-1, Math.floor((k-PATT.k0)/(PATT.k1-PATT.k0)*PATT.TN)));
			n++; if (pAt(a, b2)) hit++;
		}
		return Math.round(100 * hit / n);
	}

	function drawMap() {
		if (!SP) return;
		const W = mapCv.width, H = mapCv.height;
		mcx.fillStyle = "#070910"; mcx.fillRect(0, 0, W, H);
		const cw = PWd() / PATT.TN, ch = PHt() / PATT.TN;
		mcx.fillStyle = "#2b3550";
		for (let j = 0; j < PATT.TN; j++) for (let i = 0; i < PATT.TN; i++) if (pAt(i, j)) {
			const f = PATT.f0 + (PATT.f1-PATT.f0)*i/PATT.TN, k = PATT.k0 + (PATT.k1-PATT.k0)*j/PATT.TN;
			const [x, y] = toPx(f, k);
			mcx.fillRect(x, y - ch, Math.ceil(cw) + 1, Math.ceil(ch) + 1);
		}
		for (const [fn, col] of [[kSN, "#6ec0ff"], [kHopf, "#ff77b8"]]) {
			mcx.beginPath(); mcx.strokeStyle = col; mcx.lineWidth = 1.6; let on = false;
			for (let t = 0; t <= 260; t++) {
				const f = R.f0 + (R.f1 - R.f0) * t / 260, k = fn(f);
				if (!isFinite(k) || k < R.k0 || k > R.k1) { on = false; continue; }
				const [x, y] = toPx(f, k); on ? mcx.lineTo(x, y) : (mcx.moveTo(x, y), on = true);
			}
			mcx.stroke();
		}
		const lo = curve(SP.lower), up = curve(SP.upper);
		mcx.beginPath();
		lo.forEach((p, i) => { const [x, y] = toPx(p[0], p[1]); i ? mcx.lineTo(x, y) : mcx.moveTo(x, y); });
		for (let i = up.length - 1; i >= 0; i--) { const [x, y] = toPx(up[i][0], up[i][1]); mcx.lineTo(x, y); }
		mcx.closePath(); mcx.fillStyle = "rgba(255,215,106,0.13)"; mcx.fill();
		for (const nm of NM) {
			const col = nm === "centre" ? "#ffd76a" : "#7fe3b0", sp = SP[nm];
			mcx.beginPath(); mcx.strokeStyle = col; mcx.lineWidth = nm === "centre" ? 2 : 1.6;
			curve(sp).forEach((p, i) => { const [x, y] = toPx(p[0], p[1]); i ? mcx.lineTo(x, y) : mcx.moveTo(x, y); });
			mcx.stroke();
			mcx.strokeStyle = "rgba(243,236,230,0.28)"; mcx.lineWidth = 1;
			sp.c.forEach((c, i) => { for (const kn of [sp.k[i], sp.k[i+1]]) {
				const [a, b2] = toPx(c[0], c[1]), [d, e] = toPx(kn[0], kn[1]);
				mcx.beginPath(); mcx.moveTo(a, b2); mcx.lineTo(d, e); mcx.stroke(); } });
			sp.k.forEach(p => { const [x, y] = toPx(p[0], p[1]); mcx.fillStyle = col;
				mcx.fillRect(x-4.5, y-4.5, 9, 9); mcx.strokeStyle = "#070910"; mcx.lineWidth = 1.4;
				mcx.strokeRect(x-4.5, y-4.5, 9, 9); });
			sp.c.forEach(p => { const [x, y] = toPx(p[0], p[1]);
				mcx.beginPath(); mcx.arc(x, y, 3.6, 0, 7); mcx.fillStyle = col; mcx.fill();
				mcx.strokeStyle = "#070910"; mcx.lineWidth = 1.4; mcx.stroke(); });
		}
		// The press target, where the band actually puts it. Drawn last so it is
		// never hidden by a spline handle.
		rebuildArcs();
		const c0 = field.getCursor();
		const [tf, tk] = bandFK(c0.xi, c0.eta);
		const [tx, ty] = toPx(tf, tk);
		mcx.strokeStyle = "#ff8a4c"; mcx.lineWidth = 1.8;
		mcx.beginPath(); mcx.arc(tx, ty, 7, 0, 7); mcx.stroke();
		mcx.beginPath();
		mcx.moveTo(tx - 11, ty); mcx.lineTo(tx - 3, ty);
		mcx.moveTo(tx + 3, ty); mcx.lineTo(tx + 11, ty);
		mcx.moveTo(tx, ty - 11); mcx.lineTo(tx, ty - 3);
		mcx.moveTo(tx, ty + 3); mcx.lineTo(tx, ty + 11);
		mcx.stroke();
		tgtPx = [tx, ty];

		$("fp-cov").innerHTML = "the band lands on measured pattern <b>" + coverage() + "%</b> of its area"
			+ " \u00b7 target at f <b>" + tf.toFixed(4) + "</b>, k <b>" + tk.toFixed(4) + "</b>";
	}

	let drag = null, tgtPx = null;
	const atCv = e => { const b2 = mapCv.getBoundingClientRect();
		return [ (e.clientX - b2.left) * mapCv.width / b2.width,
		         (e.clientY - b2.top) * mapCv.height / b2.height ]; };
	mapCv.addEventListener("pointerdown", e => {
		if (!SP) return;
		const [mx, my] = atCv(e); let best = null;
		// The target wins ties with a spline handle: it is the thing you came to
		// move, and it is the only handle that is not on a curve.
		if (tgtPx && Math.hypot(tgtPx[0] - mx, tgtPx[1] - my) < 15) best = { tgt: true, d: 0 };
		else for (const nm of NM) for (const kind of ["k", "c"]) SP[nm][kind].forEach((p, i) => {
			const [x, y] = toPx(p[0], p[1]), d = Math.hypot(x - mx, y - my);
			if (d < 14 && (!best || d < best.d)) best = { nm, kind, i, d }; });
		if (best) { drag = best; mapCv.setPointerCapture(e.pointerId); e.preventDefault(); }
	});
	mapCv.addEventListener("pointermove", e => {
		if (!drag) return;
		const [x, y] = atCv(e);
		if (drag.tgt) {
			// The target lives in BAND coordinates, so a point dropped off the band is
			// snapped to the nearest place on it rather than refused.
			const [xi, eta] = fkBand(...toFK(x, y));
			field.setCursor({ xi, eta });
			const r = fp.querySelector('[data-r="xi"]'), q = fp.querySelector('[data-r="eta"]');
			if (r) { r.value = xi; fp.querySelector('[data-o="xi"]').textContent = xi.toFixed(3); }
			if (q) { q.value = eta; fp.querySelector('[data-o="eta"]').textContent = eta.toFixed(3); }
			drawMap();
			return;
		}
		SP[drag.nm][drag.kind][drag.i] = clampFK(...toFK(x, y));
		drawMap();
		if (field.setSplines) field.setSplines(SP, false);
	});
	const drop = () => { if (drag) { drag = null; save(); } };
	mapCv.addEventListener("pointerup", drop);
	mapCv.addEventListener("pointercancel", drop);
	$("fp-band").addEventListener("click", () => {
		if (!DEF) return;
		SP = JSON.parse(JSON.stringify(DEF));
		drawMap(); if (field.setSplines) field.setSplines(SP, true); save();
	});

	// --- the two field previews ----------------------------------------------
	// Rendered by the field's own program at its own instant, so a preview cannot
	// disagree with what the page is reading.
	const PW = 150, PH = 100;
	const pvx = [0, 1].map(i => { const c = $("fp-p" + i);
		c.width = PW; c.height = PH; return c.getContext("2d"); });
	function drawPrev() {
		if (!field.mapPreview || tab !== "noise") return;
		for (let i = 0; i < 2; i++) try {
			const p = field.mapPreview(PW, PH, i);
			pvx[i].putImageData(new ImageData(p.data, p.w, p.h), 0, 0);
		} catch { /* the field owns the context; a lost frame is not fatal */ }
	}
	setInterval(drawPrev, 500);

	$("fp-seed").addEventListener("click", () => field.reseed());
	$("fp-reset").addEventListener("click", () => {
		try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
		location.reload();
	});
	return { setOpen };
}
