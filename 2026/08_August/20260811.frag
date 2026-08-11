// ================================================================
// MARRELLA SPLENDENS — CAMBRIAN LACE SIGNAL
// TouchDesigner GLSL TOP fragment shader
// 10-second seamless procedural raymarched animation
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z
// ================================================================

out vec4 fragColor;
uniform float uTimeSeconds;

#define MAX_STEPS 112
#define MAX_DIST  14.0
#define SURF_DIST 0.0012
#define PI  3.14159265359
#define TAU 6.28318530718

const vec3 ACID   = vec3(0.0,   1.0,   0.624);
const vec3 CYAN   = vec3(0.0,   0.812, 1.0);
const vec3 VIOLET = vec3(0.545, 0.0,   1.0);
const vec3 PINK   = vec3(1.0,   0.0,   0.431);
const vec3 ICE    = vec3(0.78, 0.96, 1.00);
const vec3 DEEP   = vec3(0.001, 0.003, 0.008);

mat2 marRot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 marSafeNorm(vec3 v, vec3 fallback) {
    float d = dot(v, v);
    return d < 1e-10 ? fallback : v * inversesqrt(d);
}

vec3 marSafeNorm(vec3 v) {
    return marSafeNorm(v, vec3(0.0, 0.0, 1.0));
}

float marHash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
}

float marHash13(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);

float marNoise3(vec3 x) {
    vec3 p = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(marHash13(p), marHash13(p + vec3(1,0,0)), f.x),
            mix(marHash13(p + vec3(0,1,0)), marHash13(p + vec3(1,1,0)), f.x), f.y),
        mix(mix(marHash13(p + vec3(0,0,1)), marHash13(p + vec3(1,0,1)), f.x),
            mix(marHash13(p + vec3(0,1,1)), marHash13(p + vec3(1,1,1)), f.x), f.y),
        f.z);
}

float marFbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; ++i) {
        v += a * marNoise3(p);
        p = p * 2.03 + vec3(7.1, 13.7, 5.3);
        a *= 0.51;
    }
    return v;
}

float marPhase(float t) {
    return TAU * fract(t / 10.0);
}

float marSdSphere(vec3 p, float r) {
    return length(p) - r;
}

float marSdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float marSdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

float marSdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float marSmin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

vec2 marUnion(vec2 a, vec2 b) {
    return b.x < a.x ? b : a;
}

float marDistSeg2(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

struct MarFrame {
    vec3 c;
    vec3 tangent;
    vec3 side;
    vec3 dorsal;
};

vec3 marBodyCenter(float u, float t) {
    float ph = marPhase(t);
    float travel = ph * 2.0 - u * TAU * 1.35;
    float tail = smoothstep(0.08, 1.0, u);
    return vec3(
        0.075 * sin(travel) * tail,
        mix(-0.78, 1.65, u),
        0.045 * cos(travel * 0.72) * tail
    );
}

float marBodyWidth(float u) {
    float dome = pow(max(sin(PI * clamp(u * 0.96 + 0.035, 0.0, 1.0)), 0.0), 0.48);
    float tail = 1.0 - 0.78 * smoothstep(0.68, 1.0, u);
    return (0.072 + 0.295 * dome) * tail;
}

float marBodyHeight(float u) {
    float dome = pow(max(sin(PI * clamp(u * 0.96 + 0.04, 0.0, 1.0)), 0.0), 0.58);
    return (0.050 + 0.125 * dome) * (1.0 - 0.60 * smoothstep(0.72, 1.0, u));
}

MarFrame marBodyFrame(float u, float t) {
    float e = 0.004;
    MarFrame f;
    f.c = marBodyCenter(u, t);
    vec3 a = marBodyCenter(clamp(u - e, 0.0, 1.0), t);
    vec3 b = marBodyCenter(clamp(u + e, 0.0, 1.0), t);
    f.tangent = marSafeNorm(b - a, vec3(0.0, 1.0, 0.0));
    f.side = marSafeNorm(cross(vec3(0.0, 0.0, 1.0), f.tangent), vec3(1.0, 0.0, 0.0));
    f.dorsal = marSafeNorm(cross(f.tangent, f.side), vec3(0.0, 0.0, 1.0));
    return f;
}

float marBodyU(vec3 q) {
    return clamp((q.y + 0.78) / 2.43, 0.0, 1.0);
}

vec3 marPose(vec3 p, float t) {
    float ph = marPhase(t);
    float bank = radians(8.0) * sin(ph);
    p.xz = marRot(bank) * p.xz;
    p.xy = marRot(0.025 * sin(ph * 2.0)) * p.xy;
    p += vec3(0.025 * sin(ph), 0.025 * cos(ph), 0.02 * cos(ph));
    return p;
}

vec3 marUnpose(vec3 p, float t) {
    float ph = marPhase(t);
    p -= vec3(0.025 * sin(ph), 0.025 * cos(ph), 0.02 * cos(ph));
    p.xy = marRot(-0.025 * sin(ph * 2.0)) * p.xy;
    p.xz = marRot(-radians(8.0) * sin(ph)) * p.xz;
    return p;
}

float marBodySDF(vec3 q, float t) {
    float u = marBodyU(q);
    MarFrame f = marBodyFrame(u, t);
    vec3 r = q - f.c;
    float x = dot(r, f.side);
    float z = dot(r, f.dorsal);
    float w = marBodyWidth(u);
    float h = marBodyHeight(u);
    float crossD = (length(vec2(x / w, z / h)) - 1.0) * min(w, h);
    float front = -dot(q - marBodyCenter(0.0, t), marBodyFrame(0.0, t).tangent);
    float rear = dot(q - marBodyCenter(1.0, t), marBodyFrame(1.0, t).tangent);
    float d = max(crossD, max(front, rear));
    float cell = abs(fract(u * 26.0) - 0.5);
    float groove = exp(-cell * cell * 920.0);
    return d + groove * (0.014 + 0.012 * smoothstep(0.08, 0.85, u));
}

float marHeadSDF(vec3 q, float t) {
    MarFrame f = marBodyFrame(0.015, t);
    vec3 c = f.c - f.tangent * 0.16;
    vec3 r = q - c;
    vec3 p = vec3(dot(r, f.side), dot(r, f.tangent), dot(r, f.dorsal));
    float wedge = mix(0.56, 0.29, clamp((-p.y + 0.30) / 0.65, 0.0, 1.0));
    p.x /= wedge / 0.48;
    return marSdEllipsoid(p, vec3(0.48, 0.37, 0.115));
}

vec3 marSpinePoint(int index, float v, float t) {
    float side = (index == 0 || index == 2) ? -1.0 : 1.0;
    float dorsalPair = index >= 2 ? 1.0 : 0.0;
    float ph = marPhase(t);
    MarFrame f = marBodyFrame(0.02, t);
    float rootSide = mix(0.42, 0.22, dorsalPair);
    vec3 root = f.c + f.side * side * rootSide - f.tangent * 0.08
              + f.dorsal * mix(-0.015, 0.075, dorsalPair);
    float span = mix(1.20, 0.86, dorsalPair) * (1.0 + 0.035 * float(index));
    float sweep = mix(1.72, 1.90, dorsalPair);
    float curve = sin(PI * v);
    float offset = float(index) * 0.73;
    return root
         + f.side * side * (span * v + 0.27 * curve)
         + f.tangent * (sweep * v - 0.16 * curve)
         + f.dorsal * (mix(-0.15, 0.34, dorsalPair) * v
         + 0.035 * sin(ph * 2.0 + offset + v * 4.0) * v);
}

float marSpinesSDF(vec3 q, float t) {
    float d = 1e5;
    for (int spine = 0; spine < 4; ++spine) {
        for (int i = 0; i < 8; ++i) {
            float a = float(i) / 8.0;
            float b = float(i + 1) / 8.0;
            d = min(d, marSdTaperedCapsule(q,
                marSpinePoint(spine, a, t), marSpinePoint(spine, b, t),
                mix(0.038, 0.006, a), mix(0.038, 0.006, b)));
        }
    }
    return d;
}

vec3 marAntennaPoint(float side, float v, float t) {
    MarFrame f = marBodyFrame(0.0, t);
    float ph = marPhase(t);
    float lag = ph - v * 1.35 + (side > 0.0 ? 0.38 : 0.0);
    vec3 root = f.c + f.side * side * 0.18 - f.tangent * 0.25 - f.dorsal * 0.025;
    return root + f.tangent * (-1.62 * v + 0.12 * v * v)
         + f.side * side * (0.10 + 0.30 * v + 0.08 * sin(lag * 2.0) * v * v)
         + f.dorsal * (-0.06 + 0.11 * sin(lag + v * 3.0) * v);
}

vec3 marPaddlePoint(float side, float v, float t) {
    MarFrame f = marBodyFrame(0.06, t);
    float ph = marPhase(t) * 2.0 + side * 0.24;
    float stroke = sign(sin(ph)) * pow(abs(sin(ph)), 0.68);
    vec3 root = f.c + f.side * side * 0.23 - f.dorsal * 0.06;
    return root + f.side * side * (0.76 * v)
         + f.tangent * (0.17 * v - 0.16 * sin(PI * v))
         + f.dorsal * (0.31 * stroke * v);
}

float marPaddlesSDF(vec3 q, float t) {
    float d = 1e5;
    for (int sideIndex = 0; sideIndex < 2; ++sideIndex) {
        float side = sideIndex == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 6; ++i) {
            float a = float(i) / 6.0;
            float b = float(i + 1) / 6.0;
            d = min(d, marSdTaperedCapsule(q,
                marPaddlePoint(side, a, t), marPaddlePoint(side, b, t),
                mix(0.034, 0.012, a), mix(0.034, 0.012, b)));
        }
    }
    return d;
}

