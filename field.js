/*
	field.js — the page's background, as one module behind one entry point.

	    import { mount } from "./field.js";
	    mount({ canvas, scrim, toggle, caption });

	The model is the project's own apparatus, not a stock demo: a growing field
	under a projected inhibition that is computed from the field itself through a
	designed interaction kernel, with the controller given a response time.

	    K  = a_w·G(sw) - a_n·G(sn)          the designed kernel
	    Phi' = ( g·max(K*u, 0) - Phi ) / tau  the projected light, with lag
	    u' = r·u(1-u) - u·Phi + D grad^2 u    the substrate

	Two dials are swept across the viewport rather than held fixed, so the page is
	a plane of parameters and every regime is on screen at once: control GAIN left
	to right, controller RESPONSE TIME top to bottom. The still image therefore
	carries the gain axis and the motion carries the lag axis.

	This file is the swap point. When nabla-wasm can compile and run a .nabla
	graph in the browser (Strategic/Outreach/Nabla-Web-Background_Spec.md), mount()
	keeps its signature and the inside of this file is replaced — the page does not
	change. Until then, and wherever WebGPU or WebGL2 is unavailable, this runs.

	Colour: the ramp is FEED_STOPS from assets/render.py, built and validated by
	assets/colourmap.py. Do not hand-edit it here; regenerate it there.
*/

const FEED_RAMP = `	const vec3 LUT[16] = vec3[16](
			vec3(0.0039, 0.0824, 0.1255),
			vec3(0.0157, 0.1529, 0.1922),
			vec3(0.0275, 0.2235, 0.2510),
			vec3(0.0471, 0.2980, 0.3059),
			vec3(0.0667, 0.3686, 0.3451),
			vec3(0.0824, 0.4314, 0.3686),
			vec3(0.0941, 0.4902, 0.3804),
			vec3(0.1059, 0.5373, 0.3765),
			vec3(0.2157, 0.5882, 0.3765),
			vec3(0.3608, 0.6392, 0.3922),
			vec3(0.4941, 0.6902, 0.4235),
			vec3(0.6196, 0.7412, 0.4706),
			vec3(0.7333, 0.7922, 0.5373),
			vec3(0.8392, 0.8392, 0.6196),
			vec3(0.9216, 0.8863, 0.7216),
			vec3(0.9569, 0.9216, 0.8196));

	vec3 ramp(float t) {
		float x = clamp(t, 0.0, 1.0) * 15.0;
		int i = int(floor(x));
		return mix(LUT[i], LUT[min(i + 1, 15)], x - float(i));
	}`;
