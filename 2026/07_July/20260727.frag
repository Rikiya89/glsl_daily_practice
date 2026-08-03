// ===============================================================
// WIWAXIA CORRUGATA - NEON SCLERITOME WALKER
// TouchDesigner GLSL TOP fragment shader
// Seamless 30-second procedural raymarched animation.
// 234 repeated sclerites + 18 dorsal blades.
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

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
mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec3 safeNormalize(vec3 v, vec3 fallback) {
  float l2 = dot(v, v);
  return l2 < 1e-10 ? fallback : v * inversesqrt(l2);
}

vec3 safeNormalize(vec3 v) {
  return safeNormalize(v, vec3(0.0, 0.0, 1.0));
}

float hash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float noise3(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(p), hash13(p + vec3(1,0,0)), f.x),
        mix(hash13(p + vec3(0,1,0)), hash13(p + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(p + vec3(0,0,1)), hash13(p + vec3(1,0,1)), f.x),
        mix(hash13(p + vec3(0,1,1)), hash13(p + vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p = p * 2.04 + vec3(17.3, 9.1, 5.7);
    a *= 0.52;
  }
  return v;
}

float wiwPhase(float t) {
  return TAU * fract(t / 30.0);
}

float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

// 3. SDF PRIMITIVES
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 0.00001);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float sdFlattenedTaperedCapsule(vec3 p, vec3 a, vec3 b,
                                float wa, float wb,
                                float ta, float tb,
                                vec3 flattenNormal) {
  vec3 ba = b - a;
  float h = clamp(dot(p - a, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  vec3 center = mix(a, b, h);
  float width = mix(wa, wb, h);
  float thick = max(mix(ta, tb, h), 0.00001);
  vec3 normal = safeNormalize(flattenNormal, vec3(0.0, 0.0, 1.0));
  vec3 rel = p - center;
  float flatten = max(width / thick, 1.0);
  vec3 scaledRel = rel + normal * dot(rel, normal) * (flatten - 1.0);
  return (length(scaledRel) - width) / flatten;
}

float sdTorusY(vec3 p, vec2 r) {
  vec2 q = vec2(length(p.xz) - r.x, p.y);
  return length(q) - r.y;
}

// 4. SMOOTH BOOLEAN OPERATIONS
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

struct Hit {
  float d;
  float m;
};

Hit opSmoothUnion(Hit a, Hit b, float k) {
  float d = smin(a.d, b.d, k);
  float h = smoothstep(-k, k, b.d - a.d);
  return Hit(d, mix(b.m, a.m, h));
}

// 5. LOOPING WIWAXIA PRESENTATION POSE
vec3 wiwPose(vec3 p, float t) {
  float ph = wiwPhase(t);
  p.xz *= rot(0.030 * sin(ph * 2.0 + 0.2));
  p.yz *= rot(-0.055 + 0.022 * sin(ph));
  p.xy *= rot(0.030 * sin(ph + 0.9));
  return p;
}

vec3 wiwUnpose(vec3 q, float t) {
  float ph = wiwPhase(t);
  q.xy *= rot(-0.030 * sin(ph + 0.9));
  q.yz *= rot(0.055 - 0.022 * sin(ph));
  q.xz *= rot(-0.030 * sin(ph * 2.0 + 0.2));
  return q;
}

// 6. FOOT-DRIVEN LOCOMOTION FIELDS
float wiwPedalPhase(float u, float t) {
  return 3.0 * wiwPhase(t) - 3.0 * TAU * clamp(u, 0.0, 1.0);
}

float wiwPedalSignal(float u, float t) {
  return 0.5 + 0.5 * sin(wiwPedalPhase(u, t));
}

float wiwPedalGrip(float u, float t) {
  return smoothstep(0.58, 0.92, wiwPedalSignal(u, t));
}

// 7. DEFORMED ANATOMY FIELDS AND MOVING FRAME
vec3 wiwBodyCenter(float u, float t) {
  float ph = wiwPhase(t);
  float cu = clamp(u, 0.0, 1.0);
  float env = sin(PI * cu);
  float lateral1 = 0.045 * env * sin(ph - TAU * cu);
  float lateral2 = 0.012 * env * sin(ph * 2.0 - TAU * 2.0 * cu + 0.65);
  float contractY = 0.018 * env * sin(ph * 3.0 - TAU * 3.0 * cu);
  float settleZ = 0.008 * env * sin(ph * 2.0 - TAU * 2.0 * cu + 1.10);
  return vec3(lateral1 + lateral2,
              mix(-0.62, 0.86, cu) + contractY,
              settleZ);
}

float wiwBodyRadius(float u, float t) {
  float ph = wiwPhase(t);
  float cu = clamp(u, 0.0, 1.0);
  float oval = sin(PI * cu);
  float base = 0.10 + 0.30 * pow(max(oval, 0.0), 0.65);
  float breathe = 1.0 + 0.012 * sin(ph * 2.0 - TAU * 2.0 * cu);
  float compress = 1.0 - 0.035 * wiwPedalGrip(cu, t);
  return base * breathe * compress;
}

struct BodyFrame {
  vec3 c;
  vec3 tangent;
  vec3 side;
  vec3 dorsal;
};

BodyFrame wiwBodyFrame(float u, float t) {
  float cu = clamp(u, 0.0, 1.0);
  float eps = 1.0 / 128.0;
  vec3 c = wiwBodyCenter(cu, t);
  vec3 cPrev = wiwBodyCenter(max(cu - eps, 0.0), t);
  vec3 cNext = wiwBodyCenter(min(cu + eps, 1.0), t);
  vec3 tangent = safeNormalize(cNext - cPrev, vec3(0.0, 1.0, 0.0));
  vec3 side = safeNormalize(cross(tangent, vec3(0.0, 0.0, 1.0)),
                            vec3(1.0, 0.0, 0.0));
  vec3 dorsal = safeNormalize(cross(side, tangent), vec3(0.0, 0.0, 1.0));
  return BodyFrame(c, tangent, side, dorsal);
}

// 8. OVAL, UNSEGMENTED BODY
float wiwBodySDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 14; i++) {
    float u0 = float(i) / 14.0;
    float u1 = float(i + 1) / 14.0;
    d = smin(d,
             sdTaperedCapsule(q,
                              wiwBodyCenter(u0, t),
                              wiwBodyCenter(u1, t),
                              wiwBodyRadius(u0, t),
                              wiwBodyRadius(u1, t)),
             0.030);
  }
  return d;
}

