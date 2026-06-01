// ===============================================================
// ODARAIA NEON FOSSIL
// TouchDesigner GLSL TOP fragment shader
// Bivalved carapace + stalked eyes + segmented trunk + biramous
// limb haze + three-part tail fan, using the original neon palette.
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

vec3 odaraiaPose(vec3 p, float t) {
  p.yz *= rot(PI * 0.5);
  p.xy *= rot(-0.16);
  p.yz *= rot(0.18);
  float swimMask = smoothstep(-1.1, 2.8, p.y);
  p.x += sin(p.y * 1.65 - t * 0.82) * 0.044 * swimMask;
  p.z += cos(p.y * 1.85 - t * 0.70) * 0.030 * swimMask;
  return p;
}

vec3 odaraiaUnpose(vec3 q, float t) {
  float swimMask = smoothstep(-1.1, 2.8, q.y);
  q.x -= sin(q.y * 1.65 - t * 0.82) * 0.044 * swimMask;
  q.z -= cos(q.y * 1.85 - t * 0.70) * 0.030 * swimMask;
  q.yz *= rot(-0.18);
  q.xy *= rot(0.16);
  q.yz *= rot(-PI * 0.5);
  q += vec3(0.0, 0.08 * sin(t * 0.22), 0.0);
  return q;
}

float trunkWidth(float y) {
  float u = clamp((y + 1.00) / 3.60, 0.0, 1.0);
  return mix(0.48, 0.20, pow(u, 1.45)) * smoothstep(0.0, 0.08, u);
}

vec3 segmentCenter(float y, float t) {
  float u = clamp((y + 1.0) / 3.6, 0.0, 1.0);
  return vec3(
    sin(y * 1.9 - t * 0.72) * 0.040 * smoothstep(0.12, 1.0, u),
    y,
    cos(y * 1.7 - t * 0.60) * 0.020
  );
}

float carapaceSDF(vec3 q, float t) {
  float d = 20.0;

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 c = q - vec3(side * 0.40, 0.36, 0.090);
    c.xy *= rot(side * 0.13);
    c.yz *= rot(-0.07);
    float shell = sdEllipsoid(c, vec3(0.58, 1.74, 0.155));

    float frontCut = q.y + 1.46 + side * q.x * 0.16;
    float rearCut = 2.15 - q.y + abs(q.x) * 0.12;
    shell = max(shell, -frontCut);
    shell = max(shell, -rearCut);

    float lowerOpen = q.z + 0.165 + 0.026 * sin(q.y * 7.5);
    shell = max(shell, lowerOpen);

    d = min(d, shell);
  }

  float seam = sdCapsule(q, vec3(0.0, -1.20, 0.205), vec3(0.0, 2.05, 0.205), 0.012);
  d = min(d, seam);

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 frontA = vec3(side * 0.10, -1.43, -0.030);
    vec3 frontB = vec3(side * 0.52, -1.22, 0.020);
    vec3 lowerA = vec3(side * 0.49, -1.05, -0.140);
    vec3 lowerB = vec3(side * 0.56, 1.68, -0.140);
    d = min(d, sdCapsule(q, frontA, frontB, 0.018));
    d = min(d, sdCapsule(q, lowerA, lowerB, 0.012));
  }

  return d;
}

float headSDF(vec3 q, float t) {
  float d = sdEllipsoid(q - vec3(0.0, -1.34, -0.080), vec3(0.32, 0.24, 0.150));
  d = smin(d, sdEllipsoid(q - vec3(0.0, -1.54, -0.180), vec3(0.19, 0.12, 0.060)), 0.045);
  d = smin(d, sdTriPrism((q - vec3(0.0, -1.50, -0.245)).xzy, vec2(0.20, 0.035)), 0.020);

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 root = vec3(side * 0.14, -1.43, -0.075);
    vec3 tip = vec3(side * 0.42, -1.68, -0.265 + 0.018 * sin(t * 0.8 + side));
    d = smin(d, sdCapsule(q, root, tip, 0.030), 0.024);
    d = smin(d, sdEllipsoid(q - tip, vec3(0.155, 0.130, 0.115)), 0.032);

    vec3 mandA = vec3(side * 0.080, -1.50, -0.220);
    vec3 mandB = vec3(side * 0.245, -1.58, -0.300);
    d = smin(d, sdCapsule(q, mandA, mandB, 0.020), 0.012);
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      vec3 tooth = mix(mandA, mandB, (fk + 0.6) / 4.6);
      d = smin(d, sdCapsule(q, tooth, tooth + vec3(side * 0.020, -0.010, -0.050), 0.004), 0.003);
    }
  }

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = (fi - 1.0) * 0.070;
    vec3 sense = q - vec3(x, -1.63 - 0.018 * abs(fi - 1.0), -0.085);
    d = smin(d, sdSphere(sense, 0.035), 0.018);
  }

  return d;
}

