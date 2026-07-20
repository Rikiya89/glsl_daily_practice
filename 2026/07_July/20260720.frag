// ===============================================================
// HALLUCIGENIA SPARSA - CAMBRIAN SPINE-WALKER
// TouchDesigner GLSL TOP fragment shader
// Seamless 30-second procedural raymarched animation.
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

float halluPhase(float t) {
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

// 5. LOOPING HALLUCIGENIA POSE
vec3 halluPose(vec3 p, float t) {
  float ph = halluPhase(t);
  p -= vec3(0.025 * sin(ph), 0.025 * sin(ph * 2.0 + 0.7),
            0.055 * sin(ph + 1.2));
  p.xz *= rot(0.035 * sin(ph * 2.0 + 0.2));
  p.yz *= rot(-0.06 + 0.025 * sin(ph));
  p.xy *= rot(0.035 * sin(ph + 0.9));
  return p;
}

vec3 halluUnpose(vec3 q, float t) {
  float ph = halluPhase(t);
  q.xy *= rot(-0.035 * sin(ph + 0.9));
  q.yz *= rot(0.06 - 0.025 * sin(ph));
  q.xz *= rot(-0.035 * sin(ph * 2.0 + 0.2));
  q += vec3(0.025 * sin(ph), 0.025 * sin(ph * 2.0 + 0.7),
            0.055 * sin(ph + 1.2));
  return q;
}

vec3 halluBodyCenter(float u, float t) {
  float ph = halluPhase(t);
  float env = sin(PI * clamp(u, 0.0, 1.0));
  float wave = sin(ph - u * TAU);
  float breathe = sin(ph * 2.0 - u * TAU * 2.0);
  return vec3(0.105 * env * wave,
              mix(-0.72, 1.18, u),
              0.045 * env * sin(ph - u * TAU + 0.8)
              + 0.018 * breathe);
}

float halluBodyRadius(float u, float t) {
  float ph = halluPhase(t);
  float taper = mix(0.205, 0.125, smoothstep(0.62, 1.0, u));
  float front = mix(0.155, taper, smoothstep(0.0, 0.16, u));
  return front * (1.0 + 0.025 * sin(ph * 2.0 - u * TAU * 2.0));
}

vec3 halluSpinePoint(float u, float side, float v, float t) {
  float ph = halluPhase(t);
  vec3 c = halluBodyCenter(u, t);
  float r = halluBodyRadius(u, t);
  float fi = floor(u * 8.0 + 0.5);
  float flex = 0.075 * sin(ph * 2.0 + fi * 1.17 + side * 0.55);
  vec3 root = c + vec3(side * r * 0.48, 0.0, r * 0.78);
  vec3 mid = root + vec3(side * (0.12 + flex) * v,
                         0.035 * sin(ph + fi) * v,
                         0.43 * v);
  return mid + vec3(-side * 0.10 * v * v, 0.055 * v * v,
                    0.28 * v * v);
}

vec3 halluLegPoint(float u, float side, float v, float t) {
  float ph = halluPhase(t);
  vec3 c = halluBodyCenter(u, t);
  float r = halluBodyRadius(u, t);
  float fi = floor(u * 8.0 + 0.5);
  float gait = sin(ph * 2.0 + fi * PI + (side > 0.0 ? PI : 0.0));
  vec3 root = c + vec3(side * r * 0.62, 0.0, -r * 0.58);
  vec3 foot = root + vec3(side * (0.22 + 0.025 * gait),
                          0.10 * gait,
                         -0.37 + 0.035 * max(gait, 0.0));
  vec3 p = mix(root, foot, v);
  p.x += side * 0.08 * sin(PI * v);
  p.z -= 0.075 * sin(PI * v);
  return p;
}

// 6. BODY AND HEAD
float halluBodySDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 18; i++) {
    float u0 = float(i) / 18.0;
    float u1 = float(i + 1) / 18.0;
    vec3 a = halluBodyCenter(u0, t);
    vec3 b = halluBodyCenter(u1, t);
    d = smin(d, sdTaperedCapsule(q, a, b,
             halluBodyRadius(u0, t), halluBodyRadius(u1, t)), 0.025);
  }
  return d;
}