// 9. ONE MORPHING SCLERITE PRIMITIVE + 3x3 DOMAIN NEIGHBOURHOOD
float wiwScleritePrimitive(vec3 p, vec3 anchor, vec3 tipDir,
                           vec3 outward, vec3 sideAxis, float zone) {
  float plateLen = mix(0.150, 0.105, zone);
  float plateWide = mix(0.030, 0.052, zone);
  float plateCurl = mix(0.085, 0.015, zone);
  float plateThick = mix(0.012, 0.016, zone);
  vec3 lateral = safeNormalize(cross(tipDir, outward), sideAxis);
  vec3 tip = anchor + tipDir * plateLen + lateral * plateCurl;

  vec3 bladeAxis = safeNormalize(tip - anchor, tipDir);
  vec3 plateNormal = safeNormalize(cross(lateral, bladeAxis), outward);
  vec3 rel = p - anchor;
  float flatten = max(plateWide / max(plateThick, 0.00001), 1.0);
  vec3 scaledP = anchor + bladeAxis * dot(rel, bladeAxis) +
                 lateral * dot(rel, lateral) +
                 plateNormal * dot(rel, plateNormal) * flatten;
  float d = sdTaperedCapsule(scaledP, anchor, tip,
                             plateWide, plateWide * 0.35);
  return d / flatten;
}

