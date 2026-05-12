// ===============================================================
// ABYSSAL VEIL JELLY — deep-sea shader creature
// 3D raymarched translucent bell + procedural oral arms + veil
// TouchDesigner GLSL TOP · 1080x1920 (Reels)
// Keeps original color constants exactly.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS    80
#define MAX_DIST     9.0
#define SURF_DIST    0.0012
#define TAU          6.28318530718
#define PI           3.14159265359

#define INTENSITY    1.8
#define GLOW_POWER   2.1
#define VEIL_POWER   2.0

const vec3 ACID   = vec3(0.0,  1.0,  0.624);
const vec3 CYAN   = vec3(0.0,  0.812,1.0);
const vec3 VIOLET = vec3(0.545,0.0,  1.0);
const vec3 PINK   = vec3(1.0,  0.0,  0.431);

// ---------- math helpers ----------
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
    p *= 2.03;
    a *= 0.52;
  }

  return v;
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

// ---------- camera ----------
struct Cam {
  vec3 ro;
  vec3 fwd;
  vec3 rgt;
  vec3 up;
};

Cam makeCam(float t) {
  Cam c;

  float a = t * 0.09;
  float dist = 3.15;

  c.ro = vec3(
    sin(a) * dist,
    0.15 + sin(t * 0.23) * 0.10,
    cos(a) * dist
  );

  vec3 target = vec3(
    0.0,
    -0.12 + sin(t * 0.35) * 0.05,
    0.0
  );

  c.fwd = normalize(target - c.ro);
  c.rgt = normalize(cross(vec3(0, 1, 0), c.fwd));
  c.up = cross(c.fwd, c.rgt);

  return c;
}

vec3 creatureOffset(float t) {
  return vec3(
    sin(t * 0.45) * 0.09,
    sin(t * 0.34) * 0.08,
    cos(t * 0.39) * 0.07
  );
}

// ---------- jelly bell SDF ----------
float bellSDF(vec3 p, float t) {
  vec3 q = p - creatureOffset(t);

  float pulse = 0.5 + 0.5 * sin(t * 1.55);

  q.y += 0.035 * sin(q.x * 2.6 + q.z * 1.8 - t * 1.2);

  float radial = length(q.xz);

  float dome = length(vec3(
    q.x * 1.05,
    (q.y - 0.18) * 1.28,
    q.z * 1.05
  )) - (0.76 + pulse * 0.035);

  float lowerCut = q.y + 0.18 + 0.08 * sin(radial * 6.0 - t * 1.4);

  float rim = abs(
    radial - (0.68 + 0.045 * sin(12.0 * atan(q.z, q.x) + t * 2.0))
  ) - 0.025;

  float rimY = abs(q.y + 0.25 + pulse * 0.035) - 0.035;
  float rimBand = max(rim, rimY);

  float ribs = sin(
    atan(q.z, q.x) * 16.0 + sin(q.y * 4.0 - t) * 0.8
  ) * 0.008;

  float skinNoise = (
    fbm(q * 3.2 + vec3(0.0, t * 0.12, 0.0)) - 0.5
  ) * 0.018;

  float shell = max(dome + ribs + skinNoise, -lowerCut);

  return min(shell, rimBand);
}

float armsSDF(vec3 p, float t) {
  vec3 q = p - creatureOffset(t);
  float d = 10.0;

  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float a = fi / 10.0 * TAU + 0.25 * sin(t * 0.31 + fi);
    float rad = 0.10 + 0.025 * sin(fi * 2.1);

    vec3 prev = vec3(
      cos(a) * rad,
      -0.23,
      sin(a) * rad
    );

    for (int j = 1; j <= 8; j++) {
      float u = float(j) / 8.0;
      float sway = sin(t * 1.2 + u * 5.2 + fi * 0.7) * 0.18 * u;
      float twist = a + sway + sin(u * 8.0 + t * 0.6 + fi) * 0.25;

      vec3 next = vec3(
        cos(twist) * (rad + u * 0.22),
        -0.23 - u * 1.42,
        sin(twist) * (rad + u * 0.22)
      );

      next.x += sin(t * 0.72 + u * 4.0 + fi) * 0.09 * u;
      next.z += cos(t * 0.66 + u * 4.2 + fi) * 0.09 * u;

      float r = mix(0.032, 0.009, u);

      d = softUnion(d, sdCapsule(q, prev, next, r), 0.055);
      prev = next;
    }
  }

  return d;
}

