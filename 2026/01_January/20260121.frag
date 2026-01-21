// TouchDesigner GLSL TOP - Celtic Sacred Geometry
// Black & white sacred geometry with Celtic knot patterns

uniform float u_time;
uniform vec2 u_resolution;

#define PI 3.14159265359
#define TAU 6.28318530718

// ============================================
// UTILITY FUNCTIONS
// ============================================

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// ============================================
// SDF PRIMITIVES
// ============================================

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdRing(vec2 p, float r, float w) {
    return abs(length(p) - r) - w;
}

float sdArc(vec2 p, float r, float w, float startAngle, float sweep) {
    float angle = atan(p.y, p.x);
    float midAngle = startAngle + sweep * 0.5;
    float halfSweep = sweep * 0.5;

    float angDist = abs(mod(angle - midAngle + PI, TAU) - PI);

    if (angDist < halfSweep) {
        return abs(length(p) - r) - w;
    } else {
        vec2 p1 = r * vec2(cos(startAngle), sin(startAngle));
        vec2 p2 = r * vec2(cos(startAngle + sweep), sin(startAngle + sweep));
        return min(length(p - p1), length(p - p2)) - w;
    }
}

float sdVesicaPiscis(vec2 p, float r, float d) {
    p = abs(p);
    float b = sqrt(r * r - d * d);
    return ((p.y - b) * d > p.x * b)
        ? length(p - vec2(0.0, b))
        : length(p - vec2(-d, 0.0)) - r;
}

// ============================================
// CELTIC KNOT COMPONENTS
// ============================================

float sdTriquetraLobe(vec2 p, float scale, float w) {
    p /= scale;
    float r = 0.5;
    vec2 center = vec2(0.0, r * 0.577);
    float d = sdRing(p - center, r, w / scale);
    return d * scale;
}

float sdTriquetra(vec2 p, float scale, float w) {
    float d = 1e10;
    for (int i = 0; i < 3; i++) {
        vec2 rp = p * rot(float(i) * TAU / 3.0);
        d = min(d, sdTriquetraLobe(rp, scale, w));
    }
    return d;
}

// ============================================
// FLOWER OF LIFE
// ============================================

float sdFlowerOfLife(vec2 p, float r, float w) {
    float d = 1e10;

    // Central circle
    d = min(d, sdRing(p, r, w));

    // First ring of 6
    for (int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0;
        vec2 center = r * vec2(cos(angle), sin(angle));
        d = min(d, sdRing(p - center, r, w));
    }

    // Second ring of 6 (rotated)
    for (int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + TAU / 12.0;
        vec2 center = r * 1.732 * vec2(cos(angle), sin(angle));
        d = min(d, sdRing(p - center, r, w));
    }

    // Outer ring of 12
    for (int i = 0; i < 12; i++) {
        float angle = float(i) * TAU / 12.0;
        vec2 center = r * 2.0 * vec2(cos(angle), sin(angle));
        d = min(d, sdRing(p - center, r, w));
    }

    return d;
}

// ============================================
// CELTIC KNOT WEAVE
// ============================================

struct Weave {
    float dist;
    float depth;
};

Weave celticKnot(vec2 p, float t) {
    Weave w;
    w.dist = 1e10;
    w.depth = 0.0;

    float scale = 0.8;
    float strokeW = 0.022;
    float animAngle = t * 0.1;

    // === CENTRAL TRIQUETRA ===
    vec2 p1 = p * rot(animAngle);
    float tri = sdTriquetra(p1, 0.35 * scale, strokeW);
    float triAngle = atan(p1.y, p1.x);
    float triDepth = sin(triAngle * 3.0 + t * 0.5) * 0.5 + 0.5;

    if (tri < w.dist) {
        w.dist = tri;
        w.depth = triDepth;
    }

    // === OUTER RINGS ===
    vec2 p2 = p * rot(-animAngle * 0.5);
    float ring1 = sdRing(p2, 0.55 * scale, strokeW);
    float ring1Depth = sin(atan(p2.y, p2.x) * 6.0 - t) * 0.5 + 0.5;

    if (ring1 < w.dist) {
        w.dist = ring1;
        w.depth = ring1Depth;
    }

    vec2 p3 = p * rot(animAngle * 0.7);
    float ring2 = sdRing(p3, 0.42 * scale, strokeW);
    float ring2Depth = sin(atan(p3.y, p3.x) * 4.0 + t * 0.8) * 0.5 + 0.5;

    if (ring2 < w.dist) {
        w.dist = ring2;
        w.depth = ring2Depth;
    }

    // === INTERLOCKING ARCS ===
    for (int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + animAngle;
        vec2 arcCenter = 0.48 * scale * vec2(cos(angle), sin(angle));

        vec2 ap = p - arcCenter;
        ap *= rot(-angle);

        float arc = sdArc(ap, 0.18 * scale, strokeW, PI * 0.3, PI * 1.4);
        float arcDepth = sin(float(i) * 1.5 + t) * 0.5 + 0.5;
        arcDepth = mod(float(i), 2.0) < 0.5 ? arcDepth : 1.0 - arcDepth;

        if (arc < w.dist) {
            w.dist = arc;
            w.depth = arcDepth;
        }
    }

    // === SMALL DECORATIVE TRIQUETRAS ===
    for (int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 - animAngle * 0.3;
        vec2 pos = 0.7 * scale * vec2(cos(angle), sin(angle));

        vec2 tp = (p - pos) * rot(angle + t * 0.2);
        float smallTri = sdTriquetra(tp, 0.1 * scale, strokeW * 0.7);
        float smallDepth = sin(float(i) + t * 0.6) * 0.5 + 0.5;

        if (smallTri < w.dist) {
            w.dist = smallTri;
            w.depth = smallDepth;
        }
    }

    return w;
}