export function mount(els) {
	"use strict";

	/* ── the model ──────────────────────────────────────────────────────────
	   Not Gray–Scott. This is the apparatus the project actually builds: a
	   growing field under a projected inhibition that is computed from the
	   field itself through a designed interaction kernel, with the controller
	   given a response time.

	       K  = a_w·G(σ_w) − a_n·G(σ_n)        the designed kernel
	       Φ' = ( g·max(K∗u, 0) − Φ ) / τ      the projected light, with lag
	       u' = r·u(1−u) − u·Φ + D∇²u          the substrate

	   Two dials are swept across the viewport rather than fixed, so the page
	   is a plane of parameters and every regime is on screen at once: control
	   GAIN g left to right, controller RESPONSE TIME τ top to bottom. Low gain
	   leaves the field uniform; raise it and a lattice appears; lengthen the
	   lag and the lattice stops holding still.                               */

	const G_LO = 2.5, G_HI = 15.0;			// control gain, across x
	const T_LO = 0.30, T_HI = 8.0;			// controller response time, down y
	const SW = 6.0, SN = 1.5;			// kernel widths, in cells
	const AW = 1.0, AN = 0.6;			// kernel weights
	const R = 1.0, ALPHA = 0.10, DT = 0.05;		// growth, diffusion number, step
	const SUBSTEPS = 8;

	const canvas = els.canvas;
	const toggle = els.toggle;
	const caption = els.caption;
	const scrim = els.scrim;

	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
	if (!gl || !gl.getExtension("EXT_color_buffer_float")) { fallback(); return; }

	const VERT = `#version 300 es
	in vec2 p; out vec2 uv;
	void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

	/* One separable Gaussian pass. Run four times a frame — narrow then wide,
	   each horizontal then vertical — to get the two halves of the kernel. */
	const BLUR = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D src;
	uniform vec2 dir;			// texel step, one axis at a time
	uniform float sigma;
	void main() {
		float step = max(sigma / 2.6, 0.9);
		float sum = 0.0, wsum = 0.0;
		for (int i = -7; i <= 7; i++) {
			float x = float(i) * step;
			float w = exp(-(x * x) / (2.0 * sigma * sigma));
			sum += w * texture(src, uv + dir * x).r;
			wsum += w;
		}
		outColor = vec4(sum / wsum, 0.0, 0.0, 1.0);
	}`;

	const STEP = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D state;		// r = u, g = phi
	uniform sampler2D narrow;
	uniform sampler2D wide;
	uniform vec2 texel;
	uniform vec2 mouse;
	uniform float mouseR;
	uniform float seed;

	float U(vec2 o) { return texture(state, uv + o * texel).r; }

	void main() {
		vec2 c = texture(state, uv).rg;
		float u = c.r, phi = c.g;

		if (seed > 0.5) {
			float n = fract(sin(dot(uv, vec2(12.9898, 78.233)) + seed) * 43758.5453);
			outColor = vec4(0.22 + 0.10 * n, 0.0, 0.0, 1.0);
			return;
		}

		float lap = (U(vec2(-1.0, 0.0)) + U(vec2(1.0, 0.0)) + U(vec2(0.0, -1.0)) + U(vec2(0.0, 1.0))) * 0.2
		          + (U(vec2(-1.0, -1.0)) + U(vec2(1.0, 1.0)) + U(vec2(1.0, -1.0)) + U(vec2(-1.0, 1.0))) * 0.05
		          - u;

		float K = ${AW.toFixed(2)} * texture(wide, uv).r - ${AN.toFixed(2)} * texture(narrow, uv).r;

		float g   = mix(${G_LO.toFixed(2)}, ${G_HI.toFixed(2)}, uv.x);
		float tau = mix(${T_LO.toFixed(2)}, ${T_HI.toFixed(2)}, 1.0 - uv.y);

		phi += ${DT.toFixed(3)} * (g * max(K, 0.0) - phi) / tau;
		u   += ${DT.toFixed(3)} * (${R.toFixed(2)} * u * (1.0 - u) - u * phi) + ${ALPHA.toFixed(3)} * lap;

		if (mouse.x >= 0.0) {
			float ar = texel.y / texel.x;
			float d = distance(uv * vec2(ar, 1.0), mouse * vec2(ar, 1.0));
			u += 0.30 * exp(-(d * d) / (mouseR * mouseR));
		}
		outColor = vec4(clamp(u, 0.0, 1.4), max(phi, 0.0), 0.0, 1.0);
	}`;

	const DRAW = `#version 300 es
	precision highp float;
	in vec2 uv; out vec4 outColor;
	uniform sampler2D state;
	__RAMP__
	void main() {
		float u = texture(state, uv).r;
		outColor = vec4(ramp(smoothstep(0.06, 0.62, u)), 1.0);
	}`;

	function compile(src, type) {
		const sh = gl.createShader(type);
		gl.shaderSource(sh, src); gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + "\n" + src);
		return sh;
	}
	function program(fs) {
		const pr = gl.createProgram();
		gl.attachShader(pr, compile(VERT, gl.VERTEX_SHADER));
		gl.attachShader(pr, compile(fs, gl.FRAGMENT_SHADER));
		gl.linkProgram(pr);
		if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
		return pr;
	}

	let blurProg, stepProg, drawProg;
	try {
		blurProg = program(BLUR);
		stepProg = program(STEP);
		drawProg = program(DRAW.replace("__RAMP__", FEED_RAMP));
	} catch (e) { fallback(); return; }

	const quad = gl.createVertexArray();
	gl.bindVertexArray(quad);
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	let W = 0, H = 0, st = [], stF = [], aux = [], auxF = [], front = 0, needsSeed = true;

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

	function resize() {
		const cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(cw * dpr);
		canvas.height = Math.round(ch * dpr);
		const budget = window.innerWidth < 720 ? 260 : 420;
		const aspect = cw / ch;
		const w = Math.round(aspect >= 1 ? budget : budget * aspect);
		const h = Math.round(aspect >= 1 ? budget / aspect : budget);
		if (w === W && h === H) return;
		W = w; H = h;
		[...st, ...aux].forEach(t => gl.deleteTexture(t));
		[...stF, ...auxF].forEach(f => gl.deleteFramebuffer(f));
		const a = target(W, H), b = target(W, H), c = target(W, H), d = target(W, H), e = target(W, H);
		st = [a[0], b[0]]; stF = [a[1], b[1]];
		aux = [c[0], d[0], e[0]]; auxF = [c[1], d[1], e[1]];	// 0 scratch, 1 narrow, 2 wide
		needsSeed = true;
	}

	const mouse = { x: -1, y: -1, active: false };
	function pointer(e) {
		const r = canvas.getBoundingClientRect();
		const t = e.touches ? e.touches[0] : e;
		mouse.x = (t.clientX - r.left) / r.width;
		mouse.y = 1.0 - (t.clientY - r.top) / r.height;
		mouse.active = true;
	}
	window.addEventListener("pointermove", pointer, { passive: true });
	window.addEventListener("pointerdown", pointer, { passive: true });
	window.addEventListener("pointerleave", () => { mouse.active = false; }, { passive: true });

	const uB = { src: gl.getUniformLocation(blurProg, "src"), dir: gl.getUniformLocation(blurProg, "dir"), sigma: gl.getUniformLocation(blurProg, "sigma") };
	const uS = {
		state: gl.getUniformLocation(stepProg, "state"), narrow: gl.getUniformLocation(stepProg, "narrow"),
		wide: gl.getUniformLocation(stepProg, "wide"), texel: gl.getUniformLocation(stepProg, "texel"),
		mouse: gl.getUniformLocation(stepProg, "mouse"), mouseR: gl.getUniformLocation(stepProg, "mouseR"),
		seed: gl.getUniformLocation(stepProg, "seed"),
	};
	const uD = { state: gl.getUniformLocation(drawProg, "state") };

	function blit(fbo) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.drawArrays(gl.TRIANGLES, 0, 3); }
	function bind(tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); }

	function convolve(sigma, outIdx) {
		gl.useProgram(blurProg);
		gl.uniform1i(uB.src, 0);
		gl.uniform1f(uB.sigma, sigma);
		gl.uniform2f(uB.dir, 1 / W, 0);
		bind(st[front]); blit(auxF[0]);
		gl.uniform2f(uB.dir, 0, 1 / H);
		bind(aux[0]); blit(auxF[outIdx]);
	}

	function frameStep(seedNow) {
		gl.viewport(0, 0, W, H);
		if (seedNow) {
			gl.useProgram(stepProg);
			gl.uniform1f(uS.seed, 1.0);
			gl.uniform2f(uS.mouse, -1, -1);
			gl.uniform2f(uS.texel, 1 / W, 1 / H);
			gl.uniform1i(uS.state, 0);
			bind(st[front]); blit(stF[1 - front]); front = 1 - front;
			return;
		}
		// The kernel is re-evaluated once a frame; Φ has a response time, so the
		// substrate may take several steps against the same projected field.
		convolve(SN, 1);
		convolve(SW, 2);
		gl.useProgram(stepProg);
		gl.uniform1f(uS.seed, 0.0);
		gl.uniform2f(uS.texel, 1 / W, 1 / H);
		gl.uniform1f(uS.mouseR, window.innerWidth < 720 ? 0.05 : 0.032);
		gl.uniform1i(uS.state, 0); gl.uniform1i(uS.narrow, 1); gl.uniform1i(uS.wide, 2);
		gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, aux[1]);
		gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, aux[2]);
		for (let i = 0; i < SUBSTEPS; i++) {
			gl.uniform2f(uS.mouse, mouse.active && i === 0 ? mouse.x : -1, mouse.y);
			gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st[front]);
			blit(stF[1 - front]);
			front = 1 - front;
		}
	}

	function present() {
		gl.useProgram(drawProg);
		gl.uniform1i(uD.state, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st[front]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	let running = !reduced.matches, raf = 0, pendingResize = false;

	function frame() {
		raf = 0;
		if (pendingResize) { resize(); pendingResize = false; }
		if (needsSeed) { frameStep(true); needsSeed = false; }
		frameStep(false);
		present();
		if (running && !document.hidden) raf = requestAnimationFrame(frame);
	}
	function kick() { if (!raf && running && !document.hidden) raf = requestAnimationFrame(frame); }

	window.addEventListener("resize", () => { pendingResize = true; kick(); }, { passive: true });
	document.addEventListener("visibilitychange", kick);

	function setRunning(on) {
		running = on;
		toggle.textContent = on ? "Pause" : "Run";
		toggle.setAttribute("aria-pressed", String(!on));
		if (on) kick();
	}
	toggle.addEventListener("click", () => setRunning(!running));

	resize();
	if (reduced.matches) {
		frameStep(true); needsSeed = false;
		for (let i = 0; i < 90; i++) frameStep(false);
		present();
		setRunning(false);
		caption.textContent = "A growth field under projected inhibition, settled and held still because this browser asks for reduced motion. Control gain varies across the screen, controller response time down it.";
	} else {
		kick();
	}

	function fallback() {
		canvas.remove();
		if (scrim) scrim.style.background =
			"radial-gradient(120% 120% at 78% 22%, #156e5e 0%, #0c2a30 45%, #011520 100%)";
		if (toggle) toggle.remove();
		if (caption) caption.textContent = "";
	}
}
