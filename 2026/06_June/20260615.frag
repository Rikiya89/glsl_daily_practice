// ===============================================================
// TUZOIA NEON FOSSIL
// TouchDesigner GLSL TOP fragment shader
// Bivalved carapace + stalked eyes + antennae + segmented trunk
// + biramous limbs (endopod + exopod) + two-tier tail fan
// Anatomy corrected from Tuzoia diagram (a)(b)(c)(d).
// Original neon palette preserved.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS 152
#define MAX_DIST  15.0
#define SURF_DIST 0.0010
#define PI        3.14159265359
#define TAU       6.28318530718

const vec3 ACID   = vec3(0.0,   1.0,   0.624);
const vec3 CYAN   = vec3(0.0,   0.812, 1.0);
const vec3 VIOLET = vec3(0.545, 0.0,   1.0);
const vec3 PINK   = vec3(1.0,   0.0,   0.431);

// ---------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------
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
    mix(mix(hash13(p),             hash13(p+vec3(1,0,0)), f.x),
        mix(hash13(p+vec3(0,1,0)), hash13(p+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(p+vec3(0,0,1)), hash13(p+vec3(1,0,1)), f.x),
        mix(hash13(p+vec3(0,1,1)), hash13(p+vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p  = p * 2.04 + vec3(17.3, 9.1, 5.7);
    a *= 0.52;
  }
  return v;
}

// ---------------------------------------------------------------
// SDF PRIMITIVES
// ---------------------------------------------------------------
float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}

float sdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - mix(ra, rb, h);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

// ---------------------------------------------------------------
// HIT STRUCT
// ---------------------------------------------------------------
struct Hit { float d; float m; };

Hit opUnion(Hit a, Hit b) { return a.d < b.d ? a : b; }

Hit opSmoothUnion(Hit a, Hit b, float k) {
  float d = smin(a.d, b.d, k);
  float h = smoothstep(-k, k, b.d - a.d);
  return Hit(d, mix(b.m, a.m, h));
}

// ---------------------------------------------------------------
// POSE / UNPOSE
// World: creature swims with trunk running along +Y axis,
// dorsal surface facing +Z, anterior (head) at -Y.
// ---------------------------------------------------------------
vec3 tuzoiaPose(vec3 p, float t) {
  // gentle floating drift
  p.y -= 0.06 * sin(t * 0.19);
  // slight lateral rock
  p.xz *= rot(0.018 * sin(t * 0.27));
  // very slow pitch forward/back
  p.yz *= rot(0.06 + 0.015 * sin(t * 0.16));
  return p;
}

vec3 tuzoiaUnpose(vec3 q, float t) {
  q.yz *= rot(-(0.06 + 0.015 * sin(t * 0.16)));
  q.xz *= rot(-0.018 * sin(t * 0.27));
  q.y += 0.06 * sin(t * 0.19);
  return q;
}

// ---------------------------------------------------------------
// TRUNK GEOMETRY HELPERS
// Trunk spans Y = -0.48 (first limb segment) to Y = 0.72 (final segment)
// ---------------------------------------------------------------
float tuzTrunkW(float y) {
  float u = clamp((y + 0.48) / 1.20, 0.0, 1.0);
  // tapers toward posterior (high u)
  return mix(0.145, 0.072, pow(u, 1.30)) * smoothstep(0.0, 0.055, u);
}

vec3 tuzSegC(float y, float t) {
  // gentle lateral undulation increases posteriorly
  float u = clamp((y + 0.48) / 1.20, 0.0, 1.0);
  float lateralFlex = sin(y * 2.6 - t * 0.24) * 0.010 * smoothstep(0.15, 1.0, u);
  return vec3(lateralFlex, y, -0.085 + cos(y * 2.0 - t * 0.20) * 0.006);
}

// ---------------------------------------------------------------
// 1. BIVALVED CARAPACE
//    Broad rounded shield. Dorsal margin has 'acp' scallops.
//    Ventral margin has 'pvs' scallops. No cardinal spines.
//    Two thin valve volumes + median dorsal hinge seam.
// ---------------------------------------------------------------
float tuzoiaCarapaceSDF(vec3 q, float t) {
  float d = 20.0;
  float breath = 0.004 * sin(t * 0.22);

  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;

    // Each valve: very broad (X), tall (Y), shallow (Z)
    // Diagram: carapace is nearly circular in lateral silhouette
    vec3 c = q - vec3(side * 0.210, 0.06, 0.026);
    c.xz *= rot(side * -0.025);

    // Main valve volume
    float shell = sdEllipsoid(c, vec3(0.360 + breath, 0.970, 0.520));

    // -- Anterior opening: head and appendages protrude here --
    float anteriorClip = q.y + 0.86;
    shell = max(shell, -anteriorClip);

    // -- Posterior end clip --
    float posteriorClip = 0.95 - q.y;
    shell = max(shell, -posteriorClip);

    // -- Ventral opening (pvs): scalloped, wide --
    // Depth of ventral opening varies with Y for scalloped 'pvs' edge
    float pvs = 0.042 * sin(q.y * 4.8 + 0.6) + 0.025 * sin(q.y * 9.1);
    float ventralClip = -q.z - (0.240 + pvs);
    shell = max(shell, ventralClip);

    // -- Median valve gap --
    float gap = 0.014 - abs(q.x);
    shell = max(shell, gap);

    d = min(d, shell);
  }

  // Dorsal hinge rod (the thin ridge visible as 'acp' base)
  d = min(d, sdTaperedCapsule(q, vec3(0.0,-0.84,0.495), vec3(0.0,0.90,0.480), 0.010, 0.008));

  // Dorsal margin scallop nodules (acp): small bumps along dorsal rim
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float u  = fi / 8.0;
    float y  = mix(-0.70, 0.88, u);
    // scallop bump sits just below the dorsal apex
    float scX = 0.040 * sin(u * PI * 2.0 + 0.4);
    d = min(d, sdSphere(q - vec3(scX, y, 0.510), 0.022 + 0.006*sin(fi*1.9)));
  }

  // Ventral margin rods (left / right)
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    d = min(d, sdTaperedCapsule(q,
      vec3(side*0.020, -0.82, 0.390),
      vec3(side*0.360,  0.72, 0.210), 0.011, 0.009));
  }

  return d;
}

