// FRACTAL BLUE DRAGON
// TouchDesigner GLSL TOP fragment shader | Seamless 8-second loop
// Glaucus atlanticus (blue dragon sea slug) built as a recursive distance field.
// Target: 1080x1920, 30 fps, 240 frames. Host resolution is never changed.
// Set EXTERNAL_CONTROLS to 1 only after binding every CONTROL uniform.

#define EXTERNAL_CONTROLS 0
#define MAX_STEPS 140   // raymarch iterations per pixel
#define MAX_DEPTH 6     // maximum branch recursion levels
#define PAIRS 3         // bilateral branch pairs (cerata)

out vec4 fragColor;
uniform float uTimeSeconds;

#if EXTERNAL_CONTROLS
    #define CONTROL(name, value) uniform float name
#else
    #define CONTROL(name, value) const float name = value
#endif

// -----------------------------------------------------------------------------
// Controls
// -----------------------------------------------------------------------------
CONTROL(uBreathing,       1.0);   // 0..2  body + branch breathing
CONTROL(uBranchExpansion, 1.0);   // 0..1  peak unfurl of the fractal
CONTROL(uUndulation,      1.0);   // 0..2  spine wave + appendage stroke
CONTROL(uGlowIntensity,   1.0);   // 0..3  traveling bioluminescence
CONTROL(uDetailDensity,   0.7);   // 0..1  recursion depth 3..6 + surface detail
CONTROL(uAnimationSpeed,  1.0);   // rounded to an integer: the loop stays exact
CONTROL(uBranchTwist,     0.55);  // 0..1  fold-plane rotation per recursion level
CONTROL(uBodyScale,       1.0);

CONTROL(uCameraOrbit,     3.0);   // degrees of periodic azimuth sway
CONTROL(uCameraTour,      1.0);   // 0..1  front + underside sweep amplitude
CONTROL(uCameraDistance,  1.0);

CONTROL(uBloomStrength,   1.0);   // in-shader halo; a Bloom TOP adds the rest
CONTROL(uBackground,      1.0);
CONTROL(uExposure,        1.05);

// -----------------------------------------------------------------------------
// Constants and palette
// -----------------------------------------------------------------------------
const float PI           = 3.14159265359;
const float TAU          = 6.28318530718;
const float LOOP_SECONDS = 8.0;

const vec3 COBALT = vec3(0.035, 0.17, 0.62);
const vec3 ULTRA  = vec3(0.05,  0.03, 0.40);
const vec3 CYAN   = vec3(0.12,  0.82, 1.0);
const vec3 SILVER = vec3(0.80,  0.85, 0.95);
const vec3 NAVY   = vec3(0.004, 0.008, 0.024);

const vec3 KEY_LIGHT = vec3(-0.5, 0.8, -0.35);  // upper front-left
const vec3 RIM_LIGHT = vec3( 0.4, 0.3,  0.9);   // back-right cyan rim

// Material IDs returned by sceneMapping().
const float MAT_BODY   = 1.0;
const float MAT_BRANCH = 2.0;
const float MAT_TIP    = 3.0;

// Distance-field correction: spine warp and tapered radii are not exact distances.
const float STEP_SAFETY = 0.70;

// -----------------------------------------------------------------------------
// Per-frame animation state (written once in main)
// -----------------------------------------------------------------------------
float phase;        // 0..1 over the loop
float theta;        // TAU * phase
float speedH;       // integer animation harmonic
float unfurl;       // 0..1 branch growth envelope
float swim;         // 0..1 swimming envelope
float glowEnv;      // 0..1 bioluminescence envelope
float breath;       // signed breathing wave

float openAngle;    // branch split angle
float twistAngle;   // fold-plane twist per recursion level
float depthEff;     // fractional recursion depth

vec3  pairAnchor[PAIRS];
mat3  pairFrame[PAIRS];
float pairSize[PAIRS];

// Hit details written by sceneMapping() for shading and glow.
float gMat;         // material ID
float gU;           // position along the branch tree (level + fraction)
float gBranchD;     // nearest branch distance, used for the halo
vec3  gS;           // spine-straightened position

