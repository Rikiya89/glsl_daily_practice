// ===============================================================
// ODARAIA NEON FOSSIL
// TouchDesigner GLSL TOP fragment shader
// Isoxys-inspired shield carapace + cardinal spines + stalked eyes
// + grasping appendages + biramous paddles, using the original neon palette.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS 136
#define MAX_DIST  15.0
#define SURF_DIST 0.0011
#define PI        3.14159265359
#define TAU       6.28318530718

const vec3 ACID   = vec3(0.0,  1.0,  0.624);
const vec3 CYAN   = vec3(0.0,  0.812,1.0);
const vec3 VIOLET = vec3(0.545,0.0,  1.0);
const vec3 PINK   = vec3(1.0,  0.0,  0.431);

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float hash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash13(p + vec3(0, 0, 0)), hash13(p + vec3(1, 0, 0)), f.x),
      mix(hash13(p + vec3(0, 1, 0)), hash13(p + vec3(1, 1, 0)), f.x),
      f.y
    ),
    mix(
      mix(hash13(p + vec3(0, 0, 1)), hash13(p + vec3(1, 0, 1)), f.x),
      mix(hash13(p + vec3(0, 1, 1)), hash13(p + vec3(1, 1, 1)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p = p * 2.04 + vec3(17.3, 9.1, 5.7);
    a *= 0.52;
  }
  return v;
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTriPrism(vec3 p, vec2 h) {
  vec3 q = abs(p);
  return max(q.z - h.y, max(q.x * 0.866025 + p.y * 0.5, -p.y) - h.x * 0.5);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

struct Hit {
  float d;
  float m;
};

Hit opUnion(Hit a, Hit b) {
  return a.d < b.d ? a : b;
}

Hit opSmoothUnion(Hit a, Hit b, float k) {
  float d = smin(a.d, b.d, k);
  float h = smoothstep(-k, k, b.d - a.d);
  return Hit(d, mix(b.m, a.m, h));
}

float sdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

vec3 isoxysPose(vec3 p, float t) {
  p.yz *= rot(PI * 0.5);
  p.xy *= rot(-0.08);
  p.yz *= rot(0.10 + 0.025 * sin(t * 0.18));
  p.x += sin(t * 0.34) * 0.030;
  return p;
}

vec3 isoxysUnpose(vec3 q, float t) {
  q.x -= sin(t * 0.34) * 0.030;
  q.yz *= rot(-(0.10 + 0.025 * sin(t * 0.18)));
  q.xy *= rot(0.08);
  q.yz *= rot(-PI * 0.5);
  q += vec3(0.0, 0.08 * sin(t * 0.22), 0.0);
  return q;
}

float trunkWidth(float y) {
  float u = clamp((y + 0.72) / 1.74, 0.0, 1.0);
  return mix(0.18, 0.095, pow(u, 1.35)) * smoothstep(0.0, 0.08, u);
}

vec3 segmentCenter(float y, float t) {
  float u = clamp((y + 0.72) / 1.74, 0.0, 1.0);
  return vec3(
    sin(y * 2.4 - t * 0.30) * 0.015 * smoothstep(0.12, 1.0, u),
    y,
    -0.165 + cos(y * 2.1 - t * 0.25) * 0.010
  );
}

float carapaceSDF(vec3 q, float t) {
  float d = 20.0;

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 c = q - vec3(side * 0.155, 0.04, 0.020);
    c.xy *= rot(side * 0.055);
    c.yz *= rot(side * -0.020);

    float shield = sdEllipsoid(c, vec3(0.245, 1.08, 0.760));
    float frontWall = q.y + 1.02 + side * q.x * 0.035;
    float rearWall = 1.14 - q.y + side * q.x * 0.020;
    shield = max(shield, -frontWall);
    shield = max(shield, -rearWall);

    float ventralOpen = -q.z - 0.455 + 0.040 * cos(q.y * 2.7);
    shield = max(shield, ventralOpen);

    float valveGap = 0.020 - abs(q.x);
    shield = max(shield, valveGap);
    d = min(d, shield);
  }

  float seam = sdCapsule(q, vec3(0.0, -0.98, 0.620), vec3(0.0, 1.12, 0.600), 0.013);
  d = min(d, seam);

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    d = min(d, sdCapsule(q, vec3(side * 0.030, -0.98, 0.548), vec3(side * 0.245, -0.83, 0.360), 0.014));
    d = min(d, sdCapsule(q, vec3(side * 0.235, -0.80, -0.435), vec3(side * 0.255, 0.90, -0.425), 0.014));
  }

  return d;
}

float cardinalSpineSDF(vec3 q, float t) {
  float d = 20.0;
  vec3 a0 = vec3(0.0, -0.92, 0.585);
  vec3 a1 = vec3(0.0, -1.18, 0.705);
  vec3 a2 = vec3(0.0, -1.56, 0.760 + 0.018 * sin(t * 0.25));
  d = smin(d, sdTaperedCapsule(q, a0, a1, 0.075, 0.046), 0.035);
  d = smin(d, sdTaperedCapsule(q, a1, a2, 0.048, 0.010), 0.022);

  vec3 p0 = vec3(0.0, 1.03, 0.570);
  vec3 p1 = vec3(0.0, 1.38, 0.640);
  vec3 p2 = vec3(0.0, 1.86, 0.635 + 0.012 * sin(t * 0.19 + 1.6));
  d = smin(d, sdTaperedCapsule(q, p0, p1, 0.082, 0.050), 0.038);
  d = smin(d, sdTaperedCapsule(q, p1, p2, 0.052, 0.012), 0.022);
  return d;
}

float headSDF(vec3 q, float t) {
  float d = sdEllipsoid(q - vec3(0.0, -0.92, -0.150), vec3(0.200, 0.135, 0.105));

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    float bob = 0.018 * sin(t * 0.46 + side * 0.7);
    vec3 root = vec3(side * 0.095, -0.96, -0.085);
    vec3 tip = vec3(side * 0.285, -1.18, -0.040 + bob);
    d = smin(d, sdTaperedCapsule(q, root, tip, 0.032, 0.050), 0.022);
    d = smin(d, sdSphere(q - tip, 0.185), 0.036);
  }

  return d;
}

