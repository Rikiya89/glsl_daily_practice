// ===============================================================
// CAMBRIAN RELIC - Pikaia Neon Chordate v1.3
// TouchDesigner GLSL TOP
// Slender chordate body + luminous dorsal ribbon + tail lance
// + repeating myomere chevrons + soft Cambrian water glow.
// Original neon color constants are preserved exactly.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS    132
#define MAX_DIST     12.0
#define SURF_DIST    0.0009
#define TAU          6.28318530718
#define PI           3.14159265359

#define INTENSITY    1.82
#define GLOW_POWER   2.35
#define VEIL_POWER   1.70

const vec3 ACID   = vec3(0.0,  1.0,  0.624);
const vec3 CYAN   = vec3(0.0,  0.812,1.0);
const vec3 VIOLET = vec3(0.545,0.0,  1.0);
const vec3 PINK   = vec3(1.0,  0.0,  0.431);

#define BODY_START  -0.92
#define BODY_END     3.34

float hash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
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
    p *= 2.04;
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

float softUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

struct Cam {
  vec3 ro;
  vec3 fwd;
  vec3 rgt;
  vec3 up;
};

vec3 creatureOffset(float t) {
  float swimT = t * 0.25;

  return vec3(
    sin(swimT * 0.42) * 0.13 + sin(t * 0.28) * 0.016,
    sin(swimT * 0.28 + 1.1) * 0.052 + sin(t * 0.16) * 0.015,
    cos(swimT * 0.30) * 0.08 + sin(t * 0.22) * 0.014
  );
}

Cam makeCam(float t) {
  Cam c;
  vec3 center = creatureOffset(t);
  float reveal = smoothstep(0.0, 5.8, t);

  float yawStart  = -0.58;
  float distStart = 1.42;
  float heightStart = 0.20;

  float yawCruise    = -0.82 + (t - 5.8) * 0.030;
  float distCruise   = 3.72 + 0.10 * sin(t * 0.13);
  float heightCruise = 1.04 + 0.11 * sin(t * 0.09);

  float yaw    = mix(yawStart,    yawCruise,    reveal);
  float dist   = mix(distStart,   distCruise,   reveal);
  float height = mix(heightStart, heightCruise, reveal);

  vec3 orbitPos = vec3(sin(yaw) * dist, height, cos(yaw) * dist);
  float targetZ = mix(-0.58, 1.20 + 0.05 * sin(t * 0.12), reveal);
  vec3 target = center + vec3(0.0, 0.0, targetZ);

  c.ro = center + orbitPos;
  c.fwd = normalize(target - c.ro);
  c.rgt = normalize(cross(vec3(0, 1, 0), c.fwd));
  c.up = cross(c.fwd, c.rgt);

  return c;
}

// Local coordinates:
// -Y = head, +Y = tail, X = left-right, Z = dorsal-ventral.
vec3 pikaiaPose(vec3 p) {
  p.yz *= rot(PI * 0.5);
  p.xy *= rot(-0.07);
  return p;
}

vec3 unposePikaia(vec3 q) {
  q.xy *= rot(0.07);
  q.yz *= rot(-PI * 0.5);
  return q;
}

vec3 bendSpace(vec3 p, float t) {
  p -= creatureOffset(t);
  p = pikaiaPose(p);

  p.xz *= rot(0.020 * sin(t * 0.18));
  p.yz *= rot(0.014 * sin(t * 0.14 + 1.3));

  float bodyMask = smoothstep(BODY_START + 0.08, BODY_END - 0.16, p.y);
  float tailMask = smoothstep(1.40, BODY_END - 0.12, p.y);
  float wave = sin(p.y * 3.18 - t * 1.08);
  float wave2 = sin(p.y * 6.10 - t * 1.55 + 0.8);
  float breath = 0.90 + 0.10 * sin(t * 0.24);
  float amp = mix(0.008, 0.128, tailMask) * breath;

  p.x += (wave * amp + wave2 * amp * 0.20) * bodyMask;
  p.z += cos(p.y * 3.18 - t * 1.08) * amp * 0.18 * bodyMask;

  return p;
}