float trunkSDF(vec3 q, float t) {
  float d = 20.0;

  for (int i = 0; i < 34; i++) {
    float fi = float(i);
    float u = fi / 33.0;
    float y = mix(-0.88, 2.58, u);
    vec3 c = segmentCenter(y, t);
    float w = trunkWidth(y);
    float seg = sdEllipsoid(q - c, vec3(w, 0.037, 0.125));
    d = smin(d, seg, 0.016);

    float sternite = sdTriPrism((q - c - vec3(0.0, 0.000, -0.120)).xzy, vec2(w * 0.34, 0.012));
    d = smin(d, sternite, 0.008);
  }

  float gut = sdCapsule(q, segmentCenter(-0.78, t) + vec3(0.0, 0.0, -0.010), segmentCenter(2.52, t) + vec3(0.0, 0.0, -0.015), 0.026);
  d = smin(d, gut, 0.018);

  return d;
}

float limbSDF(vec3 q, float t) {
  float d = 20.0;

  for (int i = 0; i < 30; i++) {
    float fi = float(i);
    float u = fi / 29.0;
    float y = mix(-0.68, 2.32, u);
    float w = trunkWidth(y);
    vec3 c = segmentCenter(y, t);

    for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
      float side = sideIndex == 0 ? -1.0 : 1.0;
      float beat = sin(t * 1.42 - fi * 0.35 + side * 0.8);
      vec3 root = c + vec3(side * w * 0.55, 0.0, -0.050);
      vec3 mid = c + vec3(side * (w + 0.20), 0.014 * beat, -0.205 - 0.035 * beat);
      vec3 tip = c + vec3(side * (w + 0.56), 0.030 * beat, -0.335 - 0.060 * beat);
      float leg = sdCapsule(q, root, mid, 0.011);
      leg = smin(leg, sdCapsule(q, mid, tip, 0.0065), 0.006);
      d = smin(d, leg, 0.006);

      for (int j = 0; j < 6; j++) {
        float fj = float(j);
        vec3 br = mix(root, tip, (fj + 1.0) / 7.0);
        vec3 bt = br + vec3(side * (0.14 + 0.030 * fj), 0.022 * sin(t + fi + fj), 0.075 + 0.018 * fj);
        d = smin(d, sdCapsule(q, br, bt, 0.0035), 0.003);
      }
    }
  }

  return d;
}

float spineRowsSDF(vec3 q, float t) {
  float d = 20.0;

  for (int i = 0; i < 34; i++) {
    float fi = float(i);
    float u = fi / 33.0;
    float y = mix(-0.82, 2.44, u);
    vec3 c = segmentCenter(y, t);

    for (int row = -2; row <= 2; row++) {
      float fr = float(row);
      float x = fr * 0.040;
      vec3 a = c + vec3(x, -0.010, 0.118);
      vec3 b = c + vec3(x * 1.35, 0.010, 0.215 + 0.015 * abs(fr));
      d = smin(d, sdCapsule(q, a, b, 0.0045), 0.003);
    }
  }

  return d;
}

