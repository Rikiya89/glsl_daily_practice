// ===============================================================
// CAMBRIAN RELIC — Anomalocaris Model v1.1
// TouchDesigner GLSL TOP
// Flattened radiodont body + overlapping swimming flaps + tail fan
// + stalked compound eyes + oral cone + paired frontal appendages.
// Original neon color constants are preserved exactly.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS    124
#define MAX_DIST     12.0
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

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
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
  float swimT = t * 0.27;

  return vec3(
    sin(swimT * 0.64) * 0.12 + sin(t * 0.92) * 0.015,
    sin(swimT * 0.44 + 1.2) * 0.055,
    cos(swimT * 0.42) * 0.08 + sin(t * 0.63) * 0.015
  );
}

Cam makeCam(float t) {
  Cam c;
  vec3 center = creatureOffset(t);

  // reveal: ease from 0→1 over first 6 seconds, then hold cruise
  float reveal = smoothstep(0.0, 6.0, t);

  // --- start: close-up on head (world Z≈-0.46 after pose transform) ---
  float yawStart  = -0.72;
  float distStart = 1.55;
  float heightStart = 0.18;

  // --- cruise: slow wide orbit showing full body ---
  float yawCruise    = -0.72 + (t - 6.0) * 0.072;
  float distCruise   = 4.20 + 0.10 * sin(t * 0.24);
  float heightCruise = 1.55 + 0.14 * sin(t * 0.11);

  float yaw    = mix(yawStart,    yawCruise,    reveal);
  float dist   = mix(distStart,   distCruise,   reveal);
  float height = mix(heightStart, heightCruise, reveal);

  vec3 orbitPos = vec3(
    sin(yaw) * dist,
    height,
    cos(yaw) * dist
  );

  // target: head (Z≈-0.46) at start, trunk midpoint (Z≈0.85) at cruise
  float targetZ = mix(-0.46, 0.85 + 0.04 * sin(t * 0.21), reveal);
  vec3 target = center + vec3(0.0, 0.0, targetZ);

  c.ro = center + orbitPos;
  c.fwd = normalize(target - c.ro);
  c.rgt = normalize(cross(vec3(0, 1, 0), c.fwd));
  c.up = cross(c.fwd, c.rgt);

  return c;
}

// Local coordinates:
// -Y = head / frontal appendages
// +Y = posterior / tail fan
// X = left-right swimming flaps
// Z = dorsal-ventral depth
vec3 anomalocarisPose(vec3 p) {
  p.yz *= rot(PI * 0.5);
  p.xy *= rot(-0.08);
  return p;
}

vec3 bendSpace(vec3 p, float t) {
  p -= creatureOffset(t);
  p = anomalocarisPose(p);

  // gentle whole-body roll/pitch sway
  p.xz *= rot(0.022 * sin(t * 0.34));
  p.yz *= rot(0.018 * sin(t * 0.26 + 1.0));

  float bodyMask = smoothstep(-0.34, 2.04, p.y);

  // MPF undulation: smooth single wave, ~1.2 wavelengths along body
  // amplitude grows toward posterior (tail undulates most, head stays stable)
  float waveAmp = mix(0.012, 0.048, bodyMask);
  float wave    = sin(p.y * 2.62 - t * 2.20);

  p.x += wave * waveAmp;
  p.z += cos(p.y * 2.62 - t * 2.20) * waveAmp * 0.32;

  return p;
}

// ---------- Anomalocaris anatomy ----------
float headSDF(vec3 q, float t) {
  vec3 h = q - vec3(0.0, -0.46, 0.01);

  float head = sdEllipsoid(h, vec3(0.43, 0.39, 0.25));
  float neck = sdEllipsoid(
    q - vec3(0.0, -0.08, 0.01),
    vec3(0.39, 0.34, 0.20)
  );

  return softUnion(head, neck, 0.13);
}

float trunkSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;

    float y = mix(0.12, 2.18, u);
    float width = mix(0.44, 0.16, pow(u, 1.32));
    float depth = mix(0.19, 0.095, u);

    float segmentWave = sin(t * 1.12 - fi * 0.45);

    vec3 center = vec3(
      segmentWave * 0.018 * u,
      y,
      segmentWave * 0.016 * u
    );

    float segment = sdEllipsoid(
      q - center,
      vec3(width, 0.115, depth)
    );

    d = softUnion(d, segment, 0.070);
  }

  float dorsalLine = sdCapsule(
    q,
    vec3(0.0, -0.02, 0.16),
    vec3(0.0, 2.20, 0.09),
    0.035
  );

  d = softUnion(d, dorsalLine, 0.035);

  return d;
}

float lateralFlapsSDF(vec3 q, float t) {
  float d = 10.0;

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;

    float y = mix(0.14, 2.10, u);
    float span      = mix(0.96, 0.34, pow(u, 1.10));
    float rootWidth = mix(0.22, 0.08, u);

    // ~1.2 wavelengths across 13 segments: phase step = TAU*1.2/13 ≈ 0.580
    // temporal freq matches body wave (2.20 rad/s)
    float phase = fi * 0.580;
    float beat  = sin(t * 2.20 - phase);

    // stroke amplitude: larger mid-body, tapers at both ends
    // anterior flaps do bigger arcs; posterior ones fine-tune steering
    float strokeAmp = mix(0.14, 0.07, u) * (1.0 + 0.18 * sin(t * 0.44));

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;

      vec3 flapQ = q - vec3(
        side * (rootWidth + span * 0.46),
        y + beat * 0.018,
        -0.02 + beat * strokeAmp
      );

      // dorsal stroke angle — flap rotates up on downstroke like manta pectoral
      flapQ.xy *= rot(side * (0.20 + beat * strokeAmp * 0.55));
      flapQ.xz *= rot(side * (-0.12 + beat * strokeAmp * 0.90));

      float flap = sdEllipsoid(
        flapQ,
        vec3(span * 0.62, 0.175, 0.028)
      );

      d = softUnion(d, flap, 0.028);
    }
  }

  return d;
}

float tailFanSDF(vec3 q, float t) {
  float d = 10.0;

  // rudder: deflects opposite to posterior body bend for active steering
  float bodyBend   = sin(2.20 * t - 3.58 * 2.14); // wave value at tail root y≈2.14
  float rudderYaw  = bodyBend * 0.18;   // lateral deflection
  float rudderPitch = cos(2.20 * t - 3.58 * 2.14) * 0.10; // slight up/down tilt

  for (int pair = 0; pair < 3; pair++) {
    float fp = float(pair);

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;

      // spread lobes open/close gently with the stroke cycle
      float spread = 1.0 + 0.12 * sin(t * 2.20 - fp * 0.30);

      vec3 fin = q - vec3(
        side * (0.18 + fp * 0.13) + rudderYaw,
        2.36 + fp * 0.16,
        0.05 + fp * 0.025 + rudderPitch
      );

      fin.xy *= rot(side * (0.50 - fp * 0.10) + rudderYaw * 0.5);
      fin.xz *= rot(side * 0.20 + rudderPitch * 0.4);

      // lobes fan wider on power stroke
      float tailLobe = sdEllipsoid(
        fin,
        vec3((0.42 - fp * 0.06) * spread, 0.22, 0.040)
      );

      d = softUnion(d, tailLobe, 0.030);
    }
  }

  // terminal fin tilts with rudder
  vec3 termPos = q - vec3(rudderYaw * 0.6, 2.70, 0.04 + rudderPitch * 0.5);
  float terminalFin = sdEllipsoid(termPos, vec3(0.12, 0.34, 0.045));

  d = softUnion(d, terminalFin, 0.025);

  return d;
}

