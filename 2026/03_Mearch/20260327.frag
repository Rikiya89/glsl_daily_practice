uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

#define PI  3.14159265
#define TAU 6.28318530
#define PHI 1.61803398
#define S3  0.86602540

// ── helpers ───────────────────────────────────────────────────────────────────

float line(float d, float w) {
    return smoothstep(w, 0.0, abs(d));
}

float glow(float r, float str) {
    return str / (r * r + 0.002);
}

// ── Flower of Life ────────────────────────────────────────────────────────────
//
// Triangular lattice: a1=(1,0), a2=(0.5, √3/2)
// Center c(n,m) = R*(n*a1 + m*a2)
// 19 circles: all lattice points with |c| <= 2R
//
// Animations:
//   1. Breathing    — radius pulses with ring-delay + angular phase
//   2. Ripple wave  — brightness/width wave travels outward
//   3. Vesica glow  — lens intersections pulse independently

float inside(vec2 uv, vec2 c, float R) {
    return smoothstep(R, R * 0.52, length(uv - c));
}

float flowerOfLife(vec2 uv, float t) {
    float R    = 0.30;
    float maxD = 2.05;

    vec2 a1 = vec2(1.0, 0.0);
    vec2 a2 = vec2(0.5, S3);

    float circles = 0.0;
    float vesica  = 0.0;

    for (int n = -2; n <= 2; n++) {
        for (int m = -2; m <= 2; m++) {
            vec2  c    = R * (float(n) * a1 + float(m) * a2);
            float cd   = length(c);
            float ring = cd / R;

            if (ring > maxD) continue;

            float a     = atan(c.y, c.x);
            float phase = ring * 0.85 + a * 0.28;

            float r      = R * (1.0 + 0.05 * sin(t * 1.05 - phase));
            float ripple = 0.5 + 0.5 * sin(t * 2.2 - ring * 3.2);
            float w      = 0.006 + 0.004 * ripple;
            float bright = 0.65 + 0.35 * ripple;

            float d = abs(length(uv - c) - r);
            circles += smoothstep(w, 0.0, d) * bright;
            vesica  += inside(uv, c, R);
        }
    }

    float v      = smoothstep(1.1, 2.8, vesica);
    float vPulse = 0.4 + 0.6 * sin(t * 1.7 + vesica * 0.6);
    circles += v * vPulse * 0.55;

    return circles;
}

// ── logarithmic spiral arm ────────────────────────────────────────────────────
float arm(vec2 uv, float offset, float tightness, float t) {
    float r     = length(uv);
    float a     = atan(uv.y, uv.x);
    float phase = mod(a - log(max(r, 0.001)) * tightness - offset * TAU + t, TAU) - PI;
    float w     = max(0.09 - 0.06 * r, 0.011);
    float core  = line(phase, w);
    float halo  = smoothstep(0.38, 0.0, abs(phase)) * 0.15;
    return (core + halo) * smoothstep(1.45, 0.10, r) * smoothstep(0.0, 0.12, r);
}

// ── 6-petal rose (mirrors FOL hexagonal symmetry) ────────────────────────────
float rose(vec2 uv, float k, float t) {
    float r     = length(uv);
    float a     = atan(uv.y, uv.x);
    float rRose = abs(cos(k * a + t * 0.10)) * 0.66;
    return line(r - rRose, 0.013) * smoothstep(0.95, 0.0, r);
}

// ── tone mapping ─────────────────────────────────────────────────────────────
// TODO: replace with your preferred curve (runs before edge1 + bloom1)
//   Reinhard    →  x / (1.0 + x)
//   Exponential →  1.0 - exp(-x * k)   tweak k = 1.0..3.0
//   Power lift  →  pow(x, 0.70)
//   S-curve     →  smoothstep(0.0, 1.4, x)
float toneMap(float x) {
    return 1.0 - exp(-x * 1.8);
}

// ─────────────────────────────────────────────────────────────────────────────

void main() {
    vec2 uv = vUV.st * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    float t  = uTime;
    float r0 = length(uv);

    float ang = t * 0.035;
    mat2  Rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2  ruv = Rot * uv;

    float lum = 0.0;

    lum += flowerOfLife(ruv, t) * 0.90;

    lum += arm(ruv, 0.0 / 3.0, 6.0, t * 0.40) * 0.28;
    lum += arm(ruv, 1.0 / 3.0, 6.0, t * 0.40) * 0.28;
    lum += arm(ruv, 2.0 / 3.0, 6.0, t * 0.40) * 0.28;

    lum += rose(ruv, 6.0, t) * 0.42;

    // Accent rings aligned to FOL geometry (R, 2R, 3R)
    lum += line(r0 - 0.30, 0.005) * 0.60;
    lum += line(r0 - 0.60, 0.005) * 0.45;
    lum += line(r0 - 0.90, 0.004) * 0.28;

    lum += glow(r0, 0.013);

    lum  = toneMap(lum);
    lum *= 1.0 - 0.55 * dot(uv, uv);

    fragColor = TDOutputSwizzle(vec4(vec3(lum), 1.0));
}
