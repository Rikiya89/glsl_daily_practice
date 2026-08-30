// ================================================================
// EDIACARAN 01 — TRIBRACHIDIUM HERALDICUM
// TouchDesigner GLSL TOP fragment shader
// Procedural artistic reconstruction; 12-second seamless loop
// Three-fold radial body plan, benthic disc, spiral tissue ridges
// ================================================================

out vec4 fragColor;
uniform float uTimeSeconds;

#define MAX_STEPS 112
#define SHADOW_STEPS 28
#define MAX_DIST 13.0
#define SURF_DIST 0.0018
#define PI 3.14159265359
#define TAU 6.28318530718

// Primary art controls
const float BODY_RADIUS   = 1.58;
const float BODY_HEIGHT   = 0.24;
const float ARM_CURVE     = 1.26;
const float ARM_WIDTH     = 0.245;
const float ARM_HEIGHT    = 0.083;
const float ARM_SPIRAL    = 0.74;
const float GROOVE_DEPTH  = 0.021;
const float EDGE_WARP     = 0.022;
const float STRIAE_HEIGHT = 0.0014;
const float BREATH_AMOUNT = 0.010;
const float HEIGHT_BREATH = 0.006;
const float CENTER_LIFT   = 0.0022;
const float RIDGE_MOTION  = 0.0026;
const float LOOP_SECONDS  = 12.0;
const float CAMERA_DIST   = 4.15;
const float CAMERA_HEIGHT = 3.55;
const float CAMERA_ORBIT  = 0.096;
const float FOG_DENSITY   = 0.060;

const vec3 OCEAN_TOP    = vec3(0.055, 0.105, 0.125);
const vec3 OCEAN_BOTTOM = vec3(0.027, 0.063, 0.078);
const vec3 SEDIMENT     = vec3(0.141, 0.149, 0.137);
const vec3 AMBER        = vec3(0.612, 0.404, 0.275);
const vec3 RUST         = vec3(0.329, 0.220, 0.184);
const vec3 IVORY        = vec3(0.839, 0.765, 0.627);

mat2 triRot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float triSmin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float triSmax(float a, float b, float k) {
    return -triSmin(-a, -b, k);
}

float triHash11(float p) {
    return fract(sin(p * 127.1) * 43758.5453123);
}

float triHash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float triHash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float triNoise2(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(triHash21(i), triHash21(i + vec2(1.0, 0.0)), f.x),
               mix(triHash21(i + vec2(0.0, 1.0)),
                   triHash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

float triNoise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = triHash31(i);
    float n100 = triHash31(i + vec3(1,0,0));
    float n010 = triHash31(i + vec3(0,1,0));
    float n110 = triHash31(i + vec3(1,1,0));
    float n001 = triHash31(i + vec3(0,0,1));
    float n101 = triHash31(i + vec3(1,0,1));
    float n011 = triHash31(i + vec3(0,1,1));
    float n111 = triHash31(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
               mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float triFbm2(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; ++i) {
        v += a * triNoise2(p);
        p = triRot(0.61) * p * 2.03 + vec2(7.2, 3.8);
        a *= 0.5;
    }
    return v;
}

float triPhase(float t) {
    return TAU * fract(max(t, 0.0) / LOOP_SECONDS);
}

float triFoldAngle(float angle) {
    const float sector = TAU / 3.0;
    return mod(angle + 0.5 * sector, sector) - 0.5 * sector;
}

float triSdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

// One spiral surface pattern, repeated exactly every 120 degrees.
// It only changes the disc's top height; it can never become an appendage.
void triSurfacePattern(vec2 xz, float phase, out float ridgeMask,
                       out float valleyMask, out float ribMask) {
    float r = length(xz);
    float rn = clamp(r / BODY_RADIUS, 0.0, 1.0);
    float folded = triFoldAngle(atan(xz.y, xz.x));
    float target = ARM_SPIRAL - ARM_CURVE * rn
                 + 0.012 * sin(phase + rn * TAU);
    float delta = triFoldAngle(folded - target);
    float lateral = r * abs(sin(delta));

    float innerGate = smoothstep(0.025, 0.17, r);
    float outerGate = 1.0 - smoothstep(1.00, 1.34, r);
    float pathGate = innerGate * outerGate;
    float width = ARM_WIDTH * mix(0.66, 1.16, smoothstep(0.12, 0.54, rn));
    width *= mix(1.0, 0.65, smoothstep(0.64, 0.88, rn));

    // Rounded embedded mound: no flat core and no tubular shoulder.
    float broad = 1.0 - smoothstep(0.0, width, lateral);
    ridgeMask = pow(max(broad, 0.0), 1.10) * pathGate;

    float sideDistance = abs(lateral - width * 0.92);
    valleyMask = (1.0 - smoothstep(0.018, 0.070, sideDistance)) * pathGate;

    float ribWave = 0.5 + 0.5 * cos(rn * TAU * 5.0 + delta * 1.35);
    ribMask = pow(ribWave, 6.0) * ridgeMask
            * smoothstep(0.22, 0.38, rn)
            * (1.0 - smoothstep(0.72, 0.86, rn));
}

float triBodyField(vec3 p, float phase, out float armMask) {
    float r = length(p.xz);
    float angle = atan(p.z, p.x);
    float breathWave = cos(phase);
    float breath = 1.0 + BREATH_AMOUNT * breathWave;
    float heightBreath = 1.0 + HEIGHT_BREATH * breathWave;
    float edgeShape = 1.0
                    + EDGE_WARP * sin(3.0 * angle + 0.10 * sin(phase))
                    + 0.006 * sin(6.0 * angle - 0.45);
    float radius = BODY_RADIUS * breath * edgeShape;
    float rn = clamp(r / max(radius, 1e-4), 0.0, 1.0);
    float taper = sqrt(max(1.0 - rn * rn, 0.0));

    float ridgeMask;
    float valleyMask;
    float ribMask;
    triSurfacePattern(p.xz / breath, phase, ridgeMask, valleyMask, ribMask);
    armMask = ridgeMask;

    // Thin tapered disc: all dorsal anatomy is part of this single height field.
    float edgeMask = 1.0 - smoothstep(radius - 0.42, radius - 0.17, r);
    float top = -0.105 + BODY_HEIGHT * heightBreath * taper;
    top += CENTER_LIFT * breathWave * taper * taper;
    top += ARM_HEIGHT * ridgeMask * edgeMask;
    top -= GROOVE_DEPTH * valleyMask * edgeMask;
    top -= 0.0055 * ribMask * edgeMask;

    // Broad continuous junction: three ridges resolve into one tissue structure.
    float centerFalloff = exp(-dot(p.xz, p.xz) / 0.225);
    float centerShape = 0.96 + 0.04 * cos(3.0 * angle - 0.32);
    float centerJunction = 0.021 * centerFalloff * centerShape;
    float centerSoftening = -0.0025 * exp(-dot(p.xz, p.xz) / 0.038);
    top += centerJunction + centerSoftening;

    // Restrained hand-shaped asymmetry, kept below the primary anatomy.
    float irregular = 0.0035 * sin(2.0 * angle + 0.35) * sin(PI * rn);
    top += irregular * smoothstep(0.0, 0.28, r) * edgeMask;
    float tissueGate = smoothstep(0.28, 0.52, r)
                     * (1.0 - smoothstep(radius - 0.36, radius - 0.14, r));
    float radialStriae = sin(12.0 * angle + 1.30 * rn);
    top += STRIAE_HEIGHT * radialStriae * tissueGate
         * (1.0 - 0.55 * ridgeMask);
    top += RIDGE_MOTION * sin(phase + rn * TAU) * ridgeMask;

    float bottom = -0.105 - 0.055 * taper;
    float verticalField = max(p.y - top, bottom - p.y);
    float radialField = (r - radius) * 0.72;
    return triSmax(verticalField, radialField, 0.026);
}

float mapTribrachidium(vec3 p, float phase, out float armMask) {
    return triBodyField(p, phase, armMask);
}

float triSeafloor(vec3 p) {
    float broad = (triFbm2(p.xz * 0.22) - 0.5) * 0.032;
    float depression = -0.028 * exp(-0.72 * dot(p.xz, p.xz));
    return p.y + 0.18 - broad - depression;
}

vec2 mapScene(vec3 p, float phase) {
    float armMask;
    float creature = mapTribrachidium(p, phase, armMask);
    float floorD = triSeafloor(p);
    return creature < floorD ? vec2(creature, 1.0) : vec2(floorD, 2.0);
}

vec3 triNormal(vec3 p, float phase) {
    const float e = 0.0028;
    vec2 h = vec2(e, 0.0);
    return normalize(vec3(
        mapScene(p + h.xyy, phase).x - mapScene(p - h.xyy, phase).x,
        mapScene(p + h.yxy, phase).x - mapScene(p - h.yxy, phase).x,
        mapScene(p + h.yyx, phase).x - mapScene(p - h.yyx, phase).x));
}

float triAO(vec3 p, vec3 n, float phase) {
    float occ = 0.0;
    float scale = 1.0;
    for (int i = 1; i <= 5; ++i) {
        float h = 0.035 * float(i);
        float d = mapScene(p + n * h, phase).x;
        occ += (h - d) * scale;
        scale *= 0.68;
    }
    return clamp(1.0 - occ * 2.65, 0.22, 1.0);
}

float triSoftShadow(vec3 ro, vec3 rd, float phase) {
    float shade = 1.0;
    float t = 0.025;
    for (int i = 0; i < SHADOW_STEPS; ++i) {
        float h = mapScene(ro + rd * t, phase).x;
        shade = min(shade, 18.0 * h / max(t, 0.02));
        t += clamp(h, 0.018, 0.22);
        if (h < 0.001 || t > 7.0) break;
    }
    return clamp(shade, 0.18, 1.0);
}

float triRaymarch(vec3 ro, vec3 rd, float phase, out float matId) {
    float t = 0.0;
    matId = 0.0;
    for (int i = 0; i < MAX_STEPS; ++i) {
        vec2 hit = mapScene(ro + rd * t, phase);
        if (hit.x < SURF_DIST * (1.0 + 0.10 * t)) {
            matId = hit.y;
            return t;
        }
        t += max(hit.x * 0.72, 0.0008);
        if (t > MAX_DIST) break;
    }
    return MAX_DIST;
}

float triRidgeMask(vec3 p, float phase) {
    float ridgeMask;
    float valleyMask;
    float ribMask;
    triSurfacePattern(p.xz, phase, ridgeMask, valleyMask, ribMask);
    return ridgeMask;
}

vec3 triCreatureMaterial(vec3 p, vec3 n, vec3 rd, float phase) {
    float ridge;
    float valley;
    float ribs;
    triSurfacePattern(p.xz, phase, ridge, valley, ribs);
    float r = length(p.xz) / BODY_RADIUS;
    float cellular = 0.5 + 0.5 * sin(2.8 * r + 0.45 * sin(3.0 * atan(p.z, p.x))
                                   + 0.08 * cos(phase));
    float microBreakup = triNoise2(p.xz * 9.0);
    float upwardFacing = clamp(n.y, 0.0, 1.0);
    vec3 base = AMBER * mix(0.94, 1.055, cellular);
    base = mix(base, RUST, clamp(valley * 0.58 + ribs * 0.10, 0.0, 0.68));
    base = mix(base, IVORY, clamp(ridge * 0.46, 0.0, 0.54));
    base *= mix(0.92, 1.07, upwardFacing);
    base *= mix(0.99, 1.01, microBreakup);
    base *= mix(1.02, 0.84, smoothstep(0.78, 1.02, r));
    float ridgeCrown = smoothstep(0.52, 0.92, ridge);
    float ridgeShoulder = 4.0 * ridge * (1.0 - ridge);
    base *= 1.0 + 0.032 * ridgeCrown - 0.018 * ridgeShoulder;

    vec3 lightDir = normalize(vec3(-0.58, 0.76, 0.30));
    vec3 halfDir = normalize(lightDir - rd);
    float diff = max(dot(n, lightDir), 0.0);
    float shadow = triSoftShadow(p + n * 0.008, lightDir, phase);
    float ao = triAO(p, n, phase);
    float spec = pow(max(dot(n, halfDir), 0.0), 10.5)
               * mix(0.030, 0.044, microBreakup);
    float fres = pow(1.0 + dot(n, rd), 3.0);
    float subsurface = pow(clamp(dot(-n, lightDir) * 0.5 + 0.5, 0.0, 1.0), 2.0);

    float centerOcclusion = exp(-dot(p.xz, p.xz) / 0.18);
    float valleyOcclusion = 1.0
                          - 0.11 * clamp(valley + ribs * 0.30, 0.0, 1.0)
                          - 0.035 * ridgeShoulder
                          - 0.018 * centerOcclusion;
    vec3 col = base * (0.52 + 1.44 * diff * shadow) * mix(0.60, 1.0, ao)
             * valleyOcclusion;
    col += vec3(0.42, 0.27, 0.18) * subsurface * 0.14;
    col += vec3(0.92, 0.79, 0.61) * spec * shadow;
    col += vec3(0.365, 0.718, 0.780) * fres * 0.050;
    return col;
}

vec3 triFloorMaterial(vec3 p, vec3 n, vec3 rd, float phase) {
    vec3 lightDir = normalize(vec3(-0.58, 0.76, 0.30));
    float diff = max(dot(n, lightDir), 0.0);
    float shadow = triSoftShadow(p + n * 0.008, lightDir, phase);
    float grain = triFbm2(p.xz * 0.34);
    vec3 base = SEDIMENT * mix(0.95, 1.04, grain);
    float contact = exp(-0.86 * dot(p.xz, p.xz));
    float contactCore = exp(-3.20 * dot(p.xz, p.xz));
    base *= 1.0 - 0.26 * contact - 0.12 * contactCore;
    return base * (0.48 + 0.82 * diff * shadow);
}

vec3 triBackground(vec2 st, vec3 rd, float phase) {
    float horizon = smoothstep(-0.24, 0.75, rd.y);
    vec3 col = mix(OCEAN_BOTTOM, OCEAN_TOP, horizon);
    float shaft = pow(max(0.0, sin(st.x * 2.6 + st.y * 0.75 - 0.7)), 10.0);
    col += vec3(0.08, 0.15, 0.17) * shaft * smoothstep(-0.4, 0.7, st.y) * 0.20;

    // Broad haze only: no isolated bright particles competing with the subject.
    float haze = exp(-2.8 * dot(st - vec2(-0.18, 0.24),
                                st - vec2(-0.18, 0.24)));
    col += vec3(0.035, 0.065, 0.072) * haze * 0.055;
    return col;
}

void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float phase = triPhase(uTimeSeconds);
    float orbit = -0.52 + CAMERA_ORBIT * sin(phase);
    float camLift = CAMERA_HEIGHT + 0.07 * sin(phase);
    vec3 target = vec3(0.0, -0.01, 0.0);
    vec3 ro = vec3(sin(orbit) * CAMERA_DIST, camLift,
                   cos(orbit) * CAMERA_DIST);
    vec3 ww = normalize(target - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uu * st.x + vv * st.y + ww * 1.82);

    vec3 color = triBackground(st, rd, phase);
    float matId;
    float travel = triRaymarch(ro, rd, phase, matId);
    if (travel < MAX_DIST) {
        vec3 p = ro + rd * travel;
        vec3 n = triNormal(p, phase);
        vec3 surface = matId < 1.5
            ? triCreatureMaterial(p, n, rd, phase)
            : triFloorMaterial(p, n, rd, phase);
        float fog = 1.0 - exp(-travel * FOG_DENSITY);
        vec3 fogColor = mix(OCEAN_BOTTOM, OCEAN_TOP, 0.44 + 0.30 * rd.y);
        color = mix(surface, fogColor, clamp(fog, 0.0, 0.82));
    }

    // Mobile-readable grade: warm subject, lifted shadows, no bloom dependency.
    color *= vec3(1.34, 1.28, 1.20);
    color = color / (color + vec3(0.64));
    color = pow(max(color, 0.0), vec3(0.90));
    float vignette = 1.0 - 0.12 * dot(st * vec2(0.58, 0.44), st * vec2(0.58, 0.44));
    color *= clamp(vignette, 0.84, 1.0);
    float grain = triHash21(gl_FragCoord.xy) - 0.5;
    color += grain * 0.004;

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
