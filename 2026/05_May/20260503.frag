// ============================================================
// AURORA NEBULA — flowing volumetric ribbons & cosmic dust
// TouchDesigner GLSL TOP — 20260503
// Required uniforms (Vectors tab):
//   iTime  (float, 1x1)  ← Timer CHOP
// Optional (declare in TD as separate float uniforms; default 0 if unbound):
//   iWarp  (float, 1x1)  ← 0..1 extra turbulence over baseline
//   iBeat  (float, 1x1)  ← 0..1 pulse input (bloom + chromatic flash)
// Palette intentionally identical to 20260426 (Sacred Mandala).
// ============================================================

uniform float iTime;
uniform float iWarp;
uniform float iBeat;

layout(location = 0) out vec4 fragColor;

#define PI    3.14159265359
#define TAU   6.28318530718
#define PHI   1.61803398875

// ── Palette (matches 20260426) ─────────────────────────────
const vec3 cBg1    = vec3(0.039, 0.059, 0.051); // deep forest night
const vec3 cBg2    = vec3(0.051, 0.129, 0.216); // ocean midnight
const vec3 cBg3    = vec3(0.102, 0.102, 0.180); // deep violet dusk
const vec3 cGreen  = vec3(0.000, 1.000, 0.529); // electric green
const vec3 cCyan   = vec3(0.000, 0.831, 1.000); // neon cyan
const vec3 cPurple = vec3(0.482, 0.184, 1.000); // electric purple
const vec3 cPink   = vec3(1.000, 0.176, 0.478); // hot pink
const vec3 cMint   = vec3(0.690, 1.000, 0.910); // jade mist
const vec3 cIce    = vec3(0.878, 0.969, 1.000); // ice halo
const vec3 cWhite  = vec3(1.000, 1.000, 1.000);

// ── Utilities ──────────────────────────────────────────────
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash21(vec2 p) {
    p = fract(p * vec2(127.619, 311.713));
    p += dot(p, p + 47.31);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 6; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

// Domain-warped flow field
vec2 flowField(vec2 p, float t) {
    vec2 q = vec2(fbm(p + vec2(0.0, t * 0.15)),
                  fbm(p + vec2(5.2, 1.3) - t * 0.12));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.10),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.08));
    return r;
}

// Cosine palette (Inigo Quilez) — tuned to match Mandala iridescence
vec3 iqPal(float t) {
    vec3 a = vec3(0.50, 0.55, 0.55);
    vec3 b = vec3(0.45, 0.40, 0.45);
    vec3 c = vec3(1.00, 1.00, 1.00);
    vec3 d = vec3(0.50, 0.20, 0.67);
    return a + b * cos(TAU * (c * t + d));
}

// Single ribbon strand: returns intensity in [0..1]
float ribbon(vec2 p, float seed, float t) {
    // Spatially-varying offset from a flow field
    vec2 fp = p * 1.4 + vec2(seed * 31.7, -seed * 17.3);
    vec2 flow = flowField(fp, t + seed * 9.13);

    // Base sinuous curve
    float yCurve = 0.55 * sin(p.x * 1.5 + t * 0.45 + seed * 7.0)
                 + 0.25 * sin(p.x * 3.1 - t * 0.7 + seed * 3.0)
                 + 0.45 * (flow.y - 0.5);

    // Slight slope offset per ribbon (vertical stacking)
    float baseY = (seed - 0.5) * 1.4;

    float dist = abs(p.y - baseY - yCurve);

    // Ribbon thickness, modulated by flow
    float thick = 0.06 + 0.05 * flow.x;
    float core  = smoothstep(thick, 0.0, dist);
    float halo  = exp(-dist * dist * 18.0);

    return core * 0.65 + halo * 0.55;
}

// Star field with twinkle
float starField(vec2 p, float t) {
    vec2 g = floor(p * 60.0);
    vec2 f = fract(p * 60.0) - 0.5;
    float h = hash21(g);
    float s = step(0.992, h);
    float r = length(f);
    float tw = 0.5 + 0.5 * sin(t * 3.0 + h * 60.0);
    return s * smoothstep(0.32, 0.0, r) * tw;
}

