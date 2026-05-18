// ===============================================================
// CAMBRIAN RELIC — Marrella Model v3.1 Stable
// TouchDesigner GLSL TOP
// Stable Marrella silhouette:
// slender carapace + four horn spines + ventral legs + shorter antennae
// Keeps original color constants exactly.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS    112
#define MAX_DIST     10.5
#define SURF_DIST    0.00105
#define TAU          6.28318530718
#define PI           3.14159265359

#define INTENSITY    1.82
#define GLOW_POWER   2.35
#define VEIL_POWER   1.70

const vec3 ACID   = vec3(0.0,  1.0,  0.624);
const vec3 CYAN   = vec3(0.0,  0.812,1.0);
const vec3 VIOLET = vec3(0.545,0.0,  1.0);
const vec3 PINK   = vec3(1.0,  0.0,  0.431);

// ---------- helpers ----------
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

// ---------- camera ----------
struct Cam {
  vec3 ro;
  vec3 fwd;
  vec3 rgt;
  vec3 up;
};

vec3 creatureOffset(float t) {
  float swimT = t * 0.32;

  return vec3(
    sin(swimT * 0.52) * 0.10 + sin(t * 1.05) * 0.016,
    sin(swimT * 0.42 + 1.2) * 0.06 + cos(t * 0.86) * 0.012,
    cos(swimT * 0.36) * 0.08 + sin(t * 0.67) * 0.016
  );
}

Cam makeCam(float t) {
  Cam c;

  float orbitT = t * 0.22;  // faster orbit
  vec3 center = creatureOffset(t);

  // Full orbit including vertical sweep so head/face side becomes visible.
  float yaw = orbitT;
  float dist = 4.50 + 0.12 * sin(t * 0.21 + 0.7);
  float height = 0.80 * sin(t * 0.14);  // swings above and below to show all sides

  vec3 orbitPos = vec3(
    sin(yaw) * dist,
    height,
    cos(yaw) * dist
  );

  vec3 target = center + vec3(
    0.02 * sin(t * 0.27),
    0.05 + 0.02 * sin(t * 0.23),
    0.02 * cos(t * 0.19)
  );

  c.ro = center + orbitPos;
  c.ro += normalize(target - c.ro) * (0.025 + 0.016 * sin(t * 0.34));

  c.fwd = normalize(target - c.ro);
  c.rgt = normalize(cross(vec3(0, 1, 0), c.fwd));
  c.up = cross(c.fwd, c.rgt);

  return c;
}

// Local Marrella coordinate:
// -Y = anterior / head / antenna direction
// +Y = posterior / abdomen direction
// X = lateral width
// Z = dorsal/ventral depth
vec3 marrellaPose(vec3 p) {
  p.yz *= rot(PI * 0.5);  // body horizontal — swims sideways
  return p;
}

vec3 bendSpace(vec3 p, float t) {
  p -= creatureOffset(t);
  p = marrellaPose(p);

  // Reduced swimming deformation. Marrella should not behave like a jellyfish.
  p.xz *= rot(0.020 * sin(t * 0.46));
  p.yz *= rot(0.018 * sin(t * 0.38 + 1.1));
  p.xy *= rot(0.012 * sin(t * 0.52));

  // Restrained body wave.
  float wave = sin(p.y * 2.35 - t * 1.45);
  float fineWave = sin(p.y * 4.8 - t * 2.35) * 0.34;
  float bodyMask = smoothstep(-0.55, 1.05, p.y);

  p.x += (wave + fineWave) * 0.014 * bodyMask;
  p.z += cos(p.y * 1.8 - t * 1.22) * 0.018 * bodyMask;

  return p;
}

// ---------- Marrella v3 anatomy ----------
float headSDF(vec3 q, float t) {
  // Smaller, shield-like head.
  vec3 h = q - vec3(0.0, -0.48, 0.02);

  float shield = sdEllipsoid(h, vec3(0.48, 0.34, 0.27));

  // Taper sides to form a shield / wedge.
  float sideCutL = h.x + 0.30 + h.y * 0.46;
  float sideCutR = -h.x + 0.30 + h.y * 0.46;
  float rearCut = h.y - 0.28;

  shield = max(shield, -sideCutL);
  shield = max(shield, -sideCutR);
  shield = max(shield, rearCut * 0.52);

  // Small frontal lobe.
  float front = sdEllipsoid(q - vec3(0.0, -0.78, 0.03), vec3(0.26, 0.18, 0.18));
  shield = softUnion(shield, front, 0.12);

  return shield;
}