float frontalAppendageSDF(vec3 q, float t) {
  float d = 20.0;

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 prev = vec3(side * 0.105, -1.03, -0.205);

    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float u = fi / 6.0;
      float flex = sin(t * 0.72 - fi * 0.55 + side * 0.35) * 0.040;
      vec3 next = vec3(
        side * (0.150 + 0.235 * sin(u * 1.45) - 0.035 * u),
        -1.08 - 0.145 * fi + 0.030 * sin(u * PI + flex),
        -0.245 + 0.105 * fi - 0.046 * fi * fi + flex
      );

      float pod = sdTaperedCapsule(q, prev, next, 0.034 - u * 0.010, 0.030 - u * 0.012);
      d = smin(d, pod, 0.010);
      d = smin(d, sdEllipsoid(q - next, vec3(0.040 - u * 0.010, 0.026, 0.030)), 0.010);

      vec3 inner = mix(prev, next, 0.62);
      vec3 spineTip = inner + vec3(-side * (0.070 + 0.020 * u), -0.020, 0.035 + 0.020 * u);
      d = smin(d, sdTaperedCapsule(q, inner, spineTip, 0.010, 0.0025), 0.004);
      prev = next;
    }

    vec3 clawA = prev;
    vec3 clawB = prev + vec3(-side * 0.080, -0.060, 0.100);
    vec3 clawC = prev + vec3(-side * 0.145, 0.010, 0.160);
    d = smin(d, sdTaperedCapsule(q, clawA, clawB, 0.022, 0.014), 0.008);
    d = smin(d, sdTaperedCapsule(q, clawB, clawC, 0.014, 0.003), 0.006);
  }

  return d;
}

float trunkSDF(vec3 q, float t) {
  float d = 20.0;

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;
    float y = mix(-0.66, 0.98, u);
    vec3 c = segmentCenter(y, t);
    float w = trunkWidth(y);
    float seg = sdEllipsoid(q - c, vec3(w, 0.043, 0.105));
    d = smin(d, seg, 0.018);
  }

  float gut = sdCapsule(q, segmentCenter(-0.60, t) + vec3(0.0, 0.0, 0.010), segmentCenter(1.08, t) + vec3(0.0, 0.0, 0.005), 0.023);
  d = smin(d, gut, 0.018);

  return d;
}