float halluHeadSDF(vec3 q, float t) {
  float ph = halluPhase(t);
  vec3 neck = halluBodyCenter(0.0, t);
  vec3 headC = neck + vec3(0.045 * sin(ph * 2.0 + 0.4), -0.31,
                           0.035 * sin(ph + 1.1));
  vec3 hp = q - headC;
  hp.xz *= rot(0.10 * sin(ph * 2.0 + 0.3));
  float d = sdEllipsoid(hp, vec3(0.175, 0.255, 0.145));
  d = smin(d, sdTaperedCapsule(q, neck, headC + vec3(0.0, 0.10, 0.0),
                               0.115, 0.145), 0.04);
  return d;
}

vec3 halluHeadCenter(float t) {
  float ph = halluPhase(t);
  return halluBodyCenter(0.0, t) +
         vec3(0.045 * sin(ph * 2.0 + 0.4), -0.31,
              0.035 * sin(ph + 1.1));
}

// 7. EYES AND RADIAL MOUTH
float halluEyesSDF(vec3 q, float t) {
  float ph = halluPhase(t);
  vec3 hc = halluHeadCenter(t);
  float d = 20.0;
  for (int sideI = 0; sideI < 2; sideI++) {
    float side = sideI == 0 ? -1.0 : 1.0;
    vec3 eye = hc + vec3(side * (0.118 + 0.008 * sin(ph * 2.0)),
                         -0.115 + 0.012 * sin(ph + side),
                         0.055 + 0.012 * cos(ph * 2.0 + side));
    d = min(d, sdSphere(q - eye, 0.049));
  }
  return d;
}

float halluMouthSDF(vec3 q, float t) {
  vec3 hc = halluHeadCenter(t);
  vec3 mouth = hc + vec3(0.0, -0.238, -0.018);
  vec3 mp = q - mouth;
  float d = sdTorusY(mp, vec2(0.059, 0.011));
  for (int i = 0; i < 8; i++) {
    float a = TAU * float(i) / 8.0;
    vec3 root = mouth + vec3(cos(a) * 0.052, 0.0, sin(a) * 0.052);
    vec3 tip  = mouth + vec3(cos(a) * 0.022, -0.016, sin(a) * 0.022);
    d = min(d, sdTaperedCapsule(q, root, tip, 0.007, 0.0015));
  }
  return d;
}

// 8. DORSAL SPINE PAIRS
float halluSpinesSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 7; i++) {
    float u = (float(i) + 1.0) / 8.0;
    for (int sideI = 0; sideI < 2; sideI++) {
      float side = sideI == 0 ? -1.0 : 1.0;
      for (int j = 0; j < 3; j++) {
        float v0 = float(j) / 3.0;
        float v1 = float(j + 1) / 3.0;
        vec3 a = halluSpinePoint(u, side, v0, t);
        vec3 b = halluSpinePoint(u, side, v1, t);
        d = min(d, sdTaperedCapsule(q, a, b,
                mix(0.052, 0.006, v0), mix(0.052, 0.006, v1)));
      }
    }
  }
  return d;
}

// 9. VENTRAL TENTACLES AND TERMINAL CLAWS
float halluLegsSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 7; i++) {
    float u = (float(i) + 1.0) / 8.0;
    for (int sideI = 0; sideI < 2; sideI++) {
      float side = sideI == 0 ? -1.0 : 1.0;
      for (int j = 0; j < 3; j++) {
        float v0 = float(j) / 3.0;
        float v1 = float(j + 1) / 3.0;
        vec3 a = halluLegPoint(u, side, v0, t);
        vec3 b = halluLegPoint(u, side, v1, t);
        d = smin(d, sdTaperedCapsule(q, a, b,
                 mix(0.048, 0.021, v0), mix(0.048, 0.021, v1)), 0.008);
      }
      vec3 foot = halluLegPoint(u, side, 1.0, t);
      for (int clawI = 0; clawI < 2; clawI++) {
        float cs = clawI == 0 ? -1.0 : 1.0;
        vec3 tip = foot + vec3(side * (0.035 + 0.025 * cs),
                               -0.045, -0.022 + 0.020 * cs);
        d = min(d, sdTaperedCapsule(q, foot, tip, 0.014, 0.002));
      }
    }
  }
  return d;
}

// 10. SEGMENT DETAILS AND TAIL
float halluBandsSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 1; i < 17; i++) {
    float u = float(i) / 18.0;
    vec3 c = halluBodyCenter(u, t);
    float r = halluBodyRadius(u, t);
    vec3 bp = q - c;
    float ring = sdTorusY(bp, vec2(r * 0.91, 0.010));
    d = min(d, ring);
  }
  return d;
}

float halluTailSDF(vec3 q, float t) {
  vec3 root = halluBodyCenter(0.96, t);
  vec3 tip = halluBodyCenter(1.0, t) + vec3(0.0, 0.17, -0.015);
  float d = sdTaperedCapsule(q, root, tip, 0.13, 0.075);
  d = smin(d, sdEllipsoid(q - tip, vec3(0.10, 0.12, 0.085)), 0.025);
  return d;
}

// 11. SCENE MAP AND MATERIAL IDS
// 1 body/head, 2 eyes, 3 mouth/claws, 4 spines, 5 legs, 6 bands/tail.
Hit mapScene(vec3 p, float t) {
  vec3 q = halluPose(p, t);
  Hit res = Hit(20.0, 0.0);
  res = opSmoothUnion(res, Hit(halluBodySDF(q, t), 1.0), 0.022);
  res = opSmoothUnion(res, Hit(halluHeadSDF(q, t), 1.0), 0.026);
  res = opSmoothUnion(res, Hit(halluEyesSDF(q, t), 2.0), 0.006);
  res = opSmoothUnion(res, Hit(halluMouthSDF(q, t), 3.0), 0.004);
  res = opSmoothUnion(res, Hit(halluSpinesSDF(q, t), 4.0), 0.007);
  res = opSmoothUnion(res, Hit(halluLegsSDF(q, t), 5.0), 0.008);
  res = opSmoothUnion(res, Hit(halluBandsSDF(q, t), 6.0), 0.004);
  res = opSmoothUnion(res, Hit(halluTailSDF(q, t), 6.0), 0.012);
  float ph = halluPhase(t);
  res.d += (fbm(q * 7.2 + vec3(0.11 * sin(ph), 0.11 * cos(ph), 0.0))
            - 0.5) * 0.0028;
  return res;
}

// 12. NORMAL, AMBIENT OCCLUSION, AND RAYMARCHING
vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.0018, 0.0);
  return normalize(vec3(
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

// 13. MATERIAL COLORING
vec3 palette(float x) {
  vec3 a = mix(ACID, CYAN, smoothstep(0.00, 0.38, x));
  vec3 b = mix(VIOLET, PINK, smoothstep(0.46, 1.00, x));
  return mix(a, b, smoothstep(0.24, 0.94, x));
}

vec3 materialColor(float mat, vec3 p, vec3 n, vec3 rd, float t) {
  float ph = halluPhase(t);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.1);
  vec3 q = halluPose(p, t);
  float bands = 0.5 + 0.5 * sin(q.y * 50.0 - ph * 2.0);
  vec3 col;

  if (mat < 1.5) {
    col = mix(CYAN, VIOLET, 0.22 + 0.30 * bands);
    col += CYAN * fres * 0.35;
  } else if (mat < 2.5) {
    col = mix(ACID, PINK, 0.30 + 0.40 * fres);
    col += ACID * 0.38;
  } else if (mat < 3.5) {
    col = mix(PINK, VIOLET, 0.32 + 0.30 * fres);
  } else if (mat < 4.5) {
    float zGrad = smoothstep(0.10, 0.92, q.z);
    col = mix(VIOLET, PINK, zGrad);
    col += CYAN * pow(fres, 0.7) * 0.62;
  } else if (mat < 5.5) {
    col = mix(ACID, CYAN, 0.34 + 0.24 * bands);
    col += PINK * fres * 0.18;
  } else {
    col = mix(CYAN, VIOLET, 0.46 + 0.28 * bands);
    col += PINK * fres * 0.22;
  }
  return col + mix(CYAN, ACID, 0.42) * fres * 0.42;
}

// 14. ANATOMICAL GLOW OVERLAY
vec2 projectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p - ro;
  float z = max(dot(rel, ww), 0.05);
  return vec2(dot(rel, uu), dot(rel, vv)) / z;
}