float carapaceSDF(vec3 q, float t) {
  float d = 10.0;

  // Long slender dorsal body / carapace.
  for (int i = 0; i < 17; i++) {
    float fi = float(i);
    float u = fi / 16.0;

    float y = mix(-0.08, 1.42, u);
    float taper = 1.0 - u * 0.42;
    float phase = sin(t * 1.12 - fi * 0.42) * 0.012;

    vec3 c = vec3(
      sin(fi * 0.45 + t * 0.40) * 0.018 * (1.0 - u),
      y + phase,
      0.04 * sin(fi * 0.35 - t * 0.5)
    );

    vec3 r = vec3(
      0.28 * taper,
      0.078,
      0.155 * taper
    );

    float seg = sdEllipsoid(q - c, r);

    // Segment ridges.
    float groove = abs(fract((q.y + 0.06) * 12.0) - 0.5) - 0.42;
    seg += groove * 0.009;

    d = softUnion(d, seg, 0.045);
  }

  // Thin dorsal plate line.
  float dorsal = sdCapsule(
    q,
    vec3(0.0, -0.02, 0.18),
    vec3(0.0, 1.48, 0.18),
    0.035
  );

  d = softUnion(d, dorsal, 0.035);

  return d;
}

float hornSpinesSDF(vec3 q, float t) {
  float d = 10.0;

  // Four horn-like spines: two pairs sweeping outward-backward from head shield.
  // References show them curving laterally and slightly posteriorly, not upward.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float side = fi < 2.0 ? -1.0 : 1.0;
    float pair = mod(fi, 2.0);  // 0 = inner/shorter, 1 = outer/longer

    // Root at head shield edge
    vec3 a = vec3(
      side * mix(0.14, 0.22, pair),
      mix(-0.52, -0.38, pair),
      mix(0.12, 0.20, pair)
    );

    // Mid sweeps outward and slightly upward (dorsal)
    vec3 mid = vec3(
      side * (0.68 + pair * 0.28),
      mix(-0.18, 0.08, pair),
      0.32 + pair * 0.18
    );

    // Tip curves gently backward (posterior) — matches the curved horns in references
    vec3 b = vec3(
      side * (1.18 + pair * 0.42),
      mix(0.32, 0.62, pair) + 0.05 * sin(t * 0.62 + fi),
      0.18 + pair * 0.10 + side * 0.06
    );

    float rRoot = mix(0.048, 0.036, pair);

    float s1 = sdCapsule(q, a, mid, rRoot);
    float s2 = sdCapsule(q, mid, b, rRoot * 0.48);

    d = softUnion(d, s1, 0.038);
    d = softUnion(d, s2, 0.028);
  }

  // Two long posterior sweeping spines (the backward-curving lower pair in references)
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;

    vec3 a   = vec3(side * 0.20, -0.28, 0.06);
    vec3 mid = vec3(side * 0.55, 0.48, -0.08);
    vec3 b   = vec3(side * 0.82, 1.38, -0.18 + 0.04 * sin(t * 0.65 + side));

    float s1 = sdCapsule(q, a, mid, 0.040);
    float s2 = sdCapsule(q, mid, b, 0.018);

    d = softUnion(d, s1, 0.032);
    d = softUnion(d, s2, 0.022);
  }

  return d;
}

float ventralLegsSDF(vec3 q, float t) {
  float d = 10.0;

  // Dense but restrained ventral appendages.
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float u = fi / 25.0;
    float y = mix(-0.05, 1.32, u);

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;

      float gait = sin(t * 2.15 - fi * 0.48 + side);
      float taper = 1.0 - u * 0.50;

      vec3 root = vec3(
        side * (0.16 * taper),
        y,
        -0.03
      );

      vec3 mid = root + vec3(
        side * (0.20 + 0.030 * gait),
        -0.05,
        -0.18 + 0.045 * gait
      );

      vec3 tip = root + vec3(
        side * (0.32 + 0.050 * gait),
        -0.14,
        -0.36 + 0.075 * gait
      );

      float r0 = mix(0.014, 0.0036, u);

      d = softUnion(d, sdCapsule(q, root, mid, r0), 0.013);
      d = softUnion(d, sdCapsule(q, mid, tip, r0 * 0.55), 0.009);
    }
  }

  return d;
}