// ---------------------------------------------------------------
// 2. HEAD / CEPHALOTHORAX
//    Compact dome projecting from anterior carapace opening.
//    Large oval stalked eyes (ey) far anterior.
// ---------------------------------------------------------------
float tuzoiaHeadSDF(vec3 q, float t) {
  // cephalic body dome
  float d = sdEllipsoid(q - vec3(0.0,-0.82,-0.098), vec3(0.162,0.115,0.092));

  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    float bob  = 0.010 * sin(t*0.42 + side*0.72);

    // Eye stalk – projects clearly anterior and lateral (diagram c)
    vec3 sRoot = vec3(side*0.082, -0.850, -0.068);
    vec3 sTip  = vec3(side*0.265, -1.065, -0.052 + bob);
    d = smin(d, sdTaperedCapsule(q, sRoot, sTip, 0.020, 0.014), 0.012);

    // Eye globe – clearly oval (diagram shows large oval ey)
    vec3 eLocal = q - sTip;
    eLocal.yz *= rot(-0.22);
    d = smin(d, sdEllipsoid(eLocal, vec3(0.044, 0.056, 0.038)), 0.014);
  }

  return d;
}

// ---------------------------------------------------------------
// 3. ANTENNAE (an) – long, forward-projecting pair
//    Diagram (a)(c): antennae project far anteriorly from head
// ---------------------------------------------------------------
float tuzoiaAntennaeSDF(vec3 q, float t) {
  float d = 20.0;

  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    // Base at head margin
    vec3 base = vec3(side*0.065, -0.930, -0.115);

    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float u0 = fi / 8.0;
      float u1 = (fi+1.0) / 8.0;
      float wv = sin(t*0.36 + fi*0.58 + side*0.50) * 0.018;
      // antennae curve outward and forward (anterior direction = -Y)
      vec3 a = base + vec3(
        side * 0.180 * sin(u0 * 1.20),
        -0.240 * fi,
        -0.060 * fi + wv);
      vec3 b = base + vec3(
        side * 0.180 * sin(u1 * 1.20),
        -0.240 * (fi+1.0),
        -0.060 * (fi+1.0) + wv);
      d = smin(d, sdTaperedCapsule(q, a, b,
        0.016 - u0*0.012, 0.015 - u1*0.011), 0.005);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 4. CEPHALIC APPENDAGES (c.a / ce)
//    Diagram (d): dense fan of short segmented limbs spreading
//    anteriorly beneath head. NOT large claws.
// ---------------------------------------------------------------
float tuzoiaCephalicAppendagesSDF(vec3 q, float t) {
  float d = 20.0;

  // 4 pairs of cephalic limbs, fanning out from beneath head
  for (int pair = 0; pair < 4; pair++) {
    float fp  = float(pair);
    float up  = fp / 3.0;
    // fan angle: innermost pair nearly vertical, outer pairs spread laterally
    float fanAngle = mix(0.15, 0.72, up);

    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      float flex = sin(t*0.54 - fp*0.44 + side*0.38) * 0.018;

      vec3 root = vec3(side * fanAngle * 0.120, -0.880 - fp*0.012, -0.130);

      // 4 segments per appendage
      vec3 prev = root;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float u  = fi / 3.0;
        vec3 next = vec3(
          side * (fanAngle * 0.120 + 0.085 * sin(u * 1.10 + fanAngle)),
          -0.880 - fp*0.012 - 0.075*fi + flex*fi*0.25,
          -0.135 + 0.050*fi - 0.015*fi*fi + flex
        );
        d = smin(d, sdTaperedCapsule(q, prev, next,
          0.022 - u*0.006, 0.020 - u*0.005), 0.007);
        // small inward spine
        if (i < 3) {
          vec3 sIn = mix(prev, next, 0.55);
          vec3 sTp = sIn + vec3(-side*0.032, -0.012, 0.024 + 0.008*u);
          d = smin(d, sdTaperedCapsule(q, sIn, sTp, 0.006, 0.001), 0.003);
        }
        prev = next;
      }
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 5. TRUNK (tr) – 13 disc segments, clearly separated
//    Diagram: segments get smaller posteriorly, curved ventral face
// ---------------------------------------------------------------
float tuzoiaTrunkSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u  = fi / 12.0;
    float y  = mix(-0.46, 0.72, u);
    vec3 c   = tuzSegC(y, t);
    float w  = tuzTrunkW(y);
    // segments are wide laterally, thin dorso-ventrally, disc-like
    d = smin(d, sdEllipsoid(q - c, vec3(w, 0.036, 0.088)), 0.013);
  }
  // gut chord
  d = smin(d,
    sdCapsule(q, tuzSegC(-0.44,t)+vec3(0,0,0.006),
                 tuzSegC( 0.72,t)+vec3(0,0,0.003), 0.018), 0.013);
  return d;
}

