out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

#define PI 3.14159265359
#define TAU 6.28318530718
#define PHI 1.61803398875

// ============ UTILITIES ============

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
        mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(cos(0.37), sin(0.37), -sin(0.37), cos(0.37));
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0 + 100.0;
        a *= 0.5;
    }
    return v;
}

// Smooth ring with glow (reduced glow for clarity)
float ring(vec2 p, float r, float w, float glow) {
    float d = abs(length(p) - r);
    float core = smoothstep(w, 0.0, d);
    float glowEffect = exp(-d * glow) * 0.2;
    return core + glowEffect;
}

// Line with glow (reduced glow for clarity)
float line(vec2 p, vec2 a, vec2 b, float w, float glow) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);
    float core = smoothstep(w, 0.0, d);
    float glowEffect = exp(-d * glow) * 0.12;
    return core + glowEffect;
}

// Soft dot/star (reduced intensity)
float star(vec2 p, float r) {
    float d = length(p);
    return exp(-d * r) * 0.6;
}

// ============ SACRED GEOMETRY ============

// Complete Flower of Life (61 circles)
float flowerOfLifeFull(vec2 p, float r, float t) {
    float d = 0.0;
    float w = 0.004;
    float g = 40.0;

    // Layer 0: Center
    d += ring(p, r, w, g);

    // Layer 1: 6 circles
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.05;
        d += ring(p - vec2(cos(a), sin(a)) * r, r, w, g);
    }

    // Layer 2: 12 circles
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.05;
        d += ring(p - vec2(cos(a), sin(a)) * r * 2.0, r, w, g);
    }
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + PI/6.0 + t * 0.05;
        d += ring(p - vec2(cos(a), sin(a)) * r * 1.732, r, w, g);
    }

    // Layer 3: 18 circles
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.05;
        d += ring(p - vec2(cos(a), sin(a)) * r * 3.0, r, w, g);
    }
    for (int i = 0; i < 12; i++) {
        float a = float(i) * TAU / 12.0 + PI/12.0 + t * 0.05;
        float dist = (mod(float(i), 2.0) == 0.0) ? 2.646 : 2.646;
        d += ring(p - vec2(cos(a), sin(a)) * r * dist, r, w, g);
    }

    // Outer boundary circles
    d += ring(p, r * 3.0, w * 0.5, g * 0.5) * 0.5;
    d += ring(p, r * 3.5, w * 0.3, g * 0.3) * 0.3;

    return clamp(d, 0.0, 1.0);
}

// Metatron's Cube with all platonic solid projections
float metatronComplete(vec2 p, float r, float t) {
    float d = 0.0;
    float w = 0.003;
    float g = 60.0;

    // 13 spheres of fruit of life
    vec2 pts[13];
    pts[0] = vec2(0.0);

    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + t * 0.08;
        pts[i + 1] = vec2(cos(a), sin(a)) * r * 0.33;
    }
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0 + PI/6.0 + t * 0.08;
        pts[i + 7] = vec2(cos(a), sin(a)) * r * 0.58;
    }

    // Draw circles at each point (reduced center glow)
    for (int i = 0; i < 13; i++) {
        d += ring(p - pts[i], r * 0.12, w, g) * 0.7;
        d += star(p - pts[i], 120.0) * 0.1; // subtle center glow
    }

    // Connect ALL points (78 lines) - this reveals platonic solids
    for (int i = 0; i < 13; i++) {
        for (int j = i + 1; j < 13; j++) {
            float fade = sin(t * 0.3 + float(i + j) * 0.2) * 0.3 + 0.7;
            d += line(p, pts[i], pts[j], w * 0.4, g * 0.8) * 0.25 * fade;
        }
    }

    return clamp(d, 0.0, 1.0);
}

