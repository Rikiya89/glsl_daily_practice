// ===============================================================
// COMB JELLY (Ctenophora) — photoreal hybrid renderer
// 3D raymarched gelatinous body + 2D cilia network overlay
// with depth-aware translucency, subsurface scatter, caustics,
// marine-snow particles, refraction shimmer, deep-sea lighting.
// TouchDesigner GLSL TOP · 1080x1920 (Reels)
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define ROWS         8
#define LONG_NODES   18
#define MAX_STEPS    64
#define MAX_DIST     8.0
#define SURF_DIST    0.0015
#define TAU          6.28318530718
#define PI           3.14159265359

const vec3 ACID   = vec3(0.0,  1.0,  0.624);
const vec3 CYAN   = vec3(0.0,  0.812,1.0);
const vec3 VIOLET = vec3(0.545,0.0,  1.0);
const vec3 PINK   = vec3(1.0,  0.0,  0.431);

// ---------- math helpers ----------
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
float hash11(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float hash13(vec3 p)  { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(p+vec3(0,0,0)), hash13(p+vec3(1,0,0)), f.x),
                 mix(hash13(p+vec3(0,1,0)), hash13(p+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(p+vec3(0,0,1)), hash13(p+vec3(1,0,1)), f.x),
                 mix(hash13(p+vec3(0,1,1)), hash13(p+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise3(p); p *= 2.02; a *= 0.5; }
  return v;
}

// ---------- camera ----------
struct Cam { vec3 ro, fwd, rgt, up; };
Cam makeCam(float t) {
  Cam c;
  float a = t * 0.14;
  float dist = 2.3;                                 // closer to creature
  c.ro  = vec3(sin(a) * dist, 0.05 + sin(t*0.2)*0.12, cos(a) * dist);
  c.fwd = normalize(-c.ro);
  c.rgt = normalize(cross(vec3(0,1,0), c.fwd));
  c.up  = cross(c.fwd, c.rgt);
  return c;
}
vec2 project(vec3 p, Cam c) {
  vec3 rel = p - c.ro;
  float zc = dot(rel, c.fwd);
  if (zc < 0.05) zc = 0.05;
  return vec2(dot(rel, c.rgt) / zc, dot(rel, c.up) / zc);
}
float depthOf(vec3 p, Cam c) { return dot(p - c.ro, c.fwd); }

// ---------- body SDF (gelatinous ovoid that breathes & sways) ----------
vec3 swayOffset(float t) {
  return vec3(sin(t * 0.6) * 0.18,
              sin(t * 0.5) * 0.12,
              cos(t * 0.4 + 1.0) * 0.12);
}
float bodySDF(vec3 p, float t) {
  vec3 q = p - swayOffset(t);
  // body uses ovoid: scale y & z, then sphere
  q.y *= 0.78;
  // gentle peristaltic distortion along axis
  float wave = sin(q.y * 3.0 - t * 1.8) * 0.04;
  q.x += wave;
  q.z += wave * 0.6;
  // breathing
  float breath = 1.0 + 0.05 * sin(t * 1.3);
  float r = 0.62 * breath;
  float d = length(q) - r;
  // subtle surface noise — gelatinous skin
  d -= 0.012 * fbm(q * 4.0 + t * 0.2);
  return d;
}
vec3 bodyNormal(vec3 p, float t) {
  float e = 0.002;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * bodySDF(p + k.xyy * e, t) +
    k.yyx * bodySDF(p + k.yyx * e, t) +
    k.yxy * bodySDF(p + k.yxy * e, t) +
    k.xxx * bodySDF(p + k.xxx * e, t));
}
float rayMarchBody(vec3 ro, vec3 rd, float t) {
  float d = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    float s = bodySDF(ro + rd * d, t);
    if (s < SURF_DIST || d > MAX_DIST) break;
    d += s;
  }
  return d;
}

// ---------- cilium positions ----------
vec3 cilium(int r, int l, float t) {
  float theta = float(r) / float(ROWS) * TAU;
  float u     = float(l) / float(LONG_NODES - 1);

  // ovoid taper (wider mid, taper at poles, blunter top, sharper bottom)
  float taper = sin(u * PI);
  taper       = pow(taper, 0.55);
  float r2    = 0.62 * taper;

  float breath = 1.0 + 0.05 * sin(t * 1.3);
  r2 *= breath;

  // metachronal beat — outward push when firing
  float metaPhase = u * 6.0 - t * 4.5;
  float beat      = sin(metaPhase + theta * 0.3);
  r2 += max(beat, 0.0) * 0.06;

  float y = (u - 0.5) * 1.55;

  // body sway (cilia ride on the body)
  vec3 sway = swayOffset(t);
  // poles drift slightly more than mid (whip-like)
  float poleK = 1.0 - taper;
  vec3 p = vec3(cos(theta) * r2, y, sin(theta) * r2);
  p += sway;
  p.x += sin(t * 0.7 + u * 4.0) * 0.05 * poleK;
  p.z += cos(t * 0.6 + u * 4.0) * 0.05 * poleK;

  // ciliary jitter
  float seed = float(r * 31 + l * 7);
  p += 0.008 * vec3(sin(t * 9.0 + seed),
                    cos(t * 8.5 + seed * 1.3),
                    sin(t * 10.1 + seed * 0.7));
  return p;
}