float wiwScleriteSDF(vec3 q, float t) {
  float uEst = clamp((q.y + 0.62) / 1.48, 0.0, 0.99999);
  int iEst = int(floor(uEst * 9.0));
  float rowEstU = (float(iEst) + 0.5) / 9.0;
  BodyFrame fEst = wiwBodyFrame(rowEstU, t);
  vec3 relEst = q - fEst.c;
  float pSide = dot(relEst, fEst.side);
  float pDorsal = max(dot(relEst, fEst.dorsal), 0.0);
  float angEst = atan(pDorsal, pSide);
  if (angEst < 0.0) angEst += PI;
  int jEst = int(floor(clamp(angEst / PI, 0.0, 0.99999) * 26.0));
  float d = 20.0;

  for (int di = -1; di <= 1; di++) {
    int row = clamp(iEst + di, 0, 8);
    float u = (float(row) + 0.5) / 9.0;
    BodyFrame f = wiwBodyFrame(u, t);
    float r = wiwBodyRadius(u, t);
    for (int dj = -1; dj <= 1; dj++) {
      int col = clamp(jEst + dj, 0, 25);
      float ang = PI * (float(col) + 0.5) / 26.0;
      float nx = cos(ang);
      float nz = sin(ang);
      vec3 outward = safeNormalize(f.side * nx + f.dorsal * nz, f.dorsal);
      float zone = sin(ang);
      vec3 anchor = f.c + outward * r;
      float tiltBack = 0.55;
      vec3 tipDir = safeNormalize(outward * cos(tiltBack) +
                                  f.tangent * sin(tiltBack), f.tangent);
      d = min(d, wiwScleritePrimitive(q, anchor, tipDir,
                                      outward, f.side, zone));
    }
  }
  return d;
}

// 10. TWO ROWS OF NINE DORSAL BLADE SPINES
vec3 wiwBladePoint(float u, float side, float v, float t) {
  float ph = wiwPhase(t);
  BodyFrame f = wiwBodyFrame(u, t);
  float r = wiwBodyRadius(u, t);
  float fi = floor(u * 9.0);
  float seed = fi * 7.31 + (side > 0.0 ? 3.7 : 0.0);
  float jit = hash11(seed);
  float lean = 0.30 + 0.25 * jit;
  float len = 0.62 + 0.22 * jit;
  float lag = 0.18 * fi / 8.0;
  float flex = 0.075 * sin(ph * 2.0 - TAU * 2.0 * u - lag + side * 0.6);
  vec3 root = f.c + f.side * (side * r * 0.42) + f.dorsal * (r * 0.88);
  vec3 tip = root + f.side * (side * (0.16 + flex)) +
             f.tangent * (lean * 0.5) + f.dorsal * len;
  return mix(root, tip, clamp(v, 0.0, 1.0));
}

float wiwBladesSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 9; i++) {
    float u = (float(i) + 0.5) / 9.0;
    for (int sideI = 0; sideI < 2; sideI++) {
      float side = sideI == 0 ? -1.0 : 1.0;
      vec3 root = wiwBladePoint(u, side, 0.0, t);
      vec3 tip = wiwBladePoint(u, side, 1.0, t);
      d = min(d, sdTaperedCapsule(q, root, tip, 0.045, 0.004));
    }
  }
  return d;
}

// 11. SMOOTH, UNARMORED VENTRAL TRACTION FOOT
struct FootSample {
  vec3 center;
  vec3 tangent;
  vec3 side;
  vec3 dorsal;
  float width;
  float thick;
  float grip;
};

FootSample wiwFootSample(float u, float t) {
  BodyFrame f = wiwBodyFrame(u, t);
  float r = wiwBodyRadius(u, t);
  float grip = wiwPedalGrip(u, t);
  float drop = r * mix(0.54, 0.59, grip);
  float width = r * mix(0.66, 0.56, grip);
  float thick = r * mix(0.20, 0.15, grip);
  return FootSample(f.c - f.dorsal * drop,
                    f.tangent, f.side, f.dorsal,
                    width, thick, grip);
}

float wiwFootSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 12; i++) {
    float u0 = float(i) / 12.0;
    float u1 = float(i + 1) / 12.0;
    FootSample a = wiwFootSample(u0, t);
    FootSample b = wiwFootSample(u1, t);
    vec3 dorsal = safeNormalize(a.dorsal + b.dorsal, a.dorsal);
    float ds = sdFlattenedTaperedCapsule(q, a.center, b.center,
                                        a.width, b.width,
                                        a.thick, b.thick, dorsal);
    d = smin(d, ds, 0.025);
  }
  return d;
}