float bodyRadius(float y) {
  float u = clamp((y - BODY_START) / (BODY_END - BODY_START), 0.0, 1.0);
  float leaf = pow(sin(u * PI), 0.55);
  float bluntHead = smoothstep(0.03, 0.17, u);
  float tailNeedle = 1.0 - smoothstep(0.82, 1.0, u) * 0.68;
  return (0.026 + leaf * 0.230) * bluntHead * tailNeedle + 0.018;
}

float dorsalHeight(float y) {
  float u = clamp((y - BODY_START) / (BODY_END - BODY_START), 0.0, 1.0);
  float arch = pow(sin(u * PI), 0.74);
  float rearDrop = 1.0 - smoothstep(0.64, 0.98, u) * 0.42;
  return 0.060 + arch * rearDrop * 0.265;
}

vec3 spinePoint(float y, float t) {
  float u = clamp((y - BODY_START) / (BODY_END - BODY_START), 0.0, 1.0);
  float amp = mix(0.006, 0.118, smoothstep(0.24, 1.0, u));
  return vec3(
    sin(y * 3.18 - t * 1.08) * amp,
    y,
    cos(y * 3.18 - t * 1.08) * amp * 0.16
  );
}

float headSDF(vec3 q, float t) {
  vec3 h = q - spinePoint(BODY_START + 0.21, t) - vec3(0.0, -0.03, 0.000);
  float head = sdEllipsoid(h, vec3(0.128, 0.235, 0.095));
  float snout = sdEllipsoid(q - spinePoint(BODY_START + 0.02, t) - vec3(0.0, -0.006, -0.012), vec3(0.070, 0.110, 0.052));
  float oralDot = sdSphere(q - spinePoint(BODY_START - 0.04, t) - vec3(0.0, -0.016, -0.018), 0.020);

  return softUnion(softUnion(head, snout, 0.050), oralDot, 0.018);
}

float trunkSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 43; i++) {
    float fi = float(i);
    float u = fi / 42.0;
    float y = mix(BODY_START + 0.12, BODY_END - 0.16, u);
    vec3 c = spinePoint(y, t);
    float r = bodyRadius(y);
    float segment = sdEllipsoid(q - c, vec3(r * 0.55, 0.072, r * 0.42));
    d = softUnion(d, segment, 0.043);
  }

  float notochord = sdCapsule(q, spinePoint(BODY_START + 0.18, t) + vec3(0.0, 0.0, 0.035), spinePoint(BODY_END - 0.22, t) + vec3(0.0, 0.0, 0.016), 0.022);
  d = softUnion(d, notochord, 0.024);

  return d;
}

float dorsalFinSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 34; i++) {
    float fi = float(i);
    float u = fi / 33.0;
    float y = mix(BODY_START + 0.20, BODY_END - 0.32, u);
    float flutter = (
      sin(t * 1.34 - fi * 0.20) * 0.70 +
      sin(t * 2.10 - fi * 0.33 + 1.4) * 0.30
    ) * mix(0.010, 0.030, u);
    vec3 c = spinePoint(y, t) + vec3(0.0, 0.0, dorsalHeight(y) + flutter);
    float fin = sdEllipsoid(q - c, vec3(mix(0.040, 0.024, u), 0.118, mix(0.050, 0.070, u)));
    d = softUnion(d, fin, 0.020);
  }

  return d;
}

float ventralVeilSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    float u = fi / 27.0;
    float y = mix(BODY_START + 0.46, BODY_END - 0.56, u);
    float sag = -bodyRadius(y) * 0.44 - 0.042;
    float beat = sin(t * 1.62 - fi * 0.46 + 1.1);
    vec3 c = spinePoint(y, t) + vec3(beat * 0.012, 0.0, sag + beat * 0.016);
    float veil = sdEllipsoid(q - c, vec3(mix(0.066, 0.026, u), 0.100, 0.018));
    d = softUnion(d, veil, 0.019);
  }

  return d;
}