float limbSDF(vec3 q, float t) {
  float d = 20.0;

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;
    float y = mix(-0.58, 0.92, u);
    float w = trunkWidth(y);
    vec3 c = segmentCenter(y, t);

    for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
      float side = sideIndex == 0 ? -1.0 : 1.0;
      float beat = sin(t * 1.36 - fi * 0.48 + side * 0.30);
      float scale = mix(1.0, 0.52, u);
      vec3 root = c + vec3(side * w * 0.82, 0.0, -0.050);
      vec3 endo = root + vec3(side * 0.160 * scale, 0.018 * beat, -0.120 - 0.035 * beat);
      vec3 exoCenter = root + vec3(side * 0.270 * scale, 0.028 * beat, -0.190 - 0.045 * beat);
      vec3 exo = q - exoCenter;
      exo.xy *= rot(side * (0.30 + 0.12 * beat));
      float paddle = sdEllipsoid(exo, vec3(0.145 * scale, 0.040, 0.038));

      d = smin(d, sdTaperedCapsule(q, root, endo, 0.012, 0.006), 0.006);
      d = smin(d, paddle, 0.010);

      for (int j = 0; j < 5; j++) {
        float fj = float(j);
        float su = (fj + 0.5) / 5.0;
        vec3 br = exoCenter + vec3(side * (0.040 + 0.095 * scale), (su - 0.5) * 0.092, -0.010);
        vec3 bt = br + vec3(side * 0.075 * scale, 0.012 * sin(t + fi + fj), 0.055 + 0.010 * fj);
        d = smin(d, sdCapsule(q, br, bt, 0.0032), 0.003);
      }
    }
  }

  return d;
}

float tailSDF(vec3 q, float t) {
  float d = 20.0;
  vec3 root = segmentCenter(1.02, t);
  vec3 flap = q - root - vec3(0.0, 0.205, -0.025 + 0.018 * sin(t * 0.48));
  flap.yz *= rot(-0.16 + 0.035 * sin(t * 0.42));
  d = smin(d, sdEllipsoid(flap, vec3(0.105, 0.175, 0.032)), 0.018);
  d = smin(d, sdTaperedCapsule(q, root, root + vec3(0.0, 0.270, -0.025), 0.040, 0.018), 0.016);

  return d;
}

Hit mapScene(vec3 p, float t) {
  p -= vec3(0.0, 0.08 * sin(t * 0.22), 0.0);
  vec3 q = isoxysPose(p, t);

  Hit res = Hit(20.0, 0.0);
  res = opSmoothUnion(res, Hit(carapaceSDF(q, t), 1.0), 0.040);
  res = opSmoothUnion(res, Hit(headSDF(q, t), 2.0), 0.035);
  res = opSmoothUnion(res, Hit(trunkSDF(q, t), 3.0), 0.030);
  res = opSmoothUnion(res, Hit(limbSDF(q, t), 4.0), 0.014);
  res = opSmoothUnion(res, Hit(frontalAppendageSDF(q, t), 5.0), 0.012);
  res = opSmoothUnion(res, Hit(cardinalSpineSDF(q, t), 6.0), 0.026);
  res = opSmoothUnion(res, Hit(tailSDF(q, t), 6.0), 0.028);

  float texture = (fbm(q * 7.2 + vec3(0.0, t * 0.10, 0.0)) - 0.5) * 0.006;
  res.d += texture;
  return res;
}

float rayMarch(vec3 ro, vec3 rd, float t, out float glow, out float mat) {
  float d = 0.0;
  glow = 0.0;
  mat = 0.0;

  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * d;
    Hit h = mapScene(p, t);
    glow += 0.013 / (0.014 + h.d * h.d * 38.0);

    if (h.d < SURF_DIST || d > MAX_DIST) {
      mat = h.m;
      break;
    }

    d += max(h.d * 0.58, 0.0035);
  }

  return d;
}

vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy, t).d - mapScene(p - e.xyy, t).d,
    mapScene(p + e.yxy, t).d - mapScene(p - e.yxy, t).d,
    mapScene(p + e.yyx, t).d - mapScene(p - e.yyx, t).d
  ));
}

vec3 palette(float x) {
  vec3 a = mix(ACID, CYAN, smoothstep(0.00, 0.38, x));
  vec3 b = mix(VIOLET, PINK, smoothstep(0.46, 1.00, x));
  return mix(a, b, smoothstep(0.24, 0.94, x));
}