// Sri Yantra - 9 interlocking triangles
float sriYantraComplete(vec2 p, float r, float t) {
    float d = 0.0;
    float w = 0.003;
    float g = 50.0;

    // Bindu (center point) - subtle
    d += star(p, 150.0) * 0.2;

    // 4 upward triangles (Shiva - masculine)
    float sizes[4] = float[4](0.95, 0.65, 0.42, 0.2);
    for (int i = 0; i < 4; i++) {
        float s = r * sizes[i];
        float rot = sin(t * 0.1) * 0.02;
        mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));

        vec2 p1 = m * vec2(0.0, s);
        vec2 p2 = m * vec2(-s * 0.866, -s * 0.5);
        vec2 p3 = m * vec2(s * 0.866, -s * 0.5);

        d += line(p, p1, p2, w, g);
        d += line(p, p2, p3, w, g);
        d += line(p, p3, p1, w, g);
    }

    // 5 downward triangles (Shakti - feminine)
    float sizesDown[5] = float[5](0.85, 0.55, 0.35, 0.25, 0.1);
    for (int i = 0; i < 5; i++) {
        float s = r * sizesDown[i];
        float rot = -sin(t * 0.1) * 0.02;
        mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));

        vec2 p1 = m * vec2(0.0, -s * 0.9);
        vec2 p2 = m * vec2(-s * 0.866, s * 0.5);
        vec2 p3 = m * vec2(s * 0.866, s * 0.5);

        d += line(p, p1, p2, w, g);
        d += line(p, p2, p3, w, g);
        d += line(p, p3, p1, w, g);
    }

    // Lotus petals (16 outer, 8 inner)
    for (int i = 0; i < 16; i++) {
        float a = float(i) * TAU / 16.0 + t * 0.02;
        float a2 = float(i + 1) * TAU / 16.0 + t * 0.02;
        vec2 outer1 = vec2(cos(a), sin(a)) * r * 1.15;
        vec2 outer2 = vec2(cos(a2), sin(a2)) * r * 1.15;
        vec2 inner = vec2(cos((a + a2) * 0.5), sin((a + a2) * 0.5)) * r * 1.0;
        d += line(p, outer1, inner, w * 0.6, g * 0.6) * 0.4;
        d += line(p, outer2, inner, w * 0.6, g * 0.6) * 0.4;
    }

    for (int i = 0; i < 8; i++) {
        float a = float(i) * TAU / 8.0 + PI/8.0 + t * 0.02;
        float a2 = float(i + 1) * TAU / 8.0 + PI/8.0 + t * 0.02;
        vec2 outer1 = vec2(cos(a), sin(a)) * r * 1.0;
        vec2 outer2 = vec2(cos(a2), sin(a2)) * r * 1.0;
        vec2 inner = vec2(cos((a + a2) * 0.5), sin((a + a2) * 0.5)) * r * 0.92;
        d += line(p, outer1, inner, w * 0.5, g * 0.5) * 0.3;
        d += line(p, outer2, inner, w * 0.5, g * 0.5) * 0.3;
    }

    // Enclosing circles
    d += ring(p, r * 1.2, w, g * 0.5) * 0.5;
    d += ring(p, r * 1.25, w * 0.5, g * 0.3) * 0.3;

    return clamp(d, 0.0, 1.0);
}

// Golden Ratio Spiral with Fibonacci
float goldenSpiralFib(vec2 p, float t) {
    float d = 0.0;

    float angle = atan(p.y, p.x);
    float radius = length(p);

    // Multiple golden spirals
    for (int j = 0; j < 4; j++) {
        float offset = float(j) * PI * 0.5;
        for (float i = -20.0; i < 20.0; i += 0.1) {
            float a = i + t * 0.2 + offset;
            float r = 0.01 * pow(PHI, a / PI);
            if (r > 0.01 && r < 1.0) {
                vec2 sp = vec2(cos(a), sin(a)) * r;
                d += exp(-length(p - sp) * 150.0) * 0.15;
            }
        }
    }

    // Fibonacci rectangles overlay
    float rectSize = 0.02;
    for (int i = 0; i < 8; i++) {
        rectSize *= PHI;
    }

    return clamp(d, 0.0, 1.0);
}