// 12. PAIRED ANTERIOR ROSETTES
float wiwRosetteSDF(vec3 q, float t) {
  float d = 20.0;
  float u = 0.060;
  BodyFrame f = wiwBodyFrame(u, t);
  float r = wiwBodyRadius(u, t);
  for (int sideI = 0; sideI < 2; sideI++) {
    float side = sideI == 0 ? -1.0 : 1.0;
    vec3 hub = f.c + f.side * (side * r * 0.70) -
               f.tangent * 0.035 + f.dorsal * (r * 0.42);
    d = min(d, sdSphere(q - hub, 0.030));
    for (int petal = 0; petal < 5; petal++) {
      float a = TAU * float(petal) / 5.0 + side * 0.18;
      vec3 fan = f.side * (side * (0.045 + 0.035 * cos(a))) +
                 f.tangent * (-0.020 + 0.055 * sin(a)) +
                 f.dorsal * (0.055 + 0.030 * cos(a));
      vec3 tip = hub + fan;
      d = min(d, sdTaperedCapsule(q, hub, tip, 0.022, 0.004));
    }
  }
  return d;
}

// 13. SCENE MAP AND MATERIAL IDS
// 1 body core, 2 sclerites, 3 blades, 4 ventral foot, 5 rosettes.
Hit mapScene(vec3 p, float t) {
  vec3 q = wiwPose(p, t);
  Hit res = Hit(20.0, 0.0);
  res = opSmoothUnion(res, Hit(wiwBodySDF(q, t), 1.0), 0.025);
  res = opSmoothUnion(res, Hit(wiwFootSDF(q, t), 4.0), 0.018);
  res = opSmoothUnion(res, Hit(wiwScleriteSDF(q, t), 2.0), 0.004);
  res = opSmoothUnion(res, Hit(wiwBladesSDF(q, t), 3.0), 0.006);
  res = opSmoothUnion(res, Hit(wiwRosetteSDF(q, t), 5.0), 0.004);
  float ph = wiwPhase(t);
  res.d += (fbm(q * 7.2 + vec3(0.11 * sin(ph), 0.11 * cos(ph), 0.0))
            - 0.5) * 0.0028;
  return res;
}

// 14. NORMAL, AMBIENT OCCLUSION, AND RAYMARCHING
vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.0018, 0.0);
  return safeNormalize(vec3(
    mapScene(p + e.xyy, t).d - mapScene(p - e.xyy, t).d,
    mapScene(p + e.yxy, t).d - mapScene(p - e.yxy, t).d,
    mapScene(p + e.yyx, t).d - mapScene(p - e.yyx, t).d));
}

float calcAO(vec3 p, vec3 n, float t) {
  float occ = 0.0, weight = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.025 * float(i);
    occ += (h - mapScene(p + n * h, t).d) * weight;
    weight *= 0.62;
  }
  return clamp(1.0 - occ * 3.1, 0.28, 1.0);
}

float rayMarch(vec3 ro, vec3 rd, float t, out float glow, out float mat) {
  float d = 0.0;
  glow = 0.0;
  mat = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    Hit h = mapScene(ro + rd * d, t);
    float safeD = max(abs(h.d), 0.0005);
    glow += 0.00012 / (0.008 + safeD * safeD * 24.0);
    if (h.d < SURF_DIST || d > MAX_DIST) {
      mat = h.m;
      break;
    }
    d += max(h.d * 0.55, 0.0030);
  }
  return d;
}

// 15. MATERIAL COLORING
vec3 palette(float x) {
  vec3 a = mix(ACID, CYAN, smoothstep(0.00, 0.38, x));
  vec3 b = mix(VIOLET, PINK, smoothstep(0.46, 1.00, x));
  return mix(a, b, smoothstep(0.24, 0.94, x));
}

vec3 materialColor(float mat, vec3 p, vec3 n, vec3 rd, float t) {
  float ph = wiwPhase(t);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.1);
  vec3 q = wiwPose(p, t);
  float bodyFlow = 0.5 + 0.5 * sin(q.y * 18.0 - ph * 2.0);
  vec3 col;

  if (mat < 1.5) {
    col = mix(CYAN, VIOLET, 0.30 + 0.22 * bodyFlow);
    col += CYAN * fres * 0.28;
  } else if (mat < 2.5) {
    float u = clamp((q.y + 0.62) / 1.48, 0.0, 1.0);
    BodyFrame f = wiwBodyFrame(u, t);
    vec3 rel = q - f.c;
    float pSide = dot(rel, f.side);
    float pDorsal = max(dot(rel, f.dorsal), 0.0);
    float zone = clamp(pDorsal /
                       max(length(vec2(pSide, pDorsal)), 0.00001), 0.0, 1.0);
    col = mix(VIOLET, PINK, 0.18 + 0.72 * zone);
    col += mix(CYAN, PINK, zone) * pow(fres, 0.72) * 0.78;
    col += ACID * (0.05 + 0.10 * fres);
  } else if (mat < 3.5) {
    col = mix(ACID, CYAN, 0.28 + 0.38 * bodyFlow);
    col += PINK * pow(fres, 0.65) * 0.34;
  } else if (mat < 4.5) {
    float u = clamp((q.y + 0.62) / 1.48, 0.0, 1.0);
    float grip = wiwPedalGrip(u, t);
    col = mix(vec3(0.07, 0.015, 0.16), VIOLET, 0.52 + 0.14 * bodyFlow);
    col += CYAN * fres * 0.10;
    col *= 1.0 - 0.12 * grip;
  } else {
    col = mix(PINK, VIOLET, 0.22 + 0.28 * bodyFlow);
    col += PINK * fres * 0.46;
  }
  return col + mix(CYAN, ACID, 0.42) * fres * 0.34;
}

// 16. PROJECTED ANATOMICAL GLOW OVERLAY
vec2 projectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p - ro;
  float z = max(dot(rel, ww), 0.05);
  return vec2(dot(rel, uu), dot(rel, vv)) / z;
}

vec3 wiwLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv,
                    vec3 ww, float t) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    vec3 a = wiwUnpose(wiwBodyCenter(float(i) / 14.0, t), t);
    vec3 b = wiwUnpose(wiwBodyCenter(float(i + 1) / 14.0, t), t);
    float d = distSeg(st, projectPoint(a, ro, uu, vv, ww),
                         projectPoint(b, ro, uu, vv, ww));
    col += mix(CYAN, VIOLET, 0.38) * exp(-d * 145.0) * 0.012;
  }
  for (int i = 0; i < 12; i++) {
    float u0 = float(i) / 12.0;
    float u1 = float(i + 1) / 12.0;
    FootSample fs0 = wiwFootSample(u0, t);
    FootSample fs1 = wiwFootSample(u1, t);
    vec3 a = wiwUnpose(fs0.center, t);
    vec3 b = wiwUnpose(fs1.center, t);
    float d = distSeg(st, projectPoint(a, ro, uu, vv, ww),
                         projectPoint(b, ro, uu, vv, ww));
    float grip = 0.5 * (fs0.grip + fs1.grip);
    col += mix(VIOLET, ACID, grip) * exp(-d * 154.0) *
           (0.006 + 0.012 * grip);
  }
  for (int i = 0; i < 9; i++) {
    float u = (float(i) + 0.5) / 9.0;
    for (int sideI = 0; sideI < 2; sideI++) {
      float side = sideI == 0 ? -1.0 : 1.0;
      vec3 root = wiwUnpose(wiwBladePoint(u, side, 0.0, t), t);
      vec3 tip = wiwUnpose(wiwBladePoint(u, side, 1.0, t), t);
      float d = distSeg(st, projectPoint(root, ro, uu, vv, ww),
                           projectPoint(tip, ro, uu, vv, ww));
      col += mix(ACID, CYAN, 0.52) * exp(-d * 148.0) * 0.016;
    }
  }
  return col;
}

// 17. DEEP-OCEAN BACKGROUND
vec3 background(vec2 st, float t) {
  float ph = wiwPhase(t);
  vec3 col = mix(vec3(0.002, 0.006, 0.022), vec3(0.010, 0.045, 0.095),
                 smoothstep(-1.0, 1.0, st.y));
  float caustic = 0.0;
  vec2 q = st;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    q += 0.20 * vec2(cos(ph + fi), sin(ph * 2.0 + fi * 1.7));
    caustic += sin(q.x * (3.0 + fi) + ph) *
               cos(q.y * (3.6 + fi) - ph * 2.0);
  }
  col += mix(CYAN, VIOLET, 0.38) *
         pow(0.5 + 0.5 * caustic / 5.0, 4.0) * 0.15;
  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec2 p = vec2(hash11(fi * 13.7), hash11(fi * 41.2)) * 2.0 - 1.0;
    float loops = 1.0 + mod(fi, 3.0);
    p.y = fract(p.y * 0.5 + 0.5 + (ph / TAU) * loops) * 2.2 - 1.1;
    p.x += sin(ph + fi) * 0.055;
    float d = length(st - p);
    col += palette(hash11(fi * 4.9)) * exp(-d * 90.0) *
           (0.014 + 0.032 * hash11(fi * 2.1));
  }
  return col;
}

