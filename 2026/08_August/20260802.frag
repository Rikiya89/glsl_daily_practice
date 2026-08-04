// ===============================================================
// NECTOCARIS PTERYX - NEON JET SWIMMER
// TouchDesigner GLSL TOP fragment shader
// Seamless 10-second procedural raymarched animation.
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z.
// ===============================================================

out vec4 fragColor;
// TouchDesigner GLSL TOP Vector uniform.
// Set uTimeSeconds to the parameter expression: absTime.seconds
uniform float uTimeSeconds;

// 1. CONSTANTS AND PALETTE
#define MAX_STEPS 152
#define MAX_DIST  15.0
#define SURF_DIST 0.0010
#define PI        3.14159265359
#define TAU       6.28318530718

const vec3 ACID   = vec3(0.0,   1.0,   0.624);
const vec3 CYAN   = vec3(0.0,   0.812, 1.0);
const vec3 VIOLET = vec3(0.545, 0.0,   1.0);
const vec3 PINK   = vec3(1.0,   0.0,   0.431);

// 2. UTILITY FUNCTIONS
mat2 necRot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec3 necSafeNormalize(vec3 v, vec3 fallback) {
  float l2 = dot(v, v);
  return l2 < 1e-10 ? fallback : v * inversesqrt(l2);
}

vec3 necSafeNormalize(vec3 v) {
  return necSafeNormalize(v, vec3(0.0, 0.0, 1.0));
}

float necHash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

float necHash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float necDistSeg2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 necPalette(float x) {
  x = fract(x);
  if (x < 0.25) return mix(ACID, CYAN, x * 4.0);
  if (x < 0.50) return mix(CYAN, VIOLET, (x - 0.25) * 4.0);
  if (x < 0.75) return mix(VIOLET, PINK, (x - 0.50) * 4.0);
  return mix(PINK, ACID, (x - 0.75) * 4.0);
}

// 3. NOISE AND FBM
float necNoise3(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(necHash13(p), necHash13(p + vec3(1,0,0)), f.x),
        mix(necHash13(p + vec3(0,1,0)), necHash13(p + vec3(1,1,0)), f.x), f.y),
    mix(mix(necHash13(p + vec3(0,0,1)), necHash13(p + vec3(1,0,1)), f.x),
        mix(necHash13(p + vec3(0,1,1)), necHash13(p + vec3(1,1,1)), f.x), f.y),
    f.z);
}

float necFbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * necNoise3(p);
    p = p * 2.04 + vec3(17.3, 9.1, 5.7);
    a *= 0.52;
  }
  return v;
}

// 4. SDF PRIMITIVES
float necSdSphere(vec3 p, float r) {
  return length(p) - r;
}

float necSdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float necSdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float necSdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 0.00001);
}

float necSdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// 5. SMOOTH BOOLEAN OPERATIONS
float necSmin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec2 necUnion(vec2 a, vec2 b) {
  return b.x < a.x ? b : a;
}

vec2 necSmoothUnion(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec2(mix(b.x, a.x, h) - k * h * (1.0 - h),
              h > 0.5 ? a.y : b.y);
}

// 6. LOOP PHASE AND MOTION SIGNALS
float necPhase(float t) {
  return TAU * fract(t / 10.0);
}

float necJetPulse(float t) {
  float ph = necPhase(t);
  float d = abs(atan(sin(ph - 3.1), cos(ph - 3.1)));
  return exp(-d * d * 12.0);
}

float necFinPhase(float u, float t) {
  return necPhase(t) * 2.0 - u * TAU * 1.45;
}

float necBank(float t) {
  float ph = necPhase(t);
  float loopLobe = 0.5 - 0.5 * cos(ph);
  float lateBias = 0.55 + 0.45 * smoothstep(-0.25, 0.85, -sin(ph));
  return radians(38.0) * loopLobe * lateBias;
}

vec3 necPosePoint(vec3 p, float t) {
  float ph = necPhase(t);
  float bank = necBank(t);
  p.xz = necRot(bank) * p.xz;
  p.xy = necRot(0.045 * sin(ph) + 0.025 * sin(ph * 2.0)) * p.xy;
  p += vec3(0.05 * sin(ph), -0.18 * necJetPulse(t), 0.035 * cos(ph));
  return p;
}