float fire(int r, int l, float t) {
  float u     = float(l) / float(LONG_NODES - 1);
  float phase = u * TAU * 1.5 - t * 4.0 + float(r) * 0.18;
  return pow(max(sin(phase), 0.0), 2.5);
}

vec3 cilColor(int r, int l, float t, float f) {
  float u   = float(l) / float(LONG_NODES - 1);
  float hue = fract(u * 1.1 + t * 0.06 + float(r) * 0.025);
  vec3  rain = hsv2rgb(vec3(hue, 0.9, 1.0));
  vec3  base = mix(VIOLET, CYAN, u);
  return mix(base, rain, 0.35 + 0.65 * f);
}

// ---------- 2D segment distance ----------
float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// ---------- caustics (animated voronoi-ish pattern) ----------
float caustic(vec2 p, float t) {
  vec2 q = p * 1.8;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 1.7 + t * 0.3;
    q += 0.5 * vec2(cos(a), sin(a));
    c += sin(q.x * 3.0 + t * 0.8) * cos(q.y * 3.0 - t * 0.6);
  }
  return pow(0.5 + 0.5 * c / 3.0, 4.0);
}

// ---------- marine-snow particles ----------
float marineSnow(vec2 p, float t) {
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float scale = 1.0 + fi * 0.6;
    vec2  drift = p * scale + vec2(t * 0.04 * (1.0 + fi * 0.2),
                                   t * 0.02 * (1.0 + fi * 0.1));
    vec2  cell  = floor(drift);
    vec2  frac  = fract(drift) - 0.5;
    float h     = hash11(dot(cell, vec2(127.1, 311.7)) + fi * 17.0);
    if (h > 0.985) {
      float d = length(frac);
      s += smoothstep(0.04, 0.0, d) * (1.0 - fi * 0.12);
    }
  }
  return s;
}

