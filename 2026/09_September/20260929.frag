// [SHADER] NAUTILUS — REACTION DIFFUSION
// Procedural artistic interpretation. TouchDesigner GLSL TOP, no inputs. 10 s seamless loop.
// Raymarched log-spiral SDF shell (involute whorls, septa, siphuncle), multi-layer
// translucent compositing, Turing-mode reaction-diffusion, sequential chamber energy.
//
// File layout
//   1. Controls & build options
//   2. Constants & shared state
//   3. Math helpers
//   4. Shell SDF (whorls, septa, siphuncle)
//   5. Body SDF (head, hood, eyes, tentacles) & scene map
//   6. Energy / reaction-diffusion / environment
//   7. Shading (shell, body)
//   8. Camera rig
//   9. Raymarch, grading, main

// ============================================================================
// 1. CONTROLS & BUILD OPTIONS
// ============================================================================
// Keep 0 for immediate inline controls; 1 exposes every CONTROL as a uniform.
#define EXTERNAL_CONTROLS 0
out vec4 fragColor;
uniform float uTimeSeconds;

#if EXTERNAL_CONTROLS
#define CONTROL(name,value) uniform float name
#else
#define CONTROL(name,value) const float name = value
#endif

CONTROL(uSpiralGrowth,        3.0);
CONTROL(uChamberCount,        30.0);
CONTROL(uChamberGlow,         1.0);
CONTROL(uReactionScale,       24.0);
CONTROL(uReactionSpeed,       1.0);
CONTROL(uReactionContrast,    0.10);
CONTROL(uShellTransmission,   0.55);
CONTROL(uIridescenceStrength, 0.85);
CONTROL(uTentacleAmplitude,   1.0);
CONTROL(uTentacleSpeed,       1.0);
CONTROL(uBloomStrength,       0.8);
CONTROL(uBackground,          1.0);
CONTROL(uExposure,            1.25);

// Cinematic camera rig. FOV is vertical degrees for the reveal / orbit / head shots.
#define EXTERNAL_CAMERA_CONTROLS 0
#if EXTERNAL_CAMERA_CONTROLS
#define CAMERA_CONTROL(name,value) uniform float name
#else
#define CAMERA_CONTROL(name,value) const float name = value
#endif

CAMERA_CONTROL(uCameraDistance, 1.0);
CAMERA_CONTROL(uLoopSpeed,      1.0);
CAMERA_CONTROL(uFov,            34.0);
CAMERA_CONTROL(uMacroFov,       50.0);

// Quality / FPS trade.
#define MAX_STEPS  120
#define MAX_LAYERS 5
#define TENTACLES  22
#define CAM_KEYS   8

// Debug: define DEBUG_T (fixed loop time 0..1) or DEBUG_MASK (hit mask output).

// ============================================================================
// 2. CONSTANTS & SHARED STATE
// ============================================================================
const float TAU = 6.28318530718, PI = 3.14159265359;
const float LOOP_SECONDS = 10.;

// Material ids written to gMat.
const float MAT_WALL = 1., MAT_SEPTUM = 2., MAT_SIPHUNCLE = 3.;
// (body ids: 4 skin, 5 tentacle, 6 eye)

// Shell geometry: aperture at phi=0, whorl centre radius R(phi)=exp(b*phi).
const float APERTURE = -2.05;
const float PHI_MIN  = -TAU * 3.1;
const float PHI_LAST = -TAU * .34;
const float VENTER = 1.45, DORSAL = .12, HALF_WIDTH = .5;
const float SEC_C = (VENTER + DORSAL) * .5, SEC_A = (VENTER - DORSAL) * .5;
const float SIPH_R = .97, WALL = .022, SEPTUM_BOW = .32;
const vec3  CENTER = vec3(-.12, -.42, 0.);

// Aperture frame: forward = spiral growth direction, out = away from coil centre.
const vec3 AP_OUT = vec3(cos(APERTURE), sin(APERTURE), 0.);
const vec3 AP_FWD = vec3(-sin(APERTURE), cos(APERTURE), 0.);

// Shared lighting / palette.
const vec3 LIGHT_DIR = normalize(vec3(-.45, .85, .55));
const vec3 PEARL     = vec3(.66, .68, .80);