float creatureSDF(vec3 p, float t) {
  float b = bellSDF(p, t);
  float a = armsSDF(p, t);
  return softUnion(b, a, 0.08);
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
    float s = creatureSDF(ro + rd * d, t);

    if (s < SURF_DIST || d > MAX_DIST) {
      break;
    }

    d += max(s * 0.72, 0.006);
  }

  return d;
}

// ---------- 2D helpers ----------
float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 project(vec3 p, Cam c) {
  vec3 rel = p - c.ro;
  float zc = max(dot(rel, c.fwd), 0.06);

  return vec2(
    dot(rel, c.rgt) / zc,
    dot(rel, c.up) / zc
  );
}

// ---------- water atmosphere ----------
float caustic(vec2 p, float t) {
  vec2 q = p * 1.6;
  float c = 0.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);

    q += 0.28 * vec2(
      cos(t * 0.25 + fi * 2.1),
      sin(t * 0.18 + fi * 1.7)
    );

    c += sin(q.x * (2.4 + fi) + t * (0.45 + fi * 0.08))
       * cos(q.y * (2.7 + fi) - t * 0.35);
  }

  return pow(0.5 + 0.5 * c / 4.0, 3.2);
}

float marineSnow(vec2 p, float t) {
  float s = 0.0;

  for (int i = 0; i < 7; i++) {
    float fi = float(i);

    vec2 drift = p * (1.0 + fi * 0.55)
      + vec2(
        t * 0.025 * (fi + 1.0),
        -t * 0.018 * (fi + 0.5)
      );

    vec2 cell = floor(drift);
    vec2 f = fract(drift) - 0.5;

    float h = hash11(dot(cell, vec2(41.7, 289.3)) + fi * 19.1);

    if (h > 0.982) {
      s += smoothstep(0.05, 0.0, length(f)) * (1.0 - fi * 0.09);
    }
  }

  return s;
}

// ---------- procedural veil and tentacles ----------
vec3 renderVeil(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  // Long transparent rim tentacles.
  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    float a = fi / 28.0 * TAU;
    float pulse = 0.5 + 0.5 * sin(t * 1.55);

    vec3 prev = off + vec3(
      cos(a) * (0.60 + pulse * 0.04),
      -0.24,
      sin(a) * (0.60 + pulse * 0.04)
    );

    for (int j = 1; j <= 9; j++) {
      float u = float(j) / 9.0;

      float wave = sin(t * 0.95 + u * 7.0 + fi * 0.47) * 0.23 * u;
      float spiral = a + wave + sin(u * 5.0 + t * 0.37) * 0.12;

      vec3 next = off + vec3(
        cos(spiral) * (0.60 + 0.10 * sin(u * PI) + 0.14 * u),
        -0.24 - u * 1.95,
        sin(spiral) * (0.60 + 0.10 * sin(u * PI) + 0.14 * u)
      );

      next.x += sin(t * 0.51 + fi + u * 4.0) * 0.13 * u;
      next.z += cos(t * 0.46 + fi + u * 3.7) * 0.13 * u;

      vec2 a2 = project(prev, cam);
      vec2 b2 = project(next, cam);

      float d = distSeg(st, a2, b2);
      float line = smoothstep(0.0028, 0.0, d);
      float glow = exp(-d * 85.0) * 0.08;

      float fire = pow(
        max(sin(u * TAU * 2.0 - t * 2.5 + fi * 0.6), 0.0),
        3.0
      );

      vec3 c = mix(
        CYAN,
        PINK,
        0.5 + 0.5 * sin(fi * 0.9 + u * 2.0)
      );

      c = mix(c, ACID, fire * 0.55);

      col += c
        * (line * 0.85 + glow * (1.25 + fire * 1.35))
        * (1.0 - u * 0.26)
        * VEIL_POWER;

      prev = next;
    }
  }

  // Internal radial nerves on the bell.
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float a = fi / 18.0 * TAU + sin(t * 0.2) * 0.08;

    vec3 p0 = off + vec3(0.0, 0.16, 0.0);
    vec3 p1 = off + vec3(
      cos(a) * 0.66,
      -0.20 + 0.02 * sin(t + fi),
      sin(a) * 0.66
    );

    vec2 a2 = project(p0, cam);
    vec2 b2 = project(p1, cam);

    float d = distSeg(st, a2, b2);
    float nerve = exp(-d * 128.0) * 0.145;

    col += mix(VIOLET, CYAN, 0.55) * nerve * GLOW_POWER;
  }

  return col;
}