float tailSDF(vec3 q, float t) {
  float d = 10.0;
  float rudder = sin(t * 1.08 - 2.88 * 3.18) * 0.092;

  vec3 root = spinePoint(BODY_END - 0.44, t);
  vec3 tip = spinePoint(BODY_END + 0.16, t) + vec3(rudder, 0.0, 0.008);
  d = softUnion(d, sdCapsule(q, root, tip, 0.034), 0.024);

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec3 fin = q - tip - vec3(side * 0.052 + rudder * 0.3, -0.035, 0.010);
    fin.xy *= rot(side * (0.50 + rudder * 0.7));
    float blade = sdEllipsoid(fin, vec3(0.110, 0.170, 0.018));
    d = softUnion(d, blade, 0.018);
  }

  return d;
}

float myomereSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 38; i++) {
    float fi = float(i);
    float u = fi / 37.0;
    float y = mix(BODY_START + 0.28, BODY_END - 0.38, u);
    float width = bodyRadius(y) * 0.62;
    vec3 c = spinePoint(y, t);

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      float lean = mix(0.075, 0.025, u);
      vec3 a = c + vec3(side * width * 0.96, -0.055, dorsalHeight(y) * 0.34);
      vec3 b = c + vec3(side * width * 0.10, 0.035 + lean, -bodyRadius(y) * 0.30);
      float rib = sdCapsule(q, a, b, mix(0.008, 0.004, u));
      d = softUnion(d, rib, 0.006);
    }
  }

  return d;
}

float organRowSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 25; i++) {
    float fi = float(i);
    float u = fi / 24.0;
    float y = mix(BODY_START + 0.76, BODY_END - 1.18, u);
    vec3 c = spinePoint(y, t) + vec3(0.0, 0.0, -bodyRadius(y) * 0.52 - 0.050);
    float pulse = 1.0 + 0.10 * sin(t * 1.10 - fi * 0.42);
    float organ = sdEllipsoid(q - c, vec3(0.040, 0.030, 0.034) * pulse);
    d = softUnion(d, organ, 0.012);
  }

  return d;
}

float whiskerSDF(vec3 q, float t) {
  float d = 10.0;

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec3 root = spinePoint(BODY_START + 0.02, t) + vec3(side * 0.025, -0.018, -0.018);

    for (int j = 1; j <= 5; j++) {
      float u = float(j) / 5.0;
      vec3 tip = spinePoint(BODY_START - u * 0.30, t)
        + vec3(side * (0.020 + u * 0.092 + sin(t * 1.26 + u * 3.0 + side * 0.7) * 0.016), -u * 0.052, -0.018 - u * 0.020);
      d = softUnion(d, sdCapsule(q, root, tip, mix(0.008, 0.003, u)), 0.006);
      root = tip;
    }
  }

  return d;
}

float creatureSDF(vec3 p, float t) {
  vec3 q = bendSpace(p, t);

  float d = headSDF(q, t);
  d = softUnion(d, trunkSDF(q, t), 0.090);
  d = softUnion(d, dorsalFinSDF(q, t), 0.030);
  d = softUnion(d, ventralVeilSDF(q, t), 0.024);
  d = softUnion(d, tailSDF(q, t), 0.036);
  d = softUnion(d, myomereSDF(q, t), 0.015);
  d = softUnion(d, organRowSDF(q, t), 0.014);
  d = softUnion(d, whiskerSDF(q, t), 0.012);

  float surfaceTexture = (fbm(q * 6.4 + vec3(0.0, t * 0.11, 0.0)) - 0.5) * 0.006;
  return d + surfaceTexture;
}

vec3 getNormal(vec3 p, float t) {
  float e = 0.002;
  vec2 k = vec2(1.0, -1.0);

  return normalize(
    k.xyy * creatureSDF(p + k.xyy * e, t) +
    k.yyx * creatureSDF(p + k.yyx * e, t) +
    k.yxy * creatureSDF(p + k.yxy * e, t) +
    k.xxx * creatureSDF(p + k.xxx * e, t)
  );
}