// Per-frame state (set once in main).
float phase;   // loop phase, 0..TAU
float gB;      // log-spiral growth exponent
float gN;      // chamber count
float gE;      // energy front position (chamber space)
float gEnv;    // energy envelope

// Per-sample surface record (written by map(), read by shading / glow).
float gMat, gPhi, gR, gCC, gSut, gIn, gSiph, gAlpha, gU, gThick;
vec2  gQ;

struct Hit { float mat, phi, R, cc, sut, u, thick; vec2 q; };

Hit captureHit() {
    return Hit(gMat, gPhi, gR, gCC, gSut, gU, gThick, gQ);
}
void restoreHit(Hit h) {
    gMat = h.mat; gPhi = h.phi; gR = h.R; gCC = h.cc;
    gSut = h.sut; gU = h.u; gThick = h.thick; gQ = h.q;
}

// ============================================================================
// 3. MATH HELPERS
// ============================================================================
mat2 rotation(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

vec2 hash22(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

float smin(float a, float b, float k) {
    float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
    return mix(b, a, h) - k * h * (1. - h);
}

float ellipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r), k1 = length(p / (r * r));
    return k0 * (k0 - 1.) / max(k1, 1e-6);
}

float capsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 v = b - a;
    return length(p - a - v * clamp(dot(p - a, v) / dot(v, v), 0., 1.)) - r;
}

vec3 filmic(vec3 x) {
    return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.);
}

// ============================================================================
// 4. SHELL SDF
// ============================================================================
vec3 tubePoint(float phi) {
    float a = APERTURE + phi;
    return SIPH_R * exp(gB * phi) * vec3(cos(a), sin(a), 0.);
}

vec3 bodyFrame(vec3 p) {
    vec3 v = p - SIPH_R * AP_OUT;
    return vec3(dot(v, AP_FWD), dot(v, AP_OUT), v.z);
}

// Gentle whole-creature bob / sway (loop-periodic).
vec3 creatureSpace(vec3 p) {
    p -= vec3(.012 * sin(phase + 1.), .022 * sin(phase), 0.);
    p.xy = rotation(.028 * sin(phase + .7)) * p.xy;
    p.yz = rotation(.02  * sin(phase + 2.1)) * p.yz;
    return p;
}

// Elliptical whorl cross-section (radial r, axial z) scaled by whorl radius R.
float section(float r, float z, float R, out vec2 q) {
    q = vec2(r - SEC_C * R, z);
    vec2 ax = R * vec2(SEC_A, HALF_WIDTH);
    float k0 = length(q / ax), k1 = length(q / (ax * ax));
    return k0 * (k0 - 1.) / max(k1, 1e-6);
}

float chamberStep() { return (PHI_LAST - PHI_MIN) / gN; }