float anteriorAntennaeSDF(vec3 q, float t) {
  float d = 10.0;

  // Antennae: two long whips from head, sweeping forward then drooping down.
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;

    vec3 prev = vec3(side * 0.12, -0.72, 0.06);

    for (int j = 1; j <= 20; j++) {
      float u = float(j) / 20.0;

      float wave = sin(t * 0.95 - u * 4.2 + side * 0.7) * 0.055 * u;
      float droop = u * u * 0.55;  // strong droop — hangs forward and down

      vec3 next = vec3(
        side * (0.10 + u * 0.18),   // minimal lateral spread
        -0.70 - u * 1.20,           // forward along head axis
        0.05 + droop + wave          // droop forward-downward
      );

      float r = mix(0.020, 0.0024, u);

      d = softUnion(d, sdCapsule(q, prev, next, r), 0.012);
      prev = next;
    }
  }

  return d;
}

float smallPalpsSDF(vec3 q, float t) {
  float d = 10.0;

  // Smaller front appendages under the head.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
    float row = floor(fi * 0.5);

    vec3 a = vec3(side * (0.10 + row * 0.05), -0.62 + row * 0.08, -0.04);
    vec3 b = a + vec3(side * (0.18 + row * 0.04), -0.22, -0.18 + 0.035 * sin(t + fi));

    float palp = sdCapsule(q, a, b, mix(0.016, 0.009, row / 3.0));
    d = softUnion(d, palp, 0.013);
  }

  return d;
}

float creatureSDF(vec3 p, float t) {
  vec3 q = bendSpace(p, t);

  float head = headSDF(q, t);
  float body = carapaceSDF(q, t);
  float spines = hornSpinesSDF(q, t);
  float legs = ventralLegsSDF(q, t);
  float antennae = anteriorAntennaeSDF(q, t);
  float palps = smallPalpsSDF(q, t);

  float d = head;
  d = softUnion(d, body, 0.105);
  d = softUnion(d, spines, 0.052);
  d = softUnion(d, legs, 0.030);
  d = softUnion(d, antennae, 0.032);
  d = softUnion(d, palps, 0.022);

  float grain = (fbm(q * 6.4 + vec3(0.0, t * 0.15, 0.0)) - 0.5) * 0.010;

  return d + grain;
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

    d += max(s * 0.66, 0.004);
  }

  return d;
}

// ---------- 2D projection helpers ----------
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

// ---------- atmosphere ----------
float caustic(vec2 p, float t) {
  vec2 q = p * 1.55;
  float c = 0.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);

    q += 0.24 * vec2(
      cos(t * 0.22 + fi * 2.0),
      sin(t * 0.18 + fi * 1.6)
    );

    c += sin(q.x * (2.2 + fi) + t * (0.42 + fi * 0.08))
       * cos(q.y * (2.6 + fi) - t * 0.32);
  }

  return pow(0.5 + 0.5 * c / 4.0, 3.4);
}

float marineSnow(vec2 p, float t) {
  float s = 0.0;

  for (int i = 0; i < 7; i++) {
    float fi = float(i);

    vec2 drift = p * (1.0 + fi * 0.56)
      + vec2(
        t * 0.022 * (fi + 1.0),
        -t * 0.016 * (fi + 0.5)
      );

    vec2 cell = floor(drift);
    vec2 f = fract(drift) - 0.5;

    float h = hash11(dot(cell, vec2(41.7, 289.3)) + fi * 19.1);

    if (h > 0.984) {
      s += smoothstep(0.05, 0.0, length(f)) * (1.0 - fi * 0.09);
    }
  }

  return s;
}

// ---------- gill lamellae glow lines ----------
// Marrella's most iconic feature: dense stacked lateral gill flaps
// extending from each body segment, fanning outward and slightly downward.
// Reference: expansion_marrella.jpg (blue flap stacks), download.jpg (rainbow iridescence).
vec3 renderGills(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  // TODO(human): implement the gill lamellae glow lines.
  // Each body segment (use the same ~17 segment positions as carapaceSDF, y in [-0.05, 1.42])
  // should emit ~5-8 gill rays per side, fanning outward in X and slightly downward in Z.
  // Each ray = one projected line segment from root (near body centerline) to tip (lateral/down).
  // Animate each lamella with a gentle wave (use sin(t + segment phase)).
  // Color: mix between CYAN and VIOLET for the inner lamellae, ACID for tips.
  // Glow: exp(-d * 110.0) * 0.09 per segment, plus smoothstep line core.
  // Tip: project() and distSeg() work the same as in renderFilaments below.

  return col;
}

