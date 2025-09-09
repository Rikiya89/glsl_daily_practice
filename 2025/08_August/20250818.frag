// 🔺🌠 CRYSTALLINE PRISM — ANIMATED COSMIC SPIRIT MODE
// —————————————————————————————————————————————————————————
// Enhanced motion: dynamic swirl, pulsating superformula, flickering stars, evolving kaleidoscope

uniform float  u_time;
uniform vec2   u_resolution;
out vec4       fragColor;

#define TAU 6.2831853
#define PHI 1.6180339

// ----------------------------------------------------------------------------
//  Hash & Noise
// ----------------------------------------------------------------------------
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 hash2(vec2 p) {
    return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for(int i = 0; i < 6; i++) {
        v += amp * noise(p);
        p *= 2.0; amp *= 0.5;
    }
    return v;
}

// ----------------------------------------------------------------------------
//  Chakra Colors
// ----------------------------------------------------------------------------
vec3 chakraColor(int idx) {
    vec3 pal[7];
    pal[0] = vec3(0.82, 0.14, 0.14);
    pal[1] = vec3(0.95, 0.50, 0.15);
    pal[2] = vec3(1.00, 0.84, 0.00);
    pal[3] = vec3(0.20, 0.75, 0.55);
    pal[4] = vec3(0.35, 0.65, 0.85);
    pal[5] = vec3(0.50, 0.20, 0.60);
    pal[6] = vec3(0.95, 0.85, 0.95);
    return pal[idx % 7];
}

// ----------------------------------------------------------------------------
//  Swirl & Kaleidoscope
// ----------------------------------------------------------------------------
mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}
vec2 swirl(vec2 p, float strength) {
    float s = strength * sin(p.y * 5.0 + u_time * 0.5);
    return rot(s) * p;
}
vec2 kaleido(vec2 p, int seg) {
    float ang = atan(p.y, p.x), rad = length(p);
    float segA = TAU / float(seg);
    ang = mod(ang + u_time * 0.02, segA);
    if(mod(floor((atan(p.y, p.x) + u_time * 0.1) / segA), 2.0) == 1.0) ang = segA - ang;
    return vec2(cos(ang), sin(ang)) * rad;
}

// ----------------------------------------------------------------------------
//  Superformula
// ----------------------------------------------------------------------------
float superShapeAngle(float phi, float m, float n1, float n2, float n3) {
    float t = m * phi / 4.0;
    return pow(abs(cos(t)), n2) + pow(abs(sin(t)), n3);
}
float superShape(vec2 p, float m, float n1, float n2, float n3, float scale) {
    float phi = atan(p.y, p.x);
    float r   = pow(superShapeAngle(phi, m, n1, n2, n3), -1.0 / n1) * scale;
    return smoothstep(r + 0.005, r - 0.005, length(p));
}

// ----------------------------------------------------------------------------
//  Starfield
// ----------------------------------------------------------------------------
float starField(vec2 uv) {
    float t = noise(uv * 300.0 + u_time * 0.2);
    return step(0.995 + 0.005 * sin(u_time), t);
}

// ----------------------------------------------------------------------------
//  Crystal & Fractal
// ----------------------------------------------------------------------------
float crystal(vec2 p, float s, float a) {
    p = rot(a) * p;
    float d = 1e3;
    for(int i = 0; i < 6; i++) {
        float ang = float(i) * TAU / 6.0;
        d = min(d, dot(p, vec2(cos(ang), sin(ang))) - s);
    }
    for(int i = 0; i < 3; i++) {
        float ang = float(i) * TAU / 3.0;
        d = max(d, - (abs(dot(p, vec2(cos(ang), sin(ang)))) - s * 0.3));
    }
    return d;
}
float fractalCrystal(vec2 p, float t) {
    float sc = 1.0, r = 0.0;
    for(int i = 0; i < 4; i++) {
        r += abs(crystal(p * sc, 0.3 / sc, t * 0.1 + float(i) * 0.5)) / sc;
        p = rot(0.5 + 0.1 * sin(u_time * 0.3)) * p;
        sc *= 2.0;
    }
    return r;
}

