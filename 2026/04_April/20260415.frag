
uniform float iTime;
layout(location = 0) out vec4 fragColor;

#define TAU  6.28318530718
#define PI   3.14159265359

// ─── Palette (black ink on white) ────────────────────────────
const vec3 cWhite  = vec3(1.000, 1.000, 1.000);
const vec3 cBlack  = vec3(0.000, 0.000, 0.000);
const vec3 cGold   = cBlack;
const vec3 cRose   = cBlack;
const vec3 cIndigo = cBlack;
const vec3 cTeal   = cBlack;
const vec3 cAmber  = cBlack;
const vec3 cViolet = cBlack;

// ─── Cycle: 5 patterns, 8s each ───────────────────────────────
#define PERIOD     40.0
#define PER_SHAPE   6.0

float cycleT()    { return mod(iTime, PERIOD); }
int   cycleIdx()  { return int(cycleT() / PER_SHAPE) % 5; }
float cycleBlend(){
    float seg = cycleT() / PER_SHAPE;
    float raw = fract(seg);
    float b   = smoothstep(0.72, 1.0, raw);
    return b*b*b*(b*(b*6.0-15.0)+10.0);
}

// ─── Color per pattern ────────────────────────────────────────
vec3 patternColor(int idx) {
    if (idx == 0) return cGold;    // Seed of Life
    if (idx == 1) return cTeal;    // Flower of Life
    if (idx == 2) return cIndigo;  // Metatron's Cube
    if (idx == 3) return cRose;    // Sri Yantra
    return cViolet;                // Golden spiral rings
}

vec3 accentColor(int idx) {
    if (idx == 0) return cAmber;
    if (idx == 1) return cGold;
    if (idx == 2) return cViolet;
    if (idx == 3) return cGold;
    return cRose;
}

// ─── SDF Primitives ───────────────────────────────────────────
float sdCircle(vec2 p, vec2 c, float r) {
    return length(p - c) - r;
}

float sdCircleStroke(vec2 p, vec2 c, float r, float w) {
    return abs(sdCircle(p, c, r)) - w;
}

// Line segment SDF
float sdSeg(vec2 p, vec2 a, vec2 b, float w) {
    vec2 ba = b - a, pa = p - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h) - w;
}

// Angular reveal mask — 0 outside reveal arc, 1 inside
float revealMask(vec2 p, float startAngle, float revealArc) {
    float a = mod(atan(p.y, p.x) - startAngle + TAU*2.0, TAU);
    return step(a, revealArc);
}

// Soft stroke renderer — returns [0,1] ink value
float stroke(float sdf, float aa) {
    return 1.0 - smoothstep(-aa, aa, sdf);
}

// ─── Pattern 0: Seed of Life (7 circles) ─────────────────────
float seedOfLifeSDF(vec2 p, float r) {
    float w  = r * 0.028;
    float d  = sdCircleStroke(p, vec2(0.0), r, w);
    d = min(d, sdCircle(p, vec2(0.0), r*0.04) );  // center dot fill
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0;
        d = min(d, sdCircleStroke(p, vec2(cos(a),sin(a))*r, r, w));
    }
    return d;
}

// ─── Pattern 1: Flower of Life (19 circles) ───────────────────
float flowerOfLifeSDF(vec2 p, float r) {
    float w = r * 0.022;
    float d = sdCircleStroke(p, vec2(0.0), r, w);
    // Ring 1: 6 circles
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0;
        vec2 c  = vec2(cos(a), sin(a)) * r;
        d = min(d, sdCircleStroke(p, c, r, w));
    }
    // Ring 2: 12 circles
    for (int i = 0; i < 6; i++) {
        float a  = float(i) * TAU / 6.0;
        float a2 = a + PI / 6.0;
        vec2  c1 = vec2(cos(a),  sin(a))  * r * 2.0;
        vec2  c2 = vec2(cos(a2), sin(a2)) * r * sqrt(3.0);
        d = min(d, sdCircleStroke(p, c1, r, w));
        d = min(d, sdCircleStroke(p, c2, r, w));
    }
    return d;
}

// ─── Pattern 2: Metatron's Cube ───────────────────────────────
float metatronSDF(vec2 p, float r) {
    float wc = r * 0.020;  // circle width
    float wl = r * 0.010;  // line width
    float d  = sdCircleStroke(p, vec2(0.0), r*0.01, wc*0.5); // center

    // 13 circles: center + 6 inner + 6 outer
    vec2 centers[13];
    centers[0]  = vec2(0.0);
    for (int i = 0; i < 6; i++) {
        float a = float(i) * TAU / 6.0;
        centers[i+1]  = vec2(cos(a), sin(a)) * r;
        centers[i+7]  = vec2(cos(a), sin(a)) * r * 2.0;
    }
    for (int i = 0; i < 13; i++)
        d = min(d, sdCircleStroke(p, centers[i], r, wc));

    // Connecting lines — all 13 nodes to all others (78 lines total, draw subset)
    for (int i = 0; i < 13; i++)
        for (int j = i+1; j < 13; j++)
            d = min(d, sdSeg(p, centers[i], centers[j], wl));

    return d;
}

// ─── Pattern 3: Sri Yantra (9 nested triangles, interlocking) ─
float sriYantraSDF(vec2 p, float r) {
    float w = r * 0.018;
    float d = 1e4;
    for (int tier = 0; tier < 9; tier++) {
        float scale = r * (1.0 - float(tier) * 0.085);
        float flip  = (tier % 2 == 0) ? 1.0 : -1.0;
        for (int side = 0; side < 3; side++) {
            float a0 = float(side)   * TAU/3.0 + flip*PI*0.5;
            float a1 = float(side+1) * TAU/3.0 + flip*PI*0.5;
            vec2  v0 = vec2(cos(a0), sin(a0)) * scale;
            vec2  v1 = vec2(cos(a1), sin(a1)) * scale;
            // Arc bow outward
            vec2  edge  = v1 - v0;
            vec2  perp  = normalize(vec2(-edge.y, edge.x));
            float bow   = flip * scale * 0.10;
            for (int k = 0; k < 8; k++) {
                float f0 = float(k)   / 8.0;
                float f1 = float(k+1) / 8.0;
                vec2  p0 = mix(v0, v1, f0) + perp * bow * sin(f0 * PI);
                vec2  p1 = mix(v0, v1, f1) + perp * bow * sin(f1 * PI);
                d = min(d, sdSeg(p, p0, p1, w));
            }
        }
    }
    // Outer enclosing circle
    d = min(d, sdCircleStroke(p, vec2(0.0), r, w));
    return d;
}

// ─── Pattern 4: Golden Spiral Rings ───────────────────────────
float goldenSpiralSDF(vec2 p, float r) {
    float w     = r * 0.022;
    float phi   = 1.61803398875;
    float d     = 1e4;
    float ri    = r * 0.06;
    for (int i = 0; i < 9; i++) {
        d  = min(d, sdCircleStroke(p, vec2(0.0), ri, w));
        ri *= phi * 0.72;
    }
    // Phi-ratio dividing lines
    for (int i = 0; i < 8; i++) {
        float a  = float(i) * PI / 4.0 + TAU * 0.05;
        vec2  v0 = vec2(0.0);
        vec2  v1 = vec2(cos(a), sin(a)) * r * 1.1;
        d = min(d, sdSeg(p, v0, v1, w * 0.5));
    }
    return d;
}

// ─── Assemble pattern with blend & reveal ─────────────────────
float patternSDF(vec2 p, int idx, float r) {
    if (idx == 0) return seedOfLifeSDF(p, r);
    if (idx == 1) return flowerOfLifeSDF(p, r);
    if (idx == 2) return metatronSDF(p, r);
    if (idx == 3) return sriYantraSDF(p, r);
    return goldenSpiralSDF(p, r);
}

// ─── Main ─────────────────────────────────────────────────────
void main() {
    vec2 uv  = vUV.st;
    vec2 st  = uv * 2.0 - 1.0;
    st.x    *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t   = iTime;
    float r   = 0.70;  // base radius

    // Slow global breath
    float breath = 1.0 + 0.025 * sin(t * 0.5);
    r *= breath;

    // Slow rotation of entire canvas
    float rotAngle = t * 0.04;
    float rc = cos(rotAngle), rs = sin(rotAngle);
    vec2  pr = vec2(rc*st.x - rs*st.y, rs*st.x + rc*st.y);

    int   idx0 = cycleIdx();
    int   idx1 = (idx0 + 1) % 5;
    float blend= cycleBlend();

    vec3  col0 = patternColor(idx0);
    vec3  col1 = patternColor(idx1);
    vec3  acc0 = accentColor(idx0);
    vec3  acc1 = accentColor(idx1);

    // Per-pattern local rotation (each pattern has its own slow spin)
    float spinSpeed[5];
    spinSpeed[0] = 0.05;
    spinSpeed[1] = 0.03;
    spinSpeed[2] = 0.02;
    spinSpeed[3] = 0.06;
    spinSpeed[4] = 0.08;

    float ra0 = t * spinSpeed[idx0];
    float ra1 = t * spinSpeed[idx1];
    float c0  = cos(ra0), s0 = sin(ra0);
    float c1  = cos(ra1), s1 = sin(ra1);
    vec2  p0  = vec2(c0*pr.x - s0*pr.y, s0*pr.x + c0*pr.y);
    vec2  p1  = vec2(c1*pr.x - s1*pr.y, s1*pr.x + c1*pr.y);

    float sdf0 = patternSDF(p0, idx0, r);
    float sdf1 = patternSDF(p1, idx1, r);

    float aa = 0.004;

    // Ink layer 0
    float ink0 = stroke(sdf0, aa);
    // Ink layer 1
    float ink1 = stroke(sdf1, aa);

    // Radial reveal wipe on the incoming pattern
    float revealProgress = blend;
    float revealArc = revealProgress * TAU;
    float mask1 = revealMask(p1, -PI * 0.5, revealArc);
    ink1 *= mask1;

    // Blend the two inks
    float inkFinal = max(ink0 * (1.0 - blend * 0.85), ink1);

    // Color the ink: primary + accent glow based on distance from center
    float dist    = length(pr);
    float radFade = smoothstep(r * 1.15, r * 0.1, dist);
    vec3  inkCol0 = mix(col0, acc0, radFade * 0.55);
    vec3  inkCol1 = mix(col1, acc1, radFade * 0.55);
    vec3  inkCol  = mix(inkCol0, inkCol1, blend);

    // White background — faint concentric ghost rings (light grey)
    vec3 bg = cWhite;
    for (int i = 1; i <= 6; i++) {
        float gr = r * float(i) * 0.22;
        float gd = abs(length(pr) - gr) - r * 0.003;
        bg -= vec3(0.88) * 0.10 * stroke(gd, aa * 1.5);
    }

    // Compose ink onto background
    vec3 col = mix(bg, inkCol, inkFinal);

    // Soft radial vignette — edges stay paper-white
    float vig = smoothstep(1.10, 0.55, length(st));
    col = mix(cWhite, col, vig);

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