// Soft volumetric nebula clouds
float nebula(vec2 p, float t) {
    vec2 q = p * 0.9;
    q += 0.6 * (flowField(q * 0.7, t * 0.3) - 0.5);
    float n = fbm(q + t * 0.05);
    return smoothstep(0.35, 0.95, n);
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x   *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t = iTime;

    // Global breathing zoom + beat compression
    float breath = 1.0 + 0.025 * sin(t * 0.45);
    float beatK  = clamp(iBeat, 0.0, 1.0);
    st /= breath;
    st *= 1.0 - 0.05 * beatK;

    // Slow whole-canvas drift rotation
    st *= rot(sin(t * 0.07) * 0.10);

    // Optional turbulence boost
    float warpAmt = clamp(0.45 + iWarp * 0.55, 0.0, 1.0);

    // Domain warp the canvas itself (subtle)
    vec2 warpField = flowField(st * 0.6, t) - 0.5;
    vec2 stW = st + warpField * 0.18 * warpAmt;

    // ── Background: deep forest → ocean → violet gradient ──
    float r2  = dot(st, st);
    float ang = atan(st.y, st.x);
    vec3 bg   = mix(cBg1, cBg2, smoothstep(0.0, 0.6, r2));
    bg        = mix(bg, cBg3, 0.45 * smoothstep(0.15, 1.4, r2));

    // Soft angular wash to break flat gradient
    float wash = 0.5 + 0.5 * sin(ang * 2.0 + t * 0.18);
    bg += iqPal(wash * 0.5 + t * 0.04) * 0.05;

    vec3 col = bg;

    // ── Nebula clouds — purple/cyan diffused haze ──────────
    float neb1 = nebula(stW + vec2( 0.6, -0.2), t * 1.1);
    float neb2 = nebula(stW * 1.3 + vec2(-0.8, 0.4), -t * 0.8);
    col += cPurple * neb1 * 0.22;
    col += cCyan   * neb2 * 0.20;
    col += mix(cBg3, cPurple, 0.5) * (neb1 * neb2) * 0.55;

    // ── Aurora ribbons — five strands, layered ─────────────
    float r1 = ribbon(stW, 0.12, t);
    float r2v = ribbon(stW * vec2(1.0, 1.05), 0.34, t * 1.05 + 1.7);
    float r3 = ribbon(stW * vec2(1.0, 1.10), 0.58, t * 0.92 - 2.3);
    float r4 = ribbon(stW * vec2(1.0, 1.00), 0.78, t * 1.12 + 4.1);
    float r5 = ribbon(stW * vec2(1.0, 0.95), 0.94, t * 0.85 - 5.7);

    col += cGreen  * r1 * 0.95;
    col += cCyan   * r2v * 0.90;
    col += cMint   * r3 * 0.75;
    col += cPurple * r4 * 0.85;
    col += cPink   * r5 * 0.80;

    // White-hot ribbon cores (thin centerlines)
    float coreSum = max(max(max(r1, r2v), max(r3, r4)), r5);
    col += cWhite * pow(coreSum, 6.0) * 0.9;
    col += cIce   * pow(coreSum, 3.0) * 0.35;

    // ── Cosmic dust — fibonacci-distributed glowing motes ──
    float dust = 0.0;
    float dustGlow = 0.0;
    float phi = 137.508 * PI / 180.0;
    for (int i = 0; i < 48; i++) {
        float fi = float(i);
        float a  = fi * phi + t * 0.12;
        float r  = sqrt(fi) * 0.11;
        vec2  c  = vec2(cos(a), sin(a)) * r;
        // gentle drift
        c += 0.05 * vec2(sin(t * 0.6 + fi), cos(t * 0.5 + fi * 1.3));
        float dl = length(stW - c);
        dust     += smoothstep(0.012, 0.0, dl);
        dustGlow += exp(-dl * dl * 240.0);
    }
    col += cIce   * dust * 0.35;
    col += iqPal(t * 0.06 + 0.20) * dustGlow * 0.18;

    // ── Star twinkle field ─────────────────────────────────
    float stars = starField(stW * 1.2, t);
    col += cIce * stars * 0.85;

    // ── Iridescent radial hue shift ────────────────────────
    float hueT = length(st) * 0.7 + t * 0.05;
    vec3  iri  = iqPal(hueT);
    col = mix(col, col * (0.6 + 0.6 * iri), 0.30);

    // ── Center bloom — cyan/ice focal light ────────────────
    float centerBloom = exp(-r2 * 3.0);
    col += mix(cCyan, cIce, 0.55) * centerBloom * (0.55 + 0.30 * sin(t * 0.4));

    // ── Outer chromatic aura ───────────────────────────────
    float aura = exp(-pow(length(st) - 0.92, 2.0) * 28.0);
    col += iqPal(ang / TAU + t * 0.1) * aura * 0.22;

    // ── Beat reactive pulse ────────────────────────────────
    col += iri * beatK * 0.12;

    // ── Soft intro fade (first 2 seconds) ──────────────────
    col *= smoothstep(0.0, 2.0, t);

    // ── Vignette using deep bg ─────────────────────────────
    float vig = smoothstep(1.45, 0.25, length(st));
    col = mix(cBg1 * 0.4, col, vig);

    // ── Tone map + gentle gamma ────────────────────────────
    col = col / (col + 0.85);
    col = pow(max(col, 0.0), vec3(0.92));

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