vec3 marLimbPoint(float side, float u, float v, float t) {
    MarFrame f = marBodyFrame(u, t);
    float ph = marPhase(t) * 2.0 - u * TAU * 3.15 + side * 0.18;
    float stroke = sin(ph);
    float span = (0.25 + 0.40 * sin(PI * u)) * v;
    return f.c + f.side * side * (marBodyWidth(u) * 0.84 + span)
         + f.tangent * (-0.14 * v - 0.11 * sin(PI * v))
         + f.dorsal * (-0.12 - 0.27 * stroke * v + 0.065 * sin(PI * v));
}

vec2 marSceneMap(vec3 worldP, float t) {
    vec3 q = marUnpose(worldP, t);
    vec2 result = vec2(marBodySDF(q, t), 1.0);
    result = marUnion(result, vec2(marHeadSDF(q, t), 2.0));
    result = marUnion(result, vec2(marSpinesSDF(q, t), 3.0));
    result = marUnion(result, vec2(marPaddlesSDF(q, t), 4.0));
    return result;
}

vec3 marNormal(vec3 p, float t) {
    vec2 e = vec2(0.0015, 0.0);
    return marSafeNorm(vec3(
        marSceneMap(p + e.xyy, t).x - marSceneMap(p - e.xyy, t).x,
        marSceneMap(p + e.yxy, t).x - marSceneMap(p - e.yxy, t).x,
        marSceneMap(p + e.yyx, t).x - marSceneMap(p - e.yyx, t).x));
}

float marAO(vec3 p, vec3 n, float t) {
    float occ = 0.0;
    float scale = 1.0;
    for (int i = 0; i < 4; ++i) {
        float h = 0.03 + 0.065 * float(i);
        occ += (h - marSceneMap(p + n * h, t).x) * scale;
        scale *= 0.58;
    }
    return clamp(1.0 - occ * 2.0, 0.22, 1.0);
}

float marRaymarch(vec3 ro, vec3 rd, float t, out float glow, out float matId) {
    float depth = 0.0;
    glow = 0.0;
    matId = 0.0;
    for (int i = 0; i < MAX_STEPS; ++i) {
        vec3 p = ro + rd * depth;
        vec2 hit = marSceneMap(p, t);
        glow += exp(-abs(hit.x) * 28.0) * 0.0024;
        if (hit.x < SURF_DIST || depth > MAX_DIST) {
            matId = hit.y;
            break;
        }
        depth += max(hit.x * 0.72, 0.00055);
    }
    return depth;
}

vec2 marProject(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
    vec3 r = p - ro;
    float z = max(dot(r, ww), 0.05);
    return vec2(dot(r, uu), dot(r, vv)) / z;
}

