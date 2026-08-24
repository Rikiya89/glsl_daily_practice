// ================================================================
// ODARAIA ALATA — CAMBRIAN SUSPENSION DRIFT
// TouchDesigner GLSL TOP fragment shader
// 12-second seamless procedural raymarched animation
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z
// Tubular bivalved carapace, dense biramous limb lattice, stalked eyes,
// soft segmented trunk, and the diagnostic three-bladed rudder tail.
// ================================================================

out vec4 fragColor;
uniform float uTimeSeconds;

#define MAX_STEPS 104
#define MAX_DIST  14.0
#define SURF_DIST 0.0014
#define PI  3.14159265359
#define TAU 6.28318530718

// Exact palette preserved from the existing project.
// Exact palette preserved from the existing project.
const vec3 ACID   = vec3(0.0,   1.0,   0.624);
const vec3 CYAN   = vec3(0.0,   0.812, 1.0);
const vec3 VIOLET = vec3(0.545, 0.0,   1.0);
const vec3 PINK   = vec3(1.0,   0.0,   0.431);
const vec3 ICE    = vec3(0.78,  0.96,  1.00);
const vec3 DEEP   = vec3(0.001, 0.003, 0.008);

mat2 odaRot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 odaSafeNorm(vec3 v, vec3 fallback) {
    float d = dot(v, v);
    return d < 1e-10 ? fallback : v * inversesqrt(d);
}

vec3 odaSafeNorm(vec3 v) {
    return odaSafeNorm(v, vec3(0.0, 0.0, 1.0));
}

float odaHash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
}

float odaHash13(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float odaNoise3(vec3 x) {
    vec3 p = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(odaHash13(p), odaHash13(p + vec3(1,0,0)), f.x),
            mix(odaHash13(p + vec3(0,1,0)), odaHash13(p + vec3(1,1,0)), f.x), f.y),
        mix(mix(odaHash13(p + vec3(0,0,1)), odaHash13(p + vec3(1,0,1)), f.x),
            mix(odaHash13(p + vec3(0,1,1)), odaHash13(p + vec3(1,1,1)), f.x), f.y),
        f.z);
}

float odaFbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; ++i) {
        v += a * odaNoise3(p);
        p = p * 2.03 + vec3(7.1, 13.7, 5.3);
        a *= 0.51;
    }
    return v;
}

float odaPhase(float t) {
    return TAU * fract(t / 12.0);
}

float odaSdSphere(vec3 p, float r) {
    return length(p) - r;
}

float odaSdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float odaSdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

float odaSdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float odaSmin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

vec2 odaUnion(vec2 a, vec2 b) {
    return b.x < a.x ? b : a;
}