// Torus Yantra / Tube Torus projection (subtle)
float torusYantra(vec2 p, float t) {
    float d = 0.0;

    int num = 36;
    for (int i = 0; i < num; i++) {
        float a = float(i) * TAU / float(num);
        float r = 0.35 + sin(a * 6.0 + t) * 0.1;
        vec2 center = vec2(cos(a), sin(a)) * 0.25;
        d += ring(p - center, r, 0.002, 60.0) * 0.15;
    }

    return clamp(d, 0.0, 1.0);
}

// Cosmic particles / stardust
float stardust(vec2 p, float t) {
    float d = 0.0;

    for (int i = 0; i < 50; i++) {
        float fi = float(i);
        vec2 pos = vec2(
            sin(fi * 127.1 + t * 0.1) * 0.8,
            cos(fi * 311.7 + t * 0.12) * 0.8
        ) * hash(vec2(fi, fi * 0.7));

        float brightness = sin(t * 2.0 + fi) * 0.5 + 0.5;
        d += star(p - pos, 120.0) * brightness * 0.15;
    }

    return d;
}

// Mandala rings
float mandalaRings(vec2 p, float t) {
    float d = 0.0;
    float a = atan(p.y, p.x);
    float r = length(p);

    // Petal patterns at different radii
    for (int i = 1; i < 6; i++) {
        float ri = float(i) * 0.12;
        float petals = float(i + 5) * 2.0;
        float wave = sin(a * petals + t * (0.5 - float(i) * 0.1)) * 0.5 + 0.5;
        float ringMask = exp(-abs(r - ri) * 30.0);
        d += wave * ringMask * 0.4;
    }

    return d;
}

void main()
{
    vec2 uv = vUV.st;
    vec2 c = uv - 0.5;
    float t = u_time;

    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = c;
    p.x *= aspect;

    // ============ LAYER COMPOSITION ============

    // Background: subtle cosmic dust
    float bg = fbm(uv * 5.0 + t * 0.02) * 0.06;
    bg += stardust(p, t) * 0.3;

    // Layer 1: Mandala rings (outermost)
    float mandala = mandalaRings(p, t);

    // Layer 2: Golden spiral (background geometry)
    float spiral = goldenSpiralFib(p, t);

    // Layer 3: Flower of Life
    float flower = flowerOfLifeFull(p * 2.8, 0.1, t);

    // Layer 4: Sri Yantra (overlaid)
    float yantra = sriYantraComplete(p * 1.5, 0.45, t);

    // Layer 5: Metatron's Cube (center focus)
    float metatron = metatronComplete(p * 1.2, 0.7, t);

    // Layer 6: Torus energy field
    float torus = torusYantra(p * 1.5, t * 0.5);

    // ============ BLENDING ============

    float pattern = bg;
    pattern += mandala * 0.3;
    pattern += spiral * 0.4;
    pattern = max(pattern, flower * 0.7);
    pattern = max(pattern, yantra * 0.85);
    pattern = max(pattern, metatron * 0.9);
    pattern += torus * 0.2;

    // ============ POST PROCESSING ============

    // Breathing pulse (subtle)
    float breath = sin(t * 0.4) * 0.05 + 0.95;
    pattern *= breath;

    // Gentle bloom (reduced)
    float bloom = pattern;
    bloom = pow(bloom, 0.7) * 0.15;
    pattern += bloom;

    // Contrast - preserve detail in bright areas
    pattern = smoothstep(0.08, 1.1, pattern);

    // Film grain (subtle)
    float grain = hash(uv * 1000.0 + t) * 0.012;
    pattern += grain;

    // Radial gradient vignette
    float vig = 1.0 - pow(length(c) * 1.2, 2.0);
    vig = smoothstep(-0.1, 1.0, vig);

    // Center glow - much softer, doesn't overpower geometry
    float centerGlow = exp(-length(p) * 5.0) * 0.05;
    pattern += centerGlow;

    // Prevent overexposure in center - soft clamp
    pattern = pattern / (pattern + 0.3) * 1.3;

    // Final composition
    float final = pattern * vig;
    final = clamp(final, 0.0, 1.0);

    // Output
    fragColor = vec4(vec3(final), 1.0);
}