float eyesSDF(vec3 q, float t) {
  float d = 10.0;

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;

    // stalks push outward further; eyes enlarged to match reference
    vec3 stalkRoot = vec3(side * 0.22, -0.50, 0.10);
    vec3 eyeCenter = vec3(side * 0.58, -0.58, 0.22);

    float stalk = sdCapsule(q, stalkRoot, eyeCenter, 0.068);
    float eye = sdSphere(q - eyeCenter, 0.195);

    d = softUnion(d, stalk, 0.044);
    d = softUnion(d, eye, 0.052);
  }

  return d;
}

float oralConeSDF(vec3 q, float t) {
  vec3 mouth = q - vec3(0.0, -0.77, -0.17);

  float d = sdTorus(mouth, vec2(0.15, 0.040));

  for (int i = 0; i < 12; i++) {
    float angle = float(i) / 12.0 * TAU;

    vec3 plateCenter = vec3(
      cos(angle) * 0.145,
      sin(angle) * 0.145,
      0.0
    );

    float plate = sdEllipsoid(
      mouth - plateCenter,
      vec3(0.052, 0.028, 0.028)
    );

    d = softUnion(d, plate, 0.018);
  }

  return d;
}

float frontalAppendagesSDF(vec3 q, float t) {
  float d = 10.0;

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;

    // slow whole-arm reach cycle — different phase per side
    float reach   = sin(t * 0.38 + side * 1.14) * 0.12;
    float reachZ  = cos(t * 0.38 + side * 1.14) * 0.06;

    vec3 prev = vec3(side * 0.14, -0.70 + reach * 0.18, -0.04 + reachZ);

    for (int j = 1; j <= 12; j++) {
      float u    = float(j) / 12.0;
      float curl = u * PI * 0.83;

      // layer 1: slow proximal reach (strongest at base)
      float slowFlex = reach * (1.0 - u) * 0.55;

      // layer 2: traveling segment wave — distal joints lag behind
      float wave = sin(t * 1.62 - u * 3.8 + side * 0.9) * 0.048 * u;

      // layer 3: fast tip quiver (only last few segments)
      float quiver = sin(t * 4.10 + u * 5.2 + side * 2.3)
                     * 0.018 * smoothstep(0.5, 1.0, u);

      float flex = slowFlex + wave + quiver;

      vec3 next = vec3(
        side * (0.14 + sin(curl) * 0.39 + flex),
        -0.68 - u * 0.82 - (1.0 - cos(curl)) * 0.17 + reach * (1.0 - u) * 0.30,
        -0.04 - u * 0.08 + sin(curl) * 0.10 + reachZ * (1.0 - u) * 0.4
      );

      float armRadius = mix(0.062, 0.022, u);

      d = softUnion(
        d,
        sdCapsule(q, prev, next, armRadius),
        0.026
      );

      if (j > 2 && j < 12) {
        // spines flick with quiver phase
        float spineQuiver = sin(t * 3.80 + u * 4.6 + side * 1.7) * 0.022;
        vec3 spineTip = next + vec3(
          side * (0.04 + spineQuiver),
          0.02,
          -mix(0.17, 0.07, u)
        );

        float spine = sdCapsule(
          q,
          next,
          spineTip,
          armRadius * 0.32
        );

        d = softUnion(d, spine, 0.013);
      }

      prev = next;
    }
  }

  return d;
}

float creatureSDF(vec3 p, float t) {
  vec3 q = bendSpace(p, t);

  float d = headSDF(q, t);

  d = softUnion(d, trunkSDF(q, t), 0.115);
  d = softUnion(d, lateralFlapsSDF(q, t), 0.044);
  d = softUnion(d, tailFanSDF(q, t), 0.045);
  d = softUnion(d, eyesSDF(q, t), 0.048);
  d = softUnion(d, oralConeSDF(q, t), 0.025);
  d = softUnion(d, frontalAppendagesSDF(q, t), 0.046);

  float surfaceTexture = (
    fbm(q * 5.8 + vec3(0.0, t * 0.12, 0.0)) - 0.5
  ) * 0.008;

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

    d += max(surfaceDistance * 0.64, 0.004);
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
  float snow = 0.0;

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
      snow += smoothstep(0.05, 0.0, length(f)) * (1.0 - fi * 0.09);
    }
  }

  return snow;
}