vec3 marLineGlow(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
    vec3 color = vec3(0.0);

    // Wedge-shaped head-shield rim. Keeping this separate from the volume
    // makes the cephalic anatomy readable even through the translucent body.
    MarFrame headFrame = marBodyFrame(0.015, t);
    vec3 headCenter = headFrame.c - headFrame.tangent * 0.16;
    vec3 shield0 = marPose(headCenter - headFrame.tangent * 0.36, t);
    vec3 shield1 = marPose(headCenter + headFrame.tangent * 0.18 - headFrame.side * 0.54, t);
    vec3 shield2 = marPose(headCenter + headFrame.tangent * 0.27, t);
    vec3 shield3 = marPose(headCenter + headFrame.tangent * 0.18 + headFrame.side * 0.54, t);
    vec2 hs0 = marProject(shield0, ro, uu, vv, ww);
    vec2 hs1 = marProject(shield1, ro, uu, vv, ww);
    vec2 hs2 = marProject(shield2, ro, uu, vv, ww);
    vec2 hs3 = marProject(shield3, ro, uu, vv, ww);
    float shieldD = min(min(marDistSeg2(st, hs0, hs1), marDistSeg2(st, hs1, hs2)),
                        min(marDistSeg2(st, hs2, hs3), marDistSeg2(st, hs3, hs0)));
    color += ICE * exp(-shieldD * 290.0) * 0.016;

    // All 26 segment rims remain explicit in the final image.
    for (int i = 0; i < 26; ++i) {
        float u = (float(i) + 0.5) / 26.0;
        MarFrame f = marBodyFrame(u, t);
        vec3 left = marPose(f.c - f.side * marBodyWidth(u), t);
        vec3 right = marPose(f.c + f.side * marBodyWidth(u), t);
        float d = marDistSeg2(st, marProject(left, ro, uu, vv, ww), marProject(right, ro, uu, vv, ww));
        color += ICE * exp(-d * 250.0) * 0.013;
    }

    // Paired walking branches and tapering gill filaments.
    for (int i = 1; i < 25; ++i) {
        float u = (float(i) + 0.5) / 26.0;
        for (int sideIndex = 0; sideIndex < 2; ++sideIndex) {
            float side = sideIndex == 0 ? -1.0 : 1.0;
            vec3 a3 = marPose(marLimbPoint(side, u, 0.0, t), t);
            vec3 b3 = marPose(marLimbPoint(side, u, 0.48, t), t);
            vec3 c3 = marPose(marLimbPoint(side, u, 1.0, t), t);
            vec2 a = marProject(a3, ro, uu, vv, ww);
            vec2 b = marProject(b3, ro, uu, vv, ww);
            vec2 c = marProject(c3, ro, uu, vv, ww);
            float d = min(marDistSeg2(st, a, b), marDistSeg2(st, b, c));
            color += mix(CYAN, ICE, 0.48) * exp(-d * 292.0) * 0.016;

            MarFrame f = marBodyFrame(u, t);
            float stroke = sin(marPhase(t) * 2.0 - u * TAU * 3.15 + side * 0.18);
            for (int filament = 0; filament < 3; ++filament) {
                float fi = float(filament);
                vec3 g0 = marLimbPoint(side, u, 0.38 + fi * 0.13, t);
                vec3 g1 = g0 + f.side * side * (0.19 + fi * 0.050)
                        + f.tangent * (0.11 + fi * 0.028)
                        + f.dorsal * (0.12 + 0.045 * stroke);
                float gd = marDistSeg2(st,
                    marProject(marPose(g0, t), ro, uu, vv, ww),
                    marProject(marPose(g1, t), ro, uu, vv, ww));
                color += mix(CYAN, ACID, 0.34) * exp(-gd * 340.0) * 0.008;
            }

            // The posterior twelve limb pairs carry blunt inner spines that
            // read as a delicate ventral feeding net in the underside view.
            if (i >= 13) {
                vec3 net0 = marLimbPoint(side, u, 0.24, t);
                vec3 net1 = f.c + f.side * side * 0.055
                          - f.dorsal * (0.20 + 0.035 * stroke)
                          + f.tangent * 0.025;
                float nd = marDistSeg2(st,
                    marProject(marPose(net0, t), ro, uu, vv, ww),
                    marProject(marPose(net1, t), ro, uu, vv, ww));
                color += mix(VIOLET, PINK, 0.24) * exp(-nd * 350.0) * 0.008;
            }
        }
    }

    // Thirty-segment antennae rendered as elegant luminous chains.
    for (int sideIndex = 0; sideIndex < 2; ++sideIndex) {
        float side = sideIndex == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 15; ++i) {
            float a = float(i) / 15.0;
            float b = float(i + 1) / 15.0;
            float d = marDistSeg2(st,
                marProject(marPose(marAntennaPoint(side, a, t), t), ro, uu, vv, ww),
                marProject(marPose(marAntennaPoint(side, b, t), t), ro, uu, vv, ww));
            vec3 antennaColor = mix(CYAN, PINK, 0.34 * b * b);
            color += antennaColor * exp(-d * 325.0) * (0.014 + 0.008 * b);
        }
    }

    // Six-part head paddles, distinct from the trunk limbs.
    for (int sideIndex = 0; sideIndex < 2; ++sideIndex) {
        float side = sideIndex == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 6; ++i) {
            float a = float(i) / 6.0;
            float b = float(i + 1) / 6.0;
            float d = marDistSeg2(st,
                marProject(marPose(marPaddlePoint(side, a, t), t), ro, uu, vv, ww),
                marProject(marPose(marPaddlePoint(side, b, t), t), ro, uu, vv, ww));
            color += mix(CYAN, ACID, 0.22) * exp(-d * 275.0) * 0.019;
        }
    }
    return color;
}

