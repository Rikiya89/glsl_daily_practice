// ===============================================================
// HALLUCIGENIA NEON SPINEWALKER
// TouchDesigner GLSL TOP fragment shader
// Soft segmented worm body + paired dorsal spines + ventral pod legs
// + rounded anterior head + small terminal tail nub.
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
// World: creature body runs along +Y, dorsal spines rise toward +Z,
// anterior head at -Y, ventral walking legs hang toward -Z.
// ---------------------------------------------------------------
vec3 hallPose(vec3 p, float t) {
  p.y -= 0.050 * sin(t * 0.19);
  p.x -= 0.026 * sin(t * 0.13 + 0.8);
  p.xz *= rot(0.022 * sin(t * 0.27));
  p.yz *= rot(0.045 + 0.014 * sin(t * 0.16));
  return p;
}

vec3 hallUnpose(vec3 q, float t) {
  q.yz *= rot(-(0.045 + 0.014 * sin(t * 0.16)));
  q.xz *= rot(-0.022 * sin(t * 0.27));
  q.x += 0.026 * sin(t * 0.13 + 0.8);
  q.y += 0.050 * sin(t * 0.19);
  return q;
}

float hallBodyU(float y) {
  return clamp((y + 1.05) / 2.10, 0.0, 1.0);
}

float hallBodyRadius(float y) {
  float u = hallBodyU(y);
  float taper = smoothstep(0.00, 0.12, u) * (1.0 - smoothstep(0.88, 1.00, u));
  float bulge = pow(max(sin(u * PI), 0.0), 0.55);
  return (0.045 + 0.077 * bulge) * (0.42 + 0.58 * taper);
}

vec3 hallSegC(float y, float t) {
  float u = hallBodyU(y);
  float wave = sin(y * 2.55 - t * 0.36) * 0.034;
  float counter = sin(y * 5.10 + t * 0.19) * 0.010;
  return vec3((wave + counter) * (0.45 + 0.55*u), y,
              0.012 * cos(y * 2.30 - t * 0.20));
}

// ---------------------------------------------------------------
// 1. SOFT SEGMENTED BODY
// ---------------------------------------------------------------
float hallBodySDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 17; i++) {
    float fi = float(i);
    float u  = fi / 16.0;
    float y  = mix(-1.05, 1.05, u);
    vec3 c   = hallSegC(y, t);
    float r  = hallBodyRadius(y);
    float seg = sdEllipsoid(q - c, vec3(r * 0.94, 0.078, r * 0.72));
    d = smin(d, seg, 0.030);
  }

  d = smin(d,
    sdTaperedCapsule(q, hallSegC(-0.98,t), hallSegC(1.00,t),
                     hallBodyRadius(-0.98) * 0.42, hallBodyRadius(1.00) * 0.34),
    0.028);

  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float u = fi / 13.0;
    float y = mix(-0.92, 0.92, u);
    vec3 c = hallSegC(y, t);
    float r = hallBodyRadius(y);
    vec3 p = q - c;
    p.y *= 1.8;
    float groove = sdEllipsoid(p, vec3(r*1.05, 0.010, r*0.78));
    d = max(d, -groove * 0.55);
  }
  return d;
}

// ---------------------------------------------------------------
// 2. DORSAL SPINES
// ---------------------------------------------------------------
float hallSpinesSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float u = fi / 6.0;
    float y = mix(-0.78, 0.72, u);
    vec3 c = hallSegC(y, t);
    float r = hallBodyRadius(y);
    float len = 0.45 + 0.12 * sin(u * PI) + 0.035 * sin(fi * 1.73);
    float lean = mix(0.045, -0.030, u);
    float vib = 0.004 * sin(t * 2.20 + fi * 1.8);

    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      vec3 base = c + vec3(side * r * 0.34, 0.0, r * 0.58);
      vec3 mid  = base + vec3(side * (0.070 + 0.018*sin(fi)), lean, len * 0.50 + vib);
      vec3 tip  = base + vec3(side * (0.150 + 0.025*sin(fi*1.6)), lean * 1.75, len);
      d = smin(d, sdTaperedCapsule(q, base, mid, 0.030, 0.018), 0.010);
      d = smin(d, sdTaperedCapsule(q, mid, tip, 0.018, 0.0025), 0.006);
      d = smin(d, sdSphere(q - base, 0.033), 0.010);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 3. VENTRAL WALKING LEGS