// ----------------------------------------------------------------------------
//  Voronoi & Light Rays
// ----------------------------------------------------------------------------
float voro(vec2 p) {
    vec2 n = floor(p), f = fract(p);
    float d = 1.0;
    for(int i = -1; i <= 1; i++) {
        for(int j = -1; j <= 1; j++) {
            vec2 o = hash2(n + vec2(i, j));
            vec2 off = 0.5 + 0.5 * sin(u_time * 0.4 + o * TAU);
            d = min(d, length(vec2(i, j) + off - f));
        }
    }
    return d;
}
float lightRay(vec2 p, vec2 A, vec2 B, float w) {
    vec2 pa = p - A, ba = B - A;
    float h  = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return smoothstep(w, 0.0, length(pa - ba * h));
}

// ----------------------------------------------------------------------------
//  MAIN
// ----------------------------------------------------------------------------
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p  = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // Starfield
    float stars = starField(uv);
    vec3 col = vec3(stars * 0.3);

    // Swirl + Kaleidoscope
    float swirlStrength = 0.3 + 0.1 * sin(u_time * 0.5);
    p = swirl(p, swirlStrength);
    p = kaleido(p, 12);

    float tS = u_time * 0.1;
    float tF = u_time * 0.7;

    // Background gradient
    col += mix(
        vec3(0.02, 0.04, 0.08),
        vec3(0.04, 0.08, 0.12),
        smoothstep(0.0, 1.0, length(p))
    );

    // Animated Superformula layers
    float m1 = 7.0 + 2.0 * sin(u_time * 0.3);
    float s1 = 0.8 + 0.2 * sin(u_time * 0.4);
    col += vec3(1.0, 0.8, 0.5) * superShape(p, m1, 0.3, 1.0, 1.0, s1) * 0.2;
    float m2 = 5.0 + 1.5 * cos(u_time * 0.2);
    float s2 = 0.6 + 0.15 * cos(u_time * 0.5);
    col += vec3(0.6, 0.2, 0.7) * superShape(p * 1.2, m2, 0.5, 1.8, 1.8, s2) * 0.15;

    // Crystals
    for(int i = 0; i < 3; i++) {
        float fi = float(i);
        float radius = 0.4 + 0.05 * sin(tS + fi * 1.2);
        vec2 pos = vec2(
            cos(fi * TAU / 3.0 + tS),
            sin(fi * TAU / 3.0 + tS)
        ) * radius;
        float d = crystal(p - pos, 0.15, tS + fi * 0.5);
        float e = smoothstep(0.015, 0.0, abs(d));
        vec3 cc = mix(chakraColor(i), chakraColor(i + 1), 0.5 + 0.5 * sin(tS));
        col += cc * e + cc * exp(-abs(d) * 8.0) * 0.3;
    }

    // Fractal & Voronoi
    float fC = fractalCrystal(p, tS);
    col += chakraColor(2) * smoothstep(0.12, 0.08, fC) * 0.4;
    float v = voro(p * 3.0);
    col += chakraColor(4) * smoothstep(0.06, 0.02, v) * 0.3;

    // Light rays across chakras
    for(int i = 0; i < 12; i++) {
        float ang = float(i) * TAU / 12.0 + tF * 0.3;
        float w   = 0.006 + 0.002 * sin(u_time * 0.8 + float(i));
        col += chakraColor(i % 7) * lightRay(p, vec2(0), vec2(cos(ang), sin(ang)) * 2.0, w) * 0.3;
    }

    // Bloom & vignette
    float bri = dot(col, vec3(0.299, 0.587, 0.114));
    col += col * smoothstep(0.3, 0.7, bri) * 0.3;
    col *= smoothstep(0.8, 0.2, length(p));

    // Film grain & gamma
    col += (hash(uv * u_resolution.xy + u_time * 5.0) - 0.5) * 0.02;
    col  = pow(col, vec3(1.0 / 2.2));

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
