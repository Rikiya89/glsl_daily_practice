// uVars = absTime  →  TD auto-declares this from Vectors tab (Type: float)
// DO NOT redeclare uniforms here — TD injects them automatically.

// ─── Mathematical Particle Art ──────────────────────────────────────
// Each particle is assigned a unique (u, v) position on a parametric
// surface. The formula f(u, v, t) defines the entire visual character.
// ─────────────────────────────────────────────────────────────────────

#define PI  3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 palette(float t) {
    vec3 a = vec3(0.56, 0.52, 0.50);
    vec3 b = vec3(0.44, 0.35, 0.48);
    vec3 c = vec3(1.00, 1.00, 1.00);
    vec3 d = vec3(0.02, 0.22, 0.52);
    return a + b * cos(TAU * (c * t + d));
}

float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;

    float N   = float(TDNumElements());
    float idx = float(id);
    float t   = uVars * 0.26;          // float uniform, value = absTime

    // ── 1D index → 2D surface parameters ─────────────────────────────
    // Lay N particles out as a sqN×sqN grid, wrapping with mod/floor.
    // u and v each sweep [0, TAU), giving full surface coverage.
    float sqN = ceil(sqrt(N));
    float u   = (mod(idx, sqN) / sqN) * TAU;
    float v   = (floor(idx / sqN) / sqN) * TAU;

    // ── Define particle position ──────────────────────────────────────
    // Lotus-vortex torus with layered deformation.
    float pulse = 0.5 + 0.5 * sin(t * 1.1);
    float petal = sin(8.0 * u + t * 1.8) * sin(5.0 * v - t * 1.2);
    float R = mix(1.65, 2.45, pulse);
    float r = 0.52 + 0.22 * petal + 0.08 * sin((u + v) * 6.0 + t * 2.3);

    float du = u + 0.45 * sin(2.0 * v + t * 0.9) + 0.08 * sin(9.0 * u - t * 1.3);
    float dv = v + 0.35 * cos(3.0 * u - t * 0.6);

    vec3 pos;
    pos.x = (R + r * cos(dv)) * cos(du);
    pos.y = (R + r * cos(dv)) * sin(du);
    pos.z = r * sin(dv);

    float shell = sin(6.0 * u - 4.0 * v + t * 2.5);
    float bloom = cos(11.0 * u + 3.0 * v - t * 1.7);
    float radialBump = shell * 0.16 + bloom * 0.10;
    vec3 n = normalize(pos + vec3(1e-4));
    pos += n * radialBump;

    vec3 orbit = vec3(
        sin(3.0 * u + t),
        cos(2.0 * v - t * 1.2),
        sin(4.0 * u - 5.0 * v + t * 0.7)
    );
    pos += orbit * 0.14;

    pos.xy *= rot(t * 0.28);
    pos.xz *= rot(0.35 * sin(t * 0.5));
    pos *= 0.86 + 0.18 * (0.5 + 0.5 * sin(t * 0.9 + u + v));

    P[id] = pos;

    // ── Define particle color ─────────────────────────────────────────
    vec3 nn = normalize(pos + vec3(1e-4));
    float hue = fract(0.17 + 0.65 * (u / TAU) + 0.20 * sin(v * 3.0 - t * 0.8) + 0.10 * length(pos));
    vec3 base = palette(hue + t * 0.03);

    vec3 lightDir = normalize(vec3(0.25, 0.35, 1.0));
    float rim = pow(1.0 - abs(dot(nn, lightDir)), 2.8);

    float caustic = smoothstep(
        0.78, 1.0,
        0.5 + 0.5 * sin(u * 12.0 + v * 9.0 - t * 6.0)
    );

    float beat = 0.38 + 0.62 * (0.5 + 0.5 * sin(t * 1.4 + v * 2.0));
    float pulseRing = smoothstep(0.30, 0.95, 0.5 + 0.5 * sin(length(pos) * 3.2 - t * 3.0));
    float twinkle = step(0.992, hash31(floor(pos * 8.0) + vec3(floor(t * 12.0))));

    vec3 col = base * beat;
    col += vec3(1.0, 0.95, 0.85) * rim * 0.55;
    col += vec3(0.20, 0.55, 1.00) * caustic * 0.30;
    col += vec3(1.00, 0.75, 0.35) * pulseRing * 0.16;
    col += vec3(1.0) * twinkle * 0.25;

    col = col / (1.0 + col); // soft tonemap
    col = pow(col, vec3(0.95));
    col = clamp(col, 0.0, 1.0);

    Cd[id] = col;
}