// ---------- projected glow appendage lines ----------
vec3 renderFilaments(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  // Ventral gill-filaments: dense fan-like appendages in PINK <-> CYAN,
  // matching Marrella.png — inner filaments blue, outer tips pink.
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
    float row = floor(fi * 0.5);
    float urow = row / 12.0;

    float segY = mix(-0.04, 1.32, urow);

    vec3 rootLocal = vec3(
      side * (0.14 - urow * 0.04),
      segY,
      -0.02
    );

    rootLocal = marrellaPose(rootLocal);
    vec3 prev = off + rootLocal;

    // More filaments per segment (8 instead of 6) for the dense fan look
    for (int j = 1; j <= 8; j++) {
      float u = float(j) / 8.0;
      float wave = sin(t * 1.85 - u * 5.2 + fi * 0.55) * 0.10 * u;

      // Fan outward in X and downward in Z — matches the splayed filaments in Marrella.png
      vec3 nextLocal = vec3(
        side * (0.14 + u * 0.42 - urow * 0.03),
        segY - u * 0.10,
        -0.05 - u * 0.38 + wave
      );

      nextLocal = marrellaPose(nextLocal);
      vec3 next = off + nextLocal;

      vec2 a2 = project(prev, cam);
      vec2 b2 = project(next, cam);

      float d = distSeg(st, a2, b2);
      float line = smoothstep(0.0015, 0.0, d);
      float glow = exp(-d * 80.0) * 0.085;
      float pulse = pow(max(sin(t * 1.8 - u * TAU + fi * 0.72), 0.0), 2.5);

      // Inner (u=0) = CYAN blue, outer tip (u=1) = PINK — exactly like the reference
      vec3 c = mix(CYAN, PINK, u * u);
      c = mix(c, VIOLET, 0.18 * (1.0 - u));  // slight violet tint at root

      col += c
        * (line * 0.38 + glow * (0.45 + pulse * 0.35))
        * (1.0 - urow * 0.30)
        * VEIL_POWER;

      prev = next;
    }
  }

  // Abdomen rib glow.
  for (int i = 0; i < 17; i++) {
    float fi = float(i);
    float u = fi / 16.0;
    float y = mix(-0.06, 1.42, u);
    float taper = 1.0 - u * 0.42;

    vec3 p0Local = vec3(-0.25 * taper, y, 0.05 * sin(fi));
    vec3 p1Local = vec3( 0.25 * taper, y, 0.05 * sin(fi));

    p0Local = marrellaPose(p0Local);
    p1Local = marrellaPose(p1Local);

    vec3 p0 = off + p0Local;
    vec3 p1 = off + p1Local;

    vec2 a2 = project(p0, cam);
    vec2 b2 = project(p1, cam);

    float d = distSeg(st, a2, b2);
    float rib = exp(-d * 138.0) * 0.105;

    col += mix(VIOLET, CYAN, 0.56) * rib * GLOW_POWER;
  }

  // Long anterior antenna glow — matches updated SDF (sweep forward/anterior).
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;

    vec3 prevLocal = vec3(side * 0.12, -0.72, 0.06);
    prevLocal = marrellaPose(prevLocal);
    vec3 prev = off + prevLocal;

    for (int j = 1; j <= 20; j++) {
      float u = float(j) / 20.0;
      float wave = sin(t * 0.95 - u * 4.2 + side * 0.7) * 0.055 * u;
      float droop = u * u * 0.55;

      vec3 nextLocal = vec3(
        side * (0.10 + u * 0.18),
        -0.70 - u * 1.20,
        0.05 + droop + wave
      );

      nextLocal = marrellaPose(nextLocal);
      vec3 next = off + nextLocal;

      vec2 a2 = project(prev, cam);
      vec2 b2 = project(next, cam);

      float d = distSeg(st, a2, b2);

      // Antenna: single thin glowing line, ACID green — simple whip shape
      col += ACID
        * (smoothstep(0.0012, 0.0, d) * 0.45 + exp(-d * 120.0) * 0.038)
        * (1.0 - u * 0.55)
        * GLOW_POWER;

      prev = next;
    }
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

  float lens = 1.18 + 0.018 * sin(t * 0.18 + 0.6);

  vec3 rd = normalize(
    cam.fwd +
    cam.rgt * st.x * lens * 0.94 +
    cam.up * st.y * lens
  );

  // ---------- background ----------
  vec3 col = vec3(0.002, 0.004, 0.014);

  col += vec3(0.028, 0.030, 0.086)
    * smoothstep(-0.88, 1.0, st.y);

  col += vec3(0.028, 0.088, 0.145)
    * caustic(st * 0.74 + vec2(t * 0.026, 0.0), t)
    * smoothstep(-0.58, 0.95, st.y);

  // ---------- raymarch ----------
  float d = rayMarch(cam.ro, rd, t);
  bool hit = d < MAX_DIST;
  vec3 p = cam.ro + rd * d;

  if (hit) {
    vec3 n = getNormal(p, t);

    vec3 L1 = normalize(vec3(-0.42, 0.82, -0.28));
    vec3 L2 = normalize(vec3(0.62, -0.10, 0.70));

    float diff = max(dot(n, L1), 0.0);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.70);
    float back = pow(max(dot(L2, rd), 0.0), 2.1);

    vec3 local = bendSpace(p, t);

    float headRegion = smoothstep(0.10, -0.58, local.y);
    float dorsalRegion = smoothstep(-0.04, 0.24, local.z);

    float stripes = 0.5 + 0.5 * sin(local.y * 28.0 - t * 1.5);
    float livingNoise = fbm(local * 5.8 + vec3(0.0, t * 0.18, 0.0));

    vec3 headCol = mix(ACID, CYAN, 0.22);
    vec3 abdomenCol = mix(VIOLET, CYAN, 0.50);
    vec3 spineCol = mix(PINK, ACID, 0.35);

    vec3 body = mix(abdomenCol, headCol, headRegion) * 0.22;
    body = mix(body, spineCol * 0.26, dorsalRegion * 0.24);

    body += CYAN * diff * 0.28;
    body += VIOLET * 0.15;
    body += ACID * back * 0.52;
    body += PINK * stripes * rim * 0.28;
    body += CYAN * rim * (0.88 + livingNoise * 0.54);

    float alpha = 0.74 + rim * 0.64 + back * 0.32;
    col = mix(col, body, clamp(alpha, 0.0, 0.92));

    float core = exp(
      -length((local - vec3(0.0, -0.34, 0.0)) * vec3(1.5, 1.7, 1.2)) * 2.35
    );

    col += mix(
      VIOLET,
      ACID,
      0.34 + 0.32 * sin(t * 1.25)
    ) * core * 0.38 * GLOW_POWER;
  }

  // ---------- projected glow ----------
  col += renderGills(st, cam, t) * (1.35 + 0.10 * sin(t * 0.85));
  col += renderFilaments(st, cam, t) * (1.28 + 0.08 * sin(t * 1.2));

  // ---------- particles ----------
  float snow = marineSnow(st * 1.22, t);
  col += vec3(0.70, 0.82, 1.0) * snow * 0.66;

  for (int i = 0; i < 11; i++) {
    float fi = float(i);

    vec2 center = vec2(
      sin(fi * 12.7 + t * 0.10),
      cos(fi * 9.1 - t * 0.075)
    );

    center.x *= 0.74;
    center.y = fract(center.y * 0.5 + 0.5 + t * 0.021 + fi * 0.13) * 2.4 - 1.2;

    float dd = length(st - center);
    vec3 cc = mix(VIOLET, CYAN, hash11(fi * 4.7));

    col += cc * exp(-dd * 25.0) * 0.050;
  }

  // ---------- post ----------
  col *= INTENSITY * 1.06;
  col += pow(max(col, 0.0), vec3(1.28)) * 0.38;

  float vignette = 1.0 - 0.18 * smoothstep(0.22, 1.62, length(st));
  col *= vignette;

  col = col / (0.84 + col);
  col = pow(col, vec3(1.0 / 0.96));

  float grain = (hash11(uv.x * 1234.5 + uv.y * 987.6 + t) - 0.5) * 0.018;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}