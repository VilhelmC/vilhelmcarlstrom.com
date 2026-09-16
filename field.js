/*
	field.js — the page's background: two models, one controlling the other.

	    import { mount } from "./field.js";
	    mount({ canvas, scrim, toggle, caption });

	A substrate and a controller, which is the project's actual subject rather
	than an illustration of it.

	CONTROLLER (slow, coarse) — the apparatus this project builds: a field under
	a projected inhibition computed from itself through a designed interaction
	kernel, with the controller given a response time.

	    K   = a_w·G(sigma_w) - a_n·G(sigma_n)
	    Phi'= ( g·max(K*a, 0) - Phi ) / tau
	    a'  = r·a(1-a) - a·Phi + Da·lap(a)

	SUBSTRATE (fast, fine) — Gray-Scott, whose two rate constants are not
	constants: the controller sets them, per pixel, as it drifts.

	    f = f0 + fA·a        k = k0 + kA·a
	    U' = Du·lap(U) - U·V^2 + f(1-U)
	    V' = Dv·lap(V) + U·V^2 - (f+k)·V

	So the picture is never one regime. Solitons, worms and dividing spots
	coexist and trade territory as the controller moves under them, and the
	boundaries between them are the controller's own pattern made visible in
	a medium that is not its own. A hard seam would say only that a parameter
	was changed; this says what changing it continuously does.

	This file is the swap point. When nabla-wasm can compile and run a .nabla
	graph in the browser (Strategic/Outreach/Nabla-Web-Background_Spec.md),
	mount() keeps its signature and the inside of this file is replaced.

	Colour: batlowK, from Crameri's scientific colour maps — perceptually
	uniform, monotonic in lightness, legible under colour-vision deficiency and
	in greyscale. The same map is used for every field in this project, so the
	site, the feed and the figures read as one body of work. Identity lives in
	the interface palette, not in the data ramp.
*/

const LUT = `
	const vec3 LUT[16] = vec3[16](
			__LUT__);

	vec3 ramp(float t) {
		float x = clamp(t, 0.0, 1.0) * 15.0;
		int i = int(floor(x));
		return mix(LUT[i], LUT[min(i + 1, 15)], x - float(i));
	}
`;

export function mount(els) {
	"use strict";

	// ── controller ────────────────────────────────────────────────────────
	const SW = 8.0, SN = 2.0, AW = 1.0, AN = 0.6;
	// The controller must never settle. A stationary controller freezes the
	// parameter field, the substrate then settles under it, and the whole page
	// stops at two regimes imprinted with the controller's own lattice — which is
	// exactly what a long run was doing. Demonstrator D's dynamic gate says how to
	// prevent it, and it is the project's own result: a long response time makes
	// the lattice breathe, and an asymmetric kernel makes it travel. Neither is
	// decoration; a pattern that moves is the thing that cannot be printed.
	const GAIN = 9.5, TAU = 7.5, R = 1.0, DA = 0.12, DTA = 0.05;
	const SHIFT_W = 2.4;			// kernel asymmetry, in cells — sets the drift
	const A_SUBSTEPS = 2;

	// ── substrate ─────────────────────────────────────────────────────────
	//
	// Gray-Scott's non-trivial homogeneous states exist only where
	//     f = 4 (f + k)^2      i.e.      k_sn(f) = sqrt(f)/2 - f
	// and the upper branch loses stability across the Hopf curve v^2 = k.
	// Everything worth looking at lives in a thin strip just inside that fold,
	// so (f, k) are the wrong coordinates — most of that plane indexes empty
	// space. The useful pair is: position ALONG the fold curve, and NORMAL
	// distance from it. That is what the controller drives.
	// Larger D with a proportionally smaller step is the same physics on a finer
	// lattice: it is the number of cells per wavelength that sets how square the
	// structures look, and assets/gs_anisotropy.py shows the stencil is not the
	// culprit — 0.2/0.05 is already the isotropic 9-point.
	const DU = 0.4194, DV = 0.2100, DTB = 0.5;
	// Measured, not guessed — assets/gs_sweep.py sweeps (f,k) and classifies the
	// result, and assets/out/gs_map.png is what it found: the patterned region is
	// a crescent hugging the fold curve, mostly on its OUTER side, running from
	// about f = 0.015 to f = 0.074. Normal offsets of patterned points span
	// -0.0033 to +0.0068 (5th to 95th percentile), so the offset has to be
	// two-sided and biased outward. Stepping inward only, as a first version did,
	// walks away from almost all of it.
	// The band is not a constant width: it is widest at low-to-mid f and narrows
	// to nothing near the nose, where it also crosses to the inside. So the
	// offset limits are functions of position along the curve, fitted to the
	// sweep rather than picked.
	// The patterned region is a curved band, and the saddle-node curve is NOT its
	// axis — it runs along the band's inner edge (assets/out/gs_axes.png). So the
	// band is fitted directly: for each f, the k-interval that patterns, giving a
	// centre line and a half-width. Coordinates are u ALONG the band, t ACROSS it;
	// 90% of patterned points land in |t| <= 1.
	//
	// The dynamic regimes — oscillation, dividing solitons, everything that never
	// settles — are not spread through the band: assets/out/gs_dyn.png puts them
	// in its low-f tail, median u = 0.27, a tenth of them below u = 0.07. So u is
	// warped, not linear, or the interesting part is a sliver.
	// And a correction that only a LONG run reveals: the band was fitted at 2800
	// steps from a strong seed, but most of it does not survive. Probed to 9000
	// steps from noise (assets/gs_band_probe.py), the durably patterned range is
	// u in [0.06, 0.40] — the upper half of the fitted band dies, which is why
	// the top of the frame looked like solid nothing rather than a solid pattern.
	// The unsettled regimes sit at u = 0.08-0.15.
	const F_LO = 0.0131, F_HI = 0.0715;
	// The pattern-forming region of (f,k) is an isolated crescent, measured on a
	// 40x40 GPU sweep at 8000 steps and five seeds per cell, and then DRAWN BY
	// HAND over those tiles rather than fitted: a lower edge, a centreline and an
	// upper edge as quadratic Bezier chains. The edges are independent, so the
	// band is asymmetric where the measurement says it is -- which no symmetric
	// half-width could express. A LONGITUDINAL coordinate xi runs along the centreline
	// and a TRANSVERSE coordinate eta between its edges, normal to the centreline
	// -- normals taken in NORMALISED (f,k), since the two axes have different
	// scales and 'normal' is otherwise meaningless. xi is ARC LENGTH, not f: the
	// crescent curves, so equal steps in f are unequal steps along it, and they
	// compress exactly where the regimes change fastest. An S-remap built from
	// MEASURED motion is baked into the LUT, so equal steps in xi carry roughly
	// equal pattern variance instead of equal arc length.
	const BAND_N = 256;
	const F0 = 0.00400, DF = 0.08600, K0 = 0.03000, DK = 0.04600;
	// Two bands. DRAWN is Will's, corrected: 98% of it lands on patterning (f,k),
	// but a 18-point sample along and across it found maze at every live point and
	// motion nowhere above 0.008 -- it runs through the MIDDLE of the region, and
	// the middle of Gray-Scott is labyrinth. LIVE is fitted to the measured moving
	// strip that hugs the fold: 66% of it lands on cells still in motion at 16000
	// steps, at the cost of a narrower f range and 25% dead.
	// The band, as three quadratic-Bezier chains in ABSOLUTE (f, k). This replaces
	// four baked 256-entry LUTs: the LUT is built from these at mount, by the same
	// code the editor uses, so what was drawn is what runs and there is one source
	// for it rather than two that can disagree. Fitted by hand in the sweep tool
	// against the measured pattern map.
	const DEFAULT_SPLINES = {
		lower:  { k: [[0.00866127, 0.03], [0.03315704, 0.05395766], [0.09, 0.04890432]],
		          c: [[0.01777597, 0.05150604], [0.09, 0.05936123]] },
		centre: { k: [[0.00615472, 0.03], [0.03327097, 0.05891094], [0.09, 0.05150604]],
		          c: [[0.01173748, 0.05560875], [0.09, 0.06336388]] },
		upper:  { k: [[0.004, 0.03], [0.03253040, 0.07061867], [0.09, 0.05320717]],
		          c: [[0.004, 0.06396427], [0.09, 0.06916771]] },
	};
	// The layout is two Perlin fields, CDF-FLATTENED to uniform on [0,1]. Perlin
	// is a sum of gradient contributions, so it is bell-shaped; fed in raw it
	// over-represents mid-band and starves the ends -- the same 'spots
	// everywhere' failure by another route. A third field sets how much say the
	// controller has locally, so its effect at x is not its effect at y.
	// Linear remaps of the two controller readouts. NOT smoothstep: that is an
	// S-curve, so it compresses toward the rails -- it turned a 60%-graded field
	// into 42%, and K's 24% into 13% with 42% of the canvas pinned at the ends.
	// Ends are the 2nd and 98th percentiles measured at this controller size.
	const WA_LO = 0.243, WA_HI = 0.393;
	const WB_LO = 0.299, WB_HI = 0.338;
	const AMP_A = 0.30, AMP_B = 0.26;
	// The layout is a 3D noise volume with TIME as its third axis: three channels,
	// each with its own lattice, each drawn once across the canvas. The rates are
	// chosen incommensurate, so the three fields never come back into the same
	// relation. Slow: the substrate needs thousands of steps to
	// follow a change in its own parameters, so the map must drift, not jump.
	const VOL_W = 192, VOL_D = 96;
	const RATE_A = 0.000112, RATE_B = 0.000112;
	// Cursor. Hover scales the DIFFUSION rates, which set the pattern's wavelength
	// as sqrt(D), so the texture swells under the pointer. The 9-point stencil's
	// symbol bottoms out at -1.6, so explicit Euler needs D*dt <= 1.25; the page
	// runs at 0.21, which leaves almost a factor of six. Measured stable to a
	// scale of 5.5 across the band. 4.0 doubles the wavelength and keeps a third
	// of the margin in hand.
	// Measured: D x2 widens the pattern only 1.20x (sqrt(2) would be 1.41, and the
	// medium drifts out of its regime on the way), and D x4 KILLS it outright --
	// V std goes to zero. Diffusion is a weak handle on wavelength here and it has
	// a cliff, so it is capped well below the numerical stability limit.
	// Hover swells the local diffusivities; press drives (f,k) to the target.
	const SWELL = 8.00, SWELL_R = 0.22;
	const PUSH_AMT = 1.00, PUSH_R = 0.34;
	// Seconds for the press to reach ~63% of full strength, and to fall back.
	const PUSH_TIME = 0.55;
	// The substrate's time step. DTB is the ceiling the scheme allows; the page runs
	// at half of it, because the medium reads better when it is not hurrying.
	const DT0 = DTB / 2;
	// The regime the zone holds to, in band coordinates. Low xi is the unsettled
	// end of the crescent; eta 0.72 is off the centreline toward the upper edge.
	const TGT_XI = 0.145, TGT_ETA = 0.72;
	const TONE = -0.55;
	const GAIN_LO = 0.15, GAIN_HI = 1.00;
	const SX = 14.0, SHIFT_X = -4.0;	// second readout, G(14) of the first
	const B_SUBSTEPS = 26;

	const canvas = els.canvas, toggle = els.toggle, caption = els.caption, scrim = els.scrim;
	const copyBtn = els.copy;

	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
	if (!gl || !gl.getExtension("EXT_color_buffer_float")) { fallback(); return; }

	const VERT = `#version 300 es
	in vec2 p; out vec2 uv;
	void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

	const BLUR = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D src; uniform vec2 dir; uniform float sigma; uniform float shift, stride;
	void main() {
		// One texel per tap. The old spacing of sigma/2.6 was 3.1 texels for the
		// wide kernel, which ALIASED the substrate's ~2-texel features into the
		// long-range term instead of smoothing them away — the Mexican hat lost
		// its shape and the field went uniform. Do not widen the stride again.
		float st = stride;
		float s = 0.0, w = 0.0;
		for (int i = -20; i <= 20; i++) {
			float x = float(i) * st;
			float g = exp(-(x * x) / (2.0 * sigma * sigma));
			s += g * texture(src, uv + dir * (x + shift)).r; w += g;
		}
		outColor = vec4(s / w, 0.0, 0.0, 1.0);
	}`;

	const STEP_A = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D state, narrow, wide;
	uniform vec2 texel; uniform float seed;
	float A(vec2 o) { return texture(state, uv + o * texel).r; }
	void main() {
		vec2 c = texture(state, uv).rg;
		float a = c.r, phi = c.g;
		if (seed > 0.5) {
			float n = fract(sin(dot(uv, vec2(12.9898, 78.233)) + seed) * 43758.5453);
			outColor = vec4(0.24 + 0.12 * n, 0.0, 0.0, 1.0); return;
		}
		float lap = (A(vec2(-1,0)) + A(vec2(1,0)) + A(vec2(0,-1)) + A(vec2(0,1))) * 0.2
		          + (A(vec2(-1,-1)) + A(vec2(1,1)) + A(vec2(1,-1)) + A(vec2(-1,1))) * 0.05 - a;
		float K = ${AW.toFixed(2)} * texture(wide, uv).r - ${AN.toFixed(2)} * texture(narrow, uv).r;
		phi += ${DTA.toFixed(3)} * (${GAIN.toFixed(2)} * max(K, 0.0) - phi) / ${TAU.toFixed(2)};
		a += ${DTA.toFixed(3)} * (${R.toFixed(2)} * a * (1.0 - a) - a * phi) + ${DA.toFixed(3)} * lap;
		outColor = vec4(clamp(a, 0.0, 1.4), max(phi, 0.0), 0.0, 1.0);
	}`;

	const STEP_B = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D state, mapTex, bandA, bandB;
	uniform vec2 texel; uniform vec2 hover, press; uniform float seed;
	uniform float swell, swellR, pushAmt, pushR, dtBase;
	uniform vec2 tgt;
	vec2 S(vec2 o) { return texture(state, uv + o * texel).rg; }

	// The crescent, read from a LUT indexed by xi: (f_n, k_n, halfwidth_n,
	// normal angle), all in normalised (f,k).
	vec2 fromBand(float xi, float eta) {
		vec2 t = vec2(clamp(xi, 0.0, 1.0), 0.5);
		vec4 A = texture(bandA, t), B = texture(bandB, t);
		// eta 0 = lower edge, 0.5 = centreline, 1 = upper edge
		vec2 off = eta < 0.5 ? mix(A.zw, vec2(0.0), eta * 2.0)
		                     : mix(vec2(0.0), B.xy, (eta - 0.5) * 2.0);
		vec2 p = A.xy + off;
		return vec2(${F0} + p.x * ${DF}, ${K0} + p.y * ${DK});
	}

	void main() {
		vec2 c = S(vec2(0.0));
		if (seed > 0.5) {
			float n = fract(sin(dot(uv, vec2(39.3468, 11.135)) + seed) * 24634.6345);
			outColor = vec4(1.0, n > 0.9972 ? 0.85 : 0.0, 0.0, 1.0); return;
		}
		vec2 lap = (S(vec2(-1,0)) + S(vec2(1,0)) + S(vec2(0,-1)) + S(vec2(0,1))) * 0.2
		         + (S(vec2(-1,-1)) + S(vec2(1,1)) + S(vec2(1,-1)) + S(vec2(-1,1))) * 0.05 - c;

		// Two maps, each uniform on [0,1], and nothing else: one says how far ALONG
		// the band this pixel sits, the other how far ACROSS it. The controller used
		// to displace both, through a third field that set how much say it had
		// locally. Removed: it was never established what it contributed, and an
		// unexplained term in the middle of the mapping is worse than no term.
		vec2 P = texture(mapTex, uv).rg;
		float xi = P.r, eta = P.g;

		// TWO DIFFERENT THINGS, deliberately. HOVER is a property of the medium: it
		// scales both diffusivities, and the pattern's wavelength goes as sqrt(D), so
		// the texture swells where you look. PRESS is an edit to the PARAMETERS: it
		// drives (xi, eta) to a chosen point of the band, so the patch under the
		// button settles on one regime and holds it while the rest goes on drifting.
		// That is the controller, and it is worth not confusing with the other one.
		//
		// The press amplitude is ramped in and out on the JS side rather than
		// switching, so holding the button reads as taking hold rather than as a
		// pulse; pushAmt arrives here already multiplied by that ramp.
		float ar = texel.y / texel.x;
		float ds = 1.0;
		if (hover.x >= 0.0) {
			float dh = distance(uv * vec2(ar, 1.0), hover * vec2(ar, 1.0));
			ds = mix(1.0, swell, exp(-(dh * dh) / (swellR * swellR)));
		}
		if (press.x >= 0.0 && pushAmt > 0.0) {
			float d = distance(uv * vec2(ar, 1.0), press * vec2(ar, 1.0));
			float m = pushAmt * exp(-(d * d) / (pushR * pushR));
			xi  = mix(xi,  tgt.x, m);
			eta = mix(eta, tgt.y, m);
		}

		vec2 fk = fromBand(xi, eta);
		float f = fk.x, k = fk.y;

		// Local time, and the stability bound that goes with the swell. The 9-point
		// stencil's symbol bottoms out at -1.6, so explicit Euler needs D*ds*dt <= 1.25;
		// at the page's D that caps ds near 6 if dt is left alone, and a swell of 8
		// would simply blow up. Shortening dt INSIDE the zone keeps the same physics
		// at the larger D and just integrates it more slowly, which costs a little
		// local time and buys the whole range.
		float dt = min(dtBase, 1.10 / (${DU} * ds));
		float uvv = c.r * c.g * c.g;
		float U = c.r + (${DU} * ds * lap.r - uvv + f * (1.0 - c.r)) * dt;
		float V = c.g + (${DV} * ds * lap.g + uvv - (f + k) * c.g) * dt;

		outColor = vec4(clamp(U, 0.0, 1.0), clamp(V, 0.0, 1.0), 0.0, 1.0);
	}`;

	const LAYOUT = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform highp sampler3D vol; uniform float t;
	uniform vec2 rep, rate;
	// chan picks a single channel for the preview canvases: -1 = the real map.
	uniform float chan;
	void main() {
		// rep = 1 draws the volume exactly once across the canvas: periodic at the
		// borders, but never repeating inside the frame. Above 1 it tiles.
		float a = texture(vol, vec3(uv * rep.x, t * rate.x)).r;
		float b = texture(vol, vec3(uv * rep.y, t * rate.y)).g;
		if (chan >= 0.0) { float v = chan < 0.5 ? a : b; outColor = vec4(v, v, v, 1.0); return; }
		outColor = vec4(a, b, 0.0, 1.0);
	}`;

	const DRAW = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D state, mapTex;
	uniform float tone;
	__RAMP__
	void main() {
		float v = texture(state, uv).g;
		// The substrate carries the image; the PARAMETER MAP is left as a faint
		// ground, so where the regimes change stays legible and a stretch of band
		// that patterns weakly does not read as a hole. This used to be drawn from
		// the CONTROLLER's own state, which is what the ground was actually showing
		// -- now it is xi itself, which is what the comment always claimed.
		float t = smoothstep(0.03, 0.42, v) * 0.90 + 0.10 * texture(mapTex, uv).r;
		vec3 col = ramp(t);
		vec3 ground = tone < 0.0 ? vec3(0.016, 0.020, 0.039) : vec3(0.934, 0.930, 0.914);
		outColor = vec4(mix(col, ground, abs(tone) * 0.78), 1.0);
	}`;

	function sh(src, type) {
		const s = gl.createShader(type);
		gl.shaderSource(s, src); gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
		return s;
	}
	function prog(fs) {
		const p = gl.createProgram();
		gl.attachShader(p, sh(VERT, gl.VERTEX_SHADER));
		gl.attachShader(p, sh(fs, gl.FRAGMENT_SHADER));
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
		return p;
	}

	let pBlur, pA, pB, pDraw, pLayout;
	try {
		pBlur = prog(BLUR); pA = prog(STEP_A); pB = prog(STEP_B); pLayout = prog(LAYOUT);
		pDraw = prog(DRAW.replace("__RAMP__", LUT.replace("__LUT__", `vec3(0.0167, 0.0208, 0.0409),
			vec3(0.0725, 0.1107, 0.1681),
			vec3(0.1211, 0.2091, 0.2960),
			vec3(0.1897, 0.3004, 0.3653),
			vec3(0.2514, 0.3589, 0.3696),
			vec3(0.3096, 0.3989, 0.3427),
			vec3(0.3807, 0.4400, 0.3012),
			vec3(0.4702, 0.4869, 0.2563),
			vec3(0.5845, 0.5379, 0.2231),
			vec3(0.7196, 0.5850, 0.2345),
			vec3(0.8459, 0.6192, 0.3152),
			vec3(0.9323, 0.6454, 0.4401),
			vec3(0.9757, 0.6747, 0.5745),
			vec3(0.9915, 0.7101, 0.7042),
			vec3(0.9923, 0.7523, 0.8374),
			vec3(0.9817, 0.8006, 0.9815)`)));
	} catch (e) { fallback(); return; }

	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const vbo = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	function target(w, h) {
		const t = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, t);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const f = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, f);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
		return [t, f];
	}

	// A 3D value-noise volume, periodic on all three axes, drawn ONCE across the
	// canvas. It used to be drawn 2.3 times across -- `scale` was a repeat count --
	// which is a literal tiling: the same field over and over, seam-free but
	// obviously repeating. Feature size belongs to the noise, not to how many times
	// the noise is repeated, so the lattice count is the control and the repeat
	// count defaults to 1.
	//
	// The lattice is nx x ny x nt, NOT cubic. A square lattice on a 3:2 canvas gives
	// cells half again as wide as they are tall; ny is derived from the aspect so a
	// cell is square ON SCREEN. The texel grid follows the same aspect, so both axes
	// are resolved equally.
	//
	// CDF-flattened per z-slice so each instant is uniform on [0,1]. Flattening
	// matters: raw fbm is bell-shaped, and fed in as a coordinate it over-represents
	// the middle of the band and starves both ends. Per SLICE, not per volume -- a
	// flat volume does not have flat slices, and any one instant could occupy a
	// fraction of the range, which is the mid-band bias again, relocated.
	function volume(Wx, Wy, D, seed, p, nx0) {
		let t = seed >>> 0;
		const rnd = () => { t ^= t << 13; t ^= t >>> 17; t ^= t << 5; return ((t >>> 0) % 1000000) / 1000000; };
		const out = new Float32Array(Wx * Wy * D);
		const sm = a => a * a * (3 - 2 * a);
		const ar = Wx / Wy;
		let amp = 1, tot = 0;
		for (let o = 0; o < p.octaves; o++) {
			// Lacunarity multiplies the BASE lattice and is rounded: a non-integer
			// lattice has no meaning for a periodic noise, and would not close on
			// itself, which is where a seam comes from.
			const l = Math.pow(p.lacun, o);
			const nx = Math.max(2, Math.round(nx0 * l));
			const ny = Math.max(2, Math.round(nx / ar));
			const nt = Math.max(2, Math.min(D >> 1, Math.round(p.tcells * l)));
			const g = new Float32Array(nx * ny * nt);
			for (let q = 0; q < g.length; q++) g[q] = rnd();
			// Lattice indices and weights precomputed per AXIS. The inner loop is
			// then eight array reads and no modulo at all; with the modulo inline it
			// was 8.1x slower, which at the largest volume this offers is the
			// difference between a 5-second hitch on load and a 0.6-second one.
			const X0 = new Int32Array(Wx), X1 = new Int32Array(Wx), SX = new Float32Array(Wx);
			for (let x = 0; x < Wx; x++) { const f = x / Wx * nx, i = Math.floor(f);
				X0[x] = i % nx; X1[x] = (i + 1) % nx; SX[x] = sm(f - i); }
			const Y0 = new Int32Array(Wy), Y1 = new Int32Array(Wy), SY = new Float32Array(Wy);
			for (let y = 0; y < Wy; y++) { const f = y / Wy * ny, i = Math.floor(f);
				Y0[y] = (i % ny) * nx; Y1[y] = ((i + 1) % ny) * nx; SY[y] = sm(f - i); }
			const nxy = nx * ny;
			for (let z = 0; z < D; z++) {
				const fz = z / D * nt, iz = Math.floor(fz), sz = sm(fz - iz);
				const zA = (iz % nt) * nxy, zB = ((iz + 1) % nt) * nxy;
				for (let y = 0; y < Wy; y++) {
					const yA = Y0[y], yB = Y1[y], sy = SY[y];
					const row = (z * Wy + y) * Wx;
					const a00 = zA + yA, a10 = zA + yB, a01 = zB + yA, a11 = zB + yB;
					for (let x = 0; x < Wx; x++) {
						const x0 = X0[x], x1 = X1[x], sx = SX[x];
						const c00 = g[a00+x0] + (g[a00+x1] - g[a00+x0]) * sx;
						const c10 = g[a10+x0] + (g[a10+x1] - g[a10+x0]) * sx;
						const c01 = g[a01+x0] + (g[a01+x1] - g[a01+x0]) * sx;
						const c11 = g[a11+x0] + (g[a11+x1] - g[a11+x0]) * sx;
						const c0 = c00 + (c10 - c00) * sy, c1 = c01 + (c11 - c01) * sy;
						out[row + x] += amp * (c0 + (c1 - c0) * sz);
					}
				}
			}
			tot += amp; amp *= p.persist;
		}
		for (let q = 0; q < out.length; q++) out[q] /= tot;
		// FLATTEN STRENGTH is the homogenisation knob. At 1 the marginal of each
		// SLICE is exactly uniform -- every xi equally represented, which is what the
		// band wants, but it also erases the field's own contrast. Below 1 the raw
		// fbm shows through and the layout gets blotchier: more of the frame sits at
		// one regime, less of the band gets visited. Per slice, not per volume: a
		// flat volume does not have flat slices, and any one instant could occupy a
		// fraction of the range, which is the mid-band bias again, relocated.
		//
		// The rank comes from a 16-bit counting sort, not a comparison sort. Ranks
		// are all this needs, and Array.sort with a comparator cost 817 ms here
		// against 55 ms for the count, to the same answer.
		const flat = new Float32Array(out.length), S = Wx * Wy;
		let lo = Infinity, hi = -Infinity;
		for (let q = 0; q < out.length; q++) { if (out[q] < lo) lo = out[q]; if (out[q] > hi) hi = out[q]; }
		const sp = Math.max(hi - lo, 1e-6), w = p.flatten;
		const NB = 65536, hist = new Int32Array(NB);
		for (let z = 0; z < D; z++) {
			const base = z * S; hist.fill(0);
			let slo = Infinity, shi = -Infinity;
			for (let q = base; q < base + S; q++) { if (out[q] < slo) slo = out[q]; if (out[q] > shi) shi = out[q]; }
			const k = (NB - 1) / Math.max(shi - slo, 1e-9);
			for (let q = base; q < base + S; q++) hist[((out[q] - slo) * k) | 0]++;
			let acc = 0;
			for (let i = 0; i < NB; i++) { const c = hist[i]; hist[i] = acc; acc += c; }
			for (let q = base; q < base + S; q++) {
				const r = hist[((out[q] - slo) * k) | 0]++;
				flat[q] = w * (r / (S - 1)) + (1 - w) * ((out[q] - lo) / sp);
			}
		}
		return flat;
	}

	// The SHAPE of the layout: what the three fields ARE. `cells` is the base
	// lattice count across the canvas WIDTH, one per channel -- the three fields no
	// longer differ by how many times one volume is repeated, they differ by having
	// their own lattice. Wavelength at the base octave is 1/cells of the width; the
	// finest octave is that divided by lacun^(octaves-1).
	// The volume is built on the CPU, once, and blocks while it happens: at the
	// desktop size that is around 0.6 s on a laptop and several times that on a
	// phone, which is the page arriving without its background. A phone also has a
	// small canvas, so the resolution is wasted there. Half the texels in each
	// direction and half the slices is an eighth of the work.
	const SMALL = (typeof window !== "undefined") && (
		Math.min(window.innerWidth, window.innerHeight) < 640 ||
		(navigator.hardwareConcurrency || 8) <= 4);
	const noise = { W: SMALL ? 96 : VOL_W, D: SMALL ? 48 : VOL_D,
		cells: [7, 7], tcells: 16, octaves: 7,
		lacun: 1.2, persist: 0.95, flatten: 1.0, ar: 1.5,
		seeds: [0x1a2b3c4d, 0x5e6f7a8b] };
	let volT = null, layoutT = null, layoutF = null, bandAT = null, bandBT = null;
	let volAR = 0;
	function buildVolume() {
		if (volT) return;
		// Texels follow the aspect too, so a cell is resolved equally on both axes.
		const ar = noise.ar;
		const Wx = noise.W | 0, Wy = Math.max(16, Math.round(Wx / ar)), D = noise.D | 0;
		const A = volume(Wx, Wy, D, noise.seeds[0], noise, Math.max(1, Math.round(noise.cells[0]))),
			B = volume(Wx, Wy, D, noise.seeds[1], noise, Math.max(1, Math.round(noise.cells[1])));
		// RG, not RGBA: there are two fields, and two of four channels were being
		// uploaded as padding. At the largest volume on offer that is 9.4 MB on the
		// GPU rather than 18.9, which matters on a phone.
		const data = new Float32Array(Wx * Wy * D * 2);
		for (let q = 0; q < Wx * Wy * D; q++) { data[q*2] = A[q]; data[q*2+1] = B[q]; }
		volT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, volT);
		gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG16F, Wx, Wy, D, 0, gl.RG, gl.FLOAT, data);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		for (const a of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
			gl.texParameteri(gl.TEXTURE_3D, a, gl.REPEAT);
		volAR = ar;
	}
	function bandTex(data) {
		const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, BAND_N, 1, 0, gl.RGBA, gl.FLOAT, data);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return t;
	}
	// The band is built from the three splines HERE, not baked offline, so an editor
	// can hand over new control points and see the field answer. A quadratic Bezier
	// chain per spline, resampled uniformly in ARC LENGTH along the centreline, with
	// the edges carried on the same parameter so eta stays consistent.
	let bandSplines = DEFAULT_SPLINES;
	function bezier(sp, per) {
		const K = sp.k, C = sp.c, out = [];
		for (let i = 0; i < K.length - 1; i++)
			for (let j = 0; j <= per; j++) {
				const t = j / per, m = 1 - t, w0 = m*m, w1 = 2*m*t, w2 = t*t;
				out.push([ w0*K[i][0] + w1*C[i][0] + w2*K[i+1][0],
				           w0*K[i][1] + w1*C[i][1] + w2*K[i+1][1] ]);
			}
		return out;
	}
	function arcResample(P, N) {
		const s = [0];
		for (let i = 1; i < P.length; i++)
			s.push(s[i-1] + Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]));
		const L = s[s.length-1] || 1, out = [];
		let j = 0;
		for (let i = 0; i < N; i++) {
			const target = i / (N - 1) * L;
			while (j < s.length - 2 && s[j+1] < target) j++;
			const a = (target - s[j]) / Math.max(s[j+1] - s[j], 1e-12);
			out.push([ P[j][0] + (P[j+1][0]-P[j][0])*a, P[j][1] + (P[j+1][1]-P[j][1])*a ]);
		}
		return out;
	}
	function bandFrom(sp) {
		const nrm = P => P.map(q => [ (q[0] - F0) / DF, (q[1] - K0) / DK ]);
		const n = x => ({ k: nrm(sp[x].k), c: nrm(sp[x].c) });
		const lo = arcResample(bezier(n("lower"), 400), BAND_N);
		const ce = arcResample(bezier(n("centre"), 400), BAND_N);
		const up = arcResample(bezier(n("upper"), 400), BAND_N);
		const A = new Float32Array(BAND_N * 4), B = new Float32Array(BAND_N * 4);
		for (let i = 0; i < BAND_N; i++) {
			A[i*4] = ce[i][0]; A[i*4+1] = ce[i][1];
			A[i*4+2] = lo[i][0] - ce[i][0]; A[i*4+3] = lo[i][1] - ce[i][1];
			B[i*4] = up[i][0] - ce[i][0]; B[i*4+1] = up[i][1] - ce[i][1];
			B[i*4+2] = 0; B[i*4+3] = 1;
		}
		return [A, B];
	}
	function buildBandLut() {
		if (bandAT) { gl.deleteTexture(bandAT); gl.deleteTexture(bandBT); }
		const [A, B] = bandFrom(bandSplines);
		bandAT = bandTex(A); bandBT = bandTex(B);
	}

	let AW_ = 0, AH = 0, BW = 0, BH = 0;
	let aT = [], aF = [], bT = [], bF = [], auxT = [], auxF = [], af = 0, bf = 0, seedNext = true;

	function resize() {
		const cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
		const small = window.innerWidth < 720;
		const bBudget = small ? 320 : 500, aBudget = small ? 112 : 176;
		const ar = cw / ch;
		// The noise lattice is built for ONE aspect: a cell is square on screen only
		// at the aspect it was built for. A materially different one has to rebuild,
		// or a reshaped window gets stretched cells. 4% is below where that shows.
		noise.ar = ar;
		if (volAR && Math.abs(ar - volAR) / volAR > 0.04) {
			gl.deleteTexture(volT); volT = null;
		}
		const dims = (b) => ar >= 1 ? [Math.round(b), Math.round(b / ar)] : [Math.round(b * ar), Math.round(b)];
		const [bw, bh] = dims(bBudget), [aw, ah] = dims(aBudget);
		if (bw === BW && bh === BH) { buildVolume(); return; }
		BW = bw; BH = bh; AW_ = aw; AH = ah;
		[...aT, ...bT, ...auxT].forEach(t => gl.deleteTexture(t));
		[...aF, ...bF, ...auxF].forEach(f => gl.deleteFramebuffer(f));
		const a0 = target(AW_, AH), a1 = target(AW_, AH);
		const b0 = target(BW, BH), b1 = target(BW, BH);
		const x0 = target(AW_, AH), x1 = target(AW_, AH), x2 = target(AW_, AH), x3 = target(AW_, AH);
		aT = [a0[0], a1[0]]; aF = [a0[1], a1[1]];
		bT = [b0[0], b1[0]]; bF = [b0[1], b1[1]];
		auxT = [x0[0], x1[0], x2[0], x3[0]]; auxF = [x0[1], x1[1], x2[1], x3[1]];
		if (layoutT) { gl.deleteTexture(layoutT); gl.deleteFramebuffer(layoutF); }
		const lay = target(BW, BH); layoutT = lay[0]; layoutF = lay[1];
		buildVolume(); buildBandLut();
		seedNext = true;
	}

	// One mechanism, two strengths. HOLD is the zone that follows the pointer
	// whenever it is over the page; PUSH is the same zone while the button is down.
	// Both pin the local (xi, eta) to the target, which is the controller.
	const mouse = { x: -1, y: -1, px: -1, py: -1, active: false };
	function at(e) {
		const r = canvas.getBoundingClientRect();
		const t = e.touches ? e.touches[0] : e;
		mouse.x = (t.clientX - r.left) / r.width;
		mouse.y = 1.0 - (t.clientY - r.top) / r.height;
		if (mouse.active) { mouse.px = mouse.x; mouse.py = mouse.y; }
	}
	window.addEventListener("pointermove", (e) => { at(e); kick(); }, { passive: true });
	window.addEventListener("pointerdown", (e) => {
		mouse.active = true; at(e); mouse.px = mouse.x; mouse.py = mouse.y; kick();
	}, { passive: true });
	// The position is NOT cleared here: the ramp is still decaying and needs
	// somewhere to decay at. frame() clears it once the ramp reaches zero.
	const release = () => { mouse.active = false; kick(); };
	window.addEventListener("pointerup", release, { passive: true });
	window.addEventListener("pointercancel", release, { passive: true });
	document.addEventListener("pointerleave", () => { release(); mouse.x = -1; mouse.y = -1; }, { passive: true });
	// A held button with a still pointer produces no events, and the ramp has to
	// keep moving, so the press kicks the loop itself.

	const uBlur = { src: gl.getUniformLocation(pBlur, "src"), dir: gl.getUniformLocation(pBlur, "dir"),
		sigma: gl.getUniformLocation(pBlur, "sigma"), shift: gl.getUniformLocation(pBlur, "shift"),
		stride: gl.getUniformLocation(pBlur, "stride") };
	const uA = {}; ["state", "narrow", "wide", "texel", "seed"].forEach(k => uA[k] = gl.getUniformLocation(pA, k));
	const uB = {}; ["state", "mapTex", "bandA", "bandB", "texel", "hover", "press", "seed",
		"swell", "swellR", "pushAmt", "pushR", "tgt", "dtBase"].forEach(k => uB[k] = gl.getUniformLocation(pB, k));
	const uD = { state: gl.getUniformLocation(pDraw, "state"), tone: gl.getUniformLocation(pDraw, "tone"),
		mapTex: gl.getUniformLocation(pDraw, "mapTex") };
	const uL = { vol: gl.getUniformLocation(pLayout, "vol"), t: gl.getUniformLocation(pLayout, "t"),
		rep: gl.getUniformLocation(pLayout, "rep"), rate: gl.getUniformLocation(pLayout, "rate"),
		chan: gl.getUniformLocation(pLayout, "chan") };
	// Layout knobs. The three RATES want to stay mutually incommensurate, or the
	// three fields drift back into the same relation and the page starts repeating.
	const layout = { repeat: [1, 1], rate: [RATE_A, RATE_B] };
	let tone = TONE;
	// Live knobs. hoverD is capped at 2.2: measured, a 4x diffusion boost does not
	// widen the pattern, it EXTINGUISHES it -- the medium leaves its own band.
	// The controller's setpoint and reach. `xi`/`eta` name the pattern being held
	// to, in band coordinates: xi runs along the crescent, eta across it.
	const cursor = { swell: SWELL, swellR: SWELL_R, pushAmt: PUSH_AMT, pushR: PUSH_R,
		pushTime: PUSH_TIME, xi: TGT_XI, eta: TGT_ETA, dt: DT0 };
	// The press ramp. 0 at rest, eased toward 1 while the button is down and back
	// down on release, so the edit arrives and leaves rather than switching.
	let pressRamp = 0, lastT = performance.now();
	mount.setTone = (v) => { tone = Math.max(-1, Math.min(1, v)); if (!running) present(); };
	mount.setCursor = (o) => {
		// The swell is no longer clamped for stability -- dt is shortened inside the
		// zone instead, which keeps the scheme inside its bound at any multiplier.
		// What it IS bounded by is the medium: measured, D x2 widens the pattern only
		// 1.20x and by x4 the pattern is gone, so past about 4 the zone reads as a
		// smooth hole rather than as coarser texture. That is a fact about
		// Gray-Scott, not a reason to refuse the setting.
		// dt's ceiling IS the stability bound: past DTB the scheme diverges even with
		// the swell off, so there is nothing above it worth offering.
		const lim = { pushAmt: [0, 1], swellR: [0.005, 3], pushR: [0.005, 3],
			pushTime: [0.02, 6], swell: [0.05, 16], xi: [0, 1], eta: [0, 1],
			dt: [0.02, DTB] };
		for (const k in lim) if (o[k] !== undefined)
			cursor[k] = Math.max(lim[k][0], Math.min(lim[k][1], +o[k]));
		if (!running) present();
	};
	mount.getCursor = () => ({ ...cursor });
	mount.getTone = () => tone;
	// The scheme's own ceiling on dt, so a control can be built against it rather
	// than against a number copied out of here.
	mount.dtMax = () => DTB;
	mount.getSplines = () => JSON.parse(JSON.stringify(bandSplines));
	// Live editing. reseed:false keeps the running field and lets it migrate to the
	// new parameters, which is the more informative thing to watch.
	mount.setSplines = (sp, reseed) => { bandSplines = sp; buildBandLut();
		if (reseed) seedNext = true; kick(); };
	mount.bandRange = () => ({ F0, DF, K0, DK });
	mount.setLayout = (o) => {
		for (const key of ["repeat", "rate"])
			if (o[key]) layout[key] = layout[key].map((v, i) => o[key][i] === undefined ? v : +o[key][i]);
		kick();
	};
	mount.getLayout = () => JSON.parse(JSON.stringify(layout));
	mount.setRunning = (on) => setRunning(!!on);
	mount.reseed = () => { seedNext = true; kick(); };
	// The noise SHAPE. Every key here changes the volume itself, so the volume is
	// rebuilt; the field is deliberately NOT reseeded, because watching the
	// substrate migrate to a new layout says more than a fresh start does.
	mount.getNoise = () => JSON.parse(JSON.stringify(noise));
	mount.setNoise = (o) => {
		if (o.seeds) noise.seeds = o.seeds.map(v => v >>> 0);
		if (o.cells) noise.cells = noise.cells.map((v, i) =>
			o.cells[i] === undefined ? v : Math.max(1, Math.min(48, Math.round(+o.cells[i]))));
		for (const k of ["W", "D", "octaves", "tcells", "lacun", "persist", "flatten"])
			if (o[k] !== undefined) noise[k] = +o[k];
		noise.W = Math.max(16, Math.min(192, Math.round(noise.W)));
		noise.D = Math.max(4, Math.min(96, Math.round(noise.D)));
		noise.octaves = Math.max(1, Math.min(7, Math.round(noise.octaves)));
		noise.tcells = Math.max(2, Math.min(24, Math.round(noise.tcells)));
		noise.flatten = Math.max(0, Math.min(1, noise.flatten));
		if (volT) { gl.deleteTexture(volT); volT = null; }
		buildVolume(); kick();
		return mount.getNoise();
	};

	// The wavelengths the lattice rounding actually produced, as fractions of the
	// canvas WIDTH: [base, finest] per channel. The panel reports these rather than
	// what was asked for, because the lattice must be integral and the request is
	// rounded to it.
	mount.wavelengths = () => noise.cells.map((c, i) => {
		const l = Math.pow(noise.lacun, noise.octaves - 1);
		const nx0 = Math.max(1, Math.round(c)), rep = Math.max(1e-3, layout.repeat[i]);
		return [1 / (nx0 * rep), 1 / (Math.max(2, Math.round(nx0 * l)) * rep)];
	});

	// A preview of the three layout channels, rendered at preview size from the
	// SAME program and the same simTime as the live map, so what the panel shows
	// is what the field is reading -- not a JS re-implementation that can drift.
	let prevT = null, prevF = null, prevW = 0, prevH = 0;
	mount.mapPreview = (w, h, chan) => {
		w = Math.max(8, w | 0); h = Math.max(8, h | 0);
		if (w !== prevW || h !== prevH) {
			if (prevT) { gl.deleteTexture(prevT); gl.deleteFramebuffer(prevF); }
			prevT = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, prevT);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			prevF = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, prevF);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, prevT, 0);
			prevW = w; prevH = h;
		}
		if (!volT) buildVolume();
		gl.useProgram(pLayout);
		gl.uniform1i(uL.vol, 0); gl.uniform1f(uL.t, simTime);
		gl.uniform2f(uL.rep, ...layout.repeat); gl.uniform2f(uL.rate, ...layout.rate);
		gl.uniform1f(uL.chan, chan === undefined ? -1 : chan);
		gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, volT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, prevF); gl.viewport(0, 0, w, h);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		const px = new Uint8Array(w * h * 4);
		gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
		gl.bindTexture(gl.TEXTURE_3D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		// gl_FragCoord.y = 0 is the BOTTOM; ImageData row 0 is the top. Flip here,
		// once, rather than in every caller.
		const out = new Uint8ClampedArray(w * h * 4);
		for (let y = 0; y < h; y++)
			out.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
		return { w, h, data: out };
	};

	const bindTo = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
	const blit = (fbo) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.drawArrays(gl.TRIANGLES, 0, 3); };

	function convolve(srcTex, sigma, out, shift, stride) {
		gl.useProgram(pBlur);
		gl.uniform1i(uBlur.src, 0); gl.uniform1f(uBlur.sigma, sigma);
		gl.uniform1f(uBlur.stride, stride || 1.0);
		// The shift goes on one axis only: an odd part in x and none in y, which
		// is what gives the lattice a direction to travel rather than a wobble.
		gl.uniform1f(uBlur.shift, shift || 0.0);
		gl.uniform2f(uBlur.dir, 1 / AW_, 0); bindTo(0, srcTex); blit(auxF[0]);
		gl.uniform1f(uBlur.shift, 0.0);
		gl.uniform2f(uBlur.dir, 0, 1 / AH); bindTo(0, auxT[0]); blit(auxF[out]);
	}

	let simTime = 0;
	function stepAll(seed) {
		// The parameter map is rebuilt every frame from the 3D volume, so the whole
		// layout drifts. One full-screen pass against 26 substeps of the substrate:
		// the cost is in the noise, not here.
		simTime += 1;
		gl.useProgram(pLayout);
		gl.uniform1i(uL.vol, 0); gl.uniform1f(uL.t, simTime);
		gl.uniform2f(uL.rep, ...layout.repeat); gl.uniform2f(uL.rate, ...layout.rate);
		gl.uniform1f(uL.chan, -1.0);
		gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, volT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, layoutF); gl.viewport(0, 0, BW, BH);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindTexture(gl.TEXTURE_3D, null);

		// LAYER A -- the Demonstrator-D controller -- is not stepped. Its two blurred
		// readouts were the only thing it fed, and those are gone from the mapping.
		// Everything for it is still built (program, targets, kernels), so putting
		// it back is this block returning, not a rewrite. Costed three separable
		// blurs and two substeps a frame.

		gl.viewport(0, 0, BW, BH);
		gl.useProgram(pB);
		gl.uniform2f(uB.texel, 1 / BW, 1 / BH);
		gl.uniform1i(uB.state, 0);
		gl.uniform1i(uB.mapTex, 4); gl.uniform1i(uB.bandA, 5); gl.uniform1i(uB.bandB, 6);
		gl.uniform1f(uB.seed, seed ? 1.0 : 0.0);
		bindTo(4, layoutT); bindTo(5, bandAT); bindTo(6, bandBT);
		gl.uniform1f(uB.swell, cursor.swell); gl.uniform1f(uB.swellR, cursor.swellR);
		gl.uniform1f(uB.pushAmt, cursor.pushAmt * pressRamp); gl.uniform1f(uB.pushR, cursor.pushR);
		gl.uniform2f(uB.tgt, cursor.xi, cursor.eta);
		gl.uniform1f(uB.dtBase, cursor.dt);
		gl.uniform2f(uB.hover, seed ? -1 : mouse.x, mouse.y);
		// The press applies on every substep -- it edits parameters, and at one
		// substep in 26 the edit was simply invisible. The position stays latched
		// while the ramp decays, so releasing the button lets go rather than cutting.
		gl.uniform2f(uB.press, !seed && pressRamp > 0.002 ? mouse.px : -1, mouse.py);
		const reps = seed ? 1 : B_SUBSTEPS;
		for (let i = 0; i < reps; i++) {
			bindTo(0, bT[bf]); blit(bF[1 - bf]); bf = 1 - bf;
		}
	}

	function present() {
		gl.useProgram(pDraw);
		gl.uniform1i(uD.state, 0); gl.uniform1i(uD.mapTex, 1);
		gl.uniform1f(uD.tone, tone);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		bindTo(0, bT[bf]); bindTo(1, layoutT);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	let running = !reduced.matches, raf = 0, pendingResize = false;
	// Frames still owed to the reduced-motion settle. Counted down in frame(), which
	// keeps looping while it is positive even though `running` is false.
	let settleLeft = 0;

	function frame() {
		raf = 0;
		if (pendingResize) { resize(); pendingResize = false; }
		// Ease the press toward 1 while held and back to 0 on release, on ELAPSED
		// time rather than frames. A per-frame factor would tie the feel of the
		// control to the frame rate, and on a slow machine -- which is exactly where
		// the frame rate drops -- the press would take ten times as long to arrive.
		const now = performance.now();
		const dtSec = Math.min(0.25, (now - lastT) / 1000); lastT = now;
		const want = mouse.active ? 1 : 0;
		pressRamp += (want - pressRamp) * (1 - Math.exp(-dtSec / Math.max(0.02, cursor.pushTime)));
		if (!mouse.active && pressRamp < 0.002) { pressRamp = 0; mouse.px = -1; mouse.py = -1; }
		if (seedNext) { stepAll(true); seedNext = false; }
		stepAll(false);
		present();
		if (settleLeft > 0) settleLeft--;
		if ((running || settleLeft > 0) && !document.hidden) raf = requestAnimationFrame(frame);
	}
	const kick = () => {
		if (!raf && (running || settleLeft > 0) && !document.hidden) raf = requestAnimationFrame(frame);
	};

	window.addEventListener("resize", () => { pendingResize = true; kick(); }, { passive: true });
	document.addEventListener("visibilitychange", kick);

	function setRunning(on) {
		running = on;
		if (on) settleLeft = 0;
		if (toggle) { toggle.textContent = on ? "Pause" : "Run"; toggle.setAttribute("aria-pressed", String(!on)); }
		if (on) kick();
	}
	if (toggle) toggle.addEventListener("click", () => setRunning(!running));

	// Copy the current frame to the clipboard as a PNG. The backbuffer is not
	// preserved, so the grab has to happen in the same task as a draw: present()
	// immediately before toBlob, which snapshots the canvas at call time.
	if (copyBtn) {
		const label = copyBtn.textContent;
		let busy = false;
		const say = (t, ms) => { copyBtn.textContent = t; setTimeout(() => { copyBtn.textContent = label; busy = false; }, ms); };
		copyBtn.addEventListener("click", () => {
			if (busy) return;
			busy = true;
			copyBtn.textContent = "…";
			present();
			canvas.toBlob(blob => {
				if (!blob) { say("failed", 1600); return; }
				const done = () => say(canvas.width + "×" + canvas.height + " copied", 2200);
				const fail = () => {
					// Clipboard refused (insecure context, or a sandbox without
					// clipboard-write). Fall back to a download.
					try {
						const u = URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = u; a.download = "field-" + Date.now() + ".png";
						document.body.appendChild(a); a.click(); a.remove();
						setTimeout(() => URL.revokeObjectURL(u), 4000);
						say("saved", 2200);
					} catch (e) { say("blocked", 2200); }
				};
				try {
					if (!navigator.clipboard || !window.ClipboardItem) return fail();
					// clipboard.write can hang forever where the permission cannot be
					// resolved (some sandboxed frames, unfocused documents). Race it.
					let settled = false;
					const once = fn => () => { if (!settled) { settled = true; fn(); } };
					setTimeout(once(fail), 1500);
					navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(once(done), once(fail));
				} catch (e) { fail(); }
			}, "image/png");
		});
	}

	resize();
	if (reduced.matches) {
		// Settle to a still image, then hold. This used to run 140 steps in ONE
		// synchronous burst -- 3640 full-screen shader passes before the page could
		// paint, on top of the volume build. On a phone that is the whole load time,
		// and the page then arrived paused with no sign that it could be started.
		// Spread over frames instead: the picture develops in front of you and the
		// thread is never held.
		settleLeft = 140;
		setRunning(false);
		kick();
		if (caption) caption.textContent = "A substrate steered by a controller, settling and then held still because this browser asks for reduced motion. Press Run to let it move.";
	} else { kick(); }

	function fallback() {
		canvas.remove();
		if (scrim) scrim.style.background = "radial-gradient(120% 120% at 78% 22%, #2c665d 0%, #12252f 45%, #04050a 100%)";
		if (toggle) toggle.remove();
		if (copyBtn) copyBtn.remove();
		if (caption) caption.textContent = "";
	}
}