float tailSDF(vec3 q, float t) {
  float d = 20.0;
  vec3 root = segmentCenter(2.45, t);
  vec3 mid = root + vec3(0.065 * sin(t * 0.90), 0.36, -0.060);
  vec3 terminal = root + vec3(0.16 * sin(t * 0.90 + 0.4), 0.72, -0.110);
  d = smin(d, sdCapsule(q, root, mid, 0.075), 0.024);
  d = smin(d, sdCapsule(q, mid, terminal, 0.054), 0.020);

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 fin = q - terminal - vec3(side * 0.27, 0.19, -0.010);
    fin.xy *= rot(side * (0.52 + 0.09 * sin(t)));
    float ramus = sdEllipsoid(fin, vec3(0.48, 0.105, 0.032));
    d = smin(d, ramus, 0.022);

    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      vec3 a = terminal + vec3(side * (0.06 + fi * 0.052), 0.08 + fi * 0.028, 0.020);
      vec3 b = a + vec3(side * 0.060, -0.012, 0.075);
      d = smin(d, sdCapsule(q, a, b, 0.004), 0.003);
    }
  }

  vec3 dorsal = q - terminal - vec3(0.0, 0.04, 0.150);
  dorsal.yz *= rot(-0.34);
  d = smin(d, sdEllipsoid(dorsal, vec3(0.075, 0.335, 0.036)), 0.020);

  return d;
}

Hit mapScene(vec3 p, float t) {
  p -= vec3(0.0, 0.08 * sin(t * 0.22), 0.0);
  vec3 q = odaraiaPose(p, t);

  Hit res = Hit(20.0, 0.0);
  res = opSmoothUnion(res, Hit(carapaceSDF(q, t), 1.0), 0.040);
  res = opSmoothUnion(res, Hit(headSDF(q, t), 2.0), 0.035);
  res = opSmoothUnion(res, Hit(trunkSDF(q, t), 3.0), 0.030);
  res = opSmoothUnion(res, Hit(limbSDF(q, t), 4.0), 0.014);
  res = opSmoothUnion(res, Hit(spineRowsSDF(q, t), 5.0), 0.010);
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

  for (int i = 0; i < 34; i++) {
    float fi = float(i);
    float u = fi / 33.0;
    float y = mix(-0.88, 2.58, u);
    float w = trunkWidth(y);
    vec3 c = segmentCenter(y, t);
    vec3 a = odaraiaUnpose(c + vec3(-w * 0.90, 0.0, 0.140), t);
    vec3 b = odaraiaUnpose(c + vec3(w * 0.90, 0.0, 0.140), t);
    float d = distSeg(st, projectPoint(a, ro, uu, vv, ww), projectPoint(b, ro, uu, vv, ww));
    col += mix(ACID, CYAN, u) * (exp(-d * 145.0) * 0.034 + smoothstep(0.0014, 0.0, d) * 0.055);
  }

  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float u = fi / 25.0;
    float y = mix(-0.62, 2.20, u);
    float w = trunkWidth(y);
    for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
      float side = sideIndex == 0 ? -1.0 : 1.0;
      vec3 c = segmentCenter(y, t);
      vec3 a = odaraiaUnpose(c + vec3(side * w * 0.75, 0.0, -0.02), t);
      vec3 b = odaraiaUnpose(c + vec3(side * (w + 0.62), 0.02 * sin(t + fi), -0.23), t);
      float d = distSeg(st, projectPoint(a, ro, uu, vv, ww), projectPoint(b, ro, uu, vv, ww));
      col += mix(CYAN, VIOLET, u * 0.65) * exp(-d * 96.0) * 0.030;
    }
  }

  for (int sideIndex = 0; sideIndex < 2; sideIndex++) {
    float side = sideIndex == 0 ? -1.0 : 1.0;
    vec3 root = odaraiaUnpose(vec3(side * 0.14, -1.43, -0.075), t);
    vec3 eye = odaraiaUnpose(vec3(side * 0.42, -1.68, -0.265), t);
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
  vec3 headTarget = odaraiaUnpose(vec3(0.0, -1.46, -0.170), t);
  vec3 midTarget = odaraiaUnpose(vec3(0.0, 0.35, -0.040), t);
  vec3 tailTarget = odaraiaUnpose(vec3(0.0, 1.70, -0.070), t);
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