float odaDistSeg2(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

vec3 odaPose(vec3 p, float t) {
    float ph = odaPhase(t);
    p.xz = odaRot(radians(6.0) * sin(ph)) * p.xz;
    p.xy = odaRot(0.028 * sin(ph * 2.0)) * p.xy;
    p += vec3(0.025 * sin(ph), 0.018 * cos(ph), 0.018 * cos(ph));
    return p;
}

vec3 odaUnpose(vec3 p, float t) {
    float ph = odaPhase(t);
    p -= vec3(0.025 * sin(ph), 0.018 * cos(ph), 0.018 * cos(ph));
    p.xy = odaRot(-0.028 * sin(ph * 2.0)) * p.xy;
    p.xz = odaRot(-radians(6.0) * sin(ph)) * p.xz;
    return p;
}

vec3 odaBodyCenter(float u, float t) {
    float ph = odaPhase(t);
    float tailWeight = smoothstep(0.12, 1.0, u);
    float wave = ph * 2.0 - u * TAU * 1.10;
    return vec3(0.085 * sin(wave) * tailWeight,
                mix(-0.56, 1.62, u),
                0.045 * cos(wave) * tailWeight);
}

float odaBodyWidth(float u) {
    float profile = pow(max(sin(PI * clamp(u * 0.94 + 0.045, 0.0, 1.0)), 0.0), 0.50);
    return (0.105 + 0.395 * profile) * (1.0 - 0.72 * smoothstep(0.72, 1.0, u));
}

float odaBodyHeight(float u) {
    float profile = pow(max(sin(PI * clamp(u * 0.95 + 0.035, 0.0, 1.0)), 0.0), 0.62);
    return (0.070 + 0.190 * profile) * (1.0 - 0.58 * smoothstep(0.72, 1.0, u));
}

float odaBodyU(vec3 q) {
    return clamp((q.y + 0.56) / 2.18, 0.0, 1.0);
}

float odaBodySDF(vec3 q, float t) {
    float u = odaBodyU(q);
    vec3 c = odaBodyCenter(u, t);
    vec3 r = q - c;
    float w = odaBodyWidth(u);
    float h = odaBodyHeight(u);
    float crossD = (length(vec2(r.x / w, r.z / h)) - 1.0) * min(w, h);
    float front = odaBodyCenter(0.0, t).y - q.y;
    float rear = q.y - odaBodyCenter(1.0, t).y;
    float d = max(crossD, max(front, rear));
    float ring = exp(-pow(abs(fract(u * 30.0) - 0.5) * 8.0, 2.0));
    return d + ring * 0.012 * smoothstep(0.08, 0.90, u);
}

float odaHeadSDF(vec3 q, float t) {
    vec3 c = odaBodyCenter(0.018, t) + vec3(0.0, -0.22, -0.005);
    float hood = odaSdEllipsoid(q - c, vec3(0.56, 0.43, 0.29));
    float muzzle = odaSdEllipsoid(q - c - vec3(0.0, -0.23, -0.015),
                                  vec3(0.43, 0.26, 0.22));
    return odaSmin(hood, muzzle, 0.10);
}

float odaCarapaceSDF(vec3 q, float t) {
    vec3 base = odaBodyCenter(0.18, t) + vec3(0.0, -0.03, 0.18);
    float d = 1e5;
    for (int s = 0; s < 2; ++s) {
        float side = s == 0 ? -1.0 : 1.0;
        vec3 p = q - base - vec3(side * 0.36, 0.14, 0.0);
        p.xy = odaRot(-side * 0.10) * p.xy;
        p.yz = odaRot(side * 0.035) * p.yz;
        float plate = odaSdEllipsoid(p, vec3(0.48, 1.02, 0.115));
        d = min(d, plate);
    }
    vec3 openingCenter = base + vec3(0.0, -0.72, -0.12);
    float opening = odaSdEllipsoid(q - openingCenter, vec3(0.39, 0.39, 0.27));
    return max(d, -opening);
}

float odaEyesSDF(vec3 q, float t) {
    vec3 c = odaBodyCenter(0.008, t) + vec3(0.0, -0.50, 0.035);
    float leftEye = odaSdEllipsoid(q - c - vec3(-0.45, -0.025, 0.0),
                                   vec3(0.175, 0.135, 0.150));
    float rightEye = odaSdEllipsoid(q - c - vec3(0.45, -0.025, 0.0),
                                    vec3(0.175, 0.135, 0.150));
    return min(leftEye, rightEye);
}

float odaEyeStalksSDF(vec3 q, float t) {
    vec3 c = odaBodyCenter(0.008, t) + vec3(0.0, -0.50, 0.035);
    float left = odaSdTaperedCapsule(q,
        c + vec3(-0.20, 0.055, -0.015), c + vec3(-0.39, 0.0, 0.0),
        0.070, 0.095);
    float right = odaSdTaperedCapsule(q,
        c + vec3(0.20, 0.055, -0.015), c + vec3(0.39, 0.0, 0.0),
        0.070, 0.095);
    return min(left, right);
}

float odaOcelliSDF(vec3 q, float t) {
    vec3 c = odaBodyCenter(0.006, t) + vec3(0.0, -0.60, 0.14);
    float a = odaSdSphere(q - c - vec3(-0.065, 0.0, 0.0), 0.027);
    float b = odaSdSphere(q - c - vec3(0.065, 0.0, 0.0), 0.027);
    float d = odaSdSphere(q - c - vec3(0.0, -0.035, -0.065), 0.027);
    return min(a, min(b, d));
}

vec3 odaMouthpartPoint(float side, float v, float t) {
    float ph = odaPhase(t);
    vec3 head = odaBodyCenter(0.01, t) + vec3(0.0, -0.30, -0.02);
    float arc = sin(PI * clamp(v, 0.0, 1.0));
    float curl = v * v;
    float flow = sin(ph * 2.0 - v * 3.7 + side * 0.55);
    return head
         + vec3(side * (0.11 + 0.12 * arc + 0.025 * v),
                -0.12 - 0.34 * v + 0.12 * curl,
                -0.08 + 0.10 * arc - 0.06 * curl + 0.018 * flow * v);
}

vec3 odaMouthpartToothTip(float side, float v, float t) {
    float ph = odaPhase(t);
    vec3 root = odaMouthpartPoint(side, v, t);
    float fan = sin(PI * clamp(v * 1.06, 0.0, 1.0));
    float flow = sin(ph * 2.0 - v * 5.0 + side * 0.45);
    return root + vec3(-side * (0.075 + 0.045 * fan),
                       -0.035 - 0.025 * fan,
                       -0.060 - 0.014 * flow);
}

float odaMouthpartsSDF(vec3 q, float t) {
    float d = 1e5;
    for (int s = 0; s < 2; ++s) {
        float side = s == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 5; ++i) {
            float a = float(i) / 5.0;
            float b = float(i + 1) / 5.0;
            d = min(d, odaSdTaperedCapsule(q,
                odaMouthpartPoint(side, a, t), odaMouthpartPoint(side, b, t),
                mix(0.090, 0.035, a), mix(0.090, 0.035, b)));
        }
        for (int i = 1; i < 4; ++i) {
            float v = float(i) / 4.0;
            d = min(d, odaSdTaperedCapsule(q,
                odaMouthpartPoint(side, v, t), odaMouthpartToothTip(side, v, t),
                0.024, 0.008));
        }
    }
    return d;
}

