// === SACRED BLOOM — TouchDesigner GLSL TOP ===
// Uniforms (add in GLSL TOP → Vectors tab):
//   iTime    (float, 1x1)  ← Timer CHOP
//   iMode    (float, 1x1)  ← 0..4 pattern selector
//   iWarp    (float, 1x1)  ← 0..1 kaleido mix
//   iBeat    (float, 1x1)  ← 0..1 audio/pulse input

out vec4 fragColor;
uniform float iTime;
uniform float iMode;
uniform float iWarp;
uniform float iBeat;

#define TAU 6.28318530718
#define PI  3.14159265359

// ---- Palette (your 10 colors, normalized) ----
const vec3 C_SLATE   = vec3(0.161, 0.188, 0.224); // #293039
const vec3 C_FOREST  = vec3(0.157, 0.212, 0.192); // #283631
const vec3 C_MIDNIGHT= vec3(0.051, 0.122, 0.176); // #0d1f2d
const vec3 C_DEEP    = vec3(0.039, 0.239, 0.180); // #0a3d2e
const vec3 C_NEON    = vec3(0.000, 1.000, 0.529); // #00ff87
const vec3 C_CYAN    = vec3(0.000, 0.831, 1.000); // #00d4ff
const vec3 C_VIOLET  = vec3(0.482, 0.184, 1.000); // #7b2fff
const vec3 C_PINK    = vec3(1.000, 0.176, 0.478); // #ff2d7a
const vec3 C_MINT    = vec3(0.690, 1.000, 0.910); // #b0ffe8
const vec3 C_ICE     = vec3(0.769, 0.941, 1.000); // #c4f0ff

// ---- Utilities ----
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec2 kaleido(vec2 uv, float segs) {
    float a = atan(uv.y, uv.x);
    float r = length(uv);
    float slice = TAU / segs;
    a = mod(a, slice);
    a = abs(a - slice * 0.5);
    return vec2(cos(a), sin(a)) * r;
}

float circle(vec2 p, float r) { return length(p) - r; }

// Smooth SDF → glow
float glow(float d, float w, float power) {
    return pow(w / max(abs(d), 1e-4), power);
}

// ---- Sacred geometry SDFs ----
// MODE 0: Flower of Life (breathing)
float flowerOfLife(vec2 uv, float t) {
    float r = 0.32 + 0.04 * sin(t * 0.7);
    float d = circle(uv, r);
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.15;
        d = min(d, circle(uv - vec2(cos(a), sin(a)) * r, r));
    }
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + PI / 6.0 - t * 0.1;
        d = min(d, circle(uv - vec2(cos(a), sin(a)) * r * 1.732, r));
    }
    return d;
}

// MODE 1: Metatron lattice (rotating triangles)
float metatron(vec2 uv, float t) {
    uv *= rot(t * 0.2);
    float d = 1e5;
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0;
        vec2 c = vec2(cos(a), sin(a)) * 0.45;
        d = min(d, circle(uv - c, 0.08));
        // connecting lines
        vec2 c2 = vec2(cos(a + TAU/6.0), sin(a + TAU/6.0)) * 0.45;
        vec2 pa = uv - c, ba = c2 - c;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        d = min(d, length(pa - ba * h) - 0.003);
    }
    d = min(d, circle(uv, 0.08));
    return d;
}

// MODE 2: Sri Yantra-style interlocking triangles
float sriYantra(vec2 uv, float t) {
    float d = 1e5;
    float scl = 0.55 + 0.05 * sin(t * 0.5);
    for (int i = 0; i < 9; i++) {
        float fi = float(i);
        vec2 p = uv * rot(fi * 0.3 + t * 0.1);
        // triangle via 3 half-planes
        float k = sqrt(3.0);
        p.x = abs(p.x) - scl * (0.4 + fi * 0.04);
        p.y += scl * 0.3;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
        p.x -= clamp(p.x, -2.0 * scl, 0.0);
        d = min(d, abs(length(p) - 0.01));
    }
    return d;
}

// MODE 3: Fibonacci spiral dots
float fibonacci(vec2 uv, float t) {
    float d = 1e5;
    float phi = 137.508 * PI / 180.0;
    for (int i = 0; i < 64; i++) {
        float fi = float(i);
        float a = fi * phi + t * 0.3;
        float r = sqrt(fi) * 0.045;
        vec2 c = vec2(cos(a), sin(a)) * r;
        d = min(d, circle(uv - c, 0.012 + fi * 0.0004));
    }
    return d;
}

// MODE 4: Torus-knot polar rose
float polarRose(vec2 uv, float t) {
    uv *= rot(t * 0.3);
    float a = atan(uv.y, uv.x);
    float r = length(uv);
    float k = 5.0 + 2.0 * sin(t * 0.4);
    float petals = 0.45 * abs(cos(k * a + t * 0.6));
    return abs(r - petals);
}

// ---- TODO(human): Palette Expression ----
// Design decision: how do these 10 colors MAP onto the geometry?
// This function takes:
//   sdDist  - signed distance from the geometry edge (small = on edge)
//   uv      - centered UV (-1..1)
//   t       - time
//   mode    - current pattern mode (0..4)
// Return: vec3 color for this pixel.
//
// Consider:
//   - Which colors are BACKGROUND vs GLOW vs HIGHLIGHT?
//     (darks #293039/#0d1f2d/#0a3d2e feel like bg; neons feel like emission)
//   - Should color shift by radius? By angle? By time? By mode?
//   - Hard bands (smoothstep thresholds) vs smooth gradients (mix chains)?
//   - Use iq's cos-palette: `palette(t, a, b, c, d)` for smooth cycling?
//
// This function defines the SOUL of the piece — the same geometry
// reads totally differently with a different palette mapping.
// Per-mode color pair (hue personality)
void modeColors(float mode, out vec3 coreCol, out vec3 haloCol, out vec3 bgCol) {
    if (mode < 1.0)      { coreCol = C_NEON;   haloCol = C_MINT;   bgCol = C_DEEP;     } // Flower: green temple
    else if (mode < 2.0) { coreCol = C_CYAN;   haloCol = C_ICE;    bgCol = C_MIDNIGHT; } // Metatron: cold crystal
    else if (mode < 3.0) { coreCol = C_PINK;   haloCol = C_VIOLET; bgCol = C_SLATE;    } // Sri Yantra: tantric fire
    else if (mode < 4.0) { coreCol = C_MINT;   haloCol = C_CYAN;   bgCol = C_FOREST;   } // Fibonacci: bio spiral
    else                 { coreCol = C_VIOLET; haloCol = C_PINK;   bgCol = C_MIDNIGHT; } // Rose: dream nebula
}

vec3 palette(float sdDist, vec2 uv, float t, float mode) {
    vec3 coreCol, haloCol, bgCol;
    modeColors(mode, coreCol, haloCol, bgCol);

    // Breathing color shift along radius + time
    float breath = 0.5 + 0.5 * sin(length(uv) * 4.0 - t * 0.8);
    vec3 accent = mix(coreCol, haloCol, breath);

    // Three stacked glow layers: tight core, medium halo, wide atmosphere
    float core  = glow(sdDist, 0.003, 1.4);
    float halo  = glow(sdDist, 0.020, 0.9);
    float atmos = glow(sdDist, 0.090, 0.6);

    // Chromatic split: R/G/B sample at slightly different distances
    float ca = 0.004;
    vec3 chroma = vec3(
        glow(sdDist - ca, 0.010, 1.0),
        glow(sdDist,      0.010, 1.0),
        glow(sdDist + ca, 0.010, 1.0)
    );

    vec3 col = bgCol;
    col += atmos * mix(haloCol, C_ICE, 0.3) * 0.25;
    col += halo  * accent * 0.9;
    col += core  * C_ICE * 1.4;
    col += chroma * 0.35;

    // Sparkle: tiny bright dots on mint/ice
    float sparkle = pow(core, 3.0);
    col += sparkle * C_MINT * 0.8;

    return col;
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t = iTime;

    // Optional kaleidoscopic warp (iWarp 0..1)
    vec2 stK = kaleido(st, 6.0 + floor(mod(t * 0.3, 6.0)));
    st = mix(st, stK, iWarp);

    // Beat-reactive zoom pulse
    st *= 1.0 - 0.08 * iBeat;

    // ----- Smooth mode crossfade -----
    // iMode is continuous; fract() gives blend factor, floor() gives indices
    float mA = mod(floor(iMode), 5.0);
    float mB = mod(floor(iMode) + 1.0, 5.0);
    float blend = smoothstep(0.0, 1.0, fract(iMode));

    float dA = (mA < 1.0) ? flowerOfLife(st, t) :
               (mA < 2.0) ? metatron(st, t)     :
               (mA < 3.0) ? sriYantra(st, t)    :
               (mA < 4.0) ? fibonacci(st, t)    : polarRose(st, t);
    float dB = (mB < 1.0) ? flowerOfLife(st, t) :
               (mB < 2.0) ? metatron(st, t)     :
               (mB < 3.0) ? sriYantra(st, t)    :
               (mB < 4.0) ? fibonacci(st, t)    : polarRose(st, t);

    // Color both, then crossfade the FINAL colors (richer than SDF blending)
    vec3 colA = palette(dA, st, t, mA);
    vec3 colB = palette(dB, st, t, mB);
    vec3 col  = mix(colA, colB, blend);

    // ----- Breathing opacity fade (geometry "inhales") -----
    float breathe = 0.75 + 0.25 * sin(t * 0.6);
    col *= breathe;

    // ----- Slow global hue wash: whole piece fades through palette -----
    float wash = 0.5 + 0.5 * sin(t * 0.15);
    vec3 washTint = mix(C_MINT, C_VIOLET, wash);
    col = mix(col, col * washTint * 1.4, 0.25);

    // ----- Soft intro/outro fade on seconds 0-2 and loop boundary -----
    float intro = smoothstep(0.0, 2.0, t);
    col *= intro;

    // Subtle vignette using deep forest
    float vig = smoothstep(1.4, 0.3, length(st));
    col = mix(C_SLATE * 0.3, col, vig);

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