// ---------------------------------------------------------------
// 6. BIRAMOUS LIMBS
//    Diagram (b)(c): each limb has:
//      ba  = basal attachment
//      en  = endopod: multi-segmented, points DOWNWARD (-Z in world)
//      ex  = exopod: broad paddle, projects LATERALLY (±X)
//      et / sp = enditic spines on endopod
//      p1-7 = podomeres (segments) on endopod
//    Swimming wave: sequential phase offset per segment.
// ---------------------------------------------------------------
float tuzoiaLimbsSDF(vec3 q, float t) {
  float d = 20.0;

  for (int i = 0; i < 13; i++) {
    float fi    = float(i);
    float u     = fi / 12.0;
    float y     = mix(-0.44, 0.70, u);
    float w     = tuzTrunkW(y);
    vec3  c     = tuzSegC(y, t);
    float scale = mix(1.0, 0.44, u);   // posterior limbs smaller

    for (int si = 0; si < 2; si++) {
      float side  = si == 0 ? -1.0 : 1.0;
      // sequential swimming phase: posteriormost limbs lag
      float phase = fi * 0.50 + side * 0.30;
      float beat  = sin(t * 1.18 - phase);

      // --- basal attachment (ba) ---
      vec3 ba = c + vec3(side * w * 0.82, 0.0, -0.035);

      // --- ENDOPOD (en) – segmented, hangs downward (-Z) and slightly outward ---
      // 7 podomeres (p1-7), each slightly smaller
      vec3 enPrev = ba;
      for (int p = 0; p < 7; p++) {
        float fp = float(p);
        float pu = fp / 6.0;
        // wave propagates along limb with slight phase stagger
        float limbWave = 0.022 * sin(t*1.18 - phase - fp*0.30) * scale;
        vec3 enNext = enPrev + vec3(
          side * (0.024 + 0.010*pu) * scale,
          limbWave,
          -(0.072 + 0.008*pu) * scale
        );
        float er = (0.014 - pu*0.005) * scale;
        d = smin(d, sdTaperedCapsule(q, enPrev, enNext, er+0.001, er), 0.004);

        // enditic spine (et/sp) on first 4 podomeres
        if (p < 4) {
          vec3 spRoot = mix(enPrev, enNext, 0.60);
          vec3 spTip  = spRoot + vec3(-side*0.028*scale, 0.0, -0.014*scale);
          d = smin(d, sdCapsule(q, spRoot, spTip, 0.003*scale), 0.002);
        }
        enPrev = enNext;
      }

      // --- EXOPOD (ex) – broad lateral paddle ---
      // Attaches at ba, swings outward with beat
      float exAngle  = 0.25 + 0.12 * beat;
      vec3 exBase    = ba;
      vec3 exTip     = exBase + vec3(
        side * (0.200 + 0.060*beat) * scale,
        0.025 * beat * scale,
        -0.060 * scale
      );
      // paddle blade: flat wide ellipsoid at tip
      vec3 exPaddle  = exTip + vec3(side * 0.055 * scale, 0.0, -0.010);
      vec3 exLocal   = q - exPaddle;
      exLocal.xy *= rot(side * exAngle);
      exLocal.yz *= rot(-0.08);
      float paddle   = sdEllipsoid(exLocal, vec3(0.130*scale, 0.040, 0.022));

      d = smin(d, sdTaperedCapsule(q, exBase, exTip, 0.012*scale, 0.006*scale), 0.005);
      d = smin(d, paddle, 0.007);

      // marginal setae on exopod (diagram b: fine filaments along paddle edge)
      for (int j = 0; j < 5; j++) {
        float fj   = float(j);
        float su   = (fj + 0.5) / 5.0;
        vec3 sRoot = exPaddle + vec3(
          side * (0.055 + 0.095*su) * scale,
          (su - 0.5) * 0.085 * scale,
          -0.006);
        vec3 sTip  = sRoot + vec3(
          side * 0.052 * scale,
          sin(t + fi + fj) * 0.006,
          0.032 * scale);
        d = smin(d, sdCapsule(q, sRoot, sTip, 0.0024), 0.002);
      }
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 7. TAIL FAN
//    Diagram (b): ts = telson block (rectangular)
//                 cr1 = upper narrow ramus
//                 cr2 = lower broader rectangular plate
//                 crp = thin caudal ramus process (lateral flap)
// ---------------------------------------------------------------
float tuzoiaTailFanSDF(vec3 q, float t) {
  float d = 20.0;

  vec3 trunkEnd = tuzSegC(0.74, t);

  // --- Telson (ts): broad rectangular block ---
  vec3 tsCenter = trunkEnd + vec3(0.0, 0.170, 0.010);
  vec3 tsLocal  = q - tsCenter;
  tsLocal.yz   *= rot(0.05 + 0.008 * sin(t*0.38));
  d = smin(d, sdBox(tsLocal, vec3(0.095, 0.090, 0.060)), 0.022);

  // --- cr1: upper pair, narrower, angled upward ---
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    float flex = 0.010 * sin(t*0.33 + side*0.85);
    vec3 cr1Base = trunkEnd + vec3(side*0.040, 0.190, 0.020);
    vec3 cr1Tip  = cr1Base  + vec3(side*0.145, 0.160 + flex, -0.018);
    d = smin(d, sdTaperedCapsule(q, cr1Base, cr1Tip, 0.032, 0.010), 0.012);
    // fan blade
    vec3 fC = mix(cr1Base, cr1Tip, 0.62);
    vec3 fL = q - fC;
    fL.xy  *= rot(side * 0.42);
    fL.yz  *= rot(-0.10 + flex*2.5);
    d = smin(d, sdEllipsoid(fL, vec3(0.100, 0.078, 0.018)), 0.012);
  }

  // --- cr2: lower pair, broader rectangular plate (diagram b lower) ---
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    float flex = 0.008 * sin(t*0.37 + side*1.10 + 1.2);
    vec3 cr2Base = trunkEnd + vec3(side*0.028, 0.095, -0.008);
    vec3 cr2Tip  = cr2Base  + vec3(side*0.195, 0.095 + flex, -0.030);
    // broader, flatter than cr1
    d = smin(d, sdTaperedCapsule(q, cr2Base, cr2Tip, 0.040, 0.014), 0.014);
    vec3 fC = mix(cr2Base, cr2Tip, 0.58);
    vec3 fL = q - fC;
    fL.xy  *= rot(side * 0.30);
    fL.yz  *= rot(-0.22);
    d = smin(d, sdEllipsoid(fL, vec3(0.125, 0.058, 0.022)), 0.012);
  }

  // --- crp: thin caudal ramus process (lateral fringe flaps) ---
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    float flex = 0.006 * sin(t*0.40 + side*0.60 + 2.1);
    vec3 crpA = trunkEnd + vec3(side*0.190, 0.210, -0.005);
    vec3 crpB = crpA     + vec3(side*0.085, 0.040 + flex, -0.012);
    d = smin(d, sdTaperedCapsule(q, crpA, crpB, 0.018, 0.006), 0.008);
  }

  return d;
}