vec3 halluLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv,
                      vec3 ww, float t) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 17; i++) {
    vec3 a = halluUnpose(halluBodyCenter(float(i) / 17.0, t), t);
    vec3 b = halluUnpose(halluBodyCenter(float(i + 1) / 17.0, t), t);
    float d = distSeg(st, projectPoint(a, ro, uu, vv, ww),
                         projectPoint(b, ro, uu, vv, ww));
    col += mix(CYAN, VIOLET, 0.38) * exp(-d * 145.0) * 0.014;
  }
  for (int i = 0; i < 7; i++) {
    float u = (float(i) + 1.0) / 8.0;
    for (int sideI = 0; sideI < 2; sideI++) {
      float side = sideI == 0 ? -1.0 : 1.0;
      vec3 sr = halluUnpose(halluSpinePoint(u, side, 0.0, t), t);
      vec3 stp = halluUnpose(halluSpinePoint(u, side, 1.0, t), t);
      float sd = distSeg(st, projectPoint(sr, ro, uu, vv, ww),
                            projectPoint(stp, ro, uu, vv, ww));
      col += mix(VIOLET, PINK, 0.58) * exp(-sd * 148.0) * 0.017;

      vec3 lr = halluUnpose(halluLegPoint(u, side, 0.0, t), t);
      vec3 lf = halluUnpose(halluLegPoint(u, side, 1.0, t), t);
      float ld = distSeg(st, projectPoint(lr, ro, uu, vv, ww),
                            projectPoint(lf, ro, uu, vv, ww));
      col += mix(ACID, CYAN, 0.52) * exp(-ld * 152.0) * 0.015;
    }
  }
  return col;
}

// 15. DEEP-OCEAN BACKGROUND
vec3 background(vec2 st, float t) {
  float ph = halluPhase(t);
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

// 16. CAMERA AND FINAL RENDER
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;
  float phase = fract(t / 30.0);
  float loopAngle = TAU * phase;

  // One cinematic orbit; the raised side angle keeps both anatomical rows legible.
  float orbit = -1.15 + loopAngle;
  float radial = 4.15 + 0.12 * sin(loopAngle * 3.0 + 0.6);
  float elevation = 0.55 + 0.35 * sin(loopAngle * 2.0 + 0.45);
  vec3 target = halluUnpose(vec3(0.0, 0.12, 0.08), t);
  vec3 ro = target + vec3(sin(orbit) * radial,
                          cos(orbit) * radial,
                          elevation);

  vec3 ww = normalize(target - ro);
  vec3 up = abs(ww.z) > 0.96 ? vec3(0.0, 1.0, 0.0)
                             : vec3(0.0, 0.0, 1.0);
  vec3 uu = normalize(cross(up, ww));
  vec3 vv = normalize(cross(ww, uu));
  vec3 rd = normalize(uu * st.x + vv * st.y + ww * 1.68);

  vec3 col = background(st, t);
  float glow, mat;
  float d = rayMarch(ro, rd, t, glow, mat);

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p, t);
    vec3 l1 = normalize(vec3(-0.45, 0.82, -0.25));
    vec3 l2 = normalize(vec3(0.58, -0.12, 0.72));
    vec3 fillDir = normalize(vec3(0.15, -0.35, -0.92));
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
    vec3 h = normalize(l1 - rd);
    float spec = pow(max(dot(n, h), 0.0), 68.0);
    lit += mix(CYAN, ACID, 0.42) * spec * 1.75;
    float fog = 1.0 - exp(-d * 0.16);
    col = mix(lit, col, fog * 0.42);
  }

  col += halluLineOverlay(st, ro, uu, vv, ww, t) *
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