float rayMarch(vec3 ro, vec3 rd, float t) {
  float d = 0.0;

  for (int i = 0; i < MAX_STEPS; i++) {
    float surfaceDistance = creatureSDF(ro + rd * d, t);

    if (surfaceDistance < SURF_DIST || d > MAX_DIST) {
      break;
    }

    d += max(surfaceDistance * 0.62, 0.0035);
  }

  return d;
}

float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 project(vec3 p, Cam c) {
  vec3 rel = p - c.ro;
  float zc = max(dot(rel, c.fwd), 0.06);
  return vec2(dot(rel, c.rgt) / zc, dot(rel, c.up) / zc);
}

vec3 localToWorld(vec3 q, float t) {
  q = unposePikaia(q);
  return q + creatureOffset(t);
}

float caustic(vec2 p, float t) {
  vec2 q = p * 1.55;
  float c = 0.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    q += 0.24 * vec2(cos(t * 0.22 + fi * 2.0), sin(t * 0.18 + fi * 1.6));
    c += sin(q.x * (2.2 + fi) + t * (0.42 + fi * 0.08))
       * cos(q.y * (2.6 + fi) - t * 0.32);
  }

  return pow(0.5 + 0.5 * c / 4.0, 3.4);
}

float marineSnow(vec2 p, float t) {
  float snow = 0.0;

  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 drift = p * (1.0 + fi * 0.56) + vec2(t * 0.022 * (fi + 1.0), -t * 0.016 * (fi + 0.5));
    vec2 cell = floor(drift);
    vec2 f = fract(drift) - 0.5;
    float h = hash11(dot(cell, vec2(41.7, 289.3)) + fi * 19.1);

    if (h > 0.984) {
      snow += smoothstep(0.05, 0.0, length(f)) * (1.0 - fi * 0.09);
    }
  }

  return snow;
}

vec3 renderDorsalGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);

  for (int i = 0; i < 34; i++) {
    float u0 = float(i) / 34.0;
    float u1 = float(i + 1) / 34.0;
    float y0 = mix(BODY_START + 0.18, BODY_END - 0.32, u0);
    float y1 = mix(BODY_START + 0.18, BODY_END - 0.32, u1);
    float shimmer0 = sin(t * 1.34 - float(i) * 0.20) * 0.70 + sin(t * 2.10 - float(i) * 0.33 + 1.4) * 0.30;
    float shimmer1 = sin(t * 1.34 - float(i + 1) * 0.20) * 0.70 + sin(t * 2.10 - float(i + 1) * 0.33 + 1.4) * 0.30;
    vec3 a = spinePoint(y0, t) + vec3(0.0, 0.0, dorsalHeight(y0) + shimmer0 * 0.026);
    vec3 b = spinePoint(y1, t) + vec3(0.0, 0.0, dorsalHeight(y1) + shimmer1 * 0.026);
    float d = distSeg(st, project(localToWorld(a, t), cam), project(localToWorld(b, t), cam));
    vec3 finColor = mix(CYAN, VIOLET, u0 * 0.72);
    finColor = mix(finColor, PINK, smoothstep(0.60, 1.0, u0) * 0.30);
    float travelingLight = 0.70 + 0.30 * sin(t * 1.55 - u0 * 9.0);
    col += finColor * (smoothstep(0.0012, 0.0, d) * 0.24 + exp(-d * 88.0) * 0.075) * VEIL_POWER * travelingLight;
  }

  return col;
}

vec3 renderMyomereGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);

  for (int i = 0; i < 38; i++) {
    float fi = float(i);
    float u = fi / 37.0;
    float y = mix(BODY_START + 0.28, BODY_END - 0.38, u);
    vec3 c = spinePoint(y, t);
    float width = bodyRadius(y) * 0.64;
    float pulse = 0.66 + 0.34 * sin(t * 1.08 - fi * 0.32);

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      vec3 a = c + vec3(side * width, -0.052, dorsalHeight(y) * 0.34);
      vec3 b = c + vec3(side * width * 0.12, 0.038, -bodyRadius(y) * 0.30);
      float d = distSeg(st, project(localToWorld(a, t), cam), project(localToWorld(b, t), cam));
      vec3 ribColor = mix(ACID, CYAN, 0.35 + u * 0.35);
      col += ribColor * (exp(-d * 180.0) * 0.050 + smoothstep(0.0013, 0.0, d) * 0.040) * pulse * GLOW_POWER;
    }
  }

  return col;
}

vec3 renderTailGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  float rudder = sin(t * 1.08 - 2.88 * 3.18) * 0.092;
  vec3 root = spinePoint(BODY_END - 0.48, t);
  vec3 tip = spinePoint(BODY_END + 0.16, t) + vec3(rudder, 0.0, 0.008);
  float shaft = distSeg(st, project(localToWorld(root, t), cam), project(localToWorld(tip, t), cam));
  col += mix(VIOLET, PINK, 0.56) * (smoothstep(0.0015, 0.0, shaft) * 0.22 + exp(-shaft * 78.0) * 0.080) * GLOW_POWER;

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec3 edge = tip + vec3(side * 0.15 + rudder * 0.22, -0.11, 0.020);
    float blade = distSeg(st, project(localToWorld(tip, t), cam), project(localToWorld(edge, t), cam));
    col += mix(PINK, ACID, 0.22) * (smoothstep(0.0015, 0.0, blade) * 0.18 + exp(-blade * 88.0) * 0.070) * GLOW_POWER;
  }

  return col;
}

vec3 renderWhiskerGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec3 prev = spinePoint(BODY_START + 0.02, t) + vec3(side * 0.025, -0.018, -0.018);

    for (int j = 1; j <= 5; j++) {
      float u = float(j) / 5.0;
      vec3 next = spinePoint(BODY_START - u * 0.30, t)
        + vec3(side * (0.020 + u * 0.092 + sin(t * 1.26 + u * 3.0 + side * 0.7) * 0.016), -u * 0.052, -0.018 - u * 0.020);
      float d = distSeg(st, project(localToWorld(prev, t), cam), project(localToWorld(next, t), cam));
      col += mix(PINK, ACID, u * 0.28) * (smoothstep(0.0011, 0.0, d) * 0.32 + exp(-d * 110.0) * 0.045) * GLOW_POWER;
      prev = next;
    }
  }

  return col;
}

vec3 renderOrganGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);

  for (int i = 0; i < 25; i++) {
    float fi = float(i);
    float u = fi / 24.0;
    float y = mix(BODY_START + 0.76, BODY_END - 1.18, u);
    vec3 c = spinePoint(y, t) + vec3(0.0, 0.0, -bodyRadius(y) * 0.52 - 0.050);
    float d = length(st - project(localToWorld(c, t), cam));
    vec3 organColor = mix(VIOLET, PINK, 0.35);
    float pulse = 0.72 + 0.28 * sin(t * 1.10 - fi * 0.42);
    col += organColor * (smoothstep(0.010, 0.0, d) * 0.060 + exp(-d * 42.0) * 0.038) * pulse;
  }

  return col;
}

vec3 renderFilterStream(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 mouth = spinePoint(BODY_START - 0.04, t) + vec3(0.0, -0.035, -0.020);

  for (int i = 0; i < 22; i++) {
    float fi = float(i);
    float travel = fract(t * 0.075 + hash11(fi * 17.3));
    float side = hash11(fi * 23.1) * 2.0 - 1.0;
    float lift = hash11(fi * 31.9) * 2.0 - 1.0;

    vec3 start = spinePoint(BODY_START - 0.94 - hash11(fi * 9.4) * 0.44, t)
      + vec3(side * (0.08 + hash11(fi * 13.5) * 0.26), -0.04 - hash11(fi * 5.8) * 0.10, lift * 0.13);
    vec3 p = mix(start, mouth, smoothstep(0.0, 1.0, travel));
    p.x += sin(t * 0.62 + fi * 1.7) * 0.018 * (1.0 - travel);
    p.z += cos(t * 0.46 + fi * 1.3) * 0.014 * (1.0 - travel);

    vec2 pp = project(localToWorld(p, t), cam);
    float d = length(st - pp);
    vec3 particleColor = mix(ACID, CYAN, hash11(fi * 4.7));
    col += particleColor * exp(-d * 70.0) * (0.030 + 0.035 * travel);

    if (i < 9) {
      vec3 trail = mix(start, mouth, smoothstep(0.0, 1.0, max(travel - 0.10, 0.0)));
      float line = distSeg(st, project(localToWorld(trail, t), cam), pp);
      col += mix(CYAN, VIOLET, 0.25) * exp(-line * 130.0) * 0.012 * (1.0 - travel * 0.35);
    }
  }

  return col;
}