// ---------------------------------------------------------------
// SCENE ASSEMBLY
// mat 1=carapace  2=head/eyes  3=trunk  4=limbs
// mat 5=antennae+cephalic  6=tail fan
// ---------------------------------------------------------------
Hit mapScene(vec3 p, float t) {
  vec3 q = tuzoiaPose(p, t);

  Hit res = Hit(20.0, 0.0);
  res = opSmoothUnion(res, Hit(tuzoiaCarapaceSDF(q, t),           1.0), 0.030);
  res = opSmoothUnion(res, Hit(tuzoiaTrunkSDF(q, t),              3.0), 0.022);
  res = opSmoothUnion(res, Hit(tuzoiaHeadSDF(q, t),               2.0), 0.024);
  res = opSmoothUnion(res, Hit(tuzoiaLimbsSDF(q, t),              4.0), 0.010);
  res = opSmoothUnion(res, Hit(tuzoiaAntennaeSDF(q, t),           5.0), 0.008);
  res = opSmoothUnion(res, Hit(tuzoiaCephalicAppendagesSDF(q, t), 5.0), 0.009);
  res = opSmoothUnion(res, Hit(tuzoiaTailFanSDF(q, t),            6.0), 0.020);

  // subtle surface texture
  res.d += (fbm(q * 7.2 + vec3(0.0, t*0.08, 0.0)) - 0.50) * 0.004;
  return res;
}

// ---------------------------------------------------------------
// RAY MARCHER
// ---------------------------------------------------------------
float rayMarch(vec3 ro, vec3 rd, float t, out float glow, out float mat) {
  float d = 0.0;
  glow = 0.0; mat = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    Hit h = mapScene(ro + rd*d, t);
    glow += 0.013 / (0.014 + h.d*h.d*38.0);
    if (h.d < SURF_DIST || d > MAX_DIST) { mat = h.m; break; }
    d += max(h.d * 0.56, 0.0032);
  }
  return d;
}

vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.0018, 0.0);
  return normalize(vec3(
    mapScene(p+e.xyy,t).d - mapScene(p-e.xyy,t).d,
    mapScene(p+e.yxy,t).d - mapScene(p-e.yxy,t).d,
    mapScene(p+e.yyx,t).d - mapScene(p-e.yyx,t).d));
}

// ---------------------------------------------------------------
// PALETTE + MATERIAL
// ---------------------------------------------------------------
vec3 palette(float x) {
  vec3 a = mix(ACID,   CYAN, smoothstep(0.00, 0.38, x));
  vec3 b = mix(VIOLET, PINK, smoothstep(0.46, 1.00, x));
  return mix(a, b, smoothstep(0.24, 0.94, x));
}

vec3 materialColor(float mat, vec3 p, vec3 n, vec3 rd, float t) {
  float fres  = pow(1.0 - max(dot(n,-rd),0.0), 2.1);
  float bands = 0.5 + 0.5*sin(p.y*26.0 + p.x*7.0 - t*1.05);
  vec3 col    = CYAN;

  if (mat < 1.5) {
    // carapace: CYAN/VIOLET with ACID iridescent flash
    col  = mix(CYAN, VIOLET, 0.38 + fres*0.44);
    col += ACID * pow(bands, 9.0) * 0.20;
  } else if (mat < 2.5) {
    // head + eyes: ACID/CYAN + PINK highlight
    col  = mix(ACID, CYAN, 0.30 + fres*0.26);
    col += PINK * fres * 0.28;
  } else if (mat < 3.5) {
    // trunk segments: banded CYAN → VIOLET
    col = mix(CYAN, VIOLET, 0.24 + bands*0.40);
  } else if (mat < 4.5) {
    // biramous limbs: ACID/CYAN + strong PINK rim
    col  = mix(ACID, CYAN, 0.42);
    col += PINK * fres * 0.58;
  } else if (mat < 5.5) {
    // antennae + cephalic: ACID → PINK
    col = mix(ACID, PINK, 0.20 + bands*0.32);
  } else {
    // tail fan (ts, cr1, cr2, crp): PINK/VIOLET + CYAN edge
    col  = mix(PINK, VIOLET, 0.32 + fres*0.50);
    col += CYAN * fres * 0.36;
  }

  col += mix(CYAN, ACID, 0.45) * fres * 0.62;
  return col;
}

// ---------------------------------------------------------------
// LINE OVERLAY – Tuzoia anatomy
// ---------------------------------------------------------------
float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h);
}

vec2 projectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p - ro;
  float z  = max(dot(rel,ww), 0.05);
  return vec2(dot(rel,uu), dot(rel,vv)) / z;
}