// ============================================
// BACKGROUND SACRED GEOMETRY
// ============================================

float sacredBackground(vec2 p, float t) {
    float d = 1e10;

    // Flower of Life
    float fol = sdFlowerOfLife(p * 1.5, 0.2, 0.003);
    d = min(d, fol);

    // Seed of Life at corners
    vec2 corners[4];
    corners[0] = vec2(-0.6, -0.4);
    corners[1] = vec2(0.6, -0.4);
    corners[2] = vec2(-0.6, 0.4);
    corners[3] = vec2(0.6, 0.4);

    for (int i = 0; i < 4; i++) {
        vec2 cp = p - corners[i];
        cp *= rot(t * 0.05 * (mod(float(i), 2.0) * 2.0 - 1.0));

        float seed = sdRing(cp, 0.08, 0.002);
        for (int j = 0; j < 6; j++) {
            float angle = float(j) * TAU / 6.0;
            vec2 sc = 0.08 * vec2(cos(angle), sin(angle));
            seed = min(seed, sdRing(cp - sc, 0.08, 0.002));
        }
        d = min(d, seed);
    }

    // Vesica Piscis elements
    for (int i = 0; i < 4; i++) {
        float angle = float(i) * TAU / 4.0 + PI / 4.0 + t * 0.03;
        vec2 vp = 0.85 * vec2(cos(angle), sin(angle));

        vec2 vpp = p - vp;
        vpp *= rot(angle + PI / 2.0);

        float vesica = abs(sdVesicaPiscis(vpp, 0.12, 0.06)) - 0.003;
        d = min(d, vesica);
    }

    return d;
}

// ============================================
// SHADING
// ============================================

vec3 shadeKnot(Weave w, vec2 p, float t) {
    vec3 col = vec3(0.0);

    if (w.dist < 0.0) {
        float edge = smoothstep(0.0, -0.008, w.dist);
        float shade = 0.7 + 0.3 * w.depth;

        float highlight = smoothstep(-0.015, -0.005, w.dist);
        shade += highlight * 0.2;

        float edgeDark = smoothstep(-0.022, -0.008, w.dist);
        shade *= 0.8 + 0.2 * edgeDark;

        col = vec3(shade) * edge;

        float innerShadow = smoothstep(-0.018, -0.005, w.dist);
        col *= 0.85 + 0.15 * innerShadow;
    } else {
        float glow = exp(-w.dist * 80.0) * 0.3;
        col = vec3(glow);
    }

    return col;
}

float shadeBackground(float d, float t) {
    float col = 0.0;

    if (d < 0.0) {
        col = 0.15;
    } else {
        float glow = exp(-d * 150.0) * 0.1;
        col = glow;
    }

    return col;
}

// ============================================
// MAIN
// ============================================

out vec4 fragColor;

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float t = u_time;

    // Background
    float bgGrad = 1.0 - length(uv) * 0.3;
    vec3 col = vec3(0.02) * bgGrad;

    // Sacred geometry background
    float bgPattern = sacredBackground(uv, t);
    float bgShade = shadeBackground(bgPattern, t);
    col += vec3(bgShade) * 0.5;

    // Main Celtic knot
    Weave knot = celticKnot(uv, t);
    vec3 knotCol = shadeKnot(knot, uv, t);

    // Composite
    float knotMask = smoothstep(0.01, -0.01, knot.dist);
    col = mix(col, knotCol, knotMask + (1.0 - knotMask) * knotCol);

    // Pulse that highlights the knot strands as it radiates outward
    float pulseEffect = sin(length(uv) * 15.0 - t * 2.0) * smoothstep(0.02, -0.01, knot.dist) * 0.15;

    col += vec3(pulseEffect);

    // Central glow
    float centerGlow = exp(-length(uv) * 4.0) * 0.15;
    col += vec3(centerGlow);

    // Vignette
    float vignette = 1.0 - pow(length(uv) * 1.1, 2.0);
    vignette = clamp(vignette, 0.0, 1.0);
    col *= vignette;

    // Film grain
    float grain = fract(sin(dot(uv * t * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.02;

    // Contrast
    col = smoothstep(0.0, 1.0, col);

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
