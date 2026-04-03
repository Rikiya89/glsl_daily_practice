// TouchDesigner injects uVars from the Vectors tab.
// Create Cd as a float3 attribute in the Create Attributes tab.

#define PI  3.14159265359
#define TAU 6.28318530718

const vec3 COL_0 = vec3(0.039216, 0.058824, 0.050980); // #0a0f0d
const vec3 COL_1 = vec3(0.050980, 0.129412, 0.215686); // #0d2137
const vec3 COL_2 = vec3(0.101961, 0.101961, 0.180392); // #1a1a2e
const vec3 COL_3 = vec3(0.050980, 0.231373, 0.180392); // #0d3b2e
const vec3 COL_4 = vec3(0.000000, 1.000000, 0.529412); // #00ff87
const vec3 COL_5 = vec3(0.000000, 0.831373, 1.000000); // #00d4ff
const vec3 COL_6 = vec3(0.482353, 0.184314, 1.000000); // #7b2fff
const vec3 COL_7 = vec3(1.000000, 0.176471, 0.478431); // #ff2d7a
const vec3 COL_8 = vec3(0.690196, 1.000000, 0.909804); // #b0ffe8
const vec3 COL_9 = vec3(0.878431, 0.968627, 1.000000); // #e0f7ff

mat2 rotate2D(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float superFormula(float angle, float m, float n1, float n2, float n3) {
    float c = pow(abs(cos(angle * m * 0.25)), n2);
    float s = pow(abs(sin(angle * m * 0.25)), n3);
    return pow(max(c + s, 1e-4), -1.0 / n1);
}

float gyroid(vec3 p) {
    return sin(p.x) * cos(p.y)
         + sin(p.y) * cos(p.z)
         + sin(p.z) * cos(p.x);
}

vec3 paletteRamp(float t) {
    float x = clamp(t, 0.0, 1.0) * 9.0;

    if (x < 1.0) return mix(COL_0, COL_1, x);
    if (x < 2.0) return mix(COL_1, COL_2, x - 1.0);
    if (x < 3.0) return mix(COL_2, COL_3, x - 2.0);
    if (x < 4.0) return mix(COL_3, COL_4, x - 3.0);
    if (x < 5.0) return mix(COL_4, COL_5, x - 4.0);
    if (x < 6.0) return mix(COL_5, COL_6, x - 5.0);
    if (x < 7.0) return mix(COL_6, COL_7, x - 6.0);
    if (x < 8.0) return mix(COL_7, COL_8, x - 7.0);
    return mix(COL_8, COL_9, x - 8.0);
}

vec3 neonField(float u, float v, float t) {
    float mA = 6.0 + 1.8 * sin(t * 0.31);
    float mB = 4.0 + 1.2 * cos(t * 0.23);

    // Morphing exponents — shape slowly transforms between organic forms
    float n1A = 0.42 + 0.18 * sin(t * 0.19);
    float n2A = 1.15 + 0.30 * cos(t * 0.13);

    float rA = superFormula(u + 0.16 * sin(t * 0.47), mA, n1A, n2A, n2A);
    float rB = superFormula(v + 0.12 * cos(t * 0.39), mB, 0.68, 1.00, 1.55);

    float radius = 0.55 + 0.33 * rA * rB;
    vec3 dir = vec3(cos(v) * cos(u), sin(v), cos(v) * sin(u));
    vec3 pos = dir * radius;

    float ribbon = sin(3.0 * u + t * 1.10) * cos(4.0 * v - t * 0.90);
    float bloom = sin(6.0 * u - 3.0 * v + t * 0.70);
    float shell  = gyroid(pos * 4.20 + vec3(0.0,       t * 0.25, t * 0.17));
    // Second finer gyroid — interference with shell creates moiré-like ridges
    float shell2 = gyroid(pos * 9.10 + vec3(t * 0.13, 0.0,       t * 0.21));

    pos += dir * (0.13 * shell + 0.05 * shell2 + 0.06 * ribbon);
    pos.xz = rotate2D(0.35 * shell  + t * 0.12) * pos.xz;
    pos.xy = rotate2D(0.18 * bloom)              * pos.xy;
    pos.yz = rotate2D(0.14 * shell2 + t * 0.07) * pos.yz; // third axis twist

    float filamentR = 0.14 + 0.05 * sin(5.0 * v + t * 1.70);
    vec3 filament = vec3(
        cos(3.0 * u + t * 0.55) * filamentR,
        0.22 * sin(2.0 * u - 3.0 * v + t * 0.80),
        sin(3.0 * u + t * 0.55) * filamentR
    );

    float filamentMix = 0.35 + 0.25 * sin(2.0 * v + t * 0.30);
    pos = mix(pos, pos + filament, filamentMix);

    // Two-frequency organic breathing pulse
    float pulse = 0.07 * sin(t * 0.53 + u * 1.5) + 0.04 * cos(t * 1.27 - v * 2.0);
    pos += dir * pulse;

    pos *= 1.45;
    return pos;
}

vec3 neonColor(vec3 pos, float u, float v, float t) {
    float band = 0.5 + 0.5 * sin(2.0 * u - 5.0 * v + t * 0.80);
    float pulse = 0.5 + 0.5 * sin(length(pos) * 4.0 - t * 1.40);
    float lift = clamp(0.5 + pos.y * 0.18, 0.0, 1.0);
    float sweep = 0.5 + 0.5 * sin(3.0 * atan(pos.z, pos.x) + t * 0.25);

    float rampA = 0.10 + 0.55 * band + 0.20 * lift;
    float rampB = 0.18 + 0.45 * pulse + 0.25 * sweep;

    vec3 col = mix(paletteRamp(rampA), paletteRamp(rampB), 0.45);

    float greenGlow = pow(pulse, 4.0);
    float cyanGlow = pow(band, 3.0);
    float pinkGlow = pow(1.0 - band, 4.0);
    float whiteCore = pow(max(0.0, 1.0 - abs(length(pos) - 1.15)), 6.0);

    col = mix(col, COL_4, 0.30 * greenGlow);
    col = mix(col, COL_5, 0.32 * cyanGlow);
    col = mix(col, COL_7, 0.28 * pinkGlow);
    col = mix(col, COL_8, 0.18 * sweep);
    col += COL_9 * (0.16 * whiteCore);

    // TODO(human): Add a ridge glow — points sitting on the gyroid isosurface
    // should flare bright. Call gyroid(pos * someScale), then build a sharp spike
    // near zero using pow(1.0 - abs(ridgeVal) * k, exp), then mix it into col.

    return clamp(col, 0.0, 1.0);
}

void main() {
    uint id = TDIndex();
    if (id >= TDNumElements()) {
        return;
    }

    float n = float(TDNumElements());
    float idx = float(id);
    float t = uVars * 0.22;

    float cols = ceil(sqrt(n));
    float rows = ceil(n / cols);

    float u = (mod(idx, cols) / max(cols - 1.0, 1.0)) * TAU - PI;
    float v = (floor(idx / cols) / max(rows - 1.0, 1.0)) * PI - PI * 0.5;

    vec3 pos = neonField(u, v, t);
    vec3 col = neonColor(pos, u, v, t);

    P[id] = pos;
    Cd[id] = vec4(col, 1.0);
}