vec3 necUnposePoint(vec3 p, float t) {
  float ph = necPhase(t);
  p -= vec3(0.05 * sin(ph), -0.18 * necJetPulse(t), 0.035 * cos(ph));
  p.xy = necRot(-0.045 * sin(ph) - 0.025 * sin(ph * 2.0)) * p.xy;
  p.xz = necRot(-necBank(t)) * p.xz;
  return p;
}

// 7. BODY FRAME AND ANATOMY FIELDS
struct BodyFrame {
  vec3 c;
  vec3 tangent;
  vec3 side;
  vec3 dorsal;
};

vec3 necBodyCenter(float u, float t) {
  float ph = necPhase(t);
  float tail = smoothstep(0.62, 1.0, u);
  float steer = sin(ph - 0.65) * tail * tail;
  return vec3(0.13 * steer,
              mix(-0.76, 1.38, u),
              0.035 * sin(ph * 2.0 + u * PI) + 0.10 * steer);
}

float necBodyWidth(float u, float t) {
  float head = exp(-pow((u - 0.12) / 0.20, 2.0));
  float kite = pow(max(sin(PI * clamp(u * 0.98 + 0.035, 0.0, 1.0)), 0.0), 0.72);
  float tailTaper = 1.0 - 0.78 * smoothstep(0.68, 1.0, u);
  float compression = 1.0 - 0.075 * necJetPulse(t) * (1.0 - smoothstep(0.55, 0.90, u));
  return (0.075 + 0.49 * kite + 0.12 * head) * tailTaper * compression;
}

float necBodyThickness(float u, float t) {
  float profile = pow(max(sin(PI * clamp(u * 0.98 + 0.05, 0.0, 1.0)), 0.0), 0.55);
  float tailTaper = 1.0 - 0.58 * smoothstep(0.72, 1.0, u);
  float breath = 1.0 + 0.028 * sin(necPhase(t) * 2.0) - 0.11 * necJetPulse(t);
  return (0.085 + 0.205 * profile) * tailTaper * breath;
}

BodyFrame necBodyFrame(float u, float t) {
  float e = 0.004;
  vec3 c = necBodyCenter(u, t);
  vec3 a = necBodyCenter(clamp(u - e, 0.0, 1.0), t);
  vec3 b = necBodyCenter(clamp(u + e, 0.0, 1.0), t);
  vec3 tangent = necSafeNormalize(b - a, vec3(0.0, 1.0, 0.0));
  vec3 side = necSafeNormalize(cross(vec3(0.0, 0.0, 1.0), tangent), vec3(1.0, 0.0, 0.0));
  vec3 dorsal = necSafeNormalize(cross(tangent, side), vec3(0.0, 0.0, 1.0));
  BodyFrame f;
  f.c = c;
  f.tangent = tangent;
  f.side = side;
  f.dorsal = dorsal;
  return f;
}

float necBodyU(vec3 q) {
  return clamp((q.y + 0.76) / 2.14, 0.0, 1.0);
}

// 8. MANTLE
float necMantleSDF(vec3 q, float t) {
  float u = necBodyU(q);
  BodyFrame f = necBodyFrame(u, t);
  vec3 rel = q - f.c;
  float w = necBodyWidth(u, t);
  float h = necBodyThickness(u, t);
  float crossD = necSdEllipsoid(vec3(dot(rel, f.side), 0.0, dot(rel, f.dorsal)),
                                vec3(w, 1.0, h));
  float frontCap = -dot(q - necBodyCenter(0.0, t), necBodyFrame(0.0, t).tangent);
  float rearCap = dot(q - necBodyCenter(1.0, t), necBodyFrame(1.0, t).tangent);
  float axial = max(frontCap, rearCap);
  float d = max(crossD, axial);
  BodyFrame headF = necBodyFrame(0.0, t);
  vec3 headCenter = headF.c - headF.tangent * 0.055;
  float head = necSdEllipsoid(q - headCenter, vec3(0.39, 0.28, 0.245));
  d = necSmin(d, head, 0.13);
  vec3 tailA = necBodyCenter(0.88, t);
  vec3 tailB = necBodyCenter(1.0, t);
  float tail = necSdTaperedCapsule(q, tailA, tailB, 0.105, 0.022);
  return necSmin(d, tail, 0.055);
}

// 9. CONTINUOUS LATERAL FINS
float necFinEnvelope(float u) {
  float rootFade = smoothstep(0.10, 0.23, u);
  float tailFade = 1.0 - smoothstep(0.84, 0.98, u);
  return pow(max(sin(PI * u), 0.0), 0.7) * rootFade * tailFade;
}

