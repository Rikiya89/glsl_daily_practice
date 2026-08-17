// ================================================================
// TAMISIOCARIS BOREALIS — CAMBRIAN FILTER SIGNAL
// TouchDesigner GLSL TOP fragment shader
// 10-second seamless procedural raymarched animation
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z
// ================================================================

out vec4 fragColor;
uniform float uTimeSeconds;

#define MAX_STEPS 104
#define MAX_DIST  14.0
#define SURF_DIST 0.0014
#define PI  3.14159265359
#define TAU 6.28318530718

// Exact palette preserved from the existing project.
const vec3 ACID   = vec3(0.0,   1.0,   0.624);
const vec3 CYAN   = vec3(0.0,   0.812, 1.0);
const vec3 VIOLET = vec3(0.545, 0.0,   1.0);
const vec3 PINK   = vec3(1.0,   0.0,   0.431);
const vec3 ICE    = vec3(0.78,  0.96,  1.00);
const vec3 DEEP   = vec3(0.001, 0.003, 0.008);

mat2 tamRot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 tamSafeNorm(vec3 v, vec3 fallback) {
    float d = dot(v, v);
    return d < 1e-10 ? fallback : v * inversesqrt(d);
}

vec3 tamSafeNorm(vec3 v) {
    return tamSafeNorm(v, vec3(0.0, 0.0, 1.0));
}

float tamHash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
}

float tamHash13(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float tamNoise3(vec3 x) {
    vec3 p = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(tamHash13(p), tamHash13(p + vec3(1,0,0)), f.x),
            mix(tamHash13(p + vec3(0,1,0)), tamHash13(p + vec3(1,1,0)), f.x), f.y),
        mix(mix(tamHash13(p + vec3(0,0,1)), tamHash13(p + vec3(1,0,1)), f.x),
            mix(tamHash13(p + vec3(0,1,1)), tamHash13(p + vec3(1,1,1)), f.x), f.y),
        f.z);
}

float tamFbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; ++i) {
        v += a * tamNoise3(p);
        p = p * 2.03 + vec3(7.1, 13.7, 5.3);
        a *= 0.51;
    }
    return v;
}

float tamPhase(float t) {
    return TAU * fract(t / 10.0);
}

float tamSdSphere(vec3 p, float r) {
    return length(p) - r;
}

float tamSdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float tamSdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

float tamSdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float tamSmin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

vec2 tamUnion(vec2 a, vec2 b) {
    return b.x < a.x ? b : a;
}

float tamDistSeg2(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

vec3 tamPose(vec3 p, float t) {
    float ph = tamPhase(t);
    p.xz = tamRot(radians(6.0) * sin(ph)) * p.xz;
    p.xy = tamRot(0.028 * sin(ph * 2.0)) * p.xy;
    p += vec3(0.025 * sin(ph), 0.018 * cos(ph), 0.018 * cos(ph));
    return p;
}

vec3 tamUnpose(vec3 p, float t) {
    float ph = tamPhase(t);
    p -= vec3(0.025 * sin(ph), 0.018 * cos(ph), 0.018 * cos(ph));
    p.xy = tamRot(-0.028 * sin(ph * 2.0)) * p.xy;
    p.xz = tamRot(-radians(6.0) * sin(ph)) * p.xz;
    return p;
}

vec3 tamBodyCenter(float u, float t) {
    float ph = tamPhase(t);
    float tailWeight = smoothstep(0.12, 1.0, u);
    float wave = ph * 2.0 - u * TAU * 1.22;
    return vec3(0.075 * sin(wave) * tailWeight,
                mix(-0.52, 1.72, u),
                0.035 * cos(wave) * tailWeight);
}

float tamBodyWidth(float u) {
    float profile = pow(max(sin(PI * clamp(u * 0.94 + 0.045, 0.0, 1.0)), 0.0), 0.50);
    return (0.090 + 0.365 * profile) * (1.0 - 0.66 * smoothstep(0.70, 1.0, u));
}

float tamBodyHeight(float u) {
    float profile = pow(max(sin(PI * clamp(u * 0.95 + 0.035, 0.0, 1.0)), 0.0), 0.62);
    return (0.060 + 0.165 * profile) * (1.0 - 0.52 * smoothstep(0.72, 1.0, u));
}

float tamBodyU(vec3 q) {
    return clamp((q.y + 0.52) / 2.24, 0.0, 1.0);
}

float tamBodySDF(vec3 q, float t) {
    float u = tamBodyU(q);
    vec3 c = tamBodyCenter(u, t);
    vec3 r = q - c;
    float w = tamBodyWidth(u);
    float h = tamBodyHeight(u);
    float crossD = (length(vec2(r.x / w, r.z / h)) - 1.0) * min(w, h);
    float front = tamBodyCenter(0.0, t).y - q.y;
    float rear = q.y - tamBodyCenter(1.0, t).y;
    float d = max(crossD, max(front, rear));
    float ring = exp(-pow(abs(fract(u * 15.0) - 0.5) * 9.0, 2.0));
    return d + ring * 0.010 * smoothstep(0.08, 0.86, u);
}

float tamHeadSDF(vec3 q, float t) {
    vec3 c = tamBodyCenter(0.025, t) + vec3(0.0, -0.18, 0.015);
    return tamSdEllipsoid(q - c, vec3(0.47, 0.35, 0.22));
}

float tamEyesSDF(vec3 q, float t) {
    vec3 c = tamBodyCenter(0.015, t) + vec3(0.0, -0.27, 0.105);
    float leftEye = tamSdSphere(q - c - vec3(-0.35, 0.0, 0.03), 0.062);
    float rightEye = tamSdSphere(q - c - vec3(0.35, 0.0, 0.03), 0.062);
    return min(leftEye, rightEye);
}

vec3 tamFilterArmPoint(float side, float v, float t) {
    float ph = tamPhase(t);
    vec3 head = tamBodyCenter(0.01, t);
    float arc = sin(PI * v);
    float flow = sin(ph * 2.0 - v * 3.2 + side * 0.44)
               + 0.35 * sin(ph * 3.0 + v * 5.1);
    return head
         + vec3(side * (0.19 + 0.14 * v + 0.045 * arc),
                -0.25 - 1.55 * v + 0.12 * v * v,
                -0.025 + 0.075 * arc + 0.015 * flow * v);
}

vec3 tamFilterSpineTip(float side, float v, float t) {
    float ph = tamPhase(t);
    vec3 root = tamFilterArmPoint(side, v, t);
    float fan = sin(PI * clamp(v * 1.05, 0.0, 1.0));
    float flow = sin(ph * 2.0 - v * 5.0 + side * 0.4)
               + 0.35 * sin(ph * 3.0 + v * 8.0);
    return root + vec3(-0.29 - 0.12 * fan,
                       0.025 + 0.07 * fan,
                       -0.055 - 0.025 * flow);
}

float tamFilterSDF(vec3 q, float t) {
    float d = 1e5;
    for (int s = 0; s < 2; ++s) {
        float side = s == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 7; ++i) {
            float a = float(i) / 7.0;
            float b = float(i + 1) / 7.0;
            d = min(d, tamSdTaperedCapsule(q,
                tamFilterArmPoint(side, a, t), tamFilterArmPoint(side, b, t),
                mix(0.070, 0.026, a), mix(0.070, 0.026, b)));
        }
        for (int i = 1; i < 8; ++i) {
            float v = float(i) / 8.0;
            d = min(d, tamSdTaperedCapsule(q,
                tamFilterArmPoint(side, v, t), tamFilterSpineTip(side, v, t),
                0.026, 0.008));
        }
    }
    return d;
}

float tamFlapsSDF(vec3 q, float t) {
    float d = 1e5;
    float ph = tamPhase(t);
    for (int i = 0; i < 9; ++i) {
        float u = (float(i) + 1.25) / 11.2;
        vec3 c = tamBodyCenter(u, t);
        float phase = ph * 2.0 - float(i) * 0.72;
        float stroke = sin(phase);
        float span = (0.28 + 0.19 * sin(PI * u));
        for (int s = 0; s < 2; ++s) {
            float side = s == 0 ? -1.0 : 1.0;
            vec3 flapCenter = c + vec3(side * (tamBodyWidth(u) + span * 0.32),
                                       span * 0.22,
                                       0.055 * stroke);
            vec3 p = q - flapCenter;
            p.yz = tamRot(-stroke * side * 0.24) * p.yz;
            p.xy = tamRot(-side * (0.50 + 0.08 * stroke)) * p.xy;
            d = min(d, tamSdEllipsoid(p, vec3(span, 0.145, 0.034)));
        }
    }
    return d;
}

float tamTailSDF(vec3 q, float t) {
    vec3 c = tamBodyCenter(0.98, t);
    float ph = tamPhase(t);
    float d = 1e5;
    for (int i = -1; i <= 1; ++i) {
        float fi = float(i);
        float angle = fi * (0.34 + 0.025 * sin(ph * 2.0));
        vec3 p = q - c;
        p.xy = tamRot(-angle) * p.xy;
        p.xz = tamRot(-0.08 * sin(ph * 2.0 + fi)) * p.xz;
        d = min(d, tamSdEllipsoid(p - vec3(0.0, 0.31, 0.0),
                                  vec3(0.080, 0.40, 0.035)));
    }
    return d;
}

vec2 tamSceneMap(vec3 worldP, float t) {
    vec3 q = tamUnpose(worldP, t);
    float body = tamSmin(tamBodySDF(q, t), tamHeadSDF(q, t), 0.12);
    vec2 result = vec2(body, 1.0);
    result = tamUnion(result, vec2(tamEyesSDF(q, t), 2.0));
    result = tamUnion(result, vec2(tamFilterSDF(q, t), 3.0));
    result = tamUnion(result, vec2(tamFlapsSDF(q, t), 4.0));
    result = tamUnion(result, vec2(tamTailSDF(q, t), 5.0));
    return result;
}

vec3 tamNormal(vec3 p, float t) {
    vec2 e = vec2(0.0018, 0.0);
    return tamSafeNorm(vec3(
        tamSceneMap(p + e.xyy, t).x - tamSceneMap(p - e.xyy, t).x,
        tamSceneMap(p + e.yxy, t).x - tamSceneMap(p - e.yxy, t).x,
        tamSceneMap(p + e.yyx, t).x - tamSceneMap(p - e.yyx, t).x));
}

float tamAO(vec3 p, vec3 n, float t) {
    float occ = 0.0;
    float scale = 1.0;
    for (int i = 0; i < 3; ++i) {
        float h = 0.035 + 0.075 * float(i);
        occ += (h - tamSceneMap(p + n * h, t).x) * scale;
        scale *= 0.56;
    }
    return clamp(1.0 - occ * 2.1, 0.22, 1.0);
}

float tamRaymarch(vec3 ro, vec3 rd, float t, out float glow, out float matId) {
    float depth = 0.0;
    glow = 0.0;
    matId = 0.0;
    for (int i = 0; i < MAX_STEPS; ++i) {
        vec3 p = ro + rd * depth;
        vec2 hit = tamSceneMap(p, t);
        glow += exp(-abs(hit.x) * 25.0) * 0.0022;
        if (hit.x < SURF_DIST || depth > MAX_DIST) {
            matId = hit.y;
            break;
        }
        depth += max(hit.x * 0.72, 0.00065);
    }
    return depth;
}

vec2 tamProject(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
    vec3 r = p - ro;
    float z = max(dot(r, ww), 0.05);
    return vec2(dot(r, uu), dot(r, vv)) / z;
}

vec3 tamFilterLineGlow(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
    vec3 color = vec3(0.0);
    float pulse = 0.82 + 0.18 * sin(tamPhase(t) * 3.0);
    for (int s = 0; s < 2; ++s) {
        float side = s == 0 ? -1.0 : 1.0;
        for (int i = 0; i < 14; ++i) {
            float a = float(i) / 14.0;
            float b = float(i + 1) / 14.0;
            vec2 p0 = tamProject(tamPose(tamFilterArmPoint(side, a, t), t), ro, uu, vv, ww);
            vec2 p1 = tamProject(tamPose(tamFilterArmPoint(side, b, t), t), ro, uu, vv, ww);
            float d = tamDistSeg2(st, p0, p1);
            color += mix(CYAN, ACID, 0.26) * exp(-d * 330.0) * 0.022 * pulse;
        }
        for (int i = 1; i < 15; ++i) {
            float v = float(i) / 15.0;
            vec3 root3 = tamFilterArmPoint(side, v, t);
            vec3 tip3 = tamFilterSpineTip(side, v, t);
            vec2 root = tamProject(tamPose(root3, t), ro, uu, vv, ww);
            vec2 tip = tamProject(tamPose(tip3, t), ro, uu, vv, ww);
            float mainD = tamDistSeg2(st, root, tip);
            color += mix(CYAN, ICE, 0.48) * exp(-mainD * 370.0) * 0.022 * pulse;

            // Three fine seta bands imply a dense filtering lattice without
            // adding hundreds of SDF primitives to every raymarch step.
            vec3 tangent = tamSafeNorm(tip3 - root3, vec3(0.0, 0.0, -1.0));
            for (int j = 0; j < 3; ++j) {
                float fj = (float(j) + 1.0) / 4.0;
                vec3 m = mix(root3, tip3, fj);
                float flow = sin(tamPhase(t) * 2.0 + v * 9.0 + fj * 4.0);
                vec3 e = m + vec3(side * (0.13 + 0.035 * flow), 0.045, 0.018 * flow)
                         + tangent * 0.035;
                float setaD = tamDistSeg2(st,
                    tamProject(tamPose(m, t), ro, uu, vv, ww),
                    tamProject(tamPose(e, t), ro, uu, vv, ww));
                color += mix(ACID, ICE, 0.42) * exp(-setaD * 440.0) * 0.010;
            }
        }
    }
    return color;
}

vec3 tamPlankton(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
    vec3 color = vec3(0.0);
    float loop = tamPhase(t) / TAU;
    for (int i = 0; i < 52; ++i) {
        float fi = float(i);
        float lane = tamHash11(fi * 17.3);
        float speed = 1.0 + mod(fi, 4.0);
        float travel = fract(tamHash11(fi * 5.7) + loop * speed);
        vec3 p = vec3(mix(-2.2, 2.2, tamHash11(fi * 11.1)),
                      mix(-2.8, 2.8, travel),
                      mix(-1.0, 1.8, tamHash11(fi * 29.9)));
        p.x += 0.16 * sin(tamPhase(t) * speed + fi);
        p.z += 0.09 * cos(tamPhase(t) * speed + fi * 0.7);

        // Current converges toward the frontal sieve, then relaxes downstream.
        float nearFilter = exp(-pow((p.y + 1.15) * 1.05, 2.0));
        p.x *= mix(1.0, 0.62, nearFilter);
        p.z *= mix(1.0, 0.72, nearFilter);
        vec2 sp = tamProject(tamPose(p, t), ro, uu, vv, ww);
        float d = length(st - sp);
        float captured = nearFilter * step(0.70, lane);
        vec3 pc = mix(CYAN, ACID, 0.30 + 0.42 * captured);
        color += pc * exp(-d * (150.0 + 80.0 * lane))
               * (0.0025 + 0.008 * lane + 0.010 * captured);
    }
    return color;
}

vec3 tamBackground(vec2 st, float t) {
    float ph = tamPhase(t);
    float vertical = smoothstep(-1.2, 1.1, st.y);
    vec3 color = mix(DEEP + CYAN * 0.004, VIOLET * 0.038 + DEEP, vertical);
    float haze = tamFbm(vec3(st * 1.35 + vec2(sin(ph), cos(ph)) * 0.05,
                              sin(ph * 2.0)));
    color += mix(VIOLET, CYAN, 0.62) * haze * haze * 0.021;
    float caustic = pow(0.5 + 0.5 * sin(st.x * 8.0 + sin(st.y * 4.0 + ph) + ph), 8.0);
    color += CYAN * caustic * (1.0 - smoothstep(-0.8, 0.7, st.y)) * 0.004;
    color += CYAN * exp(-length(st - vec2(0.0, -0.12)) * 3.9) * 0.024;
    return color;
}

vec3 tamMaterial(float matId, vec3 p, vec3 n, vec3 rd, float t) {
    vec3 q = tamUnpose(p, t);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.7);
    float organic = tamFbm(q * 3.5 + vec3(sin(tamPhase(t)), cos(tamPhase(t)), 0.0));
    float micro = tamNoise3(q * 21.0 + vec3(3.1, 7.7, 1.9));
    if (matId < 1.5) {
        float u = tamBodyU(q);
        float segment = pow(1.0 - abs(fract(u * 15.0) - 0.5) * 2.0, 9.0);
        vec3 tissue = mix(DEEP + CYAN * 0.012,
                          VIOLET * 0.145 + CYAN * 0.026 + DEEP, organic);
        tissue *= 0.82 + 0.32 * micro;
        tissue += mix(VIOLET, CYAN, 0.72) * fresnel * 0.25;
        tissue += ICE * segment * (0.018 + 0.045 * fresnel);
        return tissue;
    }
    if (matId < 2.5) {
        return DEEP * 0.4 + PINK * 0.13 + ICE * fresnel * 0.45;
    }
    if (matId < 3.5) {
        return DEEP + mix(CYAN, ACID, 0.24) * (0.10 + 0.52 * fresnel)
             + ICE * fresnel * fresnel * 0.31;
    }
    if (matId < 4.5) {
        return DEEP + mix(VIOLET, CYAN, 0.72) * (0.075 + 0.29 * fresnel)
             + ICE * fresnel * fresnel * 0.17;
    }
    return DEEP + mix(PINK, CYAN, 0.56) * (0.045 + 0.20 * fresnel);
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t = uTimeSeconds;
    float ph = tamPhase(t);

    // Frontal three-quarter presentation: the camera sits on the anterior -Y
    // side so the filtering combs dominate the foreground and the trunk
    // recedes behind them instead of reading as a dorsal plan view.
    float travel = 0.5 - 0.5 * cos(ph);
    float sideReveal = sin(PI * travel);
    vec3 target = tamPose(vec3(0.0, 0.02 - 0.06 * sideReveal, -0.015), t);
    float radius = 5.95 + 0.16 * sideReveal;
    vec3 viewOffset = tamSafeNorm(vec3(
        0.22 + 0.055 * sin(ph * 2.0),
       -0.78 + 0.10 * sideReveal,
        0.59 - 0.055 * sideReveal));
    vec3 ro = target + viewOffset * radius;

    vec3 ww = tamSafeNorm(target - ro);
    vec3 cameraUp = tamSafeNorm(vec3(1.0, 0.08 + 0.018 * sin(ph * 2.0), 0.02));
    vec3 uuBase = tamSafeNorm(cross(cameraUp, ww), vec3(0.0, 1.0, 0.0));
    vec3 vvBase = tamSafeNorm(cross(ww, uuBase));
    float portraitRoll = radians(-32.0 + 2.0 * sin(ph));
    vec3 uu = uuBase * cos(portraitRoll) + vvBase * sin(portraitRoll);
    vec3 vv = -uuBase * sin(portraitRoll) + vvBase * cos(portraitRoll);
    float focalLength = 1.55 - 0.025 * sideReveal;
    vec3 rd = tamSafeNorm(uu * st.x + vv * st.y + ww * focalLength);

    vec3 color = tamBackground(st, t);
    color += tamPlankton(st, ro, uu, vv, ww, t);

    float glow, matId;
    float depth = tamRaymarch(ro, rd, t, glow, matId);
    if (depth < MAX_DIST) {
        vec3 p = ro + rd * depth;
        vec3 n = tamNormal(p, t);
        vec3 l1 = tamSafeNorm(vec3(-0.55, -0.48, 0.72));
        vec3 l2 = tamSafeNorm(vec3(0.62, 0.18, -0.58));
        float diffuse = max(dot(n, l1), 0.0);
        float fill = max(dot(n, l2), 0.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
        float ao = tamAO(p, n, t);
        vec3 base = tamMaterial(matId, p, n, rd, t);
        vec3 lit = base * (0.42 + 0.84 * diffuse + 0.32 * fill) * ao;
        vec3 halfVector = tamSafeNorm(l1 - rd);
        float specPower = matId > 2.5 && matId < 3.5 ? 88.0 : 48.0;
        float specular = pow(max(dot(n, halfVector), 0.0), specPower);
        lit += ICE * specular * (matId > 2.5 && matId < 3.5 ? 0.76 : 0.28);
        lit += CYAN * rim * (matId > 2.5 ? 0.25 : 0.08);
        float fog = 1.0 - exp(-depth * 0.15);
        color = mix(lit, color, fog * 0.38);
    }

    color += tamFilterLineGlow(st, ro, uu, vv, ww, t);
    color += CYAN * glow * 0.038;
    color *= 1.62;
    color += pow(max(color, 0.0), vec3(1.40)) * 0.083;
    color *= 1.0 - 0.22 * smoothstep(0.42, 1.42, length(st));
    color = color / (0.84 + color);
    color = pow(max(color, 0.0), vec3(0.86));

    float grainSeed = sin(ph) * 19.0 + cos(ph) * 37.0;
    color += (tamHash11(uv.x * 1229.0 + uv.y * 983.0 + grainSeed) - 0.5) * 0.004;
    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