// ---------- projected glow: swimming flaps ----------
vec3 renderFlapGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;

    // synced with lateralFlapsSDF — same phase/freq/amp
    float y = mix(0.14, 2.10, u);
    float span      = mix(0.96, 0.34, pow(u, 1.10));
    float rootWidth = mix(0.22, 0.08, u);
    float beat        = sin(t * 2.20 - fi * 0.580);
    float strokeAmp   = mix(0.14, 0.07, u) * (1.0 + 0.18 * sin(t * 0.44));

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;

      vec3 rootLocal = vec3(
        side * rootWidth,
        y - 0.08,
        -0.010
      );

      vec3 tipLocal = vec3(
        side * (rootWidth + span * 0.96),
        y + 0.10,
        -0.02 + beat * strokeAmp
      );

      vec3 rearLocal = vec3(
        side * (rootWidth + span * 0.76),
        y + 0.22,
        -0.03 + beat * strokeAmp * 0.80
      );

      rootLocal = anomalocarisPose(rootLocal);
      tipLocal = anomalocarisPose(tipLocal);
      rearLocal = anomalocarisPose(rearLocal);

      vec2 root2 = project(off + rootLocal, cam);
      vec2 tip2 = project(off + tipLocal, cam);
      vec2 rear2 = project(off + rearLocal, cam);

      float d1 = distSeg(st, root2, tip2);
      float d2 = distSeg(st, tip2, rear2);

      // sharper edge line for blade-like flaps
      float line =
        smoothstep(0.0012, 0.0, d1) +
        smoothstep(0.0010, 0.0, d2);

      float glow =
        exp(-d1 * 88.0) * 0.095 +
        exp(-d2 * 100.0) * 0.075;

      vec3 flapColor = mix(CYAN, VIOLET, u * 0.70);
      flapColor = mix(
        flapColor,
        PINK,
        0.18 + 0.16 * max(beat, 0.0)
      );

      col += flapColor
        * (glow + line * 0.22)
        * (1.0 - u * 0.20)
        * VEIL_POWER;
    }
  }

  return col;
}

// ---------- projected glow: frontal grasping appendages ----------
vec3 renderAppendageGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;

    // mirror the three-layer motion from the SDF
    float reach  = sin(t * 0.38 + side * 1.14) * 0.12;
    float reachZ = cos(t * 0.38 + side * 1.14) * 0.06;

    vec3 prevLocal = vec3(side * 0.14, -0.70 + reach * 0.18, -0.04 + reachZ);
    prevLocal = anomalocarisPose(prevLocal);
    vec3 prev = off + prevLocal;

    for (int j = 1; j <= 12; j++) {
      float u    = float(j) / 12.0;
      float curl = u * PI * 0.83;

      float slowFlex = reach * (1.0 - u) * 0.55;
      float wave     = sin(t * 1.62 - u * 3.8 + side * 0.9) * 0.048 * u;
      float quiver   = sin(t * 4.10 + u * 5.2 + side * 2.3)
                       * 0.018 * smoothstep(0.5, 1.0, u);
      float flex = slowFlex + wave + quiver;

      vec3 nextLocal = vec3(
        side * (0.14 + sin(curl) * 0.39 + flex),
        -0.68 - u * 0.82 - (1.0 - cos(curl)) * 0.17 + reach * (1.0 - u) * 0.30,
        -0.04 - u * 0.08 + sin(curl) * 0.10 + reachZ * (1.0 - u) * 0.4
      );

      nextLocal = anomalocarisPose(nextLocal);
      vec3 next = off + nextLocal;

      float armDistance = distSeg(
        st,
        project(prev, cam),
        project(next, cam)
      );

      // color shifts ACID→PINK toward tip, brightens near grasping end
      vec3 armColor = mix(ACID, PINK, u * 0.78);
      float tipBright = smoothstep(0.6, 1.0, u) * 1.45 + 1.0;

      col += armColor
        * (
          smoothstep(0.0014, 0.0, armDistance) * 0.46 +
          exp(-armDistance * 96.0) * 0.065
        )
        * (1.0 - u * 0.28)
        * tipBright
        * GLOW_POWER;

      // glowing tip flare — hot PINK+ACID burst at the grasping claw end
      if (j == 12) {
        float tipDist = length(st - project(next, cam));
        col += mix(PINK, ACID, 0.40)
          * exp(-tipDist * 52.0) * 0.18
          * (1.0 + 0.35 * sin(t * 4.10 + side * 2.3));
      }

      if (j > 2 && j < 12) {
        float spineQuiver = sin(t * 3.80 + u * 4.6 + side * 1.7) * 0.022;
        vec3 spineLocal = vec3(
          side * (0.14 + sin(curl) * 0.39 + flex + side * (0.04 + spineQuiver)),
          -0.68 - u * 0.82 - (1.0 - cos(curl)) * 0.17 + reach * (1.0 - u) * 0.30 + 0.02,
          -0.04 - u * 0.08 + sin(curl) * 0.10 + reachZ * (1.0 - u) * 0.4 - mix(0.17, 0.07, u)
        );

        spineLocal = anomalocarisPose(spineLocal);

        float spineDistance = distSeg(
          st,
          project(next, cam),
          project(off + spineLocal, cam)
        );

        col += ACID
          * (
            smoothstep(0.0010, 0.0, spineDistance) * 0.28 +
            exp(-spineDistance * 108.0) * 0.042
          )
          * GLOW_POWER;
      }

      prev = next;
    }
  }

  return col;
}