vec3 materialColor(float mat, vec3 p, vec3 n, vec3 rd, float t) {
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.1);
  float bands = 0.5 + 0.5 * sin(p.y * 30.0 + p.x * 9.0 - t * 1.2);
  vec3 col = CYAN;

  if (mat < 1.5) {
    col = mix(CYAN, VIOLET, 0.42 + fres * 0.38);
    col += ACID * pow(bands, 10.0) * 0.20;
  } else if (mat < 2.5) {
    col = mix(ACID, CYAN, 0.35 + fres * 0.30);
    col += PINK * fres * 0.25;
  } else if (mat < 3.5) {
    col = mix(CYAN, VIOLET, 0.28 + bands * 0.35);
  } else if (mat < 4.5) {
    col = mix(ACID, CYAN, 0.48) + PINK * fres * 0.50;
  } else if (mat < 5.5) {
    col = mix(ACID, PINK, 0.24 + bands * 0.28);
  } else {
    col = mix(PINK, VIOLET, 0.36 + fres * 0.50);
  }

  col += mix(CYAN, ACID, 0.45) * fres * 0.65;
  return col;
}

float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 projectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p - ro;
  float z = max(dot(rel, ww), 0.05);
  return vec2(dot(rel, uu), dot(rel, vv)) / z;
}

vec3 lineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
  vec3 col = vec3(0.0);

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;
    float y = mix(-0.92, 1.08, u);
    float h = sqrt(max(0.0, 1.0 - pow((y - 0.04) / 1.10, 2.0)));
    float w = 0.245 * h;
    vec3 a = isoxysUnpose(vec3(-w, y, 0.590 * h - 0.045), t);
    vec3 b = isoxysUnpose(vec3(w, y, 0.590 * h - 0.045), t);
    float d = distSeg(st, projectPoint(a, ro, uu, vv, ww), projectPoint(b, ro, uu, vv, ww));
    col += mix(ACID, CYAN, u) * (exp(-d * 145.0) * 0.034 + smoothstep(0.0014, 0.0, d) * 0.055);
  }

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;
    float y = mix(-0.58, 0.92, u);
    float w = trunkWidth(y);
    for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
      float side = sideIndex == 0 ? -1.0 : 1.0;
      vec3 c = segmentCenter(y, t);
      float beat = sin(t * 1.36 - fi * 0.48 + side * 0.30);
      float scale = mix(1.0, 0.52, u);
      vec3 a = isoxysUnpose(c + vec3(side * w * 0.82, 0.0, -0.050), t);
      vec3 b = isoxysUnpose(c + vec3(side * (w + 0.300 * scale), 0.028 * beat, -0.220 - 0.045 * beat), t);
      float d = distSeg(st, projectPoint(a, ro, uu, vv, ww), projectPoint(b, ro, uu, vv, ww));
      col += mix(CYAN, VIOLET, u * 0.65) * exp(-d * 96.0) * 0.030;
    }
  }

  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float u = fi / 6.0;
    for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
      float side = sideIndex == 0 ? -1.0 : 1.0;
      float flex = sin(t * 0.72 - fi * 0.55 + side * 0.35) * 0.040;
      vec3 a = vec3(
        side * (0.150 + 0.235 * sin(max(0.0, u - 0.16) * 1.45) - 0.035 * max(0.0, u - 0.16)),
        -1.08 - 0.145 * max(0.0, fi - 1.0) + 0.030 * sin(max(0.0, u - 0.16) * PI + flex),
        -0.245 + 0.105 * max(0.0, fi - 1.0) - 0.046 * max(0.0, fi - 1.0) * max(0.0, fi - 1.0) + flex
      );
      vec3 b = vec3(
        side * (0.150 + 0.235 * sin(u * 1.45) - 0.035 * u),
        -1.08 - 0.145 * fi + 0.030 * sin(u * PI + flex),
        -0.245 + 0.105 * fi - 0.046 * fi * fi + flex
      );
      a = isoxysUnpose(a, t);
      b = isoxysUnpose(b, t);
      float d = distSeg(st, projectPoint(a, ro, uu, vv, ww), projectPoint(b, ro, uu, vv, ww));
      col += mix(CYAN, VIOLET, u * 0.65) * exp(-d * 96.0) * 0.030;
    }
  }

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 root = isoxysUnpose(vec3(side * 0.095, -0.96, -0.085), t);
    vec3 eye = isoxysUnpose(vec3(side * 0.285, -1.18, -0.040), t);
    vec2 er = projectPoint(root, ro, uu, vv, ww);
    vec2 ee = projectPoint(eye, ro, uu, vv, ww);
    float stalk = distSeg(st, er, ee);
    float eyeGlow = length(st - ee);
    col += mix(ACID, CYAN, 0.28) * exp(-stalk * 95.0) * 0.080;
    col += mix(CYAN, PINK, 0.38) * exp(-eyeGlow * 44.0) * 0.170;
    col += ACID * exp(-eyeGlow * 140.0) * 0.120;
  }

  return col;
}