float odaLimbMassSDF(vec3 q, float t) {
    float d = 1e5;
    float ph = odaPhase(t);
    for (int i = 0; i < 15; ++i) {
        float u = (float(i) + 0.65) / 16.1;
        vec3 c = odaBodyCenter(u, t);
        float phase = ph * 2.0 - float(i) * 0.39;
        float stroke = sin(phase);
        float span = (0.17 + 0.11 * sin(PI * u)) * (1.0 - 0.22 * smoothstep(0.80, 1.0, u));
        for (int s = 0; s < 2; ++s) {
            float side = s == 0 ? -1.0 : 1.0;
            vec3 limbCenter = c + vec3(side * (0.20 + span * 0.35),
                                       span * 0.05,
                                      -0.035 + 0.035 * stroke);
            vec3 p = q - limbCenter;
            p.yz = odaRot(-stroke * side * 0.24) * p.yz;
            p.xy = odaRot(-side * (0.28 + 0.07 * stroke)) * p.xy;
            d = min(d, odaSdEllipsoid(p, vec3(span, 0.085, 0.026)));
        }
    }
    return d;
}

float odaTailSDF(vec3 q, float t) {
    vec3 c = odaBodyCenter(0.98, t);
    float ph = odaPhase(t);
    float d = 1e5;
    vec3 prev = c + vec3(0.0, 0.02, 0.0);
    for (int i = 0; i < 4; ++i) {
        float a = float(i) / 4.0;
        float b = float(i + 1) / 4.0;
        vec3 next = c + vec3(0.08 * sin(ph * 2.0 - b * 3.2) * b,
                             0.04 + 0.66 * b,
                             0.05 * cos(ph * 2.0 - b * 2.6) * b);
        d = min(d, odaSdTaperedCapsule(q, prev, next,
                mix(0.105, 0.055, a), mix(0.105, 0.055, b)));
        prev = next;
    }
    vec3 fan = prev;
    for (int i = -1; i <= 1; ++i) {
        float fi = float(i);
        vec3 p = q - fan;
        p.xy = odaRot(-fi * 0.78) * p.xy;
        p.xz = odaRot(-0.10 * sin(ph * 2.0 + fi)) * p.xz;
        d = min(d, odaSdEllipsoid(p - vec3(0.0, 0.24, 0.0),
                                  vec3(0.115, 0.34, 0.045)));
    }
    return d;
}