// ---------- projected glow: tail fan ----------
vec3 renderTailGlow(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  // mirror rudder deflection from tailFanSDF
  float bodyBend  = sin(2.20 * t - 3.58 * 2.14);
  float rudderYaw = bodyBend * 0.18;

  for (int pair = 0; pair < 3; pair++) {
    float fp = float(pair);

    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      float spread = 1.0 + 0.12 * sin(t * 2.20 - fp * 0.30);

      vec3 rootLocal = vec3(
        side * 0.08 + rudderYaw,
        2.22 + fp * 0.12,
        0.06
      );

      vec3 tipLocal = vec3(
        side * (0.48 - fp * 0.05) * spread + rudderYaw,
        2.42 + fp * 0.16,
        0.05 + bodyBend * 0.06
      );

      rootLocal = anomalocarisPose(rootLocal);
      tipLocal = anomalocarisPose(tipLocal);

      float d = distSeg(
        st,
        project(off + rootLocal, cam),
        project(off + tipLocal, cam)
      );

      vec3 tailColor = mix(VIOLET, PINK, 0.54);

      col += tailColor
        * (
          smoothstep(0.0015, 0.0, d) * 0.28 +
          exp(-d * 92.0) * 0.070
        )
        * GLOW_POWER;
    }
  }

  return col;
}