// Returns shell distance; fills the g* surface record for the nearest feature.
float shell(vec3 p) {
    float r = max(length(p.xy), 1e-5), z = p.z;
    float th = atan(p.y, p.x) - APERTURE;
    th -= TAU * floor((th + PI) / TAU);
    float k0 = ceil((log(r / VENTER) / gB - th) / TAU);

    // Four candidate whorls along the ray's polar line.
    float eS[4], eO[4], ph[4], Rk[4];
    vec2 qk[4];
    for (int j = 0; j < 4; j++) {
        ph[j] = th + TAU * (k0 - 2. + float(j));
        Rk[j] = exp(gB * ph[j]);
        eO[j] = section(r, z, Rk[j], qk[j]);
        eS[j] = max(eO[j], max(ph[j], PHI_MIN - ph[j]) * r);
    }

    // Outer wall.
    float best = 1e9;
    for (int j = 1; j < 4; j++) {
        float flare = smoothstep(-.4, -.14, ph[j]) * smoothstep(0., -.12, ph[j]);
        float w = -smin(-(abs(eO[j]) - WALL * Rk[j] * (1. + 1.2 * flare)),
                        -max(ph[j], PHI_MIN - ph[j]) * r, .025 * Rk[j]);
        w = max(w, -eS[j - 1]);
        if (w < best) {
            best = w;
            gMat = MAT_WALL; gPhi = ph[j]; gR = Rk[j]; gQ = qk[j];
            gThick = WALL * Rk[j];
        }
    }

    // Septa + siphuncle (interior of whorls 2..3).
    gIn = 0.; gSiph = 1e3; gCC = -1.;
    float dP = chamberStep();
    for (int j = 2; j < 4; j++) {
        float cavity = max(eS[j], -eS[j - 1]);
        vec2 qn = qk[j] / (Rk[j] * vec2(SEC_A, HALF_WIDTH));
        float cc = (ph[j] + SEPTUM_BOW * (1. - dot(qn, qn)) - PHI_MIN) / dP;
        float n = clamp(floor(cc + .5), 1., gN);
        float lip = 1. + 2. * SEPTUM_BOW * length(qn / vec2(SEC_A, HALF_WIDTH)) * r / Rk[j];
        float sd = max(abs(cc - n) * dP * r * .85 / lip - WALL * .5 * Rk[j], cavity);

        vec2 qs = qk[j] - vec2((SIPH_R - SEC_C) * Rk[j], 0.);
        float ds = max(length(qs) - .032 * Rk[j],
                       max(ph[j] - PHI_LAST, PHI_MIN - ph[j]) * r);

        if (cavity < 0.) {
            gCC = cc;
            gSiph = ds;
            gIn = step(ph[j], PHI_LAST) * smoothstep(0., -.06 * Rk[j], cavity);
            gAlpha = length(qs) / Rk[j];
        }
        if (sd < best) {
            best = sd;
            gMat = MAT_SEPTUM; gPhi = ph[j]; gR = Rk[j]; gQ = qk[j];
            gThick = WALL * .5 * Rk[j]; gCC = cc;
            gSut = min(abs(eS[j]), abs(eS[j - 1])) / Rk[j];
        }
        if (ds < best) {
            best = ds;
            gMat = MAT_SIPHUNCLE; gPhi = ph[j]; gR = Rk[j]; gQ = qk[j];
            gThick = .02 * Rk[j]; gCC = cc;
        }
    }
    return best;
}

// ============================================================================
// 5. BODY SDF & SCENE MAP
// ============================================================================
float tentacles(vec3 b) {
    float best = capsule(b, vec3(.2, .12, 0.), vec3(.78, .5, 0.), .5);
    if (best > .08) return best;   // bounding capsule early-out

    best = 1e9;
    for (int i = 0; i < TENTACLES; i++) {
        float fi = float(i);
        vec2 h = hash22(vec2(fi, 7.3));
        float bet = (fi + .5) / float(TENTACLES) * TAU + .25 * h.y;
        vec3 base = vec3(.22, .10 + .11 * cos(bet), .16 * sin(bet));
        vec3 d = normalize(vec3(1., .22 + .34 * cos(bet), .55 * sin(bet)));
        float L = .42 + .36 * h.x;
        vec3 s1 = normalize(cross(d, vec3(0., 0., 1.))), s2 = cross(d, s1);

        vec3 v = b - base;
        float u = clamp(dot(v, d), 0., L), w = u / L;
        if (length(v - d * u) - .2 > best) continue;

        float cyc = floor(uTentacleSpeed + .5) * (1. + step(.5, h.y));
        float tp = phase * cyc + h.x * TAU;
        vec2 off = uTentacleAmplitude * w * w * vec2(
            .10 * sin(u * (5. + 2.5 * h.y) - tp) + .03 * sin(u * 13. - tp * 2. + h.x * 9.),
            .08 * cos(u * (4.5 + 2. * h.x) - tp + 1.3) + .08);
        float dd = (length(v - d * u - s1 * off.x - s2 * off.y) - mix(.017, .004, w)) * .7;
        if (dd < best) { best = dd; gU = w; }
    }
    return best;
}

float body(vec3 p, out float mat) {
    vec3 b = bodyFrame(p);
    mat = 4.;
    float bound = length(b - vec3(.35, .25, 0.)) - 1.1;
    if (bound > .2) return bound;

    float head = ellipsoid(b - vec3(-.06, .02, 0.), vec3(.32, .28, .25));
    float hood = ellipsoid(b - vec3(.02, -.17, 0.), vec3(.36, .13, .30));
    float d = smin(head, hood, .06);
    d = smin(d, capsule(b, vec3(.12, .18, 0.), vec3(.30, .30, 0.), .04), .04);

    vec3 e = b - vec3(.12, .03, 0.);
    e.z = abs(e.z) - .225;
    float eye = length(e) - .04;
    if (eye < d) { d = eye; mat = 6.; }

    float t = tentacles(b);
    if (t < d) mat = 5.;
    return smin(d, t, .04);
}

float map(vec3 p) {
    p = creatureSpace(p);
    float s = shell(p);
    float bm;
    float b = body(p, bm);
    if (b < s) { gMat = bm; return b; }
    return s;
}

vec3 normalAt(vec3 p, float e) {
    vec2 k = vec2(1., -1.);
    return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                     k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// ============================================================================
// 6. ENERGY / REACTION-DIFFUSION / ENVIRONMENT
// ============================================================================
// Energy front in chamber-space s (0 apex -> 1 last septum -> 1.45 tentacle tips).
float energyFront(float t, out float env) {
    float u = fract(t - .9);
    env = smoothstep(0., .03, u) * (1. - smoothstep(.86, 1., u));
    float s0 = .62;
    if (u < .1)  return mix(-.03, s0, u / .1);
    if (u < .4)  return mix(s0, .82, (u - .1) / .3);
    if (u < .65) return mix(.82, 1., (u - .4) / .25);
    return mix(1., 1.45, (u - .65) / .35);
}

float chamberPulse(float cc) {
    float x = gE - (floor(cc) + .5) / gN;
    float f = x < 0. ? exp(-x * x / .0004) : exp(-x / .07);
    return .12 + 2.2 * f * gEnv;
}

// Glow palettes: shell surface vs. volumetric interior.
vec3 shellGlowColor(float cc) {
    return mix(vec3(.10, .75, 1.), vec3(.55, .25, 1.), .5 + .5 * sin(cc * .9));
}
vec3 volumeGlowColor(float cc) {
    return mix(vec3(.08, .65, 1.), vec3(.6, .25, 1.), .5 + .5 * sin(floor(cc) * .9));
}

// Turing-mode reaction-diffusion: single-wavelength modes, domain-warped, thresholded.
// Returns (pigment, membrane). bias > 0 -> isolated spots, bias ~ 0 -> labyrinth.
vec2 reaction(vec2 x, float bias) {
    x += .24 * vec2(sin(x.y * 1.7 + .6 * sin(phase)), sin(x.x * 1.3 + .5 * cos(phase)));
    float s = 0.;
    for (int i = 0; i < 7; i++) {
        float a = float(i) * 2.39996 + .4;
        s += cos(dot(uReactionScale * vec2(cos(a), sin(a)), x) + float(i) * 1.7
                 + uReactionSpeed * .8 * sin(phase + float(i) * .9));
    }
    s /= 2.65;
    float pig = smoothstep(bias - uReactionContrast, bias + uReactionContrast, s);
    return vec2(pig, 1. - abs(2. * pig - 1.));
}

vec2 shellUV(float band) {
    float al = atan(gQ.y / HALF_WIDTH, gQ.x / SEC_A);
    return vec2(gPhi * 1.15, al * .62 * mix(1., .45, band));
}

float stripeBand(float phi) {
    return smoothstep(-TAU * 1.05, -TAU * .6, phi) * (1. - smoothstep(-2.8, -1.3, phi));
}

float caustic(vec3 p) {
    float c = sin(p.x * 6. + sin(p.z * 5. + phase) * 1.3)
            * sin(p.z * 6.5 + sin(p.x * 4. - phase) * 1.1 + p.y * 2.);
    return .55 + .9 * c * c;
}

vec3 environment(vec3 d) {
    vec3 c = mix(vec3(.0012, .0025, .007), vec3(.004, .017, .032), smoothstep(-.5, .9, d.y));
    c += vec3(.018, .065, .09) * pow(max(d.y, 0.), 3.);
    c += vec3(.012, .004, .02) * exp(-length(d.xz - vec2(-.6, -.5)) * 2.);
    return c;
}

vec3 background(vec3 ro, vec3 d) {
    vec3 c = environment(d);
    float beam = pow(.5 + .5 * sin(d.x * 8. + sin(d.z * 5. + phase) * .9 + d.y * 2.), 14.)
               * smoothstep(.0, .9, d.y);
    c += vec3(.010, .035, .05) * beam;

    // Sparse world-anchored particles on far shells around the creature; never in front of it.
    for (int i = 0; i < 3; i++) {
        float R = 3.4 + float(i) * 1.9;
        vec3 oc = ro - CENTER;
        float b = dot(oc, d), cq = dot(oc, oc) - R * R, h = b * b - cq;
        if (h < 0.) continue;
        vec3 q = normalize(oc + d * (-b + sqrt(h)));
        q.xz = rotation(.035 * sin(phase + float(i) * 2.)) * q.xz;
        vec2 uv = vec2(atan(q.z, q.x), acos(clamp(q.y, -1., 1.))) * vec2(9., 9.) * (1. + .3 * float(i));
        vec2 id = floor(uv), f = fract(uv) - .5;
        vec2 hh = hash22(id + float(i) * 17.);
        vec2 o = f - (hh - .5) * .7;
        float live = step(.72, hh.x);
        c += vec3(.25, .55, .7) * live * exp(-dot(o, o) * 900.) * (.25 + .75 * hh.y) * .35;
    }
    return c * uBackground;
}

// ============================================================================
// 7. SHADING
// ============================================================================
vec4 shadeShell(vec3 p, vec3 n, vec3 rd, float pix) {
    float isSeptum = step(1.5, gMat) * step(gMat, 2.5);
    float band = stripeBand(gPhi) * (1. - isSeptum);
    float sAlong = clamp((gPhi - PHI_MIN) / (PHI_LAST - PHI_MIN), 0., 1.);
    float bias = mix(.42, .02, sAlong) + .06 * sin(phase + gPhi * .3) - .25 * band;

    // Reaction-diffusion pattern + bump gradient.
    vec2 x = isSeptum > .5 ? gQ / gR * 1.6 + vec2(gCC * .37, 0.) : shellUV(band);
    vec2 rdv = reaction(x, bias);
    float e = .03;
    float gx = reaction(x + vec2(e, 0.), bias).x - rdv.x;
    float gy = reaction(x + vec2(0., e), bias).x - rdv.x;
    float plain = smoothstep(-.9, -.08, gPhi) * (1. - isSeptum);
    float pig = rdv.x * (1. - plain);

    vec3 tphi = normalize(vec3(-p.y, p.x, 0.) + 1e-5);
    vec3 nf = dot(n, rd) > 0. ? -n : n;
    vec3 tal = normalize(cross(nf, tphi));
    nf = normalize(nf - (gx * tphi + gy * tal) * (1. - plain) * .5);

    // Fresnel / lighting.
    float ct = clamp(dot(nf, -rd), 0., 1.);
    vec3 F = pow(vec3(1. - ct), vec3(2.6, 3., 3.5));
    F *= smoothstep(0., .12, ct);
    float dif = max(dot(nf, LIGHT_DIR), 0.) * caustic(p);
    float gloss = mix(90., 18., pig);
    float spec = pow(max(dot(nf, normalize(LIGHT_DIR - rd)), 0.), gloss) * mix(1.4, .5, pig);

    // Thin-film iridescence.
    float film = .55 + .45 * pig + .25 * sin(gPhi * 2. + atan(gQ.y, gQ.x) * 3.);
    float cosT = sqrt(1. - (1. - ct * ct) / 1.77);
    vec3 irid = .5 + .5 * cos(TAU * (2.2 * film * cosT + vec3(0., .33, .67)));
    vec3 dark = vec3(.005, .010, .028);
    vec3 base = mix(dark, PEARL * .5, pig) + PEARL * .22 * plain;

    // Interior-facing wall hits (camera or ray inside a whorl) stay dark: no ocean reflection.
    vec3 cp = creatureSpace(p);
    vec3 outward = normalize(normalize(vec3(cp.xy, 0.)) * gQ.x / SEC_A + vec3(0., 0., gQ.y / HALF_WIDTH));
    float inner = (1. - isSeptum) * step(0., dot(rd, outward));

    vec3 col = base * (.10 + .85 * dif) * (1. - .8 * inner)
             + vec3(.8, .9, 1.) * spec * (1. - .7 * inner);
    col += environment(reflect(rd, nf)) * 3.5 * F * (1. - .9 * inner);
    col += irid * F * uIridescenceStrength * (1. - .55 * pig) * vec3(.55, .45, .9) * (1. - .6 * inner);
    col += vec3(.05, .35, .45) * pow(max(dot(rd, LIGHT_DIR), 0.), 3.) * (1. - pig) * uShellTransmission;

    // Chamber energy glow.
    float pulse = gCC > 0. && gPhi < PHI_LAST ? chamberPulse(gCC) : .1;
    vec3 glowCol = shellGlowColor(gCC);
    col += glowCol * rdv.y * ((pulse - .08) * .55 + .35 * inner * pulse) * uChamberGlow * (1. - plain);

    // Aperture lip.
    float lip = smoothstep(-.16, -.05, gPhi) * (1. - isSeptum);
    col = mix(col, PEARL * (.12 + .55 * dif) + vec3(.8, .9, 1.) * spec + vec3(.1, .35, .5) * F * .6, lip);

    // Opacity.
    float a = (mix(.10, .72, pig) + plain * .3) * (1. - .35 * inner);
    a = mix(a, .9, lip);
    if (isSeptum > .5) {
        float sut = exp(-gSut * 28.);
        col = col * .22 + glowCol * (.05 + 1.2 * sut) * pulse * uChamberGlow;
        a = .07 + .4 * sut + .12 * pig;
    }
    a = mix(a, 1., .55 * F.g);
    a *= 1. - uShellTransmission * .45;
    a *= smoothstep(.25, 1.5, gThick / pix);
    return vec4(col, clamp(a, 0., 1.));
}

vec3 shadeBody(vec3 p, vec3 n, vec3 rd, float mat) {
    float ct = clamp(dot(n, -rd), 0., 1.), F = pow(1. - ct, 3.);
    float dif = max(dot(n, LIGHT_DIR) * .7 + .3, 0.) * caustic(p);
    float spec = pow(max(dot(n, normalize(LIGHT_DIR - rd)), 0.), 40.);

    vec3 b = bodyFrame(creatureSpace(p));
    vec3 skin = vec3(.36, .30, .40);
    float hoodZone = smoothstep(-.05, -.2, b.y);
    vec2 rdv = reaction(b.xz * vec2(2.2, 2.8) + vec2(0., b.y), .1);
    skin = mix(skin, vec3(.06, .04, .08), rdv.x * hoodZone * .8);

    vec3 col = skin * dif + vec3(.6, .7, .9) * spec * .5
             + vec3(.10, .40, .55) * F * .8 + vec3(.25, .08, .3) * F * F;
    float eHead = exp(-pow((gE - 1.03) / .05, 2.)) * gEnv;
    col += vec3(.2, .6, .9) * eHead * .25 * uChamberGlow;

    if (mat > 5.5) {            // eye
        vec3 le = normalize(b - vec3(.12, .03, sign(b.z) * .225));
        float pupil = smoothstep(.9, .96, abs(le.z));
        col = mix(vec3(.13, .13, .15) * (.3 + .7 * dif), vec3(.01, .012, .02), pupil)
            + vec3(.35) * spec + vec3(.1, .6, .9) * F * F * .7;
    } else if (mat > 4.5) {     // tentacle
        col = vec3(.34, .30, .40) * (.25 + .6 * dif) + vec3(.12, .45, .6) * F * 1.1
            + vec3(.5, .7, .9) * spec * .4;
        float front = (gE - 1.02) / .43 * 1.3 - .15;
        float g = exp(-pow((gU - front) / .12, 2.)) * gEnv;
        col += mix(vec3(.1, .8, 1.), vec3(.8, .2, .9), gU) * g * 1.4 * uChamberGlow;
    }
    return col;
}

// Shades the currently recorded hit (g* record must be valid), applies
// near-camera fade and distance fog. Returns premultiplied-ready (rgb, alpha).
vec4 shadeHit(vec3 p, vec3 n, vec3 dir, float dist, float pixAng) {
    vec4 s;
    if (gMat > 3.5) {
        s = vec4(shadeBody(p, n, dir, gMat), 1.);
    } else if (gMat > 2.5) {
        float F = pow(1. - abs(dot(n, dir)), 2.);
        s = vec4(vec3(.10, .75, 1.) * chamberPulse(gCC) * uChamberGlow * (.25 + .9 * F), .3 + .4 * F);
    } else {
        s = shadeShell(p, n, dir, pixAng * dist);
    }
    s.a *= smoothstep(.002, .03, dist);
    float fog = 1. - exp(-dist * .035);
    s.rgb = mix(s.rgb, environment(dir) * uBackground, fog);
    return s;
}

// Volumetric glow contribution of the chamber interior for one march step.
vec3 chamberVolumeGlow(float st) {
    float core = exp(-gAlpha * gAlpha * 22.) * pow(sin(PI * fract(gCC)), 2.);
    float ep = max(chamberPulse(gCC) - .12, 0.) * 1.6 + .015;
    vec3 cCol = volumeGlowColor(gCC);
    return cCol * ep
         * (core * .9 + exp(-max(gSiph, 0.) / (.04 * gR)) * .3 * uBloomStrength)
         * gIn * st / gR * uChamberGlow;
}

// ============================================================================
// 8. CAMERA RIG
// ============================================================================
// Keyframed camera: eye, target, vertical fov (deg), normalized loop time.
void camKey(int i, out float kt, out vec3 eye, out vec3 tgt, out float fov) {
    float off = 0.;
    if (i < 0)         { i += CAM_KEYS; off = -1.; }
    if (i > CAM_KEYS - 1) { i -= CAM_KEYS; off = 1.; }

    float D = 6.6 * uCameraDistance;
    vec3 head = SIPH_R * AP_OUT + AP_FWD * .2 + AP_OUT * .08;

    if (i == 0) {        // macro hold
        kt = 0.;   eye = vec3(.26, .20, .78);  tgt = vec3(-.06, -.04, 0.);  fov = uMacroFov;
    } else if (i == 1) { // macro settle
        kt = .07;  eye = vec3(.32, .26, .90);  tgt = vec3(-.05, -.05, 0.);  fov = uMacroFov - 2.;
    } else if (i == 2) { // reveal pull-back
        kt = .18;  eye = tubePoint(-1.2) * .5 + vec3(-.5, .1, 4.8);
        tgt = CENTER + vec3(-.3, 0., 0.);  fov = mix(uMacroFov, uFov, .6);
    } else if (i == 3) { // orbit start
        kt = .25;  eye = CENTER + D * vec3(sin(-.55) * cos(.16), sin(.16), cos(-.55) * cos(.16));
        tgt = CENTER;  fov = uFov;
    } else if (i == 4) { // orbit end
        kt = .55;  eye = CENTER + D * .97 * vec3(sin(-1.1) * cos(.26), sin(.26), cos(-1.1) * cos(.26));
        tgt = CENTER + vec3(0., .05, 0.);  fov = uFov;
    } else if (i == 5) { // head shot
        kt = .75;  eye = head + normalize(AP_FWD * .75 + vec3(0., .25, .8)) * 3.1;
        tgt = mix(head + AP_FWD * .3, CENTER, .3);  fov = uFov;
    } else if (i == 6) { // dive toward apex
        kt = .87;  eye = tubePoint(-2.6) * 1.3 + vec3(0., 0., 2.0);
        tgt = vec3(0., -.15, 0.);  fov = mix(uMacroFov, uFov, .6);
    } else {             // return to macro
        kt = .95;  eye = tubePoint(-5.2) * 1.6 + vec3(0., 0., .95);
        tgt = vec3(-.05, -.05, 0.);  fov = uMacroFov - 3.;
    }
    kt += off;
}

void cinematicCamera(float t, out vec3 eye, out vec3 tgt, out float fov) {
    int s = 0;
    for (int i = 0; i < CAM_KEYS; i++) {
        float kt, f; vec3 a, b;
        camKey(i, kt, a, b, f);
        if (t >= kt) s = i;
    }

    float t0, t1, tm, tp, f0, f1, fm, fp;
    vec3 e0, e1, em, ep, g0, g1, gm, gp;
    camKey(s - 1, tm, em, gm, fm);
    camKey(s,     t0, e0, g0, f0);
    camKey(s + 1, t1, e1, g1, f1);
    camKey(s + 2, tp, ep, gp, fp);

    float h = t1 - t0, x = (t - t0) / h;

    // Catmull-Rom tangents; the macro key (0) is a hold so the loop seam is a smooth stop-and-reverse.
    vec3 me0 = (e1 - em) / (t1 - tm) * h, me1 = (ep - e0) / (tp - t0) * h;
    vec3 mg0 = (g1 - gm) / (t1 - tm) * h, mg1 = (gp - g0) / (tp - t0) * h;
    if (s == 0)            { me0 *= 0.; mg0 *= 0.; }
    if (s == CAM_KEYS - 1) { me1 *= 0.; mg1 *= 0.; }

    float x2 = x * x, x3 = x2 * x;
    float h00 = 2. * x3 - 3. * x2 + 1., h10 = x3 - 2. * x2 + x;
    float h01 = -2. * x3 + 3. * x2,     h11 = x3 - x2;
    eye = h00 * e0 + h10 * me0 + h01 * e1 + h11 * me1;
    tgt = h00 * g0 + h10 * mg0 + h01 * g1 + h11 * mg1;
    fov = mix(f0, f1, x2 * (3. - 2. * x));
}

// ============================================================================
// 9. RAYMARCH, GRADING, MAIN
// ============================================================================
// Layered translucent march. Returns linear HDR colour; hitMask is 1 where any layer hit.
vec3 render(vec3 eye, vec3 rd, float pixAng, out float hitMask) {
    vec3 acc = vec3(0.), glow = vec3(0.);
    float T = 1., tr = 0., total = 0.;
    vec3 ro = eye, dir = rd;
    bool outside = true;
    int layers = 0;
    hitMask = 0.;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + dir * tr;
        float d = map(p);
        float dist = total + tr;

        // --- surface hit ---------------------------------------------------
        if (outside && d < max(.00002, .0004 * dist)) {
            Hit hit = captureHit();
            vec3 n = normalAt(p, max(.00015, .0006 * dist));   // overwrites g*
            restoreHit(hit);

            vec4 s = shadeHit(p, n, dir, dist, pixAng);
            hitMask = max(hitMask, step(.05, s.a));
            acc += T * s.a * s.rgb;
            T *= 1. - s.a;
            layers++;
            if (T < .02 || layers >= MAX_LAYERS) break;

            // Refract into the next layer and skip past the wall thickness.
            vec3 nf = dot(n, dir) > 0. ? -n : n;
            vec3 nd = normalize(mix(dir, refract(dir, nf, .9), .35));
            total += tr;
            ro = p;
            dir = nd;
            tr = 2.2 * hit.thick / max(abs(dot(dir, n)), .3) + .0005 * dist;
            outside = false;
            continue;
        }

        // --- free-space step -----------------------------------------------
        if (d > 0.) outside = true;
        float st = max(abs(d) * .8, .0002 + .0004 * dist);
        if (gIn > 0.) {
            st = min(st, .2 * gR);
            glow += T * chamberVolumeGlow(st);
        }
        tr += st;
        if (total + tr > 18.) break;
    }

    acc += glow * .35 / (1. + .6 * dot(glow, vec3(.333)));
    acc += T * background(ro, dir);
    return acc;
}

void main() {
    // Loop time / global state.
    float t = fract(uTimeSeconds * max(uLoopSpeed, 0.) / LOOP_SECONDS);
#ifdef DEBUG_T
    t = DEBUG_T;
#endif
    phase = t * TAU;
    gB = log(clamp(uSpiralGrowth, 1.6, 6.)) / TAU;
    gN = max(floor(uChamberCount + .5), 4.);
    gE = energyFront(t, gEnv);

    // Camera & primary ray.
    vec2 res = uTDOutputInfo.res.zw;
    vec3 eye, tgt;
    float fov;
    cinematicCamera(t, eye, tgt, fov);
    vec3 fw = normalize(tgt - eye);
    vec3 rt = normalize(cross(fw, vec3(0., 1., 0.)));
    vec3 up = cross(rt, fw);
    float tanH = tan(radians(fov) * .5);
    vec2 uv = (vUV.st - .5) * vec2(res.x / res.y, 1.) * 2.;
    vec3 rd = normalize(fw + (uv.x * rt + uv.y * up) * tanH);
    float pixAng = 2. * tanH / res.y;

    // Render + grade.
    float hitMask;
    vec3 col = render(eye, rd, pixAng, hitMask);
    col *= 1. - .22 * smoothstep(.6, 1.6, length(uv * vec2(1., .8)));   // vignette

#ifdef DEBUG_MASK
    fragColor = vec4(vec3(hitMask), 1.);
    return;
#endif

    col = pow(filmic(max(col, 0.) * max(uExposure, 0.)), vec3(1. / 2.2));
    fragColor = TDOutputSwizzle(vec4(col, 1.));
}