vec3 lineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
  vec3 col = vec3(0.0);

  // --- Dorsal hinge (acp base line) ---
  {
    vec3 a = tuzoiaUnpose(vec3(0.0,-0.84,0.495), t);
    vec3 b = tuzoiaUnpose(vec3(0.0, 0.90,0.480), t);
    float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
    col += CYAN * (exp(-d*155.0)*0.038 + smoothstep(0.0010,0.0,d)*0.055);
  }

  // --- Left/right valve outer edges (11 slices) ---
  for (int i = 0; i < 11; i++) {
    float fi = float(i);
    float u  = fi / 10.0;
    float y  = mix(-0.80, 0.90, u);
    float hy = (y - 0.06) / 0.97;
    float hw = 0.360 * sqrt(max(0.0, 1.0 - hy*hy));
    float hz = 0.520 * sqrt(max(0.0, 1.0 - hy*hy));
    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      vec3 a = tuzoiaUnpose(vec3(side*0.012, y, hz*0.82), t);
      vec3 b = tuzoiaUnpose(vec3(side*(0.210+hw), y, hz*0.30), t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      col += mix(ACID,CYAN,u) * (exp(-d*125.0)*0.028 + smoothstep(0.0009,0.0,d)*0.036);
    }
  }

  // --- Ventral margin / pvs scallop line ---
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float u0 = fi / 9.0;
    float u1 = (fi+1.0) / 9.0;
    float y0 = mix(-0.80, 0.90, u0);
    float y1 = mix(-0.80, 0.90, u1);
    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      float pv0 = 0.042*sin(y0*4.8+0.6)+0.025*sin(y0*9.1);
      float pv1 = 0.042*sin(y1*4.8+0.6)+0.025*sin(y1*9.1);
      vec3 a = tuzoiaUnpose(vec3(side*0.175, y0, -(0.240+pv0)), t);
      vec3 b = tuzoiaUnpose(vec3(side*0.175, y1, -(0.240+pv1)), t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      col += VIOLET * (exp(-d*105.0)*0.022 + smoothstep(0.0009,0.0,d)*0.028);
    }
  }

  // --- Trunk segment divisions ---
  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    float u  = fi / 12.0;
    float y  = mix(-0.46, 0.72, u);
    float w  = tuzTrunkW(y);
    vec3  c  = tuzSegC(y, t);
    vec3 a = tuzoiaUnpose(c + vec3(-w, 0.0, -0.036), t);
    vec3 b = tuzoiaUnpose(c + vec3( w, 0.0, -0.036), t);
    float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
    col += mix(CYAN,VIOLET,u*0.68) * exp(-d*112.0) * 0.024;
  }

  // --- Biramous limb axes (exopod line per segment) ---
  for (int i = 0; i < 13; i++) {
    float fi    = float(i);
    float u     = fi / 12.0;
    float y     = mix(-0.44, 0.70, u);
    float w     = tuzTrunkW(y);
    vec3  c     = tuzSegC(y, t);
    float scale = mix(1.0, 0.44, u);
    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      float phase = fi*0.50 + side*0.30;
      float beat  = sin(t*1.18 - phase);
      vec3 ba  = c + vec3(side*w*0.82, 0.0, -0.035);
      vec3 exT = ba + vec3(side*(0.200+0.060*beat)*scale, 0.025*beat*scale, -0.060*scale);
      vec3 a = tuzoiaUnpose(ba,  t);
      vec3 b = tuzoiaUnpose(exT, t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      col += mix(ACID,CYAN,u*0.58) * exp(-d*92.0) * 0.020;
    }
  }

  // --- Antennae ---
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    vec3 base = vec3(side*0.065, -0.930, -0.115);
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float u0 = fi / 8.0, u1 = (fi+1.0)/8.0;
      float wv = sin(t*0.36+fi*0.58+side*0.50)*0.018;
      vec3 a = tuzoiaUnpose(base+vec3(side*0.180*sin(u0*1.20),-0.240*fi,-0.060*fi+wv), t);
      vec3 b = tuzoiaUnpose(base+vec3(side*0.180*sin(u1*1.20),-0.240*(fi+1.0),-0.060*(fi+1.0)+wv), t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      col += mix(ACID,PINK,u0*0.55) * exp(-d*118.0) * 0.026;
    }
  }

  // --- Eye stalks + glow ---
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    float bob  = 0.010*sin(t*0.42+side*0.72);
    vec3 sRoot = tuzoiaUnpose(vec3(side*0.082,-0.850,-0.068), t);
    vec3 eyeP  = tuzoiaUnpose(vec3(side*0.265,-1.065,-0.052+bob), t);
    float stalk = distSeg(st, projectPoint(sRoot,ro,uu,vv,ww), projectPoint(eyeP,ro,uu,vv,ww));
    float eyeG  = length(st - projectPoint(eyeP,ro,uu,vv,ww));
    col += mix(ACID,CYAN,0.28) * exp(-stalk*98.0) * 0.068;
    col += mix(CYAN,PINK,0.32) * exp(-eyeG*45.0)  * 0.155;
    col += ACID * exp(-eyeG*145.0) * 0.095;
  }

  // --- Tail fan: cr1, cr2, telson lines ---
  {
    vec3 fBase = tuzSegC(0.74, t);
    // telson line
    {
      vec3 a = tuzoiaUnpose(fBase, t);
      vec3 b = tuzoiaUnpose(fBase+vec3(0.0,0.260,0.010), t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      col += CYAN * exp(-d*115.0) * 0.025;
    }
    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      // cr1
      {
        float flex = 0.010*sin(t*0.33+side*0.85);
        vec3 a = tuzoiaUnpose(fBase+vec3(side*0.040,0.190,0.020), t);
        vec3 b = tuzoiaUnpose(fBase+vec3(side*0.185,0.350+flex,0.002), t);
        float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
        col += mix(PINK,VIOLET,0.38) * exp(-d*98.0) * 0.027;
      }
      // cr2
      {
        float flex = 0.008*sin(t*0.37+side*1.10+1.2);
        vec3 a = tuzoiaUnpose(fBase+vec3(side*0.028,0.095,-0.008), t);
        vec3 b = tuzoiaUnpose(fBase+vec3(side*0.223,0.190+flex,-0.038), t);
        float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
        col += mix(VIOLET,PINK,0.42) * exp(-d*95.0) * 0.025;
      }
    }
  }

  return col;
}

// ---------------------------------------------------------------
// BACKGROUND – deep ocean (unchanged visual language)
// ---------------------------------------------------------------
vec3 background(vec2 st, float t) {
  vec3 col = mix(vec3(0.002,0.006,0.022), vec3(0.010,0.045,0.095),
                 smoothstep(-1.0, 1.0, st.y));
  float caustic = 0.0;
  vec2 q = st;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    q += 0.20 * vec2(cos(t*0.16+fi), sin(t*0.12+fi*1.7));
    caustic += sin(q.x*(3.0+fi)+t*0.33) * cos(q.y*(3.6+fi)-t*0.26);
  }
  col += mix(CYAN,VIOLET,0.38) * pow(0.5+0.5*caustic/5.0, 4.0) * 0.15;

  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec2 p = vec2(hash11(fi*13.7), hash11(fi*41.2)) * 2.0 - 1.0;
    p.y = fract(p.y*0.5+0.5 + t*(0.012+hash11(fi)*0.025))*2.2 - 1.1;
    p.x += sin(t*0.10+fi)*0.055;
    float d = length(st-p);
    col += palette(hash11(fi*4.9)) * exp(-d*90.0) * (0.014+0.032*hash11(fi*2.1));
  }
  return col;
}