// ---------- projected glow: segment ribs ----------
vec3 renderSegmentRibs(vec2 st, Cam cam, float t) {
  vec3 col = vec3(0.0);
  vec3 off = creatureOffset(t);

  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u = fi / 12.0;

    float y = mix(0.12, 2.18, u);
    float width = mix(0.40, 0.13, pow(u, 1.32));
    float pulse = 0.72 + 0.28 * sin(t * 1.25 - fi * 0.46);

    vec3 leftLocal = vec3(-width, y, 0.08);
    vec3 rightLocal = vec3(width, y, 0.08);

    leftLocal = anomalocarisPose(leftLocal);
    rightLocal = anomalocarisPose(rightLocal);

    float d = distSeg(
      st,
      project(off + leftLocal, cam),
      project(off + rightLocal, cam)
    );

    vec3 ribColor = mix(CYAN, VIOLET, u * 0.56);

    // sharper rib line + soft aura for segment boundary legibility
    col += ribColor
      * (exp(-d * 210.0) * 0.055 + exp(-d * 90.0) * 0.040)
      * pulse
      * GLOW_POWER;
    col += ribColor
      * smoothstep(0.0014, 0.0, d) * 0.032
      * pulse;
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

  float lens = 1.06 + 0.015 * sin(t * 0.18 + 0.6);

  vec3 rd = normalize(
    cam.fwd +
    cam.rgt * st.x * lens * 0.94 +
    cam.up * st.y * lens
  );

  // ---------- background ----------
  // deeper blue at bottom, lighter teal toward top — Cambrian shallow sea
  vec3 col = mix(
    vec3(0.002, 0.006, 0.022),
    vec3(0.010, 0.045, 0.095),
    smoothstep(-1.0, 1.0, st.y)
  );

  // ambient depth gradient
  col += vec3(0.022, 0.028, 0.080)
    * smoothstep(-0.88, 1.0, st.y);

  // strong caustic shafts — bright light columns from the surface above
  float caust = caustic(st * 0.74 + vec2(t * 0.026, 0.0), t);
  col += vec3(0.035, 0.110, 0.175) * caust
    * smoothstep(-0.40, 1.0, st.y);
  // second layer of finer caustic detail
  col += vec3(0.018, 0.065, 0.115)
    * caustic(st * 1.38 - vec2(t * 0.018, t * 0.012), t)
    * smoothstep(0.10, 1.0, st.y);

  // ---------- raymarch ----------
  float d = rayMarch(cam.ro, rd, t);
  bool hit = d < MAX_DIST;
  vec3 p = cam.ro + rd * d;

  if (hit) {
    vec3 n = getNormal(p, t);

    vec3 L1 = normalize(vec3(-0.42, 0.82, -0.28));
    vec3 L2 = normalize(vec3(0.62, -0.10, 0.70));

    float diff = max(dot(n, L1), 0.0);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.55);
    float back = pow(max(dot(L2, rd), 0.0), 2.1);

    vec3 local = bendSpace(p, t);

    float headRegion = smoothstep(0.08, -0.46, local.y);
    float tailRegion = smoothstep(1.78, 2.46, local.y);
    float ventralRegion = smoothstep(0.04, -0.20, local.z);

    float segments = 0.5 + 0.5 * sin(local.y * 35.0 - t * 1.15);
    float livingNoise = fbm(
      local * 5.6 + vec3(0.0, t * 0.16, 0.0)
    );

    vec3 headCol = mix(ACID, CYAN, 0.28);
    vec3 trunkCol = mix(CYAN, VIOLET, 0.52);
    vec3 tailCol = mix(PINK, VIOLET, 0.36);

    float regionCrush = mix(0.44, 0.32, headRegion + tailRegion * 0.5);
    vec3 body = mix(trunkCol, headCol, headRegion) * regionCrush;
    body = mix(body, tailCol * 0.54, tailRegion);

    // iridescent chitin — hue shifts with viewing angle (Fresnel-like)
    float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 1.8);
    vec3 iridescence = mix(CYAN, VIOLET, fresnel * 0.72 + livingNoise * 0.18);
    iridescence = mix(iridescence, ACID, smoothstep(0.6, 1.0, fresnel) * 0.35);
    body += iridescence * 0.28 * (1.0 - headRegion * 0.5);

    // tight dorsal specular — gives body volume along the spine ridge
    vec3 H = normalize(L1 + normalize(-cam.ro));
    float spec = pow(max(dot(n, H), 0.0), 52.0) * (1.0 - headRegion * 0.4);
    body += mix(CYAN, ACID, 0.35) * spec * 0.85;

    body += CYAN * diff * 0.36;
    body += VIOLET * 0.14;
    body += ACID * back * (0.42 + headRegion * 0.24);

    // sharper segment ridges: narrow sine band at each tergite boundary
    float segEdge = pow(max(0.0, sin(local.y * 35.0 - t * 1.15)), 6.0);
    float trunkMask = (1.0 - headRegion * 0.85) * (1.0 - tailRegion * 0.65);
    vec3 bandColor = mix(CYAN, VIOLET, smoothstep(0.15, 1.95, local.y));
    bandColor = mix(bandColor, PINK, tailRegion * 0.24);
    body += bandColor * segEdge * trunkMask * (0.22 + diff * 0.14);
    // soft mid-segment fill for plate coloring
    body += bandColor * segments * trunkMask * (0.08 + diff * 0.06);

    body += PINK * segments * rim * (0.18 + ventralRegion * 0.10);
    body += CYAN * rim * (0.72 + livingNoise * 0.42);

    float alpha = 0.80 + rim * 0.52 + back * 0.24;
    col = mix(col, body, clamp(alpha, 0.0, 0.94));

    // larger eye aura matching updated eye positions
    float eyeAura = 0.0;
    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      vec3 eyePos = vec3(side * 0.58, -0.58, 0.22);
      eyeAura += exp(-length((local - eyePos) * vec3(1.4, 2.2, 1.8)) * 1.8);
    }
    // dark pupil center — makes the compound eyes read as actual lenses
    float pupilMask = 0.0;
    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      vec3 eyePos = vec3(side * 0.58, -0.58, 0.22);
      pupilMask += exp(-length((local - eyePos) * vec3(2.8, 4.0, 3.0)) * 4.5);
    }

    // oral-cone radial plate pulse
    vec2 mouthVec = local.xy - vec2(0.0, -0.78);
    float mouthAngle = atan(mouthVec.y, mouthVec.x);
    float platePulse = 0.52 + 0.48 * sin(mouthAngle * 6.0 + t * 0.62);

    float oralAura = exp(
      -length(
        (local - vec3(0.0, -0.78, -0.17)) *
        vec3(1.8, 2.8, 2.3)
      ) * 3.0
    );

    col += ACID * eyeAura * 0.30 * GLOW_POWER;
    col -= vec3(0.04, 0.06, 0.08) * pupilMask; // subtle darkening at pupil center
    col += mix(PINK, ACID, 0.22)
      * oralAura * platePulse * 0.32 * GLOW_POWER;
  }

  // ---------- projected glow ----------
  // col += renderFlapGlow(st, cam, t)
  //   * (1.14 + 0.09 * sin(t * 0.82));

  // col += renderAppendageGlow(st, cam, t)
  //   * (1.18 + 0.08 * sin(t * 1.10));

  // col += renderTailGlow(st, cam, t)
  //   * (1.12 + 0.06 * sin(t * 0.74));

  // col += renderSegmentRibs(st, cam, t)
  //   * (1.10 + 0.05 * sin(t * 0.62));

  // ---------- particles ----------
  float snow = marineSnow(st * 1.22, t);
  col += vec3(0.70, 0.82, 1.0) * snow * 0.62;

  for (int i = 0; i < 11; i++) {
    float fi = float(i);

    vec2 center = vec2(
      sin(fi * 12.7 + t * 0.10),
      cos(fi * 9.1 - t * 0.075)
    );

    center.x *= 0.74;
    center.y = fract(
      center.y * 0.5 + 0.5 + t * 0.021 + fi * 0.13
    ) * 2.4 - 1.2;

    float particleDistance = length(st - center);
    vec3 particleColor = mix(VIOLET, CYAN, hash11(fi * 4.7));

    col += particleColor
      * exp(-particleDistance * 25.0)
      * 0.050;
  }

  // ---------- post ----------
  col *= INTENSITY * 1.04;
  col += pow(max(col, 0.0), vec3(1.28)) * 0.37;

  float vignette = 1.0 - 0.18
    * smoothstep(0.22, 1.62, length(st));

  col *= vignette;

  col = col / (0.84 + col);
  col = pow(col, vec3(1.0 / 0.96));

  float grain = (
    hash11(uv.x * 1234.5 + uv.y * 987.6 + t) - 0.5
  ) * 0.018;

  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}