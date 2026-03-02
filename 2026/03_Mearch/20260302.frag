// uVars = absTime  →  TD auto-declares this from Vectors tab (Type: float)
// DO NOT redeclare uniforms here — TD injects them automatically.

// ─── Superformula Particle Art ───────────────────────────────────────
#define PI  3.14159265359
#define TAU 6.28318530718

float superformula(float theta, float m, float n1, float n2, float n3) {
    float a = pow(abs(cos(m * theta / 4.0)), n2);
    float b = pow(abs(sin(m * theta / 4.0)), n3);
    float r = pow(a + b, -1.0 / n1);
    return r;
}

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;

    float N   = float(TDNumElements());
    float idx = float(id);
    float t   = uVars * 0.3;

    // ── 1D index → 2D surface parameters ─────────────────────────────
    float sqN = ceil(sqrt(N));
    float u   = (mod(idx, sqN) / sqN) * TAU;
    float v   = (floor(idx / sqN) / sqN) * PI - PI * 0.5;

    // ── Animated superformula parameters ─────────────────────────────
    float m1 = 3.0 + 4.0 * (0.5 + 0.5 * sin(t * 0.11));
    float m2 = 2.0 + 4.0 * (0.5 + 0.5 * cos(t * 0.07));
    float n1 = 0.5 + 2.5 * (0.5 + 0.5 * sin(t * 0.13));
    float n2 = 1.0 + 2.0 * (0.5 + 0.5 * cos(t * 0.17));
    float n3 = 1.0 + 2.0 * (0.5 + 0.5 * sin(t * 0.19));

    float r1 = superformula(u, m1, n1, n2, n3);
    float r2 = superformula(v, m2, n1, n2, n3);

    // ── Surface position ──────────────────────────────────────────────
    vec3 pos;
    pos.x = r1 * cos(u) * r2 * cos(v);
    pos.y = r1 * sin(u) * r2 * cos(v);
    pos.z =               r2 * sin(v);

    // ── TODO(human): Wave ripple displacement ────────────────────────
    // Multiply pos by a wave so ripples travel across the surface.
    // Example structure:
    //   float wave = 1.0 + [amplitude] * sin([freq]*u + [speed]*t)
    //                                  * cos([freq2]*v - [speed2]*t);
    //   pos *= wave;
    // Try amplitudes 0.05–0.25, frequencies 2–8, speeds 1.0–4.0
    // Two interference waves (add a second sin*cos term) looks best.
	float wave = 1.0 + 0.1 * sin(4.0*u + 2.0*t) * cos(3.0*v - 1.5*t);
	pos *= wave;

	float w1 = sin(5.0*u + 2.5*t) * cos(3.0*v - 1.8*t);
	float w2 = sin(3.0*u - 1.2*t) * cos(6.0*v + 2.0*t);
	pos *= 1.0 + 0.1 * (w1 + w2);


    // ── Twist: each horizontal slice rotates by a different amount ────
    float tw  = pos.y * 0.6 + t * 0.3;
    float ctw = cos(tw), stw = sin(tw);
    pos.xz    = vec2(ctw*pos.x - stw*pos.z, stw*pos.x + ctw*pos.z);

    // ── World tumble: your Y-axis rotation ───────────────────────────
    float a1 = t * 0.3;
    float ca1 = cos(a1), sa1 = sin(a1);
    pos.xz = vec2(ca1*pos.x - sa1*pos.z, sa1*pos.x + ca1*pos.z);

    // ── X-axis rotation completing the tumble ────────────────────────
    float a2  = t * 0.12;
    float ca2 = cos(a2), sa2 = sin(a2);
    pos.yz = vec2(ca2*pos.y - sa2*pos.z, sa2*pos.y + ca2*pos.z);

    P[id] = pos;

    // ── Color: hue follows shape state, peaks glow brighter ──────────
    float hue   = u / TAU + m1 * 0.04 + t * 0.02;
    float bright = clamp(r1 * r2 * 0.4, 0.05, 1.0);
    vec3  col   = 0.5 + 0.5 * cos(TAU * (hue + vec3(0.0, 0.333, 0.667)));
    col  = mix(col * 0.15, col, bright);
    col += 0.2 * vec3(0.4, 0.1, 1.0) * (1.0 - clamp(n1 * 0.5, 0.0, 1.0));

    Cd[id] = col;
}