// ---------------------------------------------------------------
// CAMERA HELPERS
// ---------------------------------------------------------------

// Quintic ease-in-out: zero first and second derivative at endpoints
float easeQ(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// Map global phase into a local 0→1 for one stage [s, e]
float segP(float phase, float s, float e) {
  return easeQ(clamp((phase - s) / (e - s), 0.0, 1.0));
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;

  // ---- 30-second seamless camera loop ----
  const float CAMERA_DURATION = 30.0;
  float cp = fract(t / CAMERA_DURATION);        // 0→1 camera phase
  float la = TAU * cp;                           // loop angle (one full cycle = 30 s)

  // Anatomical targets (follow creature pose)
  // headTarget: directly on the face — eyes, antennae, cephalic appendages
  vec3 headTarget = tuzoiaUnpose(vec3(0.0, -0.88, -0.065), t);
  vec3 midTarget  = tuzoiaUnpose(vec3(0.0,  0.04,  0.020), t);
  vec3 limbTarget = tuzoiaUnpose(vec3(0.0,  0.00, -0.180), t);
  vec3 tailTarget = tuzoiaUnpose(vec3(0.0,  1.30,  0.380), t);

  // Per-stage transition weights
  // Stage 1: 0.00–0.20   anterior hero
  // Stage 2: 0.20–0.45   full lateral
  // Stage 3: 0.45–0.65   ventral limbs
  // Stage 4: 0.65–0.85   posterior tail fan
  // Stage 5: 0.85–1.00   return to hero
  float t12 = segP(cp, 0.00, 0.20);
  float t23 = segP(cp, 0.20, 0.45);
  float t34 = segP(cp, 0.45, 0.65);
  float t45 = segP(cp, 0.65, 0.85);
  float t51 = segP(cp, 0.85, 1.00);

  // ---- Stage parameter keyframes ----
  // [orbit, elevation, camDist, lens]
  // Camera frame is rotated 90° (uu/vv swapped below) so the creature's
  // Y-spine reads LEFT-RIGHT across the landscape-like screen.
  // All orbit/elevation values are designed for this rotated frame.
  //
  // S1: face portrait — camera directly in front of the animal, slightly elevated
  //   orbit -PI  places camera exactly anterior (facing the head straight-on)
  //   slight left offset (-0.25) for three-quarter face angle
  //   elevation 0.14  just above eye level
  //   dist 2.60  close portrait distance — eyes and antennae fill the frame
  //   lens 1.60  telephoto keeps face undistorted
  float s1Orbit = -PI - 0.25,  s1Elev = 0.14,  s1Dist = 2.60,  s1Lens = 1.60;
  // S2: pure lateral — camera directly to the side
  float s2Orbit = -1.57,  s2Elev = 0.10,  s2Dist = 4.60,  s2Lens = 1.50;
  // S3: ventral — dip below to show limbs
  float s3Orbit = -1.57,  s3Elev = -0.55, s3Dist = 4.55,  s3Lens = 1.46;
  // S4: posterior — swing toward tail end
  float s4Orbit = -0.80,  s4Elev = 0.20,  s4Dist = 4.80,  s4Lens = 1.44;
  // S5 loops back to S1
  float s5Orbit = s1Orbit, s5Elev = s1Elev, s5Dist = s1Dist, s5Lens = s1Lens;

  // Blend orbit, elevation, distance, lens through the five stages
  // Each blends from its stage into the next using the transition weight
  float orbit, elevation, camDist, lens;

  if (cp < 0.20) {
    // Stage 1 (static, no incoming blend yet — loop start)
    float localBlend = t12;   // 0 at cp=0, 1 at cp=0.20 (but t12 maps 0.00–0.20)
    // At cp=0 we are exactly at S1; t12 reaches 1 at 0.20 which is still S1
    // so we blend S1→S1 (no change) — orbit is constant here
    orbit     = s1Orbit;
    elevation = s1Elev;
    camDist   = s1Dist;
    lens      = s1Lens;
  } else if (cp < 0.45) {
    orbit     = mix(s1Orbit, s2Orbit, t23);
    elevation = mix(s1Elev,  s2Elev,  t23);
    camDist   = mix(s1Dist,  s2Dist,  t23);
    lens      = mix(s1Lens,  s2Lens,  t23);
  } else if (cp < 0.65) {
    orbit     = mix(s2Orbit, s3Orbit, t34);
    elevation = mix(s2Elev,  s3Elev,  t34);
    camDist   = mix(s2Dist,  s3Dist,  t34);
    lens      = mix(s2Lens,  s3Lens,  t34);
  } else if (cp < 0.85) {
    orbit     = mix(s3Orbit, s4Orbit, t45);
    elevation = mix(s3Elev,  s4Elev,  t45);
    camDist   = mix(s3Dist,  s4Dist,  t45);
    lens      = mix(s3Lens,  s4Lens,  t45);
  } else {
    orbit     = mix(s4Orbit, s5Orbit, t51);
    elevation = mix(s4Elev,  s5Elev,  t51);
    camDist   = mix(s4Dist,  s5Dist,  t51);
    lens      = mix(s4Lens,  s5Lens,  t51);
  }

  // ---- Camera target interpolation ----
  vec3 target;
  if (cp < 0.20) {
    // Hold headTarget for the full hero stage — no drift during the hold
    target = headTarget;
  } else if (cp < 0.45) {
    // Transition from headTarget toward midTarget as we swing to lateral
    target = mix(headTarget, midTarget, t23);
  } else if (cp < 0.65) {
    target = mix(midTarget, limbTarget, t34);
  } else if (cp < 0.85) {
    target = mix(limbTarget, mix(midTarget, tailTarget, 0.65), t45);
  } else {
    // Return from tail region back to headTarget for the hero loop
    target = mix(mix(midTarget, tailTarget, 0.65), headTarget, t51);
  }

  // ---- Seamless secondary drift (integer-cycle periods within 30 s) ----
  // All frequencies are multiples of TAU/30 so sin(la*N) loops perfectly
  float driftV  =  0.035 * sin(la * 2.0);          // vertical: 2 cycles / 30 s
  float driftD  =  0.065 * sin(la * 3.0);          // distance: 3 cycles / 30 s
  float driftO  =  0.018 * sin(la * 4.0);          // orbit:    4 cycles / 30 s
  float driftTx =  0.018 * sin(la * 2.0 + 1.1);   // target x: 2 cycles / 30 s
  float driftTy =  0.012 * sin(la * 3.0 + 0.7);   // target y: 3 cycles / 30 s

  orbit     += driftO;
  camDist   += driftD;
  elevation += driftV;
  target    += tuzoiaUnpose(vec3(driftTx, driftTy, 0.0), t) * 0.0;
  // (target drift kept tiny — only add world-space nudge)
  target.x  += driftTx * 0.020;
  target.y  += driftTy * 0.015;

  // ---- Build camera frame ----
  vec3 ro = target + vec3(
    sin(orbit) * camDist,
    elevation,
    cos(orbit) * camDist
  );

  vec3 ww = normalize(target - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = normalize(cross(ww, uu));
  vec3 rd = normalize(uu * st.x * 0.96 + vv * st.y + ww * lens);

  vec3 col = background(st, t);

  float glow, mat;
  float d = rayMarch(ro, rd, t, glow, mat);

  if (d < MAX_DIST) {
    vec3 p = ro + rd*d;
    vec3 n = getNormal(p, t);

    vec3 l1   = normalize(vec3(-0.45,  0.82, -0.25));
    vec3 l2   = normalize(vec3( 0.58, -0.12,  0.72));
    float diff = max(dot(n,l1), 0.0);
    float back = pow(max(dot(l2,rd), 0.0), 2.0);
    float rim  = pow(1.0 - max(dot(n,-rd), 0.0), 2.5);

    vec3 body = materialColor(mat, p, n, rd, t);
    vec3 lit  = body * (0.26 + diff*0.72);
    lit += ACID * back * 0.28;
    lit += mix(VIOLET,PINK,0.48) * rim * 1.10;

    vec3 h    = normalize(l1-rd);
    float spec = pow(max(dot(n,h), 0.0), 68.0);
    lit += mix(CYAN,ACID,0.42) * spec * 1.75;

    float fog = 1.0 - exp(-d*0.16);
    col = mix(lit, col, fog*0.42);
  }

  col += lineOverlay(st, ro, uu, vv, ww, t) * (1.04 + 0.07*sin(t));
  col += palette(0.42 + 0.22*sin(t*0.35)) * glow * 0.105;

  // Subtle halo ring + PINK bloom
  vec2 halo = st; halo.y += 0.04;
  float ring = exp(-abs(length(halo) - 0.74) * 26.0);
  col += mix(CYAN,VIOLET,0.50) * ring * 0.042;
  col += PINK * pow(max(0.0, 1.0-length(st*vec2(0.74,1.0))), 4.4) * 0.072;

  col *= 1.76 + 0.12*sin(t*1.0);
  col += pow(max(col,0.0), vec3(1.32)) * 0.33;

  float vignette = 1.0 - 0.20*smoothstep(0.35, 1.60, length(st));
  col *= vignette;

  col  = col / (0.82 + col);
  col  = pow(max(col, 0.0), vec3(0.94));

  float grain = (hash11(uv.x*1234.5 + uv.y*987.6 + t) - 0.5) * 0.014;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