// -----------------------------------------------------------------------------
// Shared math and distance primitives
// -----------------------------------------------------------------------------
mat2 rotation(float a)
{
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// Integer harmonics keep motion periodic over exactly LOOP_SECONDS.
float harmonic(float x)
{
    return max(1.0, floor(x + 0.5));
}

float smoothUnion(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float capsule(vec3 p, vec3 a, vec3 b, float ra, float rb)
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

// Narrow cosine peak traveling along x; one pulse per unit.
float pulse(float x)
{
    return pow(0.5 + 0.5 * cos(TAU * x), 5.0);
}

// -----------------------------------------------------------------------------
// Body: tapered tube along z, bent by a traveling spine wave
// -----------------------------------------------------------------------------
// The wave grows toward the tail; the head stays steady for readability.
float spineX(float z)
{
    return 0.11 * uUndulation * swim * sin(2.1 * z - 2.0 * theta * speedH) * smoothstep(-1.4, 1.6, z);
}

float spineY(float z)
{
    return 0.04 * uUndulation * swim * sin(1.7 * z - 2.0 * theta * speedH + 0.8);
}

// Head at z = -1.25, tail tip at z = 1.8.
float bodyRadius(float z)
{
    float t = clamp((z + 1.25) / 3.05, 0.0, 1.0);
    float swell = mix(0.075, 0.205, smoothstep(0.0, 0.16, t));
    float taper = 1.0 - 0.89 * smoothstep(0.22, 1.0, t);
    return swell * taper * (1.0 + 0.05 * breath);
}

float bodyGeometry(vec3 s)
{
    float zc = clamp(s.z, -1.25, 1.8);
    float r  = bodyRadius(zc);

    // Fine segment ripple: low amplitude so the silhouette stays clean.
    r += 0.010 * uDetailDensity * sin(s.z * 26.0 - 2.0 * theta * speedH) * smoothstep(0.03, 0.15, abs(s.x));

    // Slightly flattened cross-section.
    return (length(vec3(s.x, s.y * 1.3, s.z - zc)) - r) / 1.3;
}

// Paired head tentacles (rhinophores).
float rhinophores(vec3 m)
{
    return capsule(m, vec3(0.045, 0.05, -1.17), vec3(0.085, 0.17, -1.36), 0.022, 0.008);
}

// -----------------------------------------------------------------------------
// Branches: recursive binary tree by iterated folding
// -----------------------------------------------------------------------------
// Each level: draw a segment, move to its tip, mirror, rotate, twist, scale.
// Level i grows by g = clamp(depthEff - i, 0, 1), so the recursion unfurls
// continuously instead of popping in.
// Returns x = branch distance, y = tree coordinate, z = tip-bead distance.
vec3 branchTree(vec3 p, float size)
{
    const float SCALE = 0.68;  // child / parent size

    p /= size;
    float sc  = size;
    float d   = 1e3;
    float u   = 0.0;
    float len = 0.42;
    float rad = 0.055;

    for (int i = 0; i < MAX_DEPTH; i++)
    {
        float g = clamp(depthEff - float(i), 0.0, 1.0);
        if (g <= 0.0) break;

        // Segment from the origin up the local y axis, tapering toward its tip.
        float L  = len * g;
        float h  = clamp(p.y / max(L, 1e-4), 0.0, 1.0);
        float r  = rad * mix(1.0, 0.78, h) * mix(0.45, 1.0, g);
        float di = (length(p - vec3(0.0, L * h, 0.0)) - r) * sc;
        if (di < d) { d = di; u = float(i) + h * g; }

        // Fold into the child frame.
        p.y -= L;
        p.x  = abs(p.x);
        p.xy = rotation(-openAngle) * p.xy;
        p.xz = rotation(twistAngle) * p.xz;
        p   /= SCALE;
        sc  *= SCALE;
        rad *= 0.90;
    }

    // The final frame's origin is every growing branch tip: crystalline beads.
    float tip = (length(p) - rad * 1.55) * sc;
    return vec3(d, u, tip);
}

// -----------------------------------------------------------------------------
// Scene
// -----------------------------------------------------------------------------
// Returns x = distance estimator, y = material ID.
// Also writes gS, gMat, gU and gBranchD for shading and glow.
vec2 sceneMapping(vec3 world)
{
    float S = max(uBodyScale, 0.2);
    vec3  p = world / S;

    // Straighten the swimming spine so the body can be modeled along z.
    vec3 s = vec3(p.x - spineX(p.z), p.y - spineY(p.z), p.z);
    gS   = s;
    gMat = MAT_BODY;
    gU   = 0.0;

    // Bilateral symmetry: model the right side only.
    vec3 m = s;
    m.x = abs(m.x);

    float d = smoothUnion(bodyGeometry(s), rhinophores(m), 0.04);

    float branchD = 1e3, branchU = 0.0, tipD = 1e3;
    for (int i = 0; i < PAIRS; i++)
    {
        vec3 q = pairFrame[i] * (m - pairAnchor[i]);

        // Skip trees whose bounding sphere is farther than the current best.
        if (length(q) - 1.36 * pairSize[i] > min(branchD, tipD)) continue;

        vec3 tree = branchTree(q, pairSize[i]);
        if (tree.x < branchD) { branchD = tree.x; branchU = tree.y; }
        tipD = min(tipD, tree.z);
    }
    gBranchD = min(branchD, tipD);

    if (branchD < d) { gMat = MAT_BRANCH; gU = branchU; }
    d = smoothUnion(d, branchD, 0.05);
    if (tipD < d) { d = tipD; gMat = MAT_TIP; gU = depthEff; }

    return vec2(d * STEP_SAFETY * S, gMat);
}

// -----------------------------------------------------------------------------
// Normals, environment and materials
// -----------------------------------------------------------------------------
vec3 normalAt(vec3 p, float e)
{
    vec2 k = vec2(1.0, -1.0);
    return normalize(k.xyy * sceneMapping(p + k.xyy * e).x +
                     k.yyx * sceneMapping(p + k.yyx * e).x +
                     k.yxy * sceneMapping(p + k.yxy * e).x +
                     k.xxx * sceneMapping(p + k.xxx * e).x);
}

vec3 environment(vec3 d)
{
    vec3 c = mix(vec3(0.001, 0.002, 0.006), vec3(0.006, 0.020, 0.050), smoothstep(-0.4, 1.0, d.y));
    c += vec3(0.03, 0.09, 0.16) * pow(max(dot(d, normalize(KEY_LIGHT)), 0.0), 12.0);
    c += vec3(0.02, 0.03, 0.08) * pow(max(dot(d, normalize(RIM_LIGHT)), 0.0), 6.0);
    return c;
}

float ambientOcclusion(vec3 p, vec3 n)
{
    float occ = 0.0;
    for (int i = 1; i <= 3; i++)
    {
        float h = 0.03 * float(i);
        occ += max(0.0, h - sceneMapping(p + n * h).x / STEP_SAFETY) / float(i);
    }
    return clamp(1.0 - occ * 3.0, 0.35, 1.0);
}

vec3 shade(vec3 p, vec3 n, vec3 rd)
{
    // Re-evaluate the scene at the hit point to recover material details.
    sceneMapping(p);
    float mat = gMat;
    float u   = gU;
    vec3  s   = gS;

    vec3  L    = normalize(KEY_LIGHT);
    vec3  R    = normalize(RIM_LIGHT);
    float dif  = max(dot(n, L), 0.0);
    float rim  = pow(max(dot(n, R), 0.0), 2.0);
    float F    = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    float ao   = ambientOcclusion(p, n);
    float spec = pow(max(dot(n, normalize(L - rd)), 0.0), 90.0);

    // Pulses travel from trunk to tips, two per loop at speed 1.
    float travel = 2.0 * phase * speedH;

    vec3 base, emit;
    if (mat < 1.5)
    {
        // Body: blue back, ultramarine midline stripe, silver flanks.
        base = mix(SILVER * 0.42, COBALT, smoothstep(-0.15, 0.55, n.y));
        base = mix(base, ULTRA, 0.75 * exp(-s.x * s.x / 0.0036) * smoothstep(0.0, 0.5, n.y));
        emit = CYAN * (0.03 + 0.22 * pulse(s.z * 0.33 - travel) * glowEnv) * smoothstep(-0.1, 0.6, n.y);
    }
    else if (mat < 2.5)
    {
        // Branches: brighter and cyan toward the outer levels.
        float k        = u / max(depthEff, 1.0);
        float glowBase = 0.10 + 0.9 * glowEnv;
        base = mix(COBALT, mix(ULTRA, CYAN * 0.45, 0.5), k);
        emit = CYAN * (0.04 + 0.12 * k + 1.3 * pulse(u * 0.32 - travel) * glowEnv * k) * glowBase;
    }
    else
    {
        // Tip beads.
        base = CYAN * 0.5;
        emit = mix(CYAN, SILVER, 0.35) * (0.45 + 1.4 * pulse(depthEff * 0.32 - travel) * glowEnv);
    }

    vec3 col = base * (0.04 + 0.70 * dif) * ao;
    col += mix(SILVER, base * 2.0, 0.35) * spec * 1.1;                     // metallic, tinted highlight
    col += environment(reflect(rd, n)) * mix(base * 2.0, vec3(1.0), F) * 1.4;
    col += CYAN * 0.35 * rim * ao + COBALT * F * 0.6;                      // Fresnel rim
    col += mix(SILVER, CYAN, 0.4) * 0.12 * max(-n.y, 0.0) * ao;            // underside fill
    col += emit * uGlowIntensity;
    return col;
}

// -----------------------------------------------------------------------------
// Post helpers
// -----------------------------------------------------------------------------
vec2 hash22(vec2 p)
{
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

// ACES-style filmic tone curve.
vec3 film(vec3 x)
{
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// -----------------------------------------------------------------------------
// Animation setup
// -----------------------------------------------------------------------------
// Story: 0-0.5 s hold, 0.5-2.4 s unfurl, swim + glow in the middle,
// 6.2-8.0 s return. Each envelope is 0 with zero slope at phase 0 and 1,
// so the last frame wraps to the first without a visible seam.
void setupAnimation()
{
    theta  = TAU * phase;
    speedH = harmonic(uAnimationSpeed);

    unfurl  = smoothstep(0.0625, 0.30, phase) * (1.0 - smoothstep(0.78, 1.0, phase)) * clamp(uBranchExpansion, 0.0, 1.0);
    swim    = smoothstep(0.10, 0.38, phase) * (1.0 - smoothstep(0.68, 0.96, phase));
    glowEnv = smoothstep(0.18, 0.40, phase) * (1.0 - smoothstep(0.68, 0.88, phase));
    breath  = clamp(uBreathing, 0.0, 2.0) * sin(2.0 * theta * speedH);

    depthEff   = mix(2.0, mix(3.0, 6.0, clamp(uDetailDensity, 0.0, 1.0)), unfurl);
    openAngle  = mix(0.20, 0.50, unfurl) + 0.035 * breath;
    twistAngle = clamp(uBranchTwist, 0.0, 1.0) * PI * 0.5;
}

// Place the three branch pairs along the body; each strokes with a phase lag.
void setupBranchPairs()
{
    for (int i = 0; i < PAIRS; i++)
    {
        float fi = float(i);
        float z  = -0.62 + 0.46 * fi;

        float stroke = uUndulation * swim * sin(2.0 * theta * speedH - 0.95 * fi);
        float yaw    = -0.30 + 0.42 * fi + 0.14 * stroke;
        float pitch  = 0.10 + 0.05 * uUndulation * swim * sin(2.0 * theta * speedH - 0.95 * fi + 1.3) + 0.03 * breath;

        // Local frame: Y points along the trunk of the tree.
        vec3 Y = vec3(cos(pitch) * cos(yaw), sin(pitch), cos(pitch) * sin(yaw));
        vec3 X = normalize(cross(vec3(0.0, 1.0, 0.0), Y));
        vec3 Z = cross(X, Y);

        pairFrame[i]  = transpose(mat3(X, Y, Z));
        pairAnchor[i] = vec3(bodyRadius(z) * 0.55, 0.02, z);
        pairSize[i]   = (0.80 - 0.11 * fi) * mix(0.92, 1.06, unfurl) * (1.0 + 0.04 * breath);
    }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
void main()
{
    // An unbound or invalid clock falls back to the frame-0 pose.
    float seconds = uTimeSeconds;
    if (isnan(seconds) || isinf(seconds)) seconds = 0.0;
    phase = fract(seconds / LOOP_SECONDS);
#ifdef DEBUG_T
    phase = DEBUG_T;
#endif

    setupAnimation();
    setupBranchPairs();

    vec2  res    = uTDOutputInfo.res.zw;
    float aspect = res.x / max(res.y, 1.0);
    float S      = max(uBodyScale, 0.2);
    vec3  target = vec3(0.0, 0.0, 0.18) * S;

    // ---- Camera ------------------------------------------------------------
    // Hero three-quarter view from above/behind-right, then a slow tour over
    // the right flank toward the head and under the body, and back.
    // tour is 0 with zero slope at phase 0 and 1, so the camera loops cleanly.
    float tu   = clamp((phase - 0.04) / 0.92, 0.0, 1.0);
    float tour = (0.5 - 0.5 * cos(TAU * tu)) * clamp(uCameraTour, 0.0, 1.0);

    float az = radians(30.0 + 115.0 * tour + clamp(uCameraOrbit, 0.0, 12.0) * sin(theta));
    float el = radians(40.0 - 58.0 * tour + 1.5 * sin(theta));
    vec3 eyeDir = vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el));

    // The head stays screen-up; only a little world-up is blended in during the tour.
    vec3 upHint = normalize(mix(vec3(0.0, 0.0, -1.0), vec3(0.0, 1.0, 0.0), 0.25 * tour));
    vec3 fw = -eyeDir;
    vec3 rt = normalize(cross(fw, upHint));
    vec3 up = cross(rt, fw);

    float roll  = radians((-8.0 + 1.5 * sin(theta)) * (1.0 - tour));
    vec3  oldrt = rt;
    rt =  cos(roll) * oldrt + sin(roll) * up;
    up = -sin(roll) * oldrt + cos(roll) * up;

    // Fit the creature in a 30 degree vertical FOV for any aspect.
    float tanH = tan(radians(30.0) * 0.5);
    float D    = max(1.75 / tanH, 1.30 / (tanH * aspect)) * S * max(uCameraDistance, 0.6) * (1.0 + 0.08 * tour);
    vec3  ro   = target + eyeDir * D;

    // Slight up-left placement keeps clear of the Reels action rail and caption.
    vec2 placement = aspect < 0.8 ? vec2(-0.02, 0.04) : vec2(0.0);
    vec2 uv = (vUV.st - 0.5 - placement) * vec2(aspect, 1.0) * 2.0;
    vec3 rd = normalize(fw + (uv.x * rt + uv.y * up) * tanH);

    // ---- Raymarch ----------------------------------------------------------
    // March only inside a sphere that contains the whole animated organism.
    float R  = 2.4 * S;
    vec3  oc = ro - target;
    float b  = dot(oc, rd);
    float h  = b * b - dot(oc, oc) + R * R;

    float tr = 0.0, hit = 0.0, minB = 1e3;
    if (h >= 0.0)
    {
        tr = max(0.0, -b - sqrt(h));
        float stop = -b + sqrt(h);
        for (int i = 0; i < MAX_STEPS; i++)
        {
            vec2  dm  = sceneMapping(ro + rd * tr);
            float eps = max(0.0004, tr * 0.00022);
            minB = min(minB, gBranchD);
            if (dm.x < eps) { hit = 1.0; break; }
            tr += max(dm.x, eps * 0.6);
            if (tr > stop) break;
        }
    }

    // ---- Compose -----------------------------------------------------------
    vec3 bg = mix(NAVY * 0.25, NAVY * 1.15, smoothstep(-1.2, 1.2, uv.y));
    bg += COBALT * 0.018 * exp(-dot(uv, uv) * 1.4);
    vec3 col = bg * uBackground;

    // Glow halo from the closest pass to any branch.
    vec3 halo = mix(CYAN, COBALT, 0.4) * exp(-max(minB, 0.0) * 30.0 / S) * (0.05 + 0.10 * glowEnv) * uBloomStrength;

    if (hit > 0.5)
    {
        vec3 p = ro + rd * tr;
        vec3 n = normalAt(p, max(0.0007, tr * 0.00018));
        col = shade(p, n, rd);
    }
    else
    {
        col += halo;
    }

    // Vignette.
    col *= 1.0 - 0.25 * smoothstep(0.7, 1.7, length(uv * vec2(1.0, 0.75)));

#ifdef DEBUG_MASK
    fragColor = TDOutputSwizzle(vec4(vec3(hit), 1.0));
    return;
#endif

    col = pow(film(max(col, 0.0) * max(uExposure, 0.0)), vec3(1.0 / 2.2));

    // Dither against banding.
    vec2 dh = hash22(gl_FragCoord.xy);
    col += (dh.x + dh.y - 1.0) / 255.0;

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
