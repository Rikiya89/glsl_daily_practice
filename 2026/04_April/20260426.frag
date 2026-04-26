// ============================================================
// SACRED MANDALA — layered geometry, single living composition
// TouchDesigner GLSL TOP — 20260426
// Required uniforms (Vectors tab):
//   iTime  (float, 1x1)  ← Timer CHOP
// Optional (declare in TD as separate float uniforms; default 0 if unbound):
//   iWarp  (float, 1x1)  ← 0..1 extra kaleido boost over baseline 0.55
//   iBeat  (float, 1x1)  ← 0..1 pulse input (zoom + chromatic flash)
// ============================================================

uniform float iTime;
uniform float iWarp;
uniform float iBeat;

layout(location = 0) out vec4 fragColor;

#define PI    3.14159265359
#define TAU   6.28318530718
#define PHI   1.61803398875
#define SQRT3 1.73205080757

// ── Palette ────────────────────────────────────────────────
const vec3 cInk     = vec3(0.020, 0.027, 0.043); // deep night
const vec3 cAbyss   = vec3(0.043, 0.063, 0.110); // royal indigo
const vec3 cVelvet  = vec3(0.082, 0.043, 0.157); // velvet violet
const vec3 cAmber   = vec3(1.000, 0.722, 0.282); // ritual gold
const vec3 cRose    = vec3(1.000, 0.314, 0.557); // lotus rose
const vec3 cMagenta = vec3(0.788, 0.224, 0.949); // sigil magenta
const vec3 cCyan    = vec3(0.247, 0.918, 0.976); // crystalline cyan
const vec3 cMint    = vec3(0.690, 1.000, 0.910); // jade mist
const vec3 cIce     = vec3(0.878, 0.969, 1.000); // ice halo
const vec3 cWhite   = vec3(1.000, 1.000, 1.000);

// ── Utilities ──────────────────────────────────────────────
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash21(vec2 p) {
    p = fract(p * vec2(127.619, 311.713));
    p += dot(p, p + 47.31);
    return fract(p.x * p.y);
}

// Cosine palette (Inigo Quilez) with golden-ratio offsets
vec3 iqPal(float t) {
    vec3 a = vec3(0.55, 0.45, 0.55);
    vec3 b = vec3(0.40, 0.45, 0.50);
    vec3 c = vec3(1.00, 1.00, 1.00);
    vec3 d = vec3(0.00, 0.33, 0.67);
    return a + b * cos(TAU * (c * t + d));
}

// Kaleidoscope folding around origin
vec2 kaleido(vec2 p, float segs) {
    float a = atan(p.y, p.x);
    float r = length(p);
    float slice = TAU / segs;
    a = mod(a + slice * 0.5, slice) - slice * 0.5;
    return vec2(cos(a), sin(a)) * r;
}

// SDFs
float sdCircle(vec2 p, float r)              { return length(p) - r; }
float sdRing(vec2 p, float r)                { return abs(length(p) - r); }
float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}
float sdEqTri(vec2 p, float r) {
    const float k = SQRT3;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

// Soft glow shaping
float glow(float d, float w, float power) {
    return pow(w / max(abs(d), 1e-4), power);
}
float band(float d, float halfW, float aa) {
    return smoothstep(halfW + aa, halfW - aa, abs(d));
}

// ── Layer 1: Flower of Life (inner heart, breathing) ───────
float flowerLayer(vec2 p, float t) {
    float r = 0.18 + 0.012 * sin(t * 0.9);
    float d = sdRing(p, r);
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.08;
        d = min(d, sdRing(p - vec2(cos(a), sin(a)) * r, r));
    }
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + PI / 6.0 - t * 0.05;
        d = min(d, sdRing(p - vec2(cos(a), sin(a)) * r * SQRT3, r));
    }
    return d;
}

// ── Layer 2: Metatron lattice (rotating, mid-ring) ─────────
float metatronLayer(vec2 p, float t) {
    p *= rot(t * 0.07);
    float ringR = 0.46;
    float d = sdRing(p, ringR);
    vec2 nodes[7];
    nodes[0] = vec2(0.0);
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0;
        nodes[i + 1] = vec2(cos(a), sin(a)) * ringR;
    }
    // node dots
    for (int i = 0; i < 7; i++) {
        d = min(d, sdCircle(p - nodes[i], 0.018));
    }
    // chords between hex nodes (1..6)
    for (int i = 1; i < 7; i++) {
        for (int j = i + 1; j < 7; j++) {
            d = min(d, sdSeg(p, nodes[i], nodes[j]) - 0.0015);
        }
    }
    return d;
}

// ── Layer 3: Sri Yantra triangles (counter-rotating) ───────
float yantraLayer(vec2 p, float t) {
    p *= rot(-t * 0.05);
    float d = 1e5;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float scl = 0.62 - fi * 0.07;
        // Triangle pointing up
        float dUp = abs(sdEqTri(p, scl));
        // Triangle pointing down (rotated 180)
        vec2 q = -p;
        float dDn = abs(sdEqTri(q, scl * 0.92));
        d = min(d, dUp);
        d = min(d, dDn);
    }
    return d;
}

// ── Layer 4: 12-fold lotus petals (outer corona) ───────────
float lotusLayer(vec2 p, float t) {
    p *= rot(t * 0.04);
    float a = atan(p.y, p.x);
    float r = length(p);
    float k = 12.0;
    float petals = 0.74 + 0.06 * sin(t * 0.6);
    float shape = petals * (0.55 + 0.45 * cos(k * a));
    return abs(r - shape);
}

// ── Layer 5: Fibonacci spiral dust (sparkle backdrop) ──────
float fibonacciDust(vec2 p, float t, out float spark) {
    float d = 1e5;
    spark = 0.0;
    float phi = 137.508 * PI / 180.0;
    for (int i = 0; i < 64; i++) {
        float fi = float(i);
        float a = fi * phi + t * 0.18;
        float r = sqrt(fi) * 0.085;
        vec2 c = vec2(cos(a), sin(a)) * r;
        float di = sdCircle(p - c, 0.006 + fi * 0.00018);
        d = min(d, di);
        spark += smoothstep(0.014, 0.0, length(p - c)) * (0.5 + 0.5 * sin(t * 1.7 + fi));
    }
    return d;
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x   *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t = iTime;

    // Subtle global breath / beat zoom
    float breath = 1.0 + 0.025 * sin(t * 0.5);
    float beatK  = clamp(iBeat, 0.0, 1.0);
    st /= breath;
    st *= 1.0 - 0.06 * beatK;

    // Slow whole-canvas rotation
    st *= rot(t * 0.025);

    // Kaleidoscopic warp — baseline 0.55, iWarp adds on top (clamped)
    float warpAmt = clamp(0.55 + iWarp * 0.45, 0.0, 1.0);
    vec2 stK = kaleido(st, 12.0);
    vec2 stW = mix(st, stK, warpAmt);

    // ── Compute SDF layers ───────────────────────────────
    float dFlower  = flowerLayer(stW, t);
    float dMetatron = metatronLayer(stW, t);
    float dYantra  = yantraLayer(stW, t);
    float dLotus   = lotusLayer(stW, t);
    float dustSpark;
    float dDust    = fibonacciDust(stW, t, dustSpark);

    // ── Background: deep nebula gradient ─────────────────
    float r2  = dot(st, st);
    float ang = atan(st.y, st.x);
    vec3 bg   = mix(cInk, cAbyss, smoothstep(0.0, 0.6, r2));
    bg        = mix(bg, cVelvet, 0.35 * smoothstep(0.2, 1.4, r2));
    // soft angular wash
    float wash = 0.5 + 0.5 * sin(ang * 3.0 + t * 0.2);
    bg += iqPal(wash * 0.5 + t * 0.04) * 0.06;

    // Hue cycling along radius — iridescent feel
    float hueT  = length(st) * 0.7 + t * 0.05;
    vec3 iri    = iqPal(hueT);

    vec3 col = bg;

    // Fibonacci dust — soft glow + crisp dot
    col += iqPal(t * 0.07 + 0.20) * glow(dDust, 0.004, 1.1) * 0.55;
    col += vec3(1.0) * smoothstep(0.0035, 0.0, dDust) * 0.9;
    col += cIce * dustSpark * 0.06;

    // Lotus corona — wide warm halo
    float lotusGlow = glow(dLotus, 0.018, 0.85);
    col += mix(cAmber, cRose, 0.5 + 0.5 * sin(t * 0.3)) * lotusGlow * 0.45;
    col += cWhite * band(dLotus, 0.0028, 0.0018) * 0.9;

    // Sri Yantra — magenta/violet ritual lines
    float yantraGlow = glow(dYantra, 0.012, 0.95);
    col += mix(cMagenta, cVelvet * 4.0, 0.4) * yantraGlow * 0.55;
    col += cIce * band(dYantra, 0.0022, 0.0016) * 0.9;

    // Metatron lattice — cyan crystal threads
    float metaGlow = glow(dMetatron, 0.010, 1.0);
    col += mix(cCyan, cMint, 0.35) * metaGlow * 0.7;
    col += cIce * band(dMetatron, 0.0020, 0.0014) * 1.1;

    // Flower of Life — golden core
    float flowerGlow = glow(dFlower, 0.014, 1.1);
    col += mix(cAmber, cIce, 0.25) * flowerGlow * 0.85;
    col += cWhite * band(dFlower, 0.0026, 0.0016) * 1.2;

    // Iridescent radial wash modulating overall hue
    col = mix(col, col * (0.6 + 0.6 * iri), 0.35);

    // Center bloom — divine focal light
    float centerBloom = exp(-r2 * 6.5);
    col += mix(cAmber, cIce, 0.55) * centerBloom * (0.35 + 0.25 * sin(t * 0.4));

    // Outer petal aura — chromatic ring at r ~ 0.95
    float aura = exp(-pow(length(st) - 0.95, 2.0) * 32.0);
    col += iqPal(ang / TAU + t * 0.1) * aura * 0.25;

    // 12-fold star sparkle — kaleidoscopic micro-glints
    vec2 starP = kaleido(st * 1.6, 12.0);
    float starN = hash21(floor(starP * 60.0) + floor(t * 2.0));
    float twinkle = step(0.985, starN) * (0.5 + 0.5 * sin(t * 4.0 + starN * 30.0));
    col += cIce * twinkle * 0.55;

    // Beat reactive pulse on whole frame
    col += iri * beatK * 0.10;

    // Soft intro fade (first 2 seconds)
    col *= smoothstep(0.0, 2.0, t);

    // Vignette using deep ink
    float vig = smoothstep(1.45, 0.25, length(st));
    col = mix(cInk * 0.4, col, vig);

    // Tone map + gentle gamma for richness
    col = col / (col + 0.85);
    col = pow(max(col, 0.0), vec3(0.92));

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