vec2 odaSceneMap(vec3 worldP, float t) {
    vec3 q = odaUnpose(worldP, t);
    vec2 result = vec2(odaBodySDF(q, t), 1.0);
    result = odaUnion(result, vec2(odaHeadSDF(q, t), 7.0));
    result = odaUnion(result, vec2(odaEyesSDF(q, t), 2.0));
    result = odaUnion(result, vec2(odaEyeStalksSDF(q, t), 7.0));
    result = odaUnion(result, vec2(odaOcelliSDF(q, t), 8.0));
    result = odaUnion(result, vec2(odaMouthpartsSDF(q, t), 3.0));
    result = odaUnion(result, vec2(odaLimbMassSDF(q, t), 4.0));
    result = odaUnion(result, vec2(odaTailSDF(q, t), 5.0));
    result = odaUnion(result, vec2(odaCarapaceSDF(q, t), 6.0));
    return result;
}

vec3 odaNormal(vec3 p, float t) {
    vec2 e = vec2(0.0018, 0.0);
    return odaSafeNorm(vec3(
        odaSceneMap(p + e.xyy, t).x - odaSceneMap(p - e.xyy, t).x,
        odaSceneMap(p + e.yxy, t).x - odaSceneMap(p - e.yxy, t).x,
        odaSceneMap(p + e.yyx, t).x - odaSceneMap(p - e.yyx, t).x));
}

float odaAO(vec3 p, vec3 n, float t) {
    float occ = 0.0;
    float scale = 1.0;
    for (int i = 0; i < 3; ++i) {
        float h = 0.035 + 0.075 * float(i);
        occ += (h - odaSceneMap(p + n * h, t).x) * scale;
        scale *= 0.56;
    }
    return clamp(1.0 - occ * 2.1, 0.22, 1.0);
}

float odaRaymarch(vec3 ro, vec3 rd, float t, out float glow, out float matId) {
    float depth = 0.0;
    glow = 0.0;
    matId = 0.0;
    for (int i = 0; i < MAX_STEPS; ++i) {
        vec3 p = ro + rd * depth;
        vec2 hit = odaSceneMap(p, t);
        glow += exp(-abs(hit.x) * 25.0) * 0.0022;
        if (hit.x < SURF_DIST || depth > MAX_DIST) {
            matId = hit.y;
            break;
        }
        depth += max(hit.x * 0.72, 0.00065);
    }
    return depth;
}

vec2 odaProject(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
    vec3 r = p - ro;
    float z = max(dot(r, ww), 0.05);
    return vec2(dot(r, uu), dot(r, vv)) / z;
}

vec3 odaMouthpartGlow(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
    vec3 color = vec3(0.0);
    float pulse = 0.82 + 0.18 * sin(odaPhase(t) * 3.0);
    for (int s = 0; s < 2; ++s) {
        float side = s == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 10; ++i) {
            float a = float(i) / 10.0;
            float b = float(i + 1) / 10.0;
            vec2 p0 = odaProject(odaPose(odaMouthpartPoint(side, a, t), t), ro, uu, vv, ww);
            vec2 p1 = odaProject(odaPose(odaMouthpartPoint(side, b, t), t), ro, uu, vv, ww);
            float d = odaDistSeg2(st, p0, p1);
            color += mix(PINK, ICE, 0.24) * exp(-d * 360.0) * 0.018 * pulse;
        }
        for (int i = 1; i < 4; ++i) {
            float v = float(i) / 4.0;
            vec3 root3 = odaMouthpartPoint(side, v, t);
            vec3 tip3 = odaMouthpartToothTip(side, v, t);
            vec2 root = odaProject(odaPose(root3, t), ro, uu, vv, ww);
            vec2 tip = odaProject(odaPose(tip3, t), ro, uu, vv, ww);
            float mainD = odaDistSeg2(st, root, tip);
            color += ICE * exp(-mainD * 430.0) * 0.014 * pulse;
        }
    }
    return color;
}