void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;
  Cam cam = makeCam(t);
  float lens = 0.94 + 0.010 * sin(t * 0.14 + 0.6);

  vec3 rd = normalize(cam.fwd + cam.rgt * st.x * lens * 0.94 + cam.up * st.y * lens);

  vec3 col = mix(
    vec3(0.002, 0.006, 0.022),
    vec3(0.010, 0.045, 0.095),
    smoothstep(-1.0, 1.0, st.y)
  );

  col += vec3(0.022, 0.028, 0.080) * smoothstep(-0.88, 1.0, st.y);

  float caust = caustic(st * 0.74 + vec2(t * 0.026, 0.0), t);
  col += vec3(0.035, 0.110, 0.175) * caust * smoothstep(-0.40, 1.0, st.y);
  col += vec3(0.018, 0.065, 0.115)
    * caustic(st * 1.38 - vec2(t * 0.018, t * 0.012), t)
    * smoothstep(0.10, 1.0, st.y);

  float current = sin(st.y * 9.0 + st.x * 2.5 - t * 0.72)
    * sin(st.y * 3.2 + t * 0.26);
  col += mix(CYAN, VIOLET, 0.42) * pow(0.5 + 0.5 * current, 5.0) * 0.018
    * smoothstep(-0.75, 0.85, st.y);

  float d = rayMarch(cam.ro, rd, t);
  bool hit = d < MAX_DIST;
  vec3 p = cam.ro + rd * d;

  if (hit) {
    vec3 n = getNormal(p, t);
    vec3 L1 = normalize(vec3(-0.42, 0.82, -0.28));
    vec3 L2 = normalize(vec3(0.62, -0.10, 0.70));

    float diff = max(dot(n, L1), 0.0);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.35);
    float back = pow(max(dot(L2, rd), 0.0), 2.0);

    vec3 local = bendSpace(p, t);
    float u = clamp((local.y - BODY_START) / (BODY_END - BODY_START), 0.0, 1.0);
    float headRegion = smoothstep(BODY_START + 0.40, BODY_START + 0.02, local.y);
    float tailRegion = smoothstep(BODY_END - 0.92, BODY_END + 0.08, local.y);
    float dorsalRegion = smoothstep(0.035, 0.170, local.z);
    float ventralRegion = smoothstep(-0.020, -0.170, local.z);
    float livingNoise = fbm(local * 6.0 + vec3(0.0, t * 0.11, 0.0));
    float bodyPulse = 0.92 + 0.08 * sin(t * 0.72 - u * 5.4);

    vec3 headCol = mix(ACID, CYAN, 0.22);
    vec3 trunkCol = mix(CYAN, VIOLET, 0.44);
    vec3 tailCol = mix(PINK, VIOLET, 0.34);

    vec3 body = mix(trunkCol, headCol, headRegion) * 0.40;
    body = mix(body, tailCol * 0.54, tailRegion);

    float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 1.72);
    vec3 iridescence = mix(CYAN, VIOLET, fresnel * 0.72 + livingNoise * 0.18);
    iridescence = mix(iridescence, ACID, smoothstep(0.58, 1.0, fresnel) * 0.36);
    body += iridescence * 0.34 * bodyPulse;

    vec3 H = normalize(L1 + normalize(-cam.ro));
    float spec = pow(max(dot(n, H), 0.0), 58.0);
    body += mix(CYAN, ACID, 0.42) * spec * 0.95;

    float chevron = pow(max(0.0, sin(local.y * 54.0 + abs(local.x) * 20.0 - t * 1.05)), 7.0);
    float muscleMask = (1.0 - headRegion * 0.85) * (1.0 - tailRegion * 0.45);
    vec3 bandColor = mix(ACID, CYAN, smoothstep(-0.1, 2.6, local.y));
    bandColor = mix(bandColor, VIOLET, dorsalRegion * 0.38);
    body += bandColor * chevron * muscleMask * (0.20 + diff * 0.14) * bodyPulse;

    body += CYAN * diff * 0.36;
    body += VIOLET * 0.13;
    body += ACID * back * (0.36 + headRegion * 0.24);
    body += PINK * rim * (0.18 + tailRegion * 0.18 + ventralRegion * 0.08);
    body += mix(CYAN, PINK, u) * dorsalRegion * 0.16;
    body += ACID * rim * (0.62 + livingNoise * 0.35);

    float eyeSpot = 0.0;
    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      vec3 eyePos = spinePoint(BODY_START + 0.12, t) + vec3(side * 0.046, -0.020, 0.026);
      eyeSpot += exp(-length((local - eyePos) * vec3(8.0, 7.0, 9.0)) * 2.8);
    }
    body += mix(PINK, ACID, 0.36) * eyeSpot * 0.42 * GLOW_POWER;
    body -= vec3(0.030, 0.045, 0.055) * eyeSpot * 0.55;

    float alpha = 0.80 + rim * 0.50 + back * 0.20;
    col = mix(col, body, clamp(alpha, 0.0, 0.94));
  }

  col += renderDorsalGlow(st, cam, t) * (1.10 + 0.08 * sin(t * 0.80));
  col += renderMyomereGlow(st, cam, t) * (1.08 + 0.06 * sin(t * 0.63));
  col += renderOrganGlow(st, cam, t) * (1.06 + 0.05 * sin(t * 0.70));
  col += renderTailGlow(st, cam, t) * (1.12 + 0.08 * sin(t * 0.75));
  col += renderWhiskerGlow(st, cam, t) * (1.18 + 0.10 * sin(t * 1.05));
  col += renderFilterStream(st, cam, t) * (1.05 + 0.08 * sin(t * 0.52));

  float snow = marineSnow(st * 1.22, t);
  col += vec3(0.70, 0.82, 1.0) * snow * 0.62;

  for (int i = 0; i < 11; i++) {
    float fi = float(i);
    vec2 center = vec2(sin(fi * 12.7 + t * 0.10), cos(fi * 9.1 - t * 0.075));
    center.x *= 0.74;
    center.y = fract(center.y * 0.5 + 0.5 + t * 0.021 + fi * 0.13) * 2.4 - 1.2;
    float particleDistance = length(st - center);
    vec3 particleColor = mix(VIOLET, CYAN, hash11(fi * 4.7));
    col += particleColor * exp(-particleDistance * 25.0) * 0.050;
  }

  col *= INTENSITY * 1.04;
  col += pow(max(col, 0.0), vec3(1.28)) * 0.37;

  float vignette = 1.0 - 0.18 * smoothstep(0.22, 1.62, length(st));
  col *= vignette;

  col = col / (0.84 + col);
  col = pow(col, vec3(1.0 / 0.96));

  float grain = (hash11(uv.x * 1234.5 + uv.y * 987.6 + t) - 0.5) * 0.018;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