vec3 marBackground(vec2 st, float t) {
    float ph = marPhase(t);
    float vertical = smoothstep(-1.2, 1.1, st.y);
    vec3 color = mix(DEEP, vec3(0.003, 0.013, 0.024), vertical);
    float haze = marFbm(vec3(st * 1.4 + vec2(sin(ph), cos(ph)) * 0.05, sin(ph * 2.0)));
    color += mix(VIOLET, CYAN, 0.65) * haze * haze * 0.012;
    for (int i = 0; i < 36; ++i) {
        float fi = float(i);
        vec2 p = vec2(marHash11(fi * 9.7), marHash11(fi * 31.3)) * 2.0 - 1.0;
        float harmonic = 1.0 + mod(fi, 3.0);
        p.y = fract(p.y * 0.5 + 0.5 + ph / TAU * harmonic) * 2.2 - 1.1;
        p.x += 0.035 * sin(ph * harmonic + fi);
        float d = length(st - p);
        color += mix(CYAN, ICE, 0.35) * exp(-d * 145.0)
               * (0.0025 + 0.006 * marHash11(fi * 4.3));
    }
    color += CYAN * exp(-length(st - vec2(0.0, 0.05)) * 3.8) * 0.014;
    return color;
}

vec3 marMaterial(float matId, vec3 p, vec3 n, vec3 rd, float t) {
    vec3 q = marUnpose(p, t);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.8);
    float organic = marFbm(q * 3.4 + vec3(sin(marPhase(t)), cos(marPhase(t)), 0.0));
    float micro = marNoise3(q * 22.0 + vec3(3.1, 7.7, 1.9));
    if (matId < 1.5) {
        float u = marBodyU(q);
        float rib = pow(1.0 - abs(fract(u * 26.0) - 0.5) * 2.0, 10.0);
        float pigment = smoothstep(0.28, 0.78, organic + 0.16 * micro);
        vec3 tissue = mix(vec3(0.006, 0.010, 0.014),
                          vec3(0.020, 0.034, 0.041), pigment);
        tissue *= 0.82 + 0.20 * micro;
        vec3 c = tissue;
        c += mix(VIOLET, CYAN, 0.70) * fresnel * 0.16;
        c += ICE * rib * (0.012 + 0.045 * fresnel);
        float gut = exp(-abs(q.x) * 18.0) * exp(-abs(q.z) * 19.0) * smoothstep(0.04, 0.22, u);
        c += mix(VIOLET, PINK, 0.16) * gut * (0.022 + 0.025 * organic);
        return c;
    }
    if (matId < 2.5) {
        vec3 shell = mix(vec3(0.008, 0.014, 0.018),
                         vec3(0.020, 0.035, 0.042), organic);
        shell *= 0.86 + 0.16 * micro;
        return shell
             + mix(VIOLET, CYAN, 0.74) * fresnel * 0.25
             + ICE * fresnel * fresnel * 0.11;
    }
    if (matId < 3.5) {
        vec3 spineTissue = mix(vec3(0.012, 0.026, 0.030),
                               vec3(0.025, 0.052, 0.058), organic);
        return spineTissue
             + mix(CYAN, ACID, 0.18) * fresnel * 0.46
             + ICE * fresnel * fresnel * 0.24;
    }
    vec3 paddleTissue = mix(vec3(0.008, 0.022, 0.025),
                            vec3(0.020, 0.050, 0.048), organic);
    return paddleTissue
         + mix(CYAN, ACID, 0.30) * fresnel * 0.34
         + ICE * fresnel * fresnel * 0.15;
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t = uTimeSeconds;
    float ph = marPhase(t);
    // Full anatomical reveal: dorsal hero -> broadside -> ventral three-quarter
    // -> broadside -> opening hero. The underside phase exposes the walking
    // branches, gill filaments, and feeding-net silhouette without a hard cut.
    float reveal = 0.5 - 0.5 * cos(ph);
    float shapedReveal = pow(reveal, 0.85);
    float orbit = radians(28.0 + 112.0 * shapedReveal
                        + 8.0 * sin(ph * 2.0));
    float broadside = abs(sin(orbit));
    float undersideReveal = smoothstep(0.56, 0.96, reveal);
    vec3 target = marPose(vec3(0.035 * sin(ph * 2.0),
                               0.10 + 0.10 * sin(ph - 0.30),
                               0.0), t);
    float cameraRadius = 5.92 + 0.34 * broadside
                       + 0.12 * undersideReveal;
    float longitudinal = -0.32
                       + 0.22 * sin(ph - 0.70)
                       + 0.07 * sin(ph * 2.0 + 0.35);
    vec3 ro = target + vec3(sin(orbit) * cameraRadius,
                            longitudinal,
                            cos(orbit) * cameraRadius);

    vec3 ww = marSafeNorm(target - ro);
    vec3 cameraUp = marSafeNorm(vec3(0.036 * sin(ph * 2.0),
                                     1.0,
                                     0.024 * cos(ph + 0.30)));
    vec3 uu = marSafeNorm(cross(cameraUp, ww), vec3(1.0, 0.0, 0.0));
    vec3 vv = marSafeNorm(cross(ww, uu));
    float focalLength = 1.76 - 0.075 * broadside + 0.025 * cos(ph);
    vec3 rd = marSafeNorm(uu * st.x + vv * st.y + ww * focalLength);

    vec3 color = marBackground(st, t);
    float glow, matId;
    float depth = marRaymarch(ro, rd, t, glow, matId);

    if (depth < MAX_DIST) {
        vec3 p = ro + rd * depth;
        vec3 n = marNormal(p, t);
        vec3 l1 = marSafeNorm(vec3(-0.55, -0.45, 0.74));
        vec3 l2 = marSafeNorm(vec3(0.62, 0.20, -0.62));
        float diffuse = max(dot(n, l1), 0.0);
        float fill = max(dot(n, l2), 0.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
        float ao = marAO(p, n, t);
        vec3 base = marMaterial(matId, p, n, rd, t);
        vec3 lit = base * (0.24 + 0.72 * diffuse
                        + (0.12 + 0.20 * undersideReveal) * fill) * ao;
        vec3 halfVector = marSafeNorm(l1 - rd);
        float specPower = matId > 2.5 && matId < 3.5 ? 92.0 : (matId > 3.5 ? 58.0 : 46.0);
        float specStrength = matId > 2.5 && matId < 3.5 ? 0.82 : (matId > 3.5 ? 0.48 : 0.30);
        float specular = pow(max(dot(n, halfVector), 0.0), specPower);
        lit += ICE * specular * specStrength;
        lit += CYAN * rim * (matId > 2.5 ? 0.30 : 0.09);
        float fog = 1.0 - exp(-depth * 0.15);
        color = mix(lit, color, fog * 0.38);
    }

    color += marLineGlow(st, ro, uu, vv, ww, t)
           * (1.0 + 0.24 * undersideReveal);
    color += CYAN * glow * 0.040;
    color *= 1.30;
    color += pow(max(color, 0.0), vec3(1.40)) * 0.085;
    color *= 1.0 - 0.22 * smoothstep(0.42, 1.42, length(st));
    color = color / (0.84 + color);
    color = pow(max(color, 0.0), vec3(0.94));

    float grainSeed = sin(ph) * 19.0 + cos(ph) * 37.0;
    color += (marHash11(uv.x * 1229.0 + uv.y * 983.0 + grainSeed) - 0.5) * 0.004;
    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