float necFinStroke(float u, float side, float t) {
  float p = necFinPhase(u, t) + side * 0.14;
  float s = sin(p);
  float power = sign(s) * pow(abs(s), 0.62);
  float recovery = 0.34 * sin(p * 2.0 - 0.75);
  float asym = mix(power, power + recovery, smoothstep(-0.15, 0.72, s));
  float bankAdjust = side * 0.18 * sin(necBank(t));
  return asym + bankAdjust;
}

vec3 necFinPoint(float side, float u, float v, float t) {
  BodyFrame f = necBodyFrame(u, t);
  float env = necFinEnvelope(u);
  float span = (0.08 + 0.34 * env) * (1.0 - 0.18 * necJetPulse(t));
  float stroke = necFinStroke(u, side, t);
  float fold = -0.065 * smoothstep(0.25, 0.90, abs(stroke)) * v * v;
  return f.c + f.side * side * (necBodyWidth(u, t) * 0.90 + span * v)
       + f.dorsal * (0.115 * env * stroke * pow(v, 1.18))
       + f.tangent * fold;
}

float necFinSDF(vec3 q, float side, float t) {
  float u = necBodyU(q);
  BodyFrame f = necBodyFrame(u, t);
  float env = necFinEnvelope(u);
  float span = (0.08 + 0.34 * env) * (1.0 - 0.18 * necJetPulse(t));
  float root = necBodyWidth(u, t) * 0.86;
  vec3 rel = q - f.c;
  float lateral = side * dot(rel, f.side);
  float v = clamp((lateral - root) / max(span, 0.05), 0.0, 1.0);
  vec3 surf = necFinPoint(side, u, v, t);
  vec3 delta = q - surf;
  float across = max(root - lateral, lateral - (root + span));
  float normalD = abs(dot(delta, f.dorsal)) - (0.020 + 0.009 * env);
  float fore = -dot(q - necBodyCenter(0.10, t), necBodyFrame(0.10, t).tangent);
  float aft = dot(q - necBodyCenter(0.96, t), necBodyFrame(0.96, t).tangent);
  return max(max(across, normalD), max(fore, aft));
}

float necFinsSDF(vec3 q, float t) {
  return min(necFinSDF(q, -1.0, t), necFinSDF(q, 1.0, t));
}

float necFinRayPattern(vec3 q, float t) {
  float u = necBodyU(q);
  BodyFrame f = necBodyFrame(u, t);
  float lateral = abs(dot(q - f.c, f.side));
  float root = necBodyWidth(u, t) * 0.86;
  float span = 0.08 + 0.34 * necFinEnvelope(u);
  float v = clamp((lateral - root) / max(span, 0.05), 0.0, 1.0);
  float bands = abs(fract(u * 15.0 + v * 0.34 - necPhase(t) / TAU * 2.0) - 0.5);
  return smoothstep(0.115, 0.018, bands) * smoothstep(0.05, 0.22, v) * (1.0 - smoothstep(0.84, 1.0, v));
}

// 10. EYES AND STALKS
vec3 necEyeRoot(float side, float t) {
  BodyFrame f = necBodyFrame(0.08, t);
  return f.c + f.side * side * (necBodyWidth(0.08, t) * 0.58)
       + f.dorsal * 0.13 - f.tangent * 0.055;
}

vec3 necEyePosition(float side, float t) {
  BodyFrame f = necBodyFrame(0.055, t);
  float ph = necPhase(t);
  float phaseOffset = side < 0.0 ? 0.0 : 0.42;
  return necEyeRoot(side, t) + f.side * side * 0.17
       + f.dorsal * (0.075 + 0.014 * sin(ph * 2.0 + phaseOffset))
       - f.tangent * (0.095 + 0.010 * cos(ph + phaseOffset));
}

float necEyeStalksSDF(vec3 q, float t) {
  float d = 1e5;
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    d = min(d, necSdTaperedCapsule(q, necEyeRoot(side, t), necEyePosition(side, t), 0.078, 0.055));
  }
  return d;
}

float necEyesSDF(vec3 q, float t) {
  float d = 1e5;
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    d = min(d, necSdSphere(q - necEyePosition(side, t), 0.112));
  }
  return d;
}