// 18. CAMERA AND FINAL RENDER
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;
  float phase = fract(t / 30.0);
  float loopAngle = TAU * phase;

  float orbit = -1.15 + loopAngle;
  float radial = 4.60 + 0.14 * sin(loopAngle * 3.0);
  float elevation = 0.62 + 0.35 * sin(loopAngle * 2.0);
  BodyFrame midFrame = wiwBodyFrame(0.50, t);
  vec3 target = wiwUnpose(midFrame.c + midFrame.dorsal * 0.10, t);
  vec3 ro = target + vec3(sin(orbit) * radial,
                          cos(orbit) * radial,
                          elevation);

  vec3 ww = safeNormalize(target - ro);
  vec3 up = abs(ww.z) > 0.96 ? vec3(0.0, 1.0, 0.0)
                             : vec3(0.0, 0.0, 1.0);
  vec3 uu = safeNormalize(cross(up, ww));
  vec3 vv = safeNormalize(cross(ww, uu));
  vec3 rd = safeNormalize(uu * st.x + vv * st.y + ww * 1.68);

  vec3 col = background(st, t);
  float glow, mat;
  float d = rayMarch(ro, rd, t, glow, mat);

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p, t);
    vec3 l1 = safeNormalize(vec3(-0.45, 0.82, -0.25));
    vec3 l2 = safeNormalize(vec3(0.58, -0.12, 0.72));
    vec3 fillDir = safeNormalize(vec3(0.15, -0.35, -0.92));
    float diff = max(dot(n, l1), 0.0);
    float back = pow(max(dot(l2, rd), 0.0), 2.0);
    float fill = max(dot(n, fillDir), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
    float ao = calcAO(p, n, t);
    vec3 body = materialColor(mat, p, n, rd, t);
    vec3 lit = body * (0.26 + diff * 0.72) * ao;
    lit += body * fill * 0.14 * ao;
    lit += ACID * back * 0.28;
    lit += mix(VIOLET, PINK, 0.48) * rim * 1.10;
    vec3 h = safeNormalize(l1 - rd);
    float specPower = mat > 1.5 && mat < 2.5 ? 44.0 :
                      (mat > 3.5 && mat < 4.5 ? 24.0 : 68.0);
    float specStrength = mat > 1.5 && mat < 2.5 ? 1.25 :
                         (mat > 3.5 && mat < 4.5 ? 0.35 : 1.75);
    float spec = pow(max(dot(n, h), 0.0), specPower);
    lit += mix(CYAN, ACID, 0.42) * spec * specStrength;
    if (mat > 1.5 && mat < 2.5) {
      lit += mix(VIOLET, PINK, 0.52) * back * 0.18;
    }
    float fog = 1.0 - exp(-d * 0.16);
    col = mix(lit, col, fog * 0.42);
  }

  col += wiwLineOverlay(st, ro, uu, vv, ww, t) *
         (1.04 + 0.07 * sin(loopAngle * 2.0));
  col += palette(0.42 + 0.22 * sin(loopAngle)) * glow * 0.105;

  vec2 halo = st;
  halo.y += 0.04;
  float ring = exp(-abs(length(halo) - 0.74) * 26.0);
  col += mix(CYAN, VIOLET, 0.50) * ring * 0.042;
  col += PINK * pow(max(0.0, 1.0 - length(st * vec2(0.74, 1.0))), 4.4) * 0.072;
  col *= 1.76 + 0.12 * sin(loopAngle * 2.0);
  col += pow(max(col, 0.0), vec3(1.32)) * 0.33;
  col *= 1.0 - 0.20 * smoothstep(0.35, 1.60, length(st));
  col = col / (0.82 + col);
  col = pow(max(col, 0.0), vec3(0.94));

  float grainPhase = sin(loopAngle) * 17.0 + cos(loopAngle) * 31.0;
  float grain = (hash11(uv.x * 1234.5 + uv.y * 987.6 + grainPhase) - 0.5) * 0.014;
  col += grain;
  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