vec3 background(vec2 st, float t) {
  vec3 col = mix(vec3(0.002, 0.006, 0.022), vec3(0.010, 0.045, 0.095), smoothstep(-1.0, 1.0, st.y));

  float caustic = 0.0;
  vec2 q = st;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    q += 0.20 * vec2(cos(t * 0.16 + fi), sin(t * 0.12 + fi * 1.7));
    caustic += sin(q.x * (3.0 + fi) + t * 0.33) * cos(q.y * (3.6 + fi) - t * 0.26);
  }
  col += mix(CYAN, VIOLET, 0.38) * pow(0.5 + 0.5 * caustic / 5.0, 4.0) * 0.15;

  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec2 p = vec2(hash11(fi * 13.7), hash11(fi * 41.2)) * 2.0 - 1.0;
    p.y = fract(p.y * 0.5 + 0.5 + t * (0.012 + hash11(fi) * 0.025)) * 2.2 - 1.1;
    p.x += sin(t * 0.10 + fi) * 0.055;
    float d = length(st - p);
    col += palette(hash11(fi * 4.9)) * exp(-d * 90.0) * (0.014 + 0.032 * hash11(fi * 2.1));
  }

  return col;
}

void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;

  float cycle = 0.5 + 0.5 * sin(t * 0.16);
  float track = smoothstep(0.28, 0.92, cycle);
  vec3 headTarget = isoxysUnpose(vec3(0.0, -1.12, -0.080), t);
  vec3 midTarget = isoxysUnpose(vec3(0.0, 0.04, 0.030), t);
  vec3 tailTarget = isoxysUnpose(vec3(0.0, 1.44, 0.545), t);
  vec3 target = mix(headTarget, midTarget, track);
  float tailReveal = smoothstep(0.68, 0.96, track);
  target = mix(target, tailTarget, tailReveal * 0.48);

  float orbit = -0.88 + sin(t * 0.12) * 0.26 + tailReveal * 0.34;
  float camDist = 4.05 + tailReveal * 0.74 + 0.18 * sin(t * 0.11 + 1.2);
  vec3 ro = target + vec3(
    sin(orbit) * camDist,
    0.54 + tailReveal * 0.28 + sin(t * 0.17) * 0.18,
    cos(orbit) * camDist
  );
  vec3 ww = normalize(target - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = cross(ww, uu);
  float lens = mix(1.42, 1.74, tailReveal);
  vec3 rd = normalize(uu * st.x * 0.96 + vv * st.y + ww * lens);

  vec3 col = background(st, t);

  float glow;
  float mat;
  float d = rayMarch(ro, rd, t, glow, mat);

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p, t);

    vec3 l1 = normalize(vec3(-0.45, 0.82, -0.25));
    vec3 l2 = normalize(vec3(0.58, -0.12, 0.72));
    float diff = max(dot(n, l1), 0.0);
    float back = pow(max(dot(l2, rd), 0.0), 2.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);

    vec3 body = materialColor(mat, p, n, rd, t);
    vec3 lit = body * (0.26 + diff * 0.72);
    lit += ACID * back * 0.28;
    lit += mix(VIOLET, PINK, 0.48) * rim * 1.10;

    vec3 h = normalize(l1 - rd);
    float spec = pow(max(dot(n, h), 0.0), 68.0);
    lit += mix(CYAN, ACID, 0.42) * spec * 1.75;

    float fog = 1.0 - exp(-d * 0.16);
    col = mix(lit, col, fog * 0.42);
  }

  col += lineOverlay(st, ro, uu, vv, ww, t) * (1.05 + 0.08 * sin(t));
  col += palette(0.42 + 0.22 * sin(t * 0.36)) * glow * 0.105;

  vec2 halo = st;
  halo.y += 0.05;
  float ring = exp(-abs(length(halo) - 0.72) * 28.0);
  col += mix(CYAN, VIOLET, 0.50) * ring * 0.045;
  col += PINK * pow(max(0.0, 1.0 - length(st * vec2(0.72, 1.0))), 4.4) * 0.075;

  col *= 1.78 + 0.13 * sin(t * 1.0);
  col += pow(max(col, 0.0), vec3(1.32)) * 0.34;

  float vignette = 1.0 - 0.20 * smoothstep(0.35, 1.60, length(st));
  col *= vignette;

  col = col / (0.82 + col);
  col = pow(max(col, 0.0), vec3(0.94));

  float grain = (hash11(uv.x * 1234.5 + uv.y * 987.6 + t) - 0.5) * 0.014;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