// ---------- main ----------
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x  *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t   = iTime;
  Cam   cam = makeCam(t);
  vec3  rd  = normalize(cam.fwd + cam.rgt * st.x + cam.up * st.y);

  // ---------- raymarch the gelatinous body ----------
  float bd     = rayMarchBody(cam.ro, rd, t);
  bool  hitBody = bd < MAX_DIST;
  vec3  bp      = cam.ro + rd * bd;
  vec3  bn      = hitBody ? bodyNormal(bp, t) : vec3(0,1,0);

  // ---------- pre-compute every cilium ----------
  vec2  sp[ROWS * LONG_NODES];
  float dz[ROWS * LONG_NODES];
  float fl[ROWS * LONG_NODES];
  float occ[ROWS * LONG_NODES];   // 1 = in front of body, 0 = behind
  for (int r = 0; r < ROWS; r++) {
    for (int l = 0; l < LONG_NODES; l++) {
      int   idx = r * LONG_NODES + l;
      vec3  wp  = cilium(r, l, t);
      sp[idx]   = project(wp, cam);
      float dn  = depthOf(wp, cam);
      dz[idx]   = dn;
      fl[idx]   = fire(r, l, t);
      // occlusion: if cilium is behind body hit point, mark it
      occ[idx]  = (hitBody && dn > bd + 0.02) ? 0.0 : 1.0;
    }
  }

  // ============== BACKGROUND: deep-sea void with caustics ==============
  vec3 col = vec3(0.005, 0.008, 0.022);
  // very subtle violet wash from above
  col += vec3(0.04, 0.02, 0.08) * smoothstep(-0.3, 0.7, st.y);
  // caustics from imaginary surface light
  vec2  caustUV = st * 0.6 + vec2(t * 0.05, 0.0);
  float caust   = caustic(caustUV, t);
  col += vec3(0.05, 0.12, 0.22) * caust * smoothstep(-0.2, 0.8, st.y);

  // ============== BODY (gelatinous translucent flesh) =================
  vec3 bodyCol = vec3(0.0);
  float bodyAlpha = 0.0;
  if (hitBody) {
    vec3  L     = normalize(vec3(0.4, 0.9, -0.3));   // top-down sun
    float diff  = max(dot(bn, L), 0.0);
    float fres  = pow(1.0 - max(dot(-rd, bn), 0.0), 2.5);
    // fake subsurface: light from BEHIND the surface
    float sss   = pow(max(dot(-L, rd), 0.0), 3.0);
    // thickness via reverse march (cheap approximation)
    float thick = clamp(1.0 - bn.y, 0.0, 1.0);

    vec3 baseCol = mix(vec3(0.04, 0.08, 0.16),
                       vec3(0.10, 0.18, 0.28), diff);
    baseCol += ACID  * sss  * 0.25 * thick;
    baseCol += CYAN  * fres * 0.35;
    baseCol += VIOLET * 0.08;
    bodyCol  = baseCol;
    bodyAlpha = 0.38 + fres * 0.35;     // translucent — never fully opaque
  }

  // composite body OVER background
  col = mix(col, bodyCol, bodyAlpha);

  // ============== CILIA NETWORK (longitudinal combs) ==================
  // longitudinal lines (the visible "combs")
  for (int r = 0; r < ROWS; r++) {
    for (int l = 0; l < LONG_NODES - 1; l++) {
      int ia = r * LONG_NODES + l;
      int ib = ia + 1;
      float dseg = distSeg(st, sp[ia], sp[ib]);
      float line = smoothstep(0.006, 0.0, dseg);
      float pulseAB = (fl[ia] + fl[ib]) * 0.5;
      float glow = exp(-dseg * 95.0) * (0.18 + pulseAB * 0.9);
      vec3  cAB  = mix(cilColor(r, l, t, fl[ia]),
                       cilColor(r, l + 1, t, fl[ib]), 0.5);

      // depth attenuation
      float zAvg = (dz[ia] + dz[ib]) * 0.5;
      float dpFactor = clamp(1.6 / (zAvg + 0.5), 0.0, 1.4);

      // occlusion through body
      float occAB = (occ[ia] + occ[ib]) * 0.5;
      float through = mix(0.18, 1.0, occAB);     // back-side cilia dimmed

      col += cAB * (line * 0.55 + glow) * dpFactor * through;
    }
  }

  // sparse cross-links — connective tissue between rows
  for (int r = 0; r < ROWS; r++) {
    int rn = (r + 1) % ROWS;
    for (int l = 2; l < LONG_NODES - 2; l += 4) {
      int ia = r  * LONG_NODES + l;
      int ib = rn * LONG_NODES + l;
      float dseg = distSeg(st, sp[ia], sp[ib]);
      float line = smoothstep(0.0035, 0.0, dseg);
      float pulseAB = (fl[ia] + fl[ib]) * 0.5;
      float glow = exp(-dseg * 130.0) * (0.08 + pulseAB * 0.4);
      vec3 cAB = mix(cilColor(r, l, t, fl[ia]),
                     cilColor(rn, l, t, fl[ib]), 0.5);
      float occAB = (occ[ia] + occ[ib]) * 0.5;
      float through = mix(0.15, 1.0, occAB);
      col += cAB * (line * 0.2 + glow) * 0.35 * through;
    }
  }

  // cilia node halos
  for (int r = 0; r < ROWS; r++) {
    for (int l = 0; l < LONG_NODES; l++) {
      int idx = r * LONG_NODES + l;
      float dn   = length(st - sp[idx]);
      float dpF  = clamp(1.6 / (dz[idx] + 0.5), 0.0, 1.4);
      float core = smoothstep(0.014, 0.003, dn) * dpF;
      float halo = exp(-dn * 26.0) * (0.25 + fl[idx] * 1.6) * dpF;
      vec3  c    = cilColor(r, l, t, fl[idx]);
      float through = mix(0.2, 1.0, occ[idx]);
      col += c * (core * 1.4 + halo) * through;
    }
  }

  // ============== APICAL ORGAN (the statocyst at top) =================
  vec3 apical = swayOffset(t) + vec3(0.0, 0.82, 0.0);
  vec2 ap     = project(apical, cam);
  float dap   = length(st - ap);
  float apFire = 0.5 + 0.5 * sin(t * 2.0);
  col += ACID * exp(-dap * 26.0) * (0.4 + 0.7 * apFire);

  // ============== MARINE SNOW (foreground particles) ==================
  float snow = marineSnow(st * 1.2, t);
  col += vec3(0.7, 0.8, 1.0) * snow * 0.55;

  // ============== REFRACTION SHIMMER on body ==========================
  if (hitBody) {
    // shimmer modulates a faint highlight near the rim
    float shimmer = fbm(bp * 6.0 + t * 0.5);
    float rim     = pow(1.0 - max(dot(-rd, bn), 0.0), 4.0);
    col += vec3(0.4, 0.9, 1.0) * rim * shimmer * 0.15;
  }

  // ============== POST: vignette + tonemap + grain ====================
  col *= 1.0 - 0.32 * length(st) * 0.55;          // vignette
  col  = col / (1.0 + col);                       // Reinhard
  col  = pow(col, vec3(1.0 / 1.05));              // mild gamma lift

  float grain = (hash11(uv.x * 1234.5 + uv.y * 987.6 + t) - 0.5) * 0.025;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