// ---------- main ----------
void main() {
  vec2 uv = vUV.st;

  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;

  Cam cam = makeCam(t);

  vec3 rd = normalize(
    cam.fwd +
    cam.rgt * st.x +
    cam.up * st.y
  );

  // ---------- background: abyssal water ----------
  vec3 col = vec3(0.004, 0.007, 0.020);

  col += vec3(0.025, 0.025, 0.075)
    * smoothstep(-0.75, 0.95, st.y);

  col += vec3(0.030, 0.095, 0.155)
    * caustic(st * 0.75 + vec2(t * 0.03, 0.0), t)
    * smoothstep(-0.55, 0.95, st.y);

  // ---------- raymarched jelly body ----------
  float d = rayMarch(cam.ro, rd, t);
  bool hit = d < MAX_DIST;
  vec3 p = cam.ro + rd * d;

  if (hit) {
    vec3 n = getNormal(p, t);

    vec3 L1 = normalize(vec3(-0.45, 0.85, -0.25));
    vec3 L2 = normalize(vec3(0.55, -0.15, 0.72));

    float diff = max(dot(n, L1), 0.0);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
    float back = pow(max(dot(L2, rd), 0.0), 2.0);

    float scan = 0.5 + 0.5 * sin((p.y + p.x * 0.25) * 18.0 - t * 2.3);
    float livingNoise = fbm(p * 5.0 + vec3(0.0, t * 0.2, 0.0));

    vec3 body = vec3(0.035, 0.065, 0.13);

    body += CYAN * diff * 0.22;
    body += VIOLET * 0.20;
    body += ACID * back * 0.48;
    body += PINK * scan * rim * 0.28;
    body += CYAN * rim * (0.64 + livingNoise * 0.36);

    float alpha = 0.46 + rim * 0.58 + back * 0.26;

    col = mix(col, body, clamp(alpha, 0.0, 0.82));

    // Soft internal glow near the bell core.
    float core = exp(
      -length((p - creatureOffset(t)) * vec3(1.0, 1.8, 1.0)) * 2.1
    );

    col += mix(
      VIOLET,
      ACID,
      0.35 + 0.35 * sin(t * 1.4)
    ) * core * 0.42 * GLOW_POWER;
  }

  // ---------- veil, tentacles, internal nerves ----------
  col += renderVeil(st, cam, t);

  // ---------- bioluminescent marine snow ----------
  float snow = marineSnow(st * 1.25, t);
  col += vec3(0.70, 0.82, 1.0) * snow * 0.78;

  // ---------- distant light spores ----------
  for (int i = 0; i < 10; i++) {
    float fi = float(i);

    vec2 center = vec2(
      sin(fi * 13.1 + t * 0.11),
      cos(fi * 9.4 - t * 0.08)
    );

    center.x *= 0.72;
    center.y = fract(center.y * 0.5 + 0.5 + t * 0.025 + fi * 0.13) * 2.4 - 1.2;

    float dd = length(st - center);
    vec3 cc = mix(VIOLET, CYAN, hash11(fi * 4.7));

    col += cc * exp(-dd * 26.0) * 0.065;
  }

  // ---------- post processing ----------
  col *= INTENSITY;

  // Extra emission bloom-like lift.
  col += pow(max(col, 0.0), vec3(1.35)) * 0.38;

  float vignette = 1.0 - 0.38 * smoothstep(0.15, 1.45, length(st));
  col *= vignette;

  // Softer tone map to keep stronger glow.
  col = col / (0.82 + col);

  // Mild gamma lift.
  col = pow(col, vec3(1.0 / 0.96));

  // Fine film grain.
  float grain = (hash11(uv.x * 1234.5 + uv.y * 987.6 + t) - 0.5) * 0.022;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}