// TouchDesigner GLSL TOP - Sacred Geometry: Celestial Temple
// Deep violet → celestial blue | Ancient math + otherworldly beauty
// Domain warping, aurora, mandala, god rays, chromatic bloom

uniform float uTime;
out vec4 fragColor;

#define PI  3.14159265359
#define TAU 6.28318530718
#define PHI 1.61803398875

// ── Palette ────────────────────────────────────────────────
vec3 pal[10] = vec3[10](
    vec3(0.212, 0.176, 0.471),  // #362d78
    vec3(0.322, 0.247, 0.639),  // #523fa3
    vec3(0.569, 0.424, 0.800),  // #916ccc
    vec3(0.741, 0.631, 0.898),  // #bda1e5
    vec3(0.784, 0.753, 0.914),  // #c8c0e9
    vec3(0.518, 0.729, 0.906),  // #84bae7
    vec3(0.318, 0.416, 0.831),  // #516ad4
    vec3(0.200, 0.247, 0.529),  // #333f87
    vec3(0.161, 0.188, 0.224),  // #293039
    vec3(0.157, 0.212, 0.192)   // #283631
);

vec3 getColor(float t) {
    t = fract(t) * 9.0;
    int i = int(floor(t));
    float f = fract(t);
    f = f * f * (3.0 - 2.0 * f);
    return mix(pal[i], pal[min(i + 1, 9)], f);
}

// Bright accent blend from palette
vec3 accentColor(float t, float time) {
    return mix(
        mix(pal[2], pal[5], 0.5 + 0.5 * sin(t * 3.0 + time * 0.3)),
        mix(pal[3], pal[6], 0.5 + 0.5 * cos(t * 2.0 + time * 0.2)),
        0.5 + 0.5 * sin(t * 5.0 + time * 0.5)
    );
}

// ── Utilities ──────────────────────────────────────────────
mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * (p + p));
}

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
        mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = rot(0.5);
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = r * p * 2.0 + 1.7;
        a *= 0.5;
    }
    return v;
}

// ── Domain warping (creates organic flowing distortion) ────
vec2 domainWarp(vec2 p, float time) {
    float n1 = fbm(p + vec2(time * 0.06, time * 0.08));
    float n2 = fbm(p + vec2(time * -0.07, time * 0.05) + 5.2);
    vec2 warp1 = vec2(n1, n2) * 0.4;
    // Second pass for deeper warp
    float n3 = fbm(p + warp1 + vec2(time * 0.03));
    float n4 = fbm(p + warp1 + vec2(time * -0.04) + 8.1);
    return vec2(n3, n4) * 0.3;
}

// ── SDF primitives ─────────────────────────────────────────
float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// ── Flower of Life (breathing + ripple) ────────────────────
float flowerOfLife(vec2 p, float r, float thick, float t) {
    float d = 1e9;
    float breathe = 1.0 + 0.06 * sin(t * 0.8);
    float rb = r * breathe;
    d = min(d, abs(sdCircle(p, rb)));
    for (int ring = 0; ring < 3; ring++) {
        int count = (ring == 0) ? 6 : 6;
        float ringR = (ring == 0) ? rb : (ring == 1) ? rb * 1.732 : rb * 2.0;
        float angleOff = (ring == 1) ? PI / 6.0 : 0.0;
        for (int i = 0; i < 6; i++) {
            float a = float(i) * TAU / 6.0 + angleOff;
            float wave = sin(t * 1.2 + float(i + ring * 6) * 0.4) * 0.025;
            vec2 c = (ringR + wave) * vec2(cos(a), sin(a));
            d = min(d, abs(sdCircle(p - c, rb)));
        }
    }
    return d - thick;
}

// ── Metatron's Cube (orbiting nodes) ───────────────────────
float metatronsCube(vec2 p, float r, float thick, float t) {
    float d = 1e9;
    vec2 pts[13];
    pts[0] = vec2(0.0);
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.05;
        float r1 = r * (1.0 + 0.05 * sin(t * 0.6 + float(i)));
        float r2 = 2.0 * r * (1.0 + 0.04 * sin(t * 0.5 + float(i) * 0.8));
        pts[1 + i] = r1 * vec2(cos(a), sin(a));
        pts[7 + i] = r2 * vec2(cos(a), sin(a));
    }
    for (int i = 0; i < 13; i++) {
        float pulse = 1.0 + 0.3 * sin(t * 2.0 + float(i) * PHI);
        d = min(d, abs(sdCircle(p - pts[i], r * 0.12 * pulse)) - thick * 0.4);
    }
    for (int i = 0; i < 13; i++)
        for (int j = i + 1; j < 13; j++)
            d = min(d, sdSegment(p, pts[i], pts[j]) - thick * 0.2);
    return d;
}

// ── Golden Spiral ──────────────────────────────────────────
float goldenSpiral(vec2 p, float t) {
    float d = 1e9;
    float r = length(p);
    float a = atan(p.y, p.x);
    float b = log(PHI) / (PI * 0.5);
    float expand = 0.02 + 0.005 * sin(t * 0.3);
    for (int n = -10; n < 10; n++) {
        float theta = a + float(n) * TAU;
        d = min(d, abs(r - expand * exp(b * (theta + t * 0.5))));
    }
    return d;
}

// ── Sri Yantra (pulsing triangles) ─────────────────────────
float sdTri(vec2 p, float s, float a) {
    p = rot(a) * p;
    vec2 q = abs(p);
    return max(q.x * 0.866 + p.y * 0.5, -p.y) - s * 0.5;
}

float sriYantra(vec2 p, float size, float thick, float t) {
    float d = 1e9;
    for (int i = 0; i < 4; i++) {
        float pulse = 1.0 + 0.04 * sin(t * 0.7 + float(i) * 0.8);
        float s = size * (1.0 - float(i) * 0.2) * pulse;
        d = min(d, abs(sdTri(p - vec2(0, -float(i) * size * 0.06), s, 0.0)) - thick);
    }
    for (int i = 0; i < 5; i++) {
        float pulse = 1.0 + 0.04 * sin(t * 0.6 + float(i) * 0.6 + PI);
        float s = size * (0.95 - float(i) * 0.18) * pulse;
        d = min(d, abs(sdTri(p + vec2(0, -float(i) * size * 0.055), s, PI)) - thick);
    }
    d = min(d, abs(sdCircle(p, size * 0.58)) - thick);
    return d;
}

// ── Vesica Piscis (breathing) ──────────────────────────────
float vesicaPiscis(vec2 p, float r, float thick, float t) {
    float sep = 0.5 + 0.15 * sin(t * 0.4);
    float d1 = sdCircle(p - vec2(-r * sep, 0.0), r);
    float d2 = sdCircle(p - vec2( r * sep, 0.0), r);
    return min(min(abs(d1), abs(d2)) - thick, abs(max(d1, d2)) - thick * 0.5);
}

// ── Mandala kaleidoscope (polar mirror symmetry) ───────────
float mandala(vec2 p, float t) {
    float r = length(p);
    float a = atan(p.y, p.x);
    // 12-fold mirror symmetry
    float sectors = 12.0;
    a = abs(mod(a, TAU / sectors) - PI / sectors);
    vec2 mp = r * vec2(cos(a), sin(a));

    float d = 1e9;
    // Nested petal arcs
    for (int i = 1; i <= 5; i++) {
        float ri = float(i) * 0.09;
        float wave = 0.01 * sin(t * 0.8 + float(i) * 1.3);
        d = min(d, abs(sdCircle(mp - vec2(ri + wave, 0.0), 0.06 + float(i) * 0.008)));
    }
    // Dot accents on rings
    for (int i = 1; i <= 4; i++) {
        float ri = float(i) * 0.11;
        float dotR = 0.008 + 0.004 * sin(t * 1.5 + float(i));
        d = min(d, sdCircle(mp - vec2(ri, 0.0), dotR));
    }
    return d;
}

// ── Aurora ribbons ─────────────────────────────────────────
float aurora(vec2 p, float t) {
    float v = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float freq = 2.5 + fi * 0.8;
        float speed = 0.2 + fi * 0.05;
        float amp = 0.04 / (1.0 + fi * 0.5);
        float yOff = (fi - 2.0) * 0.08;
        float wave = amp * sin(p.x * freq + t * speed + fi * 1.5)
                   + amp * 0.5 * sin(p.x * freq * 2.3 + t * speed * 1.7 + fi);
        float ribbon = exp(-pow((p.y - yOff - wave) * 15.0, 2.0));
        // Shimmer
        ribbon *= 0.7 + 0.3 * sin(p.x * 20.0 + t * 3.0 + fi * 2.0);
        v += ribbon;
    }
    return v;
}

// ── God rays (volumetric light beams from center) ──────────
float godRays(vec2 p, float t) {
    float a = atan(p.y, p.x);
    float r = length(p);
    float rays = 0.0;
    // 7 beams (sacred number) slowly rotating
    for (int i = 0; i < 7; i++) {
        float beamAngle = float(i) * TAU / 7.0 + t * 0.07;
        float diff = abs(mod(a - beamAngle + PI, TAU) - PI);
        float beam = exp(-diff * 12.0);
        // Fade with distance and pulse
        float pulse = 0.6 + 0.4 * sin(t * 0.5 + float(i) * 0.9);
        beam *= exp(-r * 1.5) * pulse;
        // Animated dust in beam
        float dust = noise(vec2(a * 5.0 + float(i), r * 8.0 - t * 0.5));
        beam *= 0.7 + 0.3 * dust;
        rays += beam;
    }
    return rays;
}

// ── Sparkle field ──────────────────────────────────────────
float sparkles(vec2 uv, float t) {
    float s = 0.0;
    for (int i = 0; i < 40; i++) {
        float fi = float(i);
        float angle = fi * PHI * TAU + t * (0.08 + fi * 0.003);
        float radius = 0.08 + 0.4 * hash11(fi * 0.73);
        vec2 pos = radius * vec2(cos(angle + fi), sin(angle * 0.7 + fi * 1.3));
        float twinkle = pow(0.5 + 0.5 * sin(t * 4.0 + fi * 3.7), 4.0);
        s += twinkle * exp(-length(uv - pos) * 300.0);
    }
    return s;
}

// ── Energy ripples ─────────────────────────────────────────
float energyRipple(vec2 p, float t) {
    float r = length(p);
    float v = 0.0;
    for (int i = 0; i < 4; i++) {
        float phase = float(i) * 1.8;
        float speed = 2.0 + float(i) * 0.3;
        float envelope = exp(-r * 2.5) * exp(-pow(mod(t * 0.35 + phase * 0.25, 3.5) - 1.5, 2.0) * 1.5);
        v += sin(r * 30.0 - t * speed + phase) * envelope;
    }
    return v;
}

// ════════════════════════════════════════════════════════════
void main()
{
    vec2 res = uTDOutputInfo.res.zw;
    vec2 uv = vUV.st - 0.5;
    uv.x *= res.x / res.y;
    float t = uTime;

    // ── Domain warp the entire scene subtly ──────────────────
    vec2 warp = domainWarp(uv * 2.5, t);
    vec2 uvW = uv + warp * 0.06; // subtle organic flow

    // Scene phasing (60s full cycle)
    float cycle = t * 0.105;
    float ph0 = smoothstep(0.0, 0.35, 0.5 + 0.5 * sin(cycle));
    float ph1 = smoothstep(0.0, 0.35, 0.5 + 0.5 * sin(cycle - 1.2));
    float ph2 = smoothstep(0.0, 0.35, 0.5 + 0.5 * sin(cycle - 2.4));
    float ph3 = smoothstep(0.0, 0.35, 0.5 + 0.5 * sin(cycle - 3.6));
    float ph4 = smoothstep(0.0, 0.35, 0.5 + 0.5 * sin(cycle - 4.8));

    float rotA = t * 0.04 + 0.03 * sin(t * 0.11);
    vec2 uvR = rot(rotA) * uvW;
    float zoom = 1.0 + 0.06 * sin(t * 0.17);
    vec2 uvZ = uvW * zoom;
    vec2 uvRZ = uvR * zoom;

    // ── 1. Deep nebula background ────────────────────────────
    float n1 = fbm(uv * 2.5 + vec2(t * 0.04, t * 0.03));
    float n2 = fbm(uv * 3.0 + vec2(-t * 0.03, t * 0.05) + 5.0);
    vec3 bg = mix(pal[8], pal[0], n1 * 0.8);
    bg = mix(bg, pal[7], n2 * 0.4);
    bg = mix(bg, pal[9], smoothstep(0.4, 0.7, length(uv)) * 0.5);

    // ── 2. God rays ──────────────────────────────────────────
    float rays = godRays(uvR, t);
    vec3 rayCol = mix(pal[1], pal[5], 0.5 + 0.5 * sin(t * 0.2));
    bg += rayCol * rays * 0.35;

    // ── 3. Aurora ribbons ────────────────────────────────────
    vec2 auroraUV = rot(t * 0.02) * uv;
    float aur = aurora(auroraUV * 2.0, t);
    vec3 aurCol = mix(pal[2], pal[5], 0.5 + 0.5 * sin(auroraUV.x * 3.0 + t * 0.4));
    aurCol = mix(aurCol, pal[4], 0.3);

    // ── 4. Quasicrystal interference ─────────────────────────
    float pent = 1e9;
    vec2 pentP = uvRZ * 3.0;
    for (int i = 0; i < 5; i++) {
        float a = float(i) * TAU / 5.0 + t * 0.1;
        pent = min(pent, 0.5 + 0.5 * cos(dot(pentP, vec2(cos(a), sin(a))) * TAU + t * 0.3));
    }
    vec3 pentCol = getColor(pent * 0.5 + t * 0.02);

    // ── 5. Flower of Life ────────────────────────────────────
    float fol = flowerOfLife(uvRZ * 2.5, 0.35, 0.005, t);
    float folG = exp(-abs(fol) * 50.0) * ph0;
    vec3 folC = accentColor(length(uvR) * 2.0 + atan(uvR.y, uvR.x) * 0.3, t);

    // ── 6. Golden Spiral ─────────────────────────────────────
    vec2 spUV = rot(-t * 0.08) * uvZ;
    float sp = goldenSpiral(spUV, t * 0.2);
    float spG = exp(-sp * 70.0) * 0.8 * ph1;
    vec3 spC = mix(pal[4], pal[6], 0.5 + 0.5 * cos(t * 0.4 + length(uv) * 4.0));

    // ── 7. Sri Yantra ────────────────────────────────────────
    vec2 sriUV = rot(t * 0.03) * uvZ;
    float sri = sriYantra(sriUV, 0.7, 0.004, t);
    float sriG = exp(-abs(sri) * 55.0) * 0.65 * ph2;
    vec3 sriC = mix(pal[1], pal[3], 0.5 + 0.5 * sin(t * 0.25 + length(uv) * 5.0));

    // ── 8. Metatron's Cube ───────────────────────────────────
    vec2 metUV = rot(-t * 0.04) * uvZ;
    float met = metatronsCube(metUV, 0.25, 0.003, t);
    float metG = exp(-abs(met) * 50.0) * 0.55 * ph3;
    vec3 metC = mix(pal[5], pal[6], 0.5 + 0.5 * sin(t * 0.2 + atan(uv.y, uv.x) * 2.0));

    // ── 9. Vesica Piscis ─────────────────────────────────────
    vec2 vpUV = rot(t * 0.06 + 0.78) * uvZ;
    float vp = vesicaPiscis(vpUV, 0.4, 0.004, t);
    float vpG = exp(-abs(vp) * 55.0) * 0.45 * ph4;
    vec3 vpC = mix(pal[3], pal[5], 0.5 + 0.5 * sin(t * 0.35 + length(uv) * 6.0));

    // ── 10. Mandala kaleidoscope ─────────────────────────────
    vec2 manUV = rot(t * 0.025) * uvW;
    float man = mandala(manUV, t);
    float manG = exp(-abs(man) * 70.0) * 0.5;
    vec3 manC = accentColor(atan(manUV.y, manUV.x) * 0.5 + length(manUV) * 3.0, t);

    // ── 11. Energy ripples ───────────────────────────────────
    float rip = energyRipple(uv, t);

    // ── 12. Sparkles ─────────────────────────────────────────
    float spark = sparkles(uv, t);

    // ════ COMPOSITE ══════════════════════════════════════════
    vec3 col = bg;
    col += aurCol * aur * 0.3;
    col = mix(col, pentCol, smoothstep(0.4, 0.0, pent) * 0.15);
    col += folC * folG * 0.85;
    col += spC * spG;
    col += sriC * sriG;
    col += metC * metG;
    col += vpC * vpG;
    col += manC * manG * 0.7;
    col += mix(pal[2], pal[5], 0.5 + 0.5 * rip) * abs(rip) * 0.12;
    col += mix(pal[4], vec3(1.0), 0.5) * spark * 0.9;

    // Edge resonance across all geometry
    float edgeD = min(min(abs(fol), abs(sri)), min(abs(met), min(abs(vp), abs(man))));
    float edgeP = exp(-edgeD * 90.0) * 0.12 * (0.5 + 0.5 * sin(t * 1.8));
    col += pal[4] * edgeP;

    // ── Chromatic aberration bloom ───────────────────────────
    // Shift geometry glow per channel for prismatic edges
    float chromStr = 0.003 * (0.5 + 0.5 * sin(t * 0.3));
    vec2 uvCr = uv + normalize(uv + 0.001) * chromStr;
    vec2 uvCb = uv - normalize(uv + 0.001) * chromStr;
    float folCr = flowerOfLife(rot(rotA) * uvCr * zoom * 2.5, 0.35, 0.005, t);
    float folCb = flowerOfLife(rot(rotA) * uvCb * zoom * 2.5, 0.35, 0.005, t);
    col.r += exp(-abs(folCr) * 50.0) * ph0 * 0.08;
    col.b += exp(-abs(folCb) * 50.0) * ph0 * 0.08;

    // ── Animated vignette ────────────────────────────────────
    float vigS = 1.0 + 0.15 * sin(t * 0.15);
    col *= clamp(1.0 - dot(uv, uv) * vigS, 0.0, 1.0);

    // ── Film grain ───────────────────────────────────────────
    col += (hash21(uv * 600.0 + fract(t * 7.0)) - 0.5) * 0.02;

    // ── Tone mapping & color grade ───────────────────────────
    col = col / (1.0 + col);                   // Reinhard
    col = pow(col, vec3(0.88, 0.90, 0.92));    // Slight warm-cool split
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.15); // Contrast S-curve

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