// ---------------------------------------------------------------
float hallLegsSDF(vec3 q, float t) {
  float d = 20.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float u = fi / 6.0;
    float y = mix(-0.76, 0.72, u);
    vec3 c = hallSegC(y, t);
    float r = hallBodyRadius(y);
    float scale = mix(0.94, 0.76, abs(u - 0.50) * 2.0);

    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      float phase = t * 1.28 - fi * 0.76 + side * 0.45;
      float step = sin(phase);
      vec3 root = c + vec3(side * r * 0.42, 0.0, -r * 0.58);
      vec3 knee = root + vec3(side * (0.050 + 0.015*step) * scale,
                              0.020 * sin(phase + 0.6),
                              -0.115 * scale);
      vec3 ankle = knee + vec3(side * (0.044 - 0.010*step) * scale,
                               0.026 * sin(phase + 1.6),
                               -0.095 * scale);
      vec3 foot = ankle + vec3(side * 0.042 * scale,
                               0.036 * sin(phase + 2.0),
                               -0.018 * scale);

      d = smin(d, sdTaperedCapsule(q, root, knee, 0.020*scale, 0.017*scale), 0.006);
      d = smin(d, sdTaperedCapsule(q, knee, ankle, 0.017*scale, 0.014*scale), 0.006);
      d = smin(d, sdTaperedCapsule(q, ankle, foot, 0.014*scale, 0.010*scale), 0.005);
      d = smin(d, sdEllipsoid(q - foot, vec3(0.036, 0.020, 0.014) * scale), 0.006);
      vec3 claw = foot + vec3(side*0.026*scale, 0.010*sin(phase), -0.010*scale);
      d = smin(d, sdTaperedCapsule(q, foot, claw, 0.007*scale, 0.002), 0.003);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 4. HEAD AND SMALL FEELERS
// ---------------------------------------------------------------
float hallHeadSDF(vec3 q, float t) {
  vec3 hc = hallSegC(-1.08, t) + vec3(0.0, -0.075, -0.004);
  vec3 hq = q - hc;
  hq.yz *= rot(-0.10);
  float d = sdEllipsoid(hq, vec3(0.108, 0.104, 0.078));

  vec3 mouth = hc + vec3(0.0, -0.092, -0.018);
  d = smin(d, sdEllipsoid(q - mouth, vec3(0.046, 0.016, 0.020)), 0.010);

  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    vec3 base = hc + vec3(side*0.040, -0.066, 0.020);
    vec3 prev = base;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float u0 = fi / 3.0;
      float wav = 0.012 * sin(t * 0.64 + fi * 0.9 + side);
      vec3 next = base + vec3(side*(0.030 + 0.030*u0),
                              -0.058 * (fi + 1.0),
                              0.022 + wav + 0.010*u0);
      d = smin(d, sdTaperedCapsule(q, prev, next, 0.010 - u0*0.005, 0.008 - u0*0.005), 0.004);
      prev = next;
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 5. POSTERIOR TAIL NUB
// ---------------------------------------------------------------
float hallTailSDF(vec3 q, float t) {
  vec3 c = hallSegC(1.08, t) + vec3(0.0, 0.070, -0.004);
  float d = sdEllipsoid(q - c, vec3(0.052, 0.086, 0.040));
  vec3 tip = c + vec3(0.0, 0.095, 0.012 + 0.006*sin(t*0.28));
  d = smin(d, sdTaperedCapsule(q, c, tip, 0.030, 0.004), 0.010);
  return d;
}

// ---------------------------------------------------------------
// SCENE ASSEMBLY
// mat 1=soft body  2=dorsal spines  3=walking legs
// mat 4=head/feelers  5=tail/terminal details
// ---------------------------------------------------------------
Hit mapScene(vec3 p, float t) {
  vec3 q = hallPose(p, t);

  Hit res = Hit(20.0, 0.0);
  res = opSmoothUnion(res, Hit(hallBodySDF(q, t),   1.0), 0.030);
  res = opSmoothUnion(res, Hit(hallSpinesSDF(q, t), 2.0), 0.012);
  res = opSmoothUnion(res, Hit(hallLegsSDF(q, t),   3.0), 0.010);
  res = opSmoothUnion(res, Hit(hallHeadSDF(q, t),   4.0), 0.020);
  res = opSmoothUnion(res, Hit(hallTailSDF(q, t),   5.0), 0.016);

  res.d += (fbm(q * 7.4 + vec3(0.0, t*0.08, 0.0)) - 0.50) * 0.0035;
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
    // soft body: CYAN/VIOLET translucent fossil glow
    col  = mix(CYAN, VIOLET, 0.28 + bands*0.32 + fres*0.24);
    col += ACID * pow(bands, 8.0) * 0.14;
  } else if (mat < 2.5) {
    // dorsal spines: PINK/VIOLET with sharp CYAN rim
    col  = mix(PINK, VIOLET, 0.26 + fres*0.48);
    col += CYAN * pow(fres, 0.72) * 0.58;
  } else if (mat < 3.5) {
    // walking legs: ACID/CYAN with subtle PINK tips
    col  = mix(ACID, CYAN, 0.40 + bands*0.18);
    col += PINK * fres * 0.32;
  } else if (mat < 4.5) {
    // head and feelers: brighter ACID/CYAN
    col  = mix(ACID, CYAN, 0.24 + fres*0.26);
    col += PINK * fres * 0.18;
  } else {
    // tail and terminal details: subdued VIOLET/PINK
    col  = mix(VIOLET, PINK, 0.26 + bands*0.18 + fres*0.22);
    col += CYAN * fres * 0.22;
  }

  col += mix(CYAN, ACID, 0.45) * fres * 0.62;
  return col;
}

// ---------------------------------------------------------------
// LINE OVERLAY - Hallucigenia anatomy
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

vec3 hallLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
  vec3 col = vec3(0.0);

  // Body centerline.
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float u0 = fi / 16.0;
    float u1 = (fi + 1.0) / 16.0;
    vec3 a = hallUnpose(hallSegC(mix(-1.02, 1.02, u0), t), t);
    vec3 b = hallUnpose(hallSegC(mix(-1.02, 1.02, u1), t), t);
    float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
    col += CYAN * (exp(-d*150.0)*0.026 + (1.0 - smoothstep(0.0,0.0009,d))*0.040);
  }

  // Segment division marks.
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float u  = (fi + 0.5) / 14.0;
    float y  = mix(-0.92, 0.92, u);
    vec3 c   = hallSegC(y, t);
    float r  = hallBodyRadius(y);
    vec3 a = hallUnpose(c + vec3(-r*0.55, 0.0, -r*0.10), t);
    vec3 b = hallUnpose(c + vec3( r*0.55, 0.0, -r*0.10), t);
    float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
    col += mix(CYAN,VIOLET,u*0.75) * exp(-d*118.0) * 0.018;
  }

  // Spine axes and glowing base points.
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float u = fi / 6.0;
    float y = mix(-0.78, 0.72, u);
    vec3 c = hallSegC(y, t);
    float r = hallBodyRadius(y);
    float len = 0.45 + 0.12 * sin(u * PI) + 0.035 * sin(fi * 1.73);
    float lean = mix(0.045, -0.030, u);
    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      vec3 base = c + vec3(side*r*0.34, 0.0, r*0.58);
      vec3 tip  = base + vec3(side*(0.150 + 0.025*sin(fi*1.6)), lean*1.75, len);
      vec3 a = hallUnpose(base, t);
      vec3 b = hallUnpose(tip, t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      vec2 bp = projectPoint(a,ro,uu,vv,ww);
      float gd = length(st - bp);
      col += mix(PINK,VIOLET,0.30) * exp(-d*112.0) * 0.030;
      col += CYAN * exp(-gd*110.0) * 0.070;
    }
  }

  // Leg axes.
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float u = fi / 6.0;
    float y = mix(-0.76, 0.72, u);
    vec3 c = hallSegC(y, t);
    float r = hallBodyRadius(y);
    float scale = mix(0.94, 0.76, abs(u - 0.50) * 2.0);
    for (int si = 0; si < 2; si++) {
      float side = si == 0 ? -1.0 : 1.0;
      float phase = t * 1.28 - fi * 0.76 + side * 0.45;
      float step = sin(phase);
      vec3 root = c + vec3(side*r*0.42, 0.0, -r*0.58);
      vec3 foot = root + vec3(side*(0.136 + 0.012*step)*scale,
                              0.070*sin(phase + 1.3),
                              -0.228*scale);
      vec3 a = hallUnpose(root, t);
      vec3 b = hallUnpose(foot, t);
      float d = distSeg(st, projectPoint(a,ro,uu,vv,ww), projectPoint(b,ro,uu,vv,ww));
      col += mix(ACID,CYAN,0.45) * exp(-d*95.0) * 0.019;
    }
  }

  // Small head feeler guide lines.
  vec3 hc = hallSegC(-1.08, t) + vec3(0.0, -0.075, -0.004);
  for (int si = 0; si < 2; si++) {
    float side = si == 0 ? -1.0 : 1.0;
    vec3 a0 = hallUnpose(hc + vec3(side*0.040, -0.066, 0.020), t);
    vec3 b0 = hallUnpose(hc + vec3(side*0.118, -0.230, 0.034 + 0.010*sin(t*0.64+side)), t);
    float d = distSeg(st, projectPoint(a0,ro,uu,vv,ww), projectPoint(b0,ro,uu,vv,ww));
    col += mix(ACID,CYAN,0.20) * exp(-d*120.0) * 0.030;
  }

  return col;
}

