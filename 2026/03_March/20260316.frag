uniform float uTime;
uniform vec2  uRes;

out vec4 fragColor;

#define PI  3.14159265
#define TAU 6.28318530

// ── Palette ──────────────────────────────────
vec3 cBg1     = vec3(0.161, 0.188, 0.224);
vec3 cBg2     = vec3(0.157, 0.212, 0.192);
vec3 cDeep1   = vec3(0.051, 0.122, 0.176);
vec3 cDeep2   = vec3(0.039, 0.239, 0.180);
vec3 cGreen   = vec3(0.000, 1.000, 0.529);
vec3 cCyan    = vec3(0.000, 0.831, 1.000);
vec3 cPurple  = vec3(0.482, 0.184, 1.000);
vec3 cPink    = vec3(1.000, 0.176, 0.478);
vec3 cMint    = vec3(0.690, 1.000, 0.910);
vec3 cIce     = vec3(0.769, 0.941, 1.000);

// ── Noise & Helpers ──────────────────────────
float hash(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Simplex-like value noise for organic distortion
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(dot(i, vec2(1.0, 157.0)));
    float b = hash(dot(i + vec2(1, 0), vec2(1.0, 157.0)));
    float c = hash(dot(i + vec2(0, 1), vec2(1.0, 157.0)));
    float d = hash(dot(i + vec2(1, 1), vec2(1.0, 157.0)));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion – 4 octaves
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

float foldAngle(float a, float n) {
    float seg = TAU / n;
    float fa = mod(a, seg);
    return min(fa, seg - fa);
}

float ring(float r, float r0, float w) {
    return smoothstep(w, 0.0, abs(r - r0));
}

// ── Mandala Shapes ───────────────────────────
float petalShape(float r, float fa, float folds, float t) {
    float halfSeg = PI / folds;
    float breath = 1.0 + 0.18 * sin(t * 1.8 + folds * 0.7);
    float width = halfSeg * 0.65 * breath * (1.0 - pow(r * 1.1, 2.0));
    width = max(width, 0.0);
    float petal = smoothstep(width, width * 0.25, fa);
    float vein = exp(-fa * fa * folds * folds * 5.0) * 0.6;
    float scallop = 0.07 * sin(r * 35.0 - t * 3.0 + folds);
    petal *= smoothstep(0.0, 0.015, width - fa + scallop);
    return clamp(petal + vein, 0.0, 1.0);
}

float dropShape(float r, float fa, float folds, float t) {
    float halfSeg = PI / folds;
    float pulse = 1.0 + 0.1 * sin(t * 2.3 + folds);
    float tip = smoothstep(0.0, 0.3, r) * smoothstep(0.8, 0.2, r);
    float width = halfSeg * 0.35 * pulse * tip;
    float drop = smoothstep(width, width * 0.15, fa);
    float spine = exp(-fa * fa * folds * folds * 8.0) * 0.4 * tip;
    return clamp(drop + spine, 0.0, 1.0);
}

float dotRing(float r, float angle, float r0, float count, float size) {
    float da = foldAngle(angle, count);
    float dr = r - r0;
    float d = length(vec2(da * r0, dr));
    return smoothstep(size, size * 0.3, d);
}

float filigree(float r, float angle, float folds, float t) {
    float fa = foldAngle(angle, folds);
    float halfSeg = PI / folds;
    float curve = halfSeg * 0.5 * sin(r * PI * 2.5 + t * 0.8);
    float line = exp(-pow((fa - abs(curve)) * folds * 3.0, 2.0)) * 0.7;
    return line * smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.6, r);
}

// ── Floating particles ──────────────────────
float particles(vec2 uv, float t, float layer) {
    float acc = 0.0;
    for (int i = 0; i < 30; i++) {
        float id = float(i) + layer * 30.0;
        vec2 seed = hash2(vec2(id, id * 0.7));

        // Spiral orbit
        float orbitR = 0.15 + seed.x * 0.75;
        float orbitSpeed = (0.2 + seed.y * 0.3) * (mod(id, 2.0) < 1.0 ? 1.0 : -1.0);
        float orbitAngle = seed.x * TAU + t * orbitSpeed;

        vec2 pos = vec2(cos(orbitAngle), sin(orbitAngle)) * orbitR;
        // Vertical drift
        pos.y += 0.05 * sin(t * 0.7 + id);

        float d = length(uv - pos);
        float size = 0.003 + 0.004 * seed.y;
        float flicker = 0.5 + 0.5 * sin(t * (3.0 + seed.x * 4.0) + id);
        acc += smoothstep(size, 0.0, d) * flicker;
    }
    return acc;
}

// ── Radial energy pulse ─────────────────────
float energyPulse(float r, float t) {
    float p = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float phase = t * 0.6 + fi * 2.1;
        float wavefront = fract(phase) * 1.2;
        float intensity = exp(-3.0 * fract(phase)); // fade as it expands
        p += ring(r, wavefront, 0.04) * intensity;
    }
    return p;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
    float t = uTime * 0.35;

    // ── Organic spatial warp via fbm noise ──
    vec2 warpOffset = vec2(
        fbm(uv * 3.0 + t * 0.3) - 0.5,
        fbm(uv * 3.0 + t * 0.3 + 5.0) - 0.5
    );
    uv += warpOffset * 0.025;

    // Breathing zoom: the whole mandala pulses in/out
    float breathZoom = 1.0 + 0.03 * sin(t * 0.8);
    uv *= breathZoom;

    float r     = length(uv);
    float angle = atan(uv.y, uv.x);
    float a     = angle + t * 0.12;

    // ── Background: deep space with nebula swirl ──
    float nebula = fbm(uv * 2.0 - t * 0.15);
    vec3 bg = mix(cDeep1, cBg1, smoothstep(0.0, 1.4, r));
    bg = mix(bg, cDeep2, 0.25 + 0.2 * sin(a * 4.0 + t));
    bg += cPurple * 0.06 * nebula;
    bg += cCyan * 0.04 * fbm(uv * 3.5 + t * 0.1 + 10.0);
    // Subtle grain
    bg += 0.012 * (hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + t * 0.1) - 0.5);

    vec3 col = bg;

    // ═══════ ENERGY PULSES (behind mandala) ═══════
    float pulse = energyPulse(r, t);
    col += cCyan * pulse * 0.25;
    col += cGreen * pulse * 0.15;

    // ═══════ LAYER 1: Outermost dots ═══════
    float dots1 = dotRing(r, a, 0.82, 24.0, 0.018);
    col = mix(col, cIce * 0.7, dots1 * 0.6);

    // ═══════ LAYER 2: Outer filigree ═══════
    float fil1 = filigree(r * 1.2, a + t * 0.05, 12.0, t);
    col += cPurple * fil1 * 0.35 * smoothstep(0.55, 0.85, r);

    // ═══════ LAYER 3: Outer petals – 12-fold ═══════
    float fa1 = foldAngle(a, 12.0);
    float p1  = petalShape(r, fa1, 12.0, t);
    float r1  = ring(r, 0.68 + 0.03 * sin(t * 1.2), 0.12);
    vec3 col1 = mix(cPurple, cPink, 0.3 + 0.3 * sin(r * 10.0 + t));
    col = mix(col, col1, p1 * r1 * 0.85);
    col += col1 * p1 * r1 * 0.18 * (0.5 + 0.5 * sin(t * 1.5));

    // ═══════ LAYER 4: Mid-outer teardrops ═══════
    float fa2d = foldAngle(a + PI / 12.0, 12.0);
    float d1   = dropShape(r * 1.5 - 0.2, fa2d, 12.0, t);
    float r2d  = ring(r, 0.55, 0.08);
    col = mix(col, cCyan * 0.9, d1 * r2d * 0.7);

    // ═══════ LAYER 5: Dot separator ═══════
    float dots2 = dotRing(r, a + PI / 24.0, 0.48, 24.0, 0.012);
    col = mix(col, cMint, dots2 * 0.7);

    // ═══════ LAYER 6: Mid petals – 8-fold ═══════
    float fa3 = foldAngle(a + t * 0.08, 8.0);
    float p3  = petalShape(r, fa3, 8.0, t);
    float r3  = ring(r, 0.40 + 0.025 * sin(t * 0.9), 0.12);
    vec3 col3 = mix(cCyan, cGreen, 0.4 + 0.4 * sin(a * 8.0 + t * 2.0));
    col = mix(col, col3, p3 * r3 * 0.85);
    col += col3 * p3 * r3 * 0.12;

    // ═══════ LAYER 7: Inner filigree ═══════
    float fil2 = filigree(r * 2.5, a - t * 0.1, 6.0, t * 1.3);
    col += cGreen * fil2 * 0.25 * smoothstep(0.15, 0.38, r) * smoothstep(0.45, 0.3, r);

    // ═══════ LAYER 8: Inner petals – 6-fold ═══════
    float fa4 = foldAngle(a - t * 0.15, 6.0);
    float p4  = petalShape(r, fa4, 6.0, t);
    float r4  = ring(r, 0.22 + 0.02 * sin(t * 1.5), 0.10);
    col = mix(col, cGreen, p4 * r4 * 0.9);
    col += cMint * p4 * r4 * 0.12;

    // ═══════ LAYER 9: Inner teardrops ═══════
    float fa5d = foldAngle(a - t * 0.15 + PI / 6.0, 6.0);
    float d2   = dropShape(r * 3.5 - 0.1, fa5d, 6.0, t);
    float r5d  = ring(r, 0.15, 0.06);
    col = mix(col, cPink * 0.85, d2 * r5d * 0.6);

    // ═══════ LAYER 10: Fine accent – 16-fold ═══════
    float fa6 = foldAngle(a + t * 0.2, 16.0);
    float p6  = petalShape(r, fa6, 16.0, t);
    float r6  = ring(r, 0.53, 0.035);
    col = mix(col, cPink, p6 * r6 * 0.6);

    // ═══════ LAYER 11: Circle outlines ═══════
    float line1 = smoothstep(0.003, 0.0, abs(r - 0.78));
    float line2 = smoothstep(0.002, 0.0, abs(r - 0.48));
    float line3 = smoothstep(0.002, 0.0, abs(r - 0.30));
    float line4 = smoothstep(0.002, 0.0, abs(r - 0.10));
    col += cIce * (line1 + line2 * 0.6 + line3 * 0.5 + line4 * 0.4) * 0.35;

    // ═══════ Center lotus bloom ═══════
    float c1 = exp(-r * r * 25.0);
    float c2 = exp(-r * r * 80.0);
    float c3 = exp(-r * r * 300.0);
    col += cMint  * c1 * (0.3 + 0.15 * sin(t * 2.0));
    col += cCyan  * c2 * (0.4 + 0.2 * sin(t * 2.5 + 1.0));
    col += cIce   * c3 * 0.8;

    float ca = foldAngle(a + t * 0.3, 6.0);
    float star = exp(-ca * ca * 200.0) * smoothstep(0.12, 0.0, r) * 0.8;
    col += cGreen * star;

    // ═══════ Outer bloom halo ═══════
    float halo = ring(r, 0.82, 0.08) * (0.25 + 0.2 * sin(a * 12.0 + t));
    col += cIce * halo * 0.3;
    float outerGlow = ring(r, 0.90, 0.15) * (0.15 + 0.1 * sin(a * 24.0 - t * 2.0));
    col += cPurple * outerGlow * 0.2;

    // ═══════ FLOATING PARTICLES ═══════
    // Two layers at different depths for parallax feel
    float part1 = particles(uv, t, 0.0);
    float part2 = particles(uv * 0.85, t * 0.7, 1.0);
    col += cMint * part1 * 0.4;
    col += cCyan * part2 * 0.25;
    // Warm particle accent near center
    float part3 = particles(uv * 1.5, t * 1.2, 2.0);
    col += cPink * part3 * 0.2 * smoothstep(0.5, 0.0, r);

    // ═══════ SACRED GEOMETRY OVERLAY ═══════
    // Rotating hexagram behind the mandala
    float hexA = foldAngle(a + t * 0.05, 6.0);
    float hexLine = smoothstep(0.004, 0.0, abs(hexA - 0.02)) * smoothstep(0.1, 0.2, r) * smoothstep(0.9, 0.75, r);
    col += cIce * hexLine * 0.12;

    // Counter-rotating triangle grid
    float triA = foldAngle(angle - t * 0.08, 3.0);
    float triLine = smoothstep(0.005, 0.0, abs(triA - 0.04)) * smoothstep(0.2, 0.35, r) * smoothstep(0.95, 0.7, r);
    col += cPurple * triLine * 0.08;

    // ═══════ POST-PROCESSING ═══════
    // Vignette – deeper for immersion
    col *= 1.0 - 0.6 * smoothstep(0.4, 1.5, r);

    // Chromatic color-shift shimmer
    col += 0.025 * vec3(
        sin(r * 20.0 + t * 3.0),
        sin(r * 20.0 + t * 3.0 + TAU / 3.0),
        sin(r * 20.0 + t * 3.0 + TAU * 2.0 / 3.0)
    ) * smoothstep(1.0, 0.3, r);

    // Slow global color breathing – shifts hue over time
    float hueShift = 0.03 * sin(t * 0.5);
    col.r += hueShift;
    col.b -= hueShift;

    // HDR tone-mapping (Reinhard)
    col = col / (1.0 + col * 0.15);

    // Slight saturation boost for vibrancy
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, 1.2);

    fragColor = vec4(col, 1.0);
}