// 11. TWO FLEXIBLE TENTACLES
vec3 necTentaclePoint(float side, float v, float t) {
  BodyFrame f = necBodyFrame(0.015, t);
  float ph = necPhase(t);
  float lag = necJetPulse(t) * pow(v, 1.25);
  float curl = (0.5 - 0.5 * cos(ph)) * smoothstep(0.56, 1.0, v);
  float phaseOffset = side < 0.0 ? 0.28 : 1.17;
  vec3 root = f.c + f.side * side * 0.19 - f.tangent * 0.11 - f.dorsal * 0.025;
  float lateral = side * (0.055 + 0.10 * v + 0.038 * sin(ph * 2.0 + v * 3.6 + phaseOffset));
  float forward = -1.20 * v + 0.15 * v * v + 0.24 * lag;
  float vertical = -0.07 - 0.10 * v + 0.075 * sin(ph + v * 4.4 + phaseOffset) * v
                 + (side > 0.0 ? 0.19 : 0.12) * curl * v * v;
  float towardCamera = -0.10 * curl * pow(v, 2.2);
  return root + f.side * lateral + f.tangent * forward + f.dorsal * (vertical + towardCamera);
}

float necTentaclesSDF(vec3 q, float t) {
  float d = 1e5;
  for (int sideI = 0; sideI < 2; sideI++) {
    float side = sideI == 0 ? -1.0 : 1.0;
    for (int i = 0; i < 11; i++) {
      float v0 = float(i) / 11.0;
      float v1 = float(i + 1) / 11.0;
      float r0 = mix(0.056, 0.020, pow(v0, 0.75));
      float r1 = mix(0.056, 0.020, pow(v1, 0.75));
      d = min(d, necSdTaperedCapsule(q, necTentaclePoint(side, v0, t),
                                     necTentaclePoint(side, v1, t), r0, r1));
    }
  }
  return d;
}

float necTentacleTipMask(vec3 q, float t) {
  float a = length(q - necTentaclePoint(-1.0, 1.0, t));
  float b = length(q - necTentaclePoint( 1.0, 1.0, t));
  return exp(-min(a, b) * 11.0);
}

// 12. VENTRAL FUNNEL AND JET
vec3 necFunnelRoot(float t) {
  BodyFrame f = necBodyFrame(0.12, t);
  return f.c - f.dorsal * (necBodyThickness(0.12, t) * 0.76) + f.tangent * 0.03;
}

vec3 necFunnelTip(float t) {
  BodyFrame f = necBodyFrame(0.12, t);
  return necFunnelRoot(t) + f.tangent * 0.39 - f.dorsal * 0.18;
}

float necFunnelSDF(vec3 q, float t) {
  float pulse = necJetPulse(t);
  vec3 a = necFunnelRoot(t), b = necFunnelTip(t);
  float outer = necSdTaperedCapsule(q, a, b, 0.145, mix(0.105, 0.070, pulse));
  vec3 axis = necSafeNormalize(b - a);
  float inner = necSdTaperedCapsule(q, a + axis * 0.17, b + axis * 0.045,
                                    0.065, mix(0.060, 0.040, pulse));
  return max(outer, -inner);
}

float necGillPattern(vec3 q, float t) {
  float u = necBodyU(q);
  BodyFrame f = necBodyFrame(u, t);
  vec3 rel = q - f.c;
  float sideBand = exp(-pow((abs(dot(rel, f.side)) - necBodyWidth(u, t) * 0.34) / 0.12, 2.0));
  float zone = smoothstep(0.13, 0.22, u) * (1.0 - smoothstep(0.48, 0.57, u));
  float stripes = pow(0.5 + 0.5 * sin(u * TAU * 9.0 + 0.28 * sin(necPhase(t))), 8.0);
  float depth = exp(-abs(dot(rel, f.dorsal)) * 9.0);
  return sideBand * zone * stripes * depth * (0.66 + 0.34 * necJetPulse(t));
}

// 13. SCENE MAP AND MATERIAL IDS
vec2 necSceneMap(vec3 worldQ, float t) {
  vec3 q = necUnposePoint(worldQ, t);
  vec2 res = vec2(necMantleSDF(q, t), 1.0);
  res = necSmoothUnion(res, vec2(necFinsSDF(q, t), 2.0), 0.020);
  res = necSmoothUnion(res, vec2(necEyeStalksSDF(q, t), 4.0), 0.030);
  res = necUnion(res, vec2(necEyesSDF(q, t), 5.0));
  res = necSmoothUnion(res, vec2(necTentaclesSDF(q, t), 6.0), 0.020);
  res = necSmoothUnion(res, vec2(necFunnelSDF(q, t), 7.0), 0.020);
  return res;
}