vec3 odaLimbLatticeGlow(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
    vec3 color = vec3(0.0);
    float ph = odaPhase(t);
    for (int i = 0; i < 30; ++i) {
        float u = (float(i) + 0.55) / 30.8;
        vec3 c = odaBodyCenter(u, t);
        float stroke = sin(ph * 2.0 - float(i) * 0.31);
        float basketFade = smoothstep(0.035, 0.16, u)
                         * (1.0 - smoothstep(0.84, 0.985, u));
        float centralLift = 0.68 + 0.32 * sin(PI * u);
        float span = (0.28 + 0.16 * sin(PI * u))
                   * (1.0 - 0.24 * smoothstep(0.80, 1.0, u));
        for (int s = 0; s < 2; ++s) {
            float side = s == 0 ? -1.0 : 1.0;
            vec3 root = c + vec3(side * 0.055, -0.025, -0.055);
            vec3 joint = c + vec3(side * (0.20 + span * 0.22),
                                  0.005, -0.035 + 0.026 * stroke);
            vec3 tip = c + vec3(side * (0.26 + span),
                                0.045, 0.005 + 0.055 * stroke);
            float d0 = odaDistSeg2(st,
                odaProject(odaPose(root, t), ro, uu, vv, ww),
                odaProject(odaPose(joint, t), ro, uu, vv, ww));
            float d1 = odaDistSeg2(st,
                odaProject(odaPose(joint, t), ro, uu, vv, ww),
                odaProject(odaPose(tip, t), ro, uu, vv, ww));
            float band = 0.72 + 0.28 * sin(float(i) * 2.4 + ph * 2.0);
            float visibility = basketFade * centralLift * band;
            color += mix(PINK, ICE, 0.16) * exp(-d0 * 255.0) * 0.0180 * visibility;
            color += mix(ACID, CYAN, 0.48) * exp(-d1 * 300.0) * 0.0110 * visibility;
        }
    }
    return color;
}

vec3 odaPlankton(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
    vec3 color = vec3(0.0);
    float loop = odaPhase(t) / TAU;
    for (int i = 0; i < 42; ++i) {
        float fi = float(i);
        float lane = odaHash11(fi * 17.3);
        float speed = 1.0 + mod(fi, 4.0);
        float travel = fract(odaHash11(fi * 5.7) + loop * speed);
        vec3 p = vec3(mix(-2.2, 2.2, odaHash11(fi * 11.1)),
                      mix(-2.8, 2.8, travel),
                      mix(-1.0, 1.8, odaHash11(fi * 29.9)));
        p.x += 0.16 * sin(odaPhase(t) * speed + fi);
        p.z += 0.09 * cos(odaPhase(t) * speed + fi * 0.7);

        // A soft current bends suspended matter into the enclosed limb basket.
        float nearCrown = exp(-pow((p.y + 1.15) * 1.05, 2.0));
        p.x *= mix(1.0, 0.72, nearCrown);
        p.z *= mix(1.0, 0.78, nearCrown);
        vec2 sp = odaProject(odaPose(p, t), ro, uu, vv, ww);
        float d = length(st - sp);
        float captured = nearCrown * step(0.70, lane);
        vec3 pc = mix(CYAN, ACID, 0.30 + 0.42 * captured);
        float localField = 0.42 + 0.58 * exp(-length(sp) * 1.35);
        color += pc * exp(-d * (150.0 + 80.0 * lane))
               * (0.0020 + 0.006 * lane + 0.008 * captured) * localField;
    }
    return color;
}

vec3 odaBackground(vec2 st, float t) {
    float ph = odaPhase(t);
    float vertical = smoothstep(-1.2, 1.1, st.y);
    vec3 color = mix(DEEP + CYAN * 0.018, DEEP + CYAN * 0.050, vertical);
    float haze = odaFbm(vec3(st * 1.35 + vec2(sin(ph), cos(ph)) * 0.05,
                              sin(ph * 2.0)));
    color += mix(CYAN, ICE, 0.18) * haze * haze * 0.040;
    float caustic = pow(0.5 + 0.5 * sin(st.x * 8.0 + sin(st.y * 4.0 + ph) + ph), 8.0);
    color += CYAN * caustic * (1.0 - smoothstep(-0.8, 0.7, st.y)) * 0.012;
    color += CYAN * exp(-length(st - vec2(-0.18, -0.18)) * 2.9) * 0.050;
    float shaftAxis = abs(st.x * 0.82 + st.y * 0.34 + 0.28 + 0.05 * sin(ph));
    float shaft = pow(max(1.0 - shaftAxis, 0.0), 5.0)
                * smoothstep(-1.05, 0.70, st.y);
    color += mix(CYAN, ICE, 0.16) * shaft * 0.055;
    float heroHalo = exp(-length((st - vec2(-0.04, 0.03)) * vec2(0.86, 1.18)) * 2.35);
    color += mix(VIOLET, CYAN, 0.72) * heroHalo * 0.034;
    return color;
}

vec3 odaMaterial(float matId, vec3 p, vec3 n, vec3 rd, float t) {
    vec3 q = odaUnpose(p, t);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.7);
    float organic = odaFbm(q * 3.5 + vec3(sin(odaPhase(t)), cos(odaPhase(t)), 0.0));
    float micro = odaNoise3(q * 21.0 + vec3(3.1, 7.7, 1.9));
    if (matId < 1.5) {
        float u = odaBodyU(q);
        float segment = pow(1.0 - abs(fract(u * 30.0) - 0.5) * 2.0, 9.0);
        vec3 tissue = mix(VIOLET * 0.34 + DEEP,
                          ACID * 0.30 + VIOLET * 0.22, organic);
        tissue *= 0.88 + 0.28 * micro;
        tissue += mix(ACID, CYAN, 0.38) * fresnel * 0.20;
        tissue += ICE * segment * (0.024 + 0.055 * fresnel);
        return tissue;
    }
    if (matId < 2.5) {
        vec3 eye = DEEP * 0.24 + CYAN * 0.32;
        eye += ICE * fresnel * 0.68;
        eye += ICE * pow(max(dot(n, odaSafeNorm(vec3(-0.42, -0.72, 0.58))), 0.0), 96.0) * 0.82;
        return eye;
    }
    if (matId < 3.5) {
        return VIOLET * 0.16 + mix(PINK, ACID, 0.42) * (0.18 + 0.42 * fresnel)
             + ICE * fresnel * fresnel * 0.24;
    }
    if (matId < 4.5) {
        return DEEP + mix(PINK, ACID, 0.12) * (0.16 + 0.33 * fresnel)
             + ICE * fresnel * fresnel * 0.14;
    }
    if (matId < 5.5) {
        return VIOLET * 0.25 + mix(PINK, ACID, 0.34) * (0.10 + 0.24 * fresnel);
    }
    float shellBands = 0.5 + 0.5 * sin(q.y * 7.4 + organic * 2.8);
    float shellMottle = odaFbm(q * 7.2 + vec3(1.7, 5.1, 9.3));
    float shellFlow = odaFbm(q * 4.3 + vec3(sin(odaPhase(t)), 0.0, cos(odaPhase(t))) * 0.38);
    vec3 shell = mix(VIOLET * 0.43 + DEEP,
                     VIOLET * 0.22 + CYAN * 0.12 + ACID * 0.055, organic);
    shell *= 0.58 + 0.46 * shellMottle + 0.18 * shellFlow;
    shell += PINK * shellBands * 0.022;
    shell += mix(CYAN, ICE, 0.28) * fresnel * 0.42;
    shell += ICE * pow(fresnel, 4.0) * 0.24;
    if (matId < 6.5) return shell;
    vec3 face = mix(DEEP + VIOLET * 0.16,
                    VIOLET * 0.24 + PINK * 0.055, organic);
    face *= 0.68 + 0.30 * micro;
    face += PINK * fresnel * 0.14 + CYAN * fresnel * fresnel * 0.22;
    if (matId < 7.5) return face;
    return PINK * 0.35 + ICE * (0.20 + 0.70 * fresnel);
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t = uTimeSeconds;
    float ph = odaPhase(t);

    // Seamless anterior-to-posterior inspection orbit: the loop begins at the
    // head, travels around the side to reveal the tail, then returns forward.
    float loopT = ph / TAU;
    float frontToBack = smoothstep(0.14, 0.40, loopT);
    float backToFront = smoothstep(0.62, 0.88, loopT);
    float travel = clamp(frontToBack - backToFront, 0.0, 1.0);
    float orbitAngle = PI * travel;
    float sideReveal = sin(orbitAngle);
    float frontBack = cos(orbitAngle);
    float posteriorView = 0.5 - 0.5 * frontBack;
    vec3 target = odaPose(vec3(0.0, 0.42 - 0.14 * frontBack, -0.015), t);
    float radius = 4.72 + 0.15 * sideReveal + 0.30 * posteriorView;
    vec3 viewOffset = odaSafeNorm(vec3(
        0.25 + 0.32 * sideReveal,
       -0.64 * frontBack,
        0.73 - 0.06 * sideReveal));
    vec3 ro = target + viewOffset * radius;

    vec3 ww = odaSafeNorm(target - ro);
    vec3 cameraUp = odaSafeNorm(vec3(1.0, 0.08 + 0.018 * sin(ph * 2.0), 0.02));
    vec3 uuBase = odaSafeNorm(cross(cameraUp, ww), vec3(0.0, 1.0, 0.0));
    vec3 vvBase = odaSafeNorm(cross(ww, uuBase));
    float portraitRoll = radians(-43.0 + 3.0 * sideReveal);
    vec3 uu = uuBase * cos(portraitRoll) + vvBase * sin(portraitRoll);
    vec3 vv = -uuBase * sin(portraitRoll) + vvBase * cos(portraitRoll);
    float focalLength = 1.62 - 0.018 * sideReveal;
    vec3 rd = odaSafeNorm(uu * st.x + vv * st.y + ww * focalLength);

    vec3 color = odaBackground(st, t);
    color += odaPlankton(st, ro, uu, vv, ww, t);

    float glow, matId;
    float depth = odaRaymarch(ro, rd, t, glow, matId);
    if (depth < MAX_DIST) {
        vec3 p = ro + rd * depth;
        vec3 n = odaNormal(p, t);
        vec3 l1 = odaSafeNorm(vec3(-0.48, -0.62, 0.72));
        vec3 l2 = odaSafeNorm(vec3(0.72, 0.12, -0.42));
        float diffuse = max(dot(n, l1), 0.0);
        float fill = max(dot(n, l2), 0.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
        float ao = odaAO(p, n, t);
        vec3 base = odaMaterial(matId, p, n, rd, t);
        vec3 lit = base * (0.58 + 0.92 * diffuse + 0.42 * fill) * ao;
        vec3 halfVector = odaSafeNorm(l1 - rd);
        float eyeMaterial = (matId > 1.5 && matId < 2.5) ? 1.0 : 0.0;
        float shellMaterial = (matId > 5.5 && matId < 6.5) ? 1.0 : 0.0;
        float mouthMaterial = (matId > 2.5 && matId < 3.5) ? 1.0 : 0.0;
        float ocellusMaterial = matId > 7.5 ? 1.0 : 0.0;
        float specPower = mix(52.0, 118.0, eyeMaterial);
        float specular = pow(max(dot(n, halfVector), 0.0), specPower);
        float specAmount = 0.28 + eyeMaterial * 0.62
                         + shellMaterial * 0.24
                         + mouthMaterial * 0.18
                         + ocellusMaterial * 0.34;
        lit += ICE * specular * specAmount;
        lit += mix(CYAN, ICE, 0.24) * rim * (matId > 2.5 ? 0.20 : 0.10);
        float fog = 1.0 - exp(-depth * 0.15);
        color = mix(lit, color, fog * 0.38);
    }

    color += odaMouthpartGlow(st, ro, uu, vv, ww, t);
    color += odaLimbLatticeGlow(st, ro, uu, vv, ww, t);
    color += CYAN * glow * 0.038;
    color *= 1.72;
    float highlightPeak = max(color.r, max(color.g, color.b));
    float bloomMask = smoothstep(0.46, 0.90, highlightPeak);
    color += color * bloomMask * 0.16;
    color *= 1.0 - 0.22 * smoothstep(0.42, 1.42, length(st));
    color = color / (0.92 + color);
    color = pow(max(color, 0.0), vec3(0.82));

    float grainSeed = sin(ph) * 19.0 + cos(ph) * 37.0;
    color += (odaHash11(uv.x * 1229.0 + uv.y * 983.0 + grainSeed) - 0.5) * 0.004;
    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