// ---------------------------------------------------------------
// BACKGROUND - deep ocean (unchanged visual language)
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

// Map global phase into a local 0 to 1 for one stage [s, e]
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
  float cp = fract(t / CAMERA_DURATION);        // 0 to 1 camera phase
  float la = TAU * cp;                           // loop angle (one full cycle = 30 s)

  // Anatomical targets follow the floating Hallucigenia pose.
  vec3 headTarget = hallUnpose(hallSegC(-1.03, t) + vec3(0.0, -0.075, 0.060), t);
  vec3 midTarget  = hallUnpose(hallSegC( 0.00, t) + vec3(0.0,  0.000, 0.170), t);
  vec3 limbTarget = hallUnpose(hallSegC( 0.00, t) + vec3(0.0,  0.000,-0.210), t);
  vec3 tailTarget = hallUnpose(hallSegC( 0.88, t) + vec3(0.0,  0.110, 0.340), t);

  // Per-stage transition weights
  // Stage 1: 0.00-0.20   anterior head and first spine pairs
  // Stage 2: 0.20-0.45   full lateral spinewalker silhouette
  // Stage 3: 0.45-0.65   low view on ventral walking legs
  // Stage 4: 0.65-0.85   posterior tracking along spine row
  // Stage 5: 0.85-1.00   return to anterior hero
  float t23 = segP(cp, 0.20, 0.45);
  float t34 = segP(cp, 0.45, 0.65);
  float t45 = segP(cp, 0.65, 0.85);
  float t51 = segP(cp, 0.85, 1.00);

  // ---- Stage parameter keyframes ----
  // [orbit, elevation, camDist, lens]
  // Camera frame is rotated 90 degrees (uu/vv swapped below) so the creature's
  // Y-spine reads LEFT-RIGHT across the landscape-like screen.
  // All orbit/elevation values are designed for this rotated frame.
  //
  // S1: anterior portrait, close enough to hold the head and first spines
  //   orbit -PI  places camera exactly anterior (facing the head straight-on)
  //   slight left offset (-0.25) for three-quarter face angle
  //   elevation 0.14  slightly above the soft head
  //   dist 2.50  close portrait distance
  //   lens 1.60  telephoto keeps face undistorted
  float s1Orbit = -PI - 0.20,  s1Elev = 0.14,  s1Dist = 2.50,  s1Lens = 1.58;
  // S2: pure lateral silhouette with all seven spine pairs readable
  float s2Orbit = -1.57,  s2Elev = 0.08,  s2Dist = 4.35,  s2Lens = 1.46;
  // S3: low lateral angle to reveal ventral pod legs
  float s3Orbit = -1.57,  s3Elev = -0.54, s3Dist = 4.30,  s3Lens = 1.44;
  // S4: posterior track looking along the spine row
  float s4Orbit = -0.62,  s4Elev = 0.25,  s4Dist = 4.55,  s4Lens = 1.42;
  // S5 loops back to S1
  float s5Orbit = s1Orbit, s5Elev = s1Elev, s5Dist = s1Dist, s5Lens = s1Lens;

  // Blend orbit, elevation, distance, lens through the five stages
  // Each blends from its stage into the next using the transition weight
  float orbit, elevation, camDist, lens;

  if (cp < 0.20) {
    // Stage 1 (static, no incoming blend yet - loop start)
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
    // Hold headTarget for the full hero stage - no drift during the hold
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
  // Target drift is tiny and loops exactly over the 30-second camera cycle.
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

  col += hallLineOverlay(st, ro, uu, vv, ww, t) * (1.04 + 0.07*sin(t));
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