// 14. NORMAL, AO, AND RAYMARCHING
vec3 necGetNormal(vec3 p, float t) {
  vec2 e = vec2(0.0012, 0.0);
  return necSafeNormalize(vec3(
    necSceneMap(p + e.xyy, t).x - necSceneMap(p - e.xyy, t).x,
    necSceneMap(p + e.yxy, t).x - necSceneMap(p - e.yxy, t).x,
    necSceneMap(p + e.yyx, t).x - necSceneMap(p - e.yyx, t).x));
}

float necCalcAO(vec3 p, vec3 n, float t) {
  float occ = 0.0, scale = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.028 + 0.055 * float(i);
    float d = necSceneMap(p + n * h, t).x;
    occ += (h - d) * scale;
    scale *= 0.62;
  }
  return clamp(1.0 - occ * 2.1, 0.18, 1.0);
}

float necRayMarch(vec3 ro, vec3 rd, float t, out float glow, out float mat) {
  float depth = 0.0;
  glow = 0.0;
  mat = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * depth;
    vec2 h = necSceneMap(p, t);
    glow += exp(-abs(h.x) * 22.0) * 0.0038;
    if (h.x < SURF_DIST || depth > MAX_DIST) {
      mat = h.y;
      break;
    }
    depth += max(h.x * 0.68, 0.00045);
  }
  return depth;
}

// 15. MATERIAL COLORING
vec3 necMaterialColor(float mat, vec3 worldQ, vec3 n, vec3 rd, float t) {
  vec3 q = necUnposePoint(worldQ, t);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.25);
  float organic = necFbm(q * 3.2 + vec3(sin(necPhase(t)), cos(necPhase(t)), 0.0));
  float u = necBodyU(q);
  vec3 col;
  if (mat < 1.5) {
    float flow = 0.5 + 0.5 * sin(u * TAU * 4.0 - necPhase(t) * 2.0 + organic * 1.35);
    float veins = pow(0.5 + 0.5 * sin(u * TAU * 7.0 + organic * 2.6 - necPhase(t)), 12.0);
    float headFocus = exp(-pow((u - 0.17) / 0.30, 2.0));
    float gills = necGillPattern(q, t);
    col = mix(vec3(0.018, 0.006, 0.060), VIOLET * 0.58, 0.44 + 0.22 * organic);
    col += mix(VIOLET, CYAN, 0.82) * flow * (0.018 + 0.022 * headFocus);
    col += mix(CYAN, ACID, 0.26) * veins * (0.035 + 0.085 * fres) * headFocus;
    col += CYAN * fres * (0.18 + 0.12 * headFocus);
    col += mix(ACID, CYAN, 0.45) * gills * 0.46;
    col += CYAN * necJetPulse(t) * 0.055;
  } else if (mat < 2.5) {
    BodyFrame f = necBodyFrame(u, t);
    float lateral = abs(dot(q - f.c, f.side));
    float root = necBodyWidth(u, t) * 0.86;
    float span = 0.08 + 0.34 * necFinEnvelope(u);
    float v = clamp((lateral - root) / max(span, 0.05), 0.0, 1.0);
    float edge = pow(smoothstep(0.58, 1.0, v), 2.0);
    float rays = necFinRayPattern(q, t);
    float iridescence = 0.5 + 0.5 * sin(organic * 5.5 + u * TAU * 2.0
                                      - necPhase(t) + fres * 3.0);
    vec3 iridescentColor = mix(VIOLET, CYAN, iridescence);
    float membrane = smoothstep(0.04, 0.30, v) * (1.0 - smoothstep(0.72, 1.0, v));
    col = mix(vec3(0.003, 0.008, 0.024), VIOLET * 0.28, 0.32 + 0.18 * organic);
    col += iridescentColor * membrane * (0.025 + 0.12 * fres);
    col += CYAN * (pow(fres, 0.78) * 0.56 + edge * 0.68);
    col += mix(CYAN, ACID, 0.68) * rays * 0.24;
    col *= 1.0 - 0.14 * smoothstep(0.025, 0.085, abs(fract(u * 15.0) - 0.5));
  } else if (mat < 4.5) {
    col = mix(vec3(0.018, 0.004, 0.050), VIOLET * 0.46, 0.46 + 0.20 * organic);
    col += CYAN * fres * 0.13;
  } else if (mat < 5.5) {
    float da = length(q - necEyePosition(-1.0, t));
    float db = length(q - necEyePosition(1.0, t));
    vec3 ec = da < db ? necEyePosition(-1.0, t) : necEyePosition(1.0, t);
    vec3 eyeN = necSafeNormalize(q - ec);
    BodyFrame ef = necBodyFrame(0.055, t);
    vec3 viewAxis = necSafeNormalize(-ef.tangent + ef.dorsal * 0.16);
    float iris = pow(max(dot(eyeN, viewAxis), 0.0), 18.0);
    float core = pow(max(dot(eyeN, viewAxis), 0.0), 58.0);
    col = vec3(0.0015, 0.0025, 0.008);
    col += mix(VIOLET, CYAN, 0.72) * iris * 1.30 + CYAN * core * 1.15;
    col += CYAN * pow(fres, 5.0) * 0.24;
  } else if (mat < 6.5) {
    float tip = necTentacleTipMask(q, t);
    float pulse = 0.5 + 0.5 * sin(length(q - necBodyCenter(0.0, t)) * 8.0 - necPhase(t) * 2.0);
    col = mix(vec3(0.025, 0.004, 0.060), VIOLET * 0.62, 0.55 + 0.18 * organic);
    col += CYAN * pulse * 0.10 + PINK * tip * 0.48 + CYAN * fres * 0.18;
  } else {
    vec3 a = necFunnelRoot(t), b = necFunnelTip(t);
    vec3 axis = necSafeNormalize(b - a);
    float rim = pow(clamp(dot(necSafeNormalize(q - b), -axis), 0.0, 1.0), 5.0);
    col = mix(vec3(0.008, 0.002, 0.024), VIOLET * 0.52, 0.38 + 0.22 * organic);
    col += mix(CYAN, ACID, 0.62) * (rim * (0.35 + 1.25 * necJetPulse(t)) + fres * 0.16);
  }
  return col;
}

// 16. PROJECTED ANATOMICAL GLOW OVERLAYS
vec2 necProjectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p - ro;
  float z = max(dot(rel, ww), 0.05);
  return vec2(dot(rel, uu), dot(rel, vv)) / z;
}

vec3 necLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 15; i++) {
    float u0 = float(i) / 15.0;
    float u1 = float(i + 1) / 15.0;
    vec3 a = necPosePoint(necBodyCenter(u0, t), t);
    vec3 b = necPosePoint(necBodyCenter(u1, t), t);
    float d = necDistSeg2(st, necProjectPoint(a, ro, uu, vv, ww), necProjectPoint(b, ro, uu, vv, ww));
    col += mix(VIOLET, CYAN, 0.58) * exp(-d * 175.0) * 0.004;
  }
  for (int sideI = 0; sideI < 2; sideI++) {
    float side = sideI == 0 ? -1.0 : 1.0;
    for (int i = 0; i < 15; i++) {
      float u0 = 0.10 + 0.86 * float(i) / 15.0;
      float u1 = 0.10 + 0.86 * float(i + 1) / 15.0;
      vec3 a = necPosePoint(necFinPoint(side, u0, 1.0, t), t);
      vec3 b = necPosePoint(necFinPoint(side, u1, 1.0, t), t);
      float d = necDistSeg2(st, necProjectPoint(a, ro, uu, vv, ww), necProjectPoint(b, ro, uu, vv, ww));
      col += CYAN * exp(-d * 155.0) * 0.013;
    }
    for (int i = 0; i < 11; i++) {
      float v0 = float(i) / 11.0;
      float v1 = float(i + 1) / 11.0;
      vec3 a = necPosePoint(necTentaclePoint(side, v0, t), t);
      vec3 b = necPosePoint(necTentaclePoint(side, v1, t), t);
      float d = necDistSeg2(st, necProjectPoint(a, ro, uu, vv, ww), necProjectPoint(b, ro, uu, vv, ww));
      col += mix(CYAN, PINK, v0 * v0) * exp(-d * 190.0) * 0.007;
    }
    for (int i = 0; i < 6; i++) {
      float u0 = 0.22 + float(i) * 0.045;
      float u1 = u0 + 0.026;
      BodyFrame f0 = necBodyFrame(u0, t);
      BodyFrame f1 = necBodyFrame(u1, t);
      vec3 a = necPosePoint(f0.c + f0.side * side * necBodyWidth(u0, t) * 0.28, t);
      vec3 b = necPosePoint(f1.c + f1.side * side * necBodyWidth(u1, t) * 0.38, t);
      float d = necDistSeg2(st, necProjectPoint(a, ro, uu, vv, ww), necProjectPoint(b, ro, uu, vv, ww));
      col += mix(ACID, CYAN, 0.45) * exp(-d * 205.0) * (0.008 + 0.005 * necJetPulse(t));
    }
  }
  float pulse = necJetPulse(t);
  float radius = 0.06 + 0.52 * (1.0 - exp(-pulse * 2.6));
  vec3 center = necPosePoint(necFunnelTip(t), t);
  BodyFrame ff = necBodyFrame(0.12, t);
  for (int i = 0; i < 24; i++) {
    float a0 = TAU * float(i) / 24.0;
    float a1 = TAU * float(i + 1) / 24.0;
    vec3 p0 = necPosePoint(necUnposePoint(center, t) + (ff.side * cos(a0) + ff.dorsal * sin(a0)) * radius, t);
    vec3 p1 = necPosePoint(necUnposePoint(center, t) + (ff.side * cos(a1) + ff.dorsal * sin(a1)) * radius, t);
    float d = necDistSeg2(st, necProjectPoint(p0, ro, uu, vv, ww), necProjectPoint(p1, ro, uu, vv, ww));
    col += mix(CYAN, ACID, 0.62) * exp(-d * 145.0) * pulse * 0.024;
  }
  return col;
}

// 17. DEEP-OCEAN BACKGROUND AND JET WAKE
vec3 necBackground(vec2 st, float t) {
  float ph = necPhase(t);
  float pulse = necJetPulse(t);
  float depthGradient = smoothstep(-1.15, 1.05, st.y);
  vec3 col = mix(vec3(0.0012, 0.0035, 0.014), vec3(0.004, 0.025, 0.058),
                 depthGradient);
  float waterHaze = necFbm(vec3(st * 1.35 + vec2(0.12 * sin(ph), 0.08 * cos(ph)),
                                0.45 * sin(ph * 2.0)));
  col += mix(VIOLET, CYAN, 0.74) * waterHaze * waterHaze * 0.020;
  float depthCurtain = pow(0.5 + 0.5 * sin(st.y * 4.2 + st.x * 1.3
                                          + 0.34 * sin(ph)), 7.0);
  col += CYAN * depthCurtain * depthGradient * 0.012;
  float caustic = 0.0;
  vec2 q = st;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    q += 0.14 * vec2(cos(ph + fi * 1.7), sin(ph * 2.0 + fi));
    caustic += sin(q.x * (3.2 + fi) + ph) * cos(q.y * (4.0 + fi) - ph * 2.0);
  }
  col += mix(CYAN, VIOLET, 0.54) * pow(0.5 + 0.5 * caustic / 4.0, 5.0) * 0.058;
  for (int i = 0; i < 46; i++) {
    float fi = float(i);
    vec2 p = vec2(necHash11(fi * 13.7), necHash11(fi * 41.2)) * 2.0 - 1.0;
    float loops = 1.0 + mod(fi, 3.0);
    p.y = fract(p.y * 0.5 + 0.5 + (ph / TAU) * loops + pulse * 0.07) * 2.2 - 1.1;
    p.x += sin(ph + fi) * 0.040 + pulse * (necHash11(fi * 9.3) - 0.5) * 0.16;
    float eyeClear = smoothstep(0.12, 0.38, length(p - vec2(0.0, 0.19)));
    float d = length(st - p);
    float shimmer = 0.58 + 0.42 * sin(ph * loops + fi * 2.17);
    vec3 particleColor = mix(CYAN, VIOLET, 0.22 + 0.50 * necHash11(fi * 4.9));
    col += particleColor * exp(-d * 118.0)
         * (0.006 + 0.015 * necHash11(fi * 2.1)) * shimmer * eyeClear;
  }
  vec2 wakeP = st - vec2(0.02, -0.12);
  float wake = exp(-abs(wakeP.x) * 13.0) * exp(-abs(wakeP.y + 0.30) * 4.0) * pulse;
  col += mix(CYAN, ACID, 0.42) * wake * 0.045;
  vec2 headHaloP = (st - vec2(0.0, 0.15)) * vec2(0.82, 1.0);
  col += mix(VIOLET, CYAN, 0.72) * exp(-length(headHaloP) * 4.2) * 0.038;
  return col;
}

// 18. CAMERA AND FINAL RENDER
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = uTimeSeconds;
  float ph = necPhase(t);
  float pulse = necJetPulse(t);

  // Slow seamless orbit constrained to elevated three-quarter views. The
  // range avoids frontal and broadside silhouettes while revealing the full
  // mantle, continuous fins, eyes, funnel, and both trailing tentacles.
  vec3 target = necPosePoint(vec3(0.0, 0.08 + 0.035 * sin(ph), 0.030), t);
  float azimuth = radians(44.0) + radians(13.0) * sin(ph);
  float radial = 5.02 + 0.10 * cos(ph * 2.0) - 0.05 * pulse;
  float elevation = 1.76 + 0.15 * cos(ph);
  vec3 ro = target + vec3(sin(azimuth) * radial,
                          -cos(azimuth) * radial,
                          elevation);
  ro.x += 0.035 * pulse * sin(ph * 7.0);
  ro.z += 0.020 * pulse * cos(ph * 9.0);

  vec3 ww = necSafeNormalize(target - ro);
  vec3 up = vec3(sin(necBank(t) * 0.13), 0.0, cos(necBank(t) * 0.13));
  vec3 uu = necSafeNormalize(cross(up, ww), vec3(1.0, 0.0, 0.0));
  vec3 vv = necSafeNormalize(cross(ww, uu));
  vec3 rd = necSafeNormalize(uu * st.x + vv * st.y + ww * 1.75);

  vec3 col = necBackground(st, t);
  float glow, mat;
  float d = necRayMarch(ro, rd, t, glow, mat);

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = necGetNormal(p, t);
    vec3 localP = necUnposePoint(p, t);
    float localU = necBodyU(localP);
    float headFocus = exp(-pow((localU - 0.16) / 0.34, 2.0));
    vec3 l1 = necSafeNormalize(vec3(-0.50, -0.62, 0.72));
    vec3 l2 = necSafeNormalize(vec3(0.62, 0.18, -0.76));
    float diff = max(dot(n, l1), 0.0);
    float fill = max(dot(n, l2), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.45);
    float ao = necCalcAO(p, n, t);
    vec3 body = necMaterialColor(mat, p, n, rd, t);
    vec3 lit = body * (0.22 + (0.72 + 0.12 * headFocus) * diff + 0.13 * fill) * ao;
    vec3 h = necSafeNormalize(l1 - rd);
    float specPower = mat > 4.5 && mat < 5.5 ? 118.0 : (mat > 1.5 && mat < 2.5 ? 58.0 : 42.0);
    float specStrength = mat > 4.5 && mat < 5.5 ? 2.20 : (mat > 1.5 && mat < 2.5 ? 0.82 : 0.46);
    float spec = pow(max(dot(n, h), 0.0), specPower);
    lit += mix(CYAN, vec3(0.78, 0.96, 1.0), 0.72) * spec * specStrength;
    lit += mix(VIOLET, CYAN, 0.72) * rim * (mat > 1.5 && mat < 2.5 ? 0.52 : 0.15);
    lit += mix(VIOLET, CYAN, 0.80) * headFocus * (0.025 + 0.060 * diff);
    float fog = 1.0 - exp(-d * 0.17);
    col = mix(lit, col, fog * 0.36);
  }

  col += necLineOverlay(st, ro, uu, vv, ww, t) * 0.84;
  col += mix(CYAN, ACID, 0.35) * glow * 0.070;
  col += VIOLET * exp(-length(st - vec2(0.0, 0.08)) * 3.8) * 0.032;
  col *= 1.56 + 0.06 * sin(ph * 2.0);
  col += pow(max(col, 0.0), vec3(1.30)) * 0.24;
  col *= 1.0 - 0.22 * smoothstep(0.38, 1.42, length(st));
  col = col / (0.80 + col);
  col = pow(max(col, 0.0), vec3(0.94));

  float grainPhase = sin(ph) * 17.0 + cos(ph) * 31.0;
  float grain = (necHash11(uv.x * 1234.5 + uv.y * 987.6 + grainPhase) - 0.5) * 0.009;
  col += grain;
  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
