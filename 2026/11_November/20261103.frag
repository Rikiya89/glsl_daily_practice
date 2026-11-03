// =============================================================================
//  FRACTAL SCARAB | INFINITE ANATOMY
//  TouchDesigner - GLSL TOP, pixel shader
// =============================================================================
//
//  WHAT IT IS
//    A scarab beetle built only from Signed Distance Functions (SDFs). Its
//    wing cases (elytra) spring open to reveal a glowing Mandelbox fractal
//    "heart". The heart beats, then folds back in as the shell closes.
//    No meshes, no textures: every pixel shoots a ray and keeps asking
//    "how far away is the nearest surface?" until it lands on the beetle.
//
//  FORMAT
//    Target 1080 x 1920 (portrait Reels). Works at any resolution and never
//    changes the TOP's own resolution.
//    Loop: 8 s = 240 frames @ 30 fps. Frame 240 == frame 0 (seamless).
//
//  TOUCHDESIGNER SETUP
//    - Uniforms page: uTimeSeconds <- absTime.seconds (or a Timer CHOP).
//    - Keep EXTERNAL_CONTROLS at 0 to use the default values baked in below.
//      Set it to 1 ONLY after every CONTROL(...) name exists as a uniform on
//      the Vectors pages. An unbound uniform reads as 0
//      (e.g. uExposure = 0 -> black frame).
//    - Add a Bloom TOP after this one. The shader only adds a subtle halo.
//
//  HOW TO READ THIS FILE
//    Start with main() at the bottom. It runs five stages for every pixel:
//      1. updateAnimation()  every time-dependent value, computed once
//      2. buildCamera()      pixel -> ray (origin + direction)
//      3. raymarch()         walk along the ray through the SDF until it hits
//      4. shade()            lights + materials at the hit point
//      5. post-processing    vignette, tone mapping, gamma, dithering
//    Then scroll up into whichever stage you want to study.
//
//  DEBUG SWITCHES (add them next to EXTERNAL_CONTROLS)
//    #define DEBUG_T 0.45    freeze the animation at one phase (0..1)
//    #define DEBUG_MASK      white where a ray hit the beetle, black elsewhere
// =============================================================================

#define EXTERNAL_CONTROLS 0

out vec4 fragColor;
uniform float uTimeSeconds;   // seconds; only fract(t / 8) matters


// -----------------------------------------------------------------------------
// 1. CONTROLS
//    CONTROL(name, default) expands to ONE of these:
//      uniform float name;             EXTERNAL_CONTROLS 1 -> tweak live in TD
//      const   float name = default;   EXTERNAL_CONTROLS 0 -> no setup needed,
//                                      and the compiler can fold the constants
//    The rest of the code uses the name and never knows which one it got.
// -----------------------------------------------------------------------------
#if EXTERNAL_CONTROLS
    #define CONTROL(name, value) uniform float name
#else
    #define CONTROL(name, value) const float name = value
#endif

//      name              default   range / meaning
CONTROL(uBreathing,       1.0);   // 0..2   breathing of abdomen, pronotum, shell
CONTROL(uShellOpen,       1.0);   // 0..1   how far the elytra open at the peak
CONTROL(uFractalUnfold,   1.0);   // 0..1   how big the fractal core grows
CONTROL(uFractalScale,   -1.9);   // Mandelbox scale s; keep |s| in 1.6..2.4
CONTROL(uFractalDetail,    .7);   // 0..1   Mandelbox iterations 6..12
CONTROL(uGlowIntensity,   1.0);   // 0..3   core emission
CONTROL(uLegMotion,       1.0);   // 0..2   leg movement amplitude
CONTROL(uAnimationSpeed,  1.0);   // rounded to a whole number: loop stays exact
CONTROL(uBodyScale,       1.0);   // overall size of the creature
CONTROL(uCameraOrbit,     4.0);   // degrees of side-to-side camera sway
CONTROL(uCameraTour,      1.0);   // 0..1   push-in + orbit during the reveal
CONTROL(uCameraDistance,  1.0);   // >1 = further away
CONTROL(uBloomStrength,   1.0);   // in-shader halo; the Bloom TOP adds the rest
CONTROL(uBackground,      1.0);   // background brightness
CONTROL(uExposure,       1.05);   // brightness before tone mapping


// -----------------------------------------------------------------------------
// 2. CONSTANTS
// -----------------------------------------------------------------------------
// Quality. GLSL loops need an upper bound known at compile time, so these are
// the caps; the real counts stop earlier with `break`.
#define MAX_STEPS 150   // raymarch steps per pixel
#define MAX_ITER  12    // Mandelbox iterations (uFractalDetail picks 6..12)
#define PAIRS     3     // leg pairs: 3 pairs = 6 legs

const float PI           = 3.14159265359;
const float TAU          = 6.28318530718;
const float LOOP_SECONDS = 8.0;

// Palette, in linear RGB. Gamma is applied only once, at the very end.
const vec3 COBALT = vec3(.035, .17, .62);
const vec3 ULTRA  = vec3(.05,  .03, .40);    // ultramarine
const vec3 CYAN   = vec3(.12,  .82, 1.0);
const vec3 SILVER = vec3(.80,  .85, .95);
const vec3 NAVY   = vec3(.004, .008, .024);

// Body space: head -> -z, abdomen -> +z, back (dorsal) -> +y.
// 1 unit is roughly half the body length.
const vec3  DOME_C  = vec3(0., .08, .55);    // centre of the closed elytra dome
const vec3  DOME_R  = vec3(.60, .40, .82);   // radii of that dome
const vec3  HINGE   = vec3(.03, .37, -.02);  // pivot point of each elytron
const vec3  CORE_C  = vec3(0., .16, .55);    // where the fractal core grows from
const float SHELL_T = .024;                  // elytra shell thickness

// Mandelbox sphere-fold radii (squared). See mandelbox().
const float MIN_R2   = .25;
const float FIXED_R2 = 1.;

// Raymarch safety factor. Smooth unions, the ellipsoid approximation and the
// fractal can all report distances that are slightly too large. Multiplying
// every step by 0.72 is a bit slower but never overshoots (no holes/noise).
const float STEP = .72;

// Material IDs: written by sceneMapping(), read by shade().
const float MAT_BODY     = 1.;   // head, pronotum, legs (obsidian chitin)
const float MAT_ELYTRA   = 2.;   // wing cases (chitin + grooves + satin inside)
const float MAT_FRACTAL  = 3.;   // Mandelbox core (emissive)
const float MAT_EYE      = 4.;   // compound eyes (glossy black)
const float MAT_MEMBRANE = 5.;   // soft top of the abdomen, under the elytra


// -----------------------------------------------------------------------------
// 3. GLOBAL STATE
//  (a) Animation values: written ONCE per pixel by updateAnimation(), then
//      only read. The SDF runs ~150 times per pixel, so computing these once
//      instead of inside the SDF saves a lot of work.
//  (b) Hit info: sceneMapping() can only return (distance, material), but
//      shading also needs the orbit trap, the shell-local position, etc.
//      So sceneMapping() leaves them in these g* globals as a side effect.
//      EVERY call overwrites them - see the warning in shade().
// -----------------------------------------------------------------------------
// (a) timeline
float phase;           // 0..1 position inside the loop
float theta;           // phase in radians (0..TAU)
float speedHarmonic;   // whole-number speed multiplier (1, 2, 3...)
float breath;          // -uBreathing..+uBreathing, 2 breaths per loop
float core;            // 0..1 how far the fractal core is revealed
float glowEnvelope;    // 0..1 overall core emission
float beat;            // heartbeat pulse ("lub-dub" shape)
float beatPhase;       // 0..1 position inside the current heartbeat
float coreLight;       // light the core spills onto nearby anatomy
float lift;            // how far the body rises on its legs
float nod;             // head pitch in radians

// (a) fractal
float fractalScale;       // Mandelbox scale s
float fractalGrowth;      // 0 = hidden, ~1.06 = fully grown (with overshoot)
float fractalZoom;        // body units -> fractal units
float fractalHalfSize;    // half-size of the full-grown fractal cube
int   fractalIterations;  // 6..12
mat3  fractalOrient;      // tilt + spin of the fractal
mat2  fractalTwist;       // twist of the fold planes ("unfolding" effect)

// (a) rig.  Index [0] = right elytron, [1] = left elytron.
mat2 elytraYaw[2], elytraPitch[2], elytraRoll[2];
vec3 legCoxa[PAIRS];       // hip joint on the body
vec3 legKnee[PAIRS];       // femur / tibia joint
vec3 legTibiaEnd[PAIRS];   // tibia / tarsus joint
vec3 legTip[PAIRS];        // tip of the tarsus (the "foot")
vec3 tibiaToothDir;        // direction of the digging teeth on the fore-leg

// (b) hit info
float gMaterial;      // material ID of the closest surface
float gOrbitTrap;     // Mandelbox orbit trap (drives the fractal's colour)
float gInsideShell;   // 1 = on the inner face (underside) of an elytron
float gFractalDist;   // distance to the fractal alone (drives the halo)
vec3  gLocalPos;      // position in elytron space (drives the grooves)


// -----------------------------------------------------------------------------
// 4. MATH HELPERS
// -----------------------------------------------------------------------------
float sq(float x) { return x * x; }

// Gaussian bump centred on c with width w.
// Uses x*x instead of pow(x, 2.): pow() with a NEGATIVE base is undefined in
// GLSL and returns NaN on some GPUs.
float gaussian(float x, float c, float w) { return exp(-sq((x - c) / w)); }

// 2D rotation matrix.
// In SDF code we rotate the SAMPLE POINT, not the object, so the object
// appears to turn the opposite way (an "inverse transform").
mat2 rotation(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

mat3 rotX3(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rotY3(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotZ3(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }

// Rounds the speed control to a whole number >= 1.
// At 1x, 2x, 3x the animation still ends exactly on frame 0; at 1.5x it wouldn't.
float harmonic(float x) { return max(1., floor(x + .5)); }

float bodyScale() { return max(uBodyScale, .2); }

// Material IDs are stored as floats; compare with a tolerance, never with ==.
bool isMaterial(float m, float id) { return abs(m - id) < .5; }


// -----------------------------------------------------------------------------
// 5. TIMING CURVES
//    The loop rule: every animated value must have the SAME value AND the
//    SAME slope at phase 0 and phase 1. Otherwise you see a pop or a hitch
//    when the video loops. All curves below are built to respect that.
// -----------------------------------------------------------------------------
// Rises a->b, holds, falls c->d. smoothstep has zero slope at each corner.
float envelope(float x, float a, float b, float c, float d) {
    return smoothstep(a, b, x) * (1. - smoothstep(c, d, x));
}

// "Back" ease: 0 -> 1 with a soft overshoot (k = amount), zero slope at 1.
// Feed it a smoothstep so the start also has zero slope (C1 continuous).
float easeBack(float x, float k) {
    float y = clamp(x, 0., 1.) - 1.;
    return 1. + (k + 1.) * y * y * y + k * y * y;
}

// sin^2 hump on [a, b]: value and slope are 0 at both ends.
float bump(float x, float a, float b) {
    float s = sin(PI * clamp((x - a) / (b - a), 0., 1.));
    return s * s;
}

// Double heartbeat "lub-dub" per period. Almost 0 at the wrap, so a whole
// number of beats per loop keeps the loop seamless.
float heartbeat(float x) {
    float f = fract(x);
    return gaussian(f, .25, .045) + .55 * gaussian(f, .40, .05);
}

// Sharp periodic peak (raised cosine ^5), used for travelling light waves.
float pulse(float x) { return pow(.5 + .5 * cos(TAU * x), 5.); }


// -----------------------------------------------------------------------------
// 6. SDF PRIMITIVES
//    Each returns the SIGNED distance from point p to a shape:
//      > 0 outside,  = 0 on the surface,  < 0 inside.
//    Reference: Inigo Quilez, "distance functions" (iquilezles.org).
// -----------------------------------------------------------------------------
// Smooth union ("smooth min"): like min(a, b) but blends the two shapes with a
// fillet of size k. This is why body parts look grown together, not glued.
float smoothUnion(float a, float b, float k) {
    float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
    return mix(b, a, h) - k * h * (1. - h);
}

// Capsule from a to b, radius tapering from ra to rb (used for leg segments).
// h = position of the closest point along a->b (0..1).
float capsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return length(pa - ba * h) - mix(ra, rb, h);
}

// Ellipsoid with radii r. The exact distance has no closed form; this is a
// fast approximation that is good near the surface (one reason STEP < 1).
float ellipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.) / max(k1, 1e-6);
}


// -----------------------------------------------------------------------------
// 7. MANDELBOX FRACTAL
//    Each iteration does four things:
//      1. box fold    - reflect any coordinate beyond +-1 back inside
//      2. twist       - rotate the fold planes (animation). A rotation does not
//                       stretch space, so the distance estimate stays valid.
//      3. sphere fold - invert points inside a shell (small |z| is pushed out)
//      4. scale + add - z = s*z + p   (compare z = z^2 + c in the Mandelbrot set)
//    dr tracks how much space was stretched in total, so |z| / |dr| is a safe
//    distance estimate (DE).
//    Orbit trap = the smallest |z|^2 visited during the iterations. Points whose
//    orbit passes near the origin get a different colour: the colour comes
//    from the fractal's own math.
// -----------------------------------------------------------------------------
vec2 mandelbox(vec3 p) {
    vec3  z    = p;
    float dr   = 1.;
    float trap = 1e3;
    for (int i = 0; i < MAX_ITER; i++) {
        if (i >= fractalIterations) break;
        z = clamp(z, -1., 1.) * 2. - z;                     // 1. box fold
        z.xz = fractalTwist * z.xz;                         // 2. twist
        float r2 = dot(z, z);
        trap = min(trap, r2);
        float k = FIXED_R2 / clamp(r2, MIN_R2, FIXED_R2);   // 3. sphere fold
        z  *= k;
        dr *= k;
        z  = z * fractalScale + p;                          // 4. scale + add
        dr = dr * abs(fractalScale) + 1.;
    }
    return vec2(length(z) / abs(dr), trap);                 // (distance, trap)
}


// -----------------------------------------------------------------------------
// 8. ANATOMY
// -----------------------------------------------------------------------------
// One elytron (wing case). Always modelled as the RIGHT one; the left one is
// the same function called with x mirrored.
//   - Thin shell: abs(d) - thickness turns a solid ellipsoid into a skin.
//   - Two cuts with max(): the midline seam and the lower edge.
//   - Opening: rotate the sample point around HINGE (yaw, pitch, roll).
// Outputs: q     = point in elytron space (for the groove pattern)
//          inner = 1 when p is on the underside of the shell
float elytron(vec3 p, int side, out vec3 q, out float inner) {
    // Move the hinge to the origin, rotate, move back = rotate around HINGE.
    q = p - HINGE;
    q.xz = elytraYaw[side]   * q.xz;
    q.yz = elytraPitch[side] * q.yz;
    q.xy = elytraRoll[side]  * q.xy;
    q += HINGE;

    vec3  e = q - DOME_C;
    float E = ellipsoid(e, DOME_R * vec3(1., 1. + .012 * breath, 1.));
    inner   = step(E, -SHELL_T * .5);                 // deeper than mid-shell -> underside
    float d = abs(E + SHELL_T * .5) - SHELL_T * .5;   // skin of thickness SHELL_T, just inside
    d = max(d, .004 - q.x);                           // cut at the midline (sutural seam)
    d = max(d, -.03 - q.y);                           // cut below the side edge (epipleuron)
    return d;
}

// Head: head capsule + flat clypeus "shovel" with teeth + antennae + eyes.
// Sets gMaterial = MAT_EYE when an eye is the closest part.
float headGeometry(vec3 p) {
    // Nod: rotate around the neck joint (nod > 0 lifts the clypeus).
    const vec3 NECK = vec3(0., .06, -.60);
    p -= NECK;
    p.yz = rotation(nod) * p.yz;
    p += NECK;

    // Mirror x: model the right side only and get the left side for free.
    vec3 m = vec3(abs(p.x), p.yz);

    float d = ellipsoid(p - vec3(0., .04, -.78), vec3(.30, .13, .24));                  // head capsule
    d = smoothUnion(d, ellipsoid(p - vec3(0., 0., -.93), vec3(.36, .045, .20)), .04);    // clypeus fan

    // Clypeal teeth - POLAR DOMAIN REPETITION:
    // measure the angle around the clypeus centre, snap it to the nearest of
    // 4 slots (w = .36 rad apart) and rotate the point into that slot.
    // One tooth SDF then draws all 4 teeth (x2 with the mirror).
    vec2  v  = vec2(m.x, -(p.z + .80));
    float a  = atan(v.x, v.y);
    float w  = .36;
    float id = clamp(floor(a / w + .5), 0., 3.);   // which slot (0..3)
    float aa = a - id * w;                         // angle inside that slot
    float r  = length(v);
    vec2  l  = r * vec2(cos(aa), sin(aa));         // point in slot space
    float tl = clamp((l.x - .27) / .11, 0., 1.);   // 0 at tooth root, 1 at tip
    float tooth = length(vec3(l.x - clamp(l.x, .27, .38), p.y, l.y)) - mix(.035, .006, tl);
    d = smoothUnion(d, tooth, .02);

    // Lamellate antenna: thin stalk (scape) + flat club at the end.
    d = min(d, capsule(m, vec3(.22, 0., -.84), vec3(.33, -.01, -.97), .012, .010));
    d = min(d, ellipsoid(m - vec3(.36, -.01, -1.01), vec3(.03, .018, .05)));

    float eye = length(m - vec3(.235, .07, -.70)) - .055;   // sphere
    gMaterial = eye < d ? MAT_EYE : MAT_BODY;
    return min(d, eye);
}

// Legs: 3 capsules per leg (femur, tibia, tarsus). Receives the mirrored
// point, so the 3 right legs also draw the 3 left legs.
float legGeometry(vec3 m) {
    float d = 1e3;
    for (int i = 0; i < PAIRS; i++) {
        d = min(d, capsule(m, legCoxa[i],     legKnee[i],     .070, .052));   // femur
        d = min(d, capsule(m, legKnee[i],     legTibiaEnd[i], .052, .036));   // tibia
        d = min(d, capsule(m, legTibiaEnd[i], legTip[i],      .020, .011));   // tarsus
    }

    // Digging teeth on the fore-tibia - LINEAR DOMAIN REPETITION:
    // project the point onto the tibia, snap to the nearest slot (every .085),
    // clamp to slots 2..4 (= exactly 3 teeth), and draw ONE tooth there.
    vec3  ba   = legTibiaEnd[0] - legKnee[0];
    float len  = length(ba);
    float s    = clamp(dot(m - legKnee[0], ba) / (len * len), 0., 1.) * len;   // distance along tibia
    float id   = clamp(floor(s / .085 + .5), 2., 4.);
    vec3  base = legKnee[0] + ba * (id * .085 / len);
    d = min(d, capsule(m, base, base + tibiaToothDir * .075, .022, .004));
    return d;
}


// -----------------------------------------------------------------------------
// 9. SCENE SDF
//    Returns vec2(distance, material). The raymarcher calls this up to
//    MAX_STEPS times per pixel, so it only reads precomputed animation values.
// -----------------------------------------------------------------------------
vec2 sceneMapping(vec3 world) {
    // Uniform scaling trick: divide the point by S here, multiply the
    // distance by S at the end.
    float S  = bodyScale();
    vec3  pw = world / S;
    // Legs use the UN-lifted, mirrored point: their tips stay planted on the
    // ground while the hips (legCoxa includes +lift) follow the body.
    vec3  mw = vec3(abs(pw.x), pw.yz);
    vec3  p  = pw - vec3(0., lift, 0.);   // body rises on its legs

    // Reset hit info for this evaluation.
    gOrbitTrap   = 0.;
    gInsideShell = 0.;
    gFractalDist = 1e3;
    gLocalPos    = p;

    float bb = 1. + .020 * breath;

    float hd = headGeometry(p);   // also sets gMaterial (eye or body)
    float headMat = gMaterial;
    gMaterial = MAT_BODY;

    // Main body: pronotum + head + abdomen + sternum + scutellum + legs,
    // all smooth-unioned into one organic shape.
    float d = ellipsoid(p - vec3(0., .10, -.33), vec3(.58, .29 * (1. + .01 * breath), .36));   // pronotum
    d = smoothUnion(d, hd, .05);

    // Abdomen with tergite rings: fract() makes a ridge every .16 units along z
    // (repetition), only on the top side (smoothstep on y). Visible when open.
    vec3  ab  = p - vec3(0., -.03, .55);
    float seg = .02 * abs(fract(ab.z / .16 + .5) - .5) * smoothstep(-.1, .2, ab.y);
    float abd = ellipsoid(ab, vec3(.52, .15 * bb, .74)) + seg;
    d = smoothUnion(d, abd, .06);

    d = smoothUnion(d, ellipsoid(p - vec3(0., -.04, -.15), vec3(.36, .18, .40)), .06);   // sternum (belly)
    d = smoothUnion(d, ellipsoid(p - vec3(0., .36,  .02), vec3(.07, .03, .11)), .02);    // scutellum
    d = smoothUnion(d, legGeometry(mw), .035);

    // Which material wins inside the merged body?
    if (abd < d + .004 && ab.y > -.02)                 gMaterial = MAT_MEMBRANE;   // soft top of abdomen
    if (isMaterial(headMat, MAT_EYE) && hd < d + .002) gMaterial = MAT_EYE;        // eye wins over body

    // Elytra: plain min() instead of smoothUnion so each side can open on its
    // own without melting into the body.
    vec3  qr, ql;
    float ir, il;
    float er = elytron(p, 0, qr, ir);
    float el = elytron(vec3(-p.x, p.y, p.z), 1, ql, il);   // mirrored = left side
    if (er < d) { d = er; gMaterial = MAT_ELYTRA; gLocalPos = qr; gInsideShell = ir; }
    if (el < d) { d = el; gMaterial = MAT_ELYTRA; gLocalPos = ql; gInsideShell = il; }

    // Fractal core.
    // A negative-scale Mandelbox fills the cube |z| <= 2. We zoom it so that
    // cube's half-size is fractalHalfSize * fractalGrowth in body space:
    // the core literally grows.
    if (fractalGrowth > .002) {
        vec3  c = p - CORE_C;
        float k = fractalZoom / fractalGrowth;
        // Cheap bounding-sphere test first (sqrt(3) ~ 1.73 encloses the cube):
        // skip the expensive fractal when it cannot be the closest thing.
        float bound = length(c) - 1.75 * fractalHalfSize * fractalGrowth;
        if (bound < d) {
            vec2  mb = mandelbox((fractalOrient * c) * k);
            float f  = mb.x / k;          // undo the zoom on the distance
            gFractalDist = f;
            if (f < d) { d = f; gMaterial = MAT_FRACTAL; gOrbitTrap = mb.y; }
        }
    }
    return vec2(d * STEP * S, gMaterial);
}


// -----------------------------------------------------------------------------
// 10. NORMALS + AMBIENT OCCLUSION
// -----------------------------------------------------------------------------
// The surface normal is the gradient of the SDF. Tetrahedral sampling needs
// only 4 SDF calls instead of the 6 of central differences.
vec3 normalAt(vec3 p, float e) {
    vec2 k = vec2(1., -1.);
    return normalize(k.xyy * sceneMapping(p + k.xyy * e).x +
                     k.yyx * sceneMapping(p + k.yyx * e).x +
                     k.yxy * sceneMapping(p + k.yxy * e).x +
                     k.xxx * sceneMapping(p + k.xxx * e).x);
}

// Step a few short distances along the normal. If the scene is closer than
// the step length, something is blocking the light -> darken.
float ambientOcclusion(vec3 p, vec3 n) {
    float occ = 0.;
    for (int i = 1; i <= 4; i++) {
        float h = .025 * float(i);
        occ += max(0., h - sceneMapping(p + n * h).x / STEP) / float(i);
    }
    return clamp(1. - occ * 3., .25, 1.);
}


// -----------------------------------------------------------------------------
// 11. LIGHTING + MATERIALS
// -----------------------------------------------------------------------------
// Fake studio environment: dark vertical gradient + two soft lights + one
// sharp softbox streak. Sampled with the reflection vector -> reflections.
vec3 environment(vec3 d) {
    vec3 c = mix(vec3(.001, .002, .006), vec3(.006, .020, .050), smoothstep(-.4, 1., d.y));
    c += vec3(.03, .09, .16) * pow(max(dot(d, normalize(vec3(-.5, .8, -.35))), 0.), 12.);
    c += vec3(.02, .03, .08) * pow(max(dot(d, normalize(vec3(.4, .3, .9))), 0.), 6.);
    c += SILVER * .10 * pow(max(dot(d, normalize(vec3(.6, .75, -.2))), 0.), 60.);   // softbox streak
    return c;
}

// Everything the material functions need, computed once in shade().
struct Surface {
    vec3  n;            // surface normal
    vec3  rd;           // ray direction (camera -> surface)
    vec3  H;            // half vector between key light and viewer
    float ndv;          // facing ratio: 1 = faces the camera, 0 = edge-on
    float diffuse;      // Lambert term of the key light
    float rim;          // second light from behind/side
    float fresnel;      // Schlick Fresnel, F0 = .04 (dielectric)
    float ao;           // ambient occlusion
    float spec;         // Blinn-Phong highlight (exponent 140)
    float scale;        // body scale S
    float distToCore;   // distance to the fractal's centre
    vec3  spill;        // core light falling on this point
};

// Obsidian chitin: near-black base, sharp silver highlight, thin-film blue
// sheen (like the colour on a soap bubble), grooves (striae) on the elytra.
vec3 shadeChitin(Surface s, bool isElytron, vec3 q, float inner) {
    float groove = 1.;
    if (isElytron) {
        vec3 e = q - DOME_C;
        groove = 1. - .55 * smoothstep(.80, 1., abs(sin(atan(e.x, e.y + .25) * 15.)));
    }
    vec3 base     = NAVY * 1.5;
    vec3 thinFilm = mix(ULTRA, COBALT, .5 + .5 * cos(5. * s.ndv + 1.2));   // hue shifts with view angle

    vec3 col = base * (.06 + .7 * s.diffuse) * s.ao;
    col += SILVER * s.spec * 1.6 * groove;
    col += environment(reflect(s.rd, s.n)) * mix(vec3(.06), vec3(1.), s.fresnel) * 1.8 * groove;
    col += thinFilm * (.04 + .60 * s.fresnel) * .30 * s.ao;
    col += CYAN * .05 * s.rim * s.fresnel * s.ao;

    if (inner > .5) col = mix(col, ULTRA * .20, .6) + COBALT * .25 * core;   // satin underside
    col += s.spill * (inner > .5 ? 1.6 : 1.);
    return col;
}

// Soft dorsal membrane (normally hidden under the elytra): satin, lit mostly
// by the core. Light leaks through the seam even before the shell opens.
vec3 shadeMembrane(Surface s) {
    vec3 col = ULTRA * .10 * (.2 + .8 * s.diffuse) * s.ao
             + environment(reflect(s.rd, s.n)) * s.fresnel * .6
             + SILVER * s.spec * .12;
    col += s.spill * 1.3 + mix(COBALT, CYAN, .35) * .55 * coreLight * exp(-s.distToCore * 3. / s.scale);
    return col;
}

// Fractal core: colour from the orbit trap, plus two kinds of emission.
vec3 shadeFractal(Surface s, float trap) {
    float k    = clamp(sqrt(trap), 0., 1.);   // 0 = orbit passed close to the origin
    vec3  base = mix(CYAN * .45, mix(COBALT, ULTRA, .6), k);

    vec3 col = base * (.05 + .75 * s.diffuse) * s.ao;
    col += SILVER * s.spec * .9 * s.ao;
    col += environment(reflect(s.rd, s.n)) * s.fresnel * 1.2;

    // rn: 0 at the core centre, 1 at its bounding radius.
    float rn   = s.distToCore / (s.scale * 1.75 * fractalHalfSize * max(fractalGrowth, .05));
    // Each heartbeat launches a ring of light that travels outward and fades.
    float ring = gaussian(rn, (beatPhase - .25) * 1.5, .11) * (1. - beatPhase);
    // A slower wave scrolling through the orbit-trap bands.
    float wave = pulse(k * .9 + rn * .5 - 2. * phase * speedHarmonic);

    vec3 emit = mix(CYAN, SILVER, .20) * ((.03 + .45 * wave) * (1. - .7 * k) + 1.6 * ring * (1. - .5 * k))
              + COBALT * .12;
    col += emit * glowEnvelope * uGlowIntensity * mix(.35, 1., s.ao);
    return col;
}

// Compound eyes: glossy black with a very tight highlight.
vec3 shadeEye(Surface s) {
    vec3 col = NAVY * .5
             + SILVER * pow(max(dot(s.n, s.H), 0.), 300.) * 2.
             + environment(reflect(s.rd, s.n)) * .8;
    col += CYAN * .25 * core * s.fresnel;
    return col;
}

vec3 shade(vec3 p, vec3 n, vec3 rd) {
    // WARNING (global side effects): normalAt() just called sceneMapping() at
    // 4 points NEAR p, overwriting the g* hit info. So we evaluate again at
    // p exactly, and copy what we need BEFORE ambientOcclusion() overwrites
    // it a second time.
    sceneMapping(p);
    float mat   = gMaterial;
    float trap  = gOrbitTrap;
    float inner = gInsideShell;
    vec3  q     = gLocalPos;

    vec3 L = normalize(vec3(-.5, .8, -.35));   // key light
    vec3 R = normalize(vec3(.4, .3, .9));      // rim light

    Surface s;
    s.n       = n;
    s.rd      = rd;
    s.scale   = bodyScale();
    s.H       = normalize(L - rd);
    s.ndv     = max(dot(n, -rd), 0.);
    s.diffuse = max(dot(n, L), 0.);
    s.rim     = pow(max(dot(n, R), 0.), 2.);
    s.fresnel = .04 + .96 * pow(1. - s.ndv, 5.);
    s.ao      = ambientOcclusion(p, n);
    s.spec    = pow(max(dot(n, s.H), 0.), 140.);

    // Core spill light: falls off with distance, stronger on faces turned
    // toward the core. coreLight beats with the heart.
    vec3 toCore  = (CORE_C + vec3(0., lift, 0.)) * s.scale - p;
    s.distToCore = length(toCore);
    s.spill = mix(COBALT, CYAN, .45) * coreLight * 1.6 * exp(-s.distToCore * 2.6 / s.scale)
            * (.25 + .75 * max(dot(n, toCore / s.distToCore), 0.));

    if (isMaterial(mat, MAT_BODY) || isMaterial(mat, MAT_ELYTRA))
        return shadeChitin(s, isMaterial(mat, MAT_ELYTRA), q, inner);
    if (isMaterial(mat, MAT_MEMBRANE)) return shadeMembrane(s);
    if (isMaterial(mat, MAT_FRACTAL))  return shadeFractal(s, trap);
    return shadeEye(s);
}


// -----------------------------------------------------------------------------
// 12. POST-PROCESSING HELPERS
// -----------------------------------------------------------------------------
// Hash without sine (Dave Hoskins): two pseudo-random numbers per pixel.
vec2 hash22(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

// ACES filmic tone-mapping curve (Narkowicz fit): compresses HDR values into
// 0..1 with a soft shoulder instead of hard clipping.
vec3 tonemapACES(vec3 x) {
    return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.);
}


// -----------------------------------------------------------------------------
// 13. ANIMATION RIG
//
//  STORY (8 s loop)
//    0.0-0.7  rest, breathing
//    0.7-1.5  heart kindles, body rises, seam cracks (light leaks out)
//    1.4-3.1  elytra spring open (right side leads)
//    2.1-4.0  Mandelbox untwists as it grows
//    4.0-5.0  peak: heartbeat rings of light
//    5.0-6.4  core folds back in, shell closes
//    6.9-7.4  shell settles with a small tap
//    7.4-8.0  rest
//
//  Every term is either 0 with zero slope at phase 0 and 1, or periodic with
//  a whole number of cycles per loop. Result: frame 240 == frame 0, smoothly.
// -----------------------------------------------------------------------------
void setElytron(int side, float amount, float crack) {
    float wobble = .010 * breath;                                              // shell rides the breath
    elytraRoll[side]  = rotation(.18 * amount + wobble);                       // outer edge lifts
    elytraPitch[side] = rotation(-.42 * amount - .5 * wobble - .09 * crack);   // tip lifts; crack = slit of light
    elytraYaw[side]   = rotation(-.70 * amount);                               // tip swings outward
}

void updateElytra() {
    float shell = clamp(uShellOpen, 0., 1.);
    // Right opens a bit earlier, left closes a bit earlier: asymmetry reads
    // as alive.
    float closeR = 1. - smoothstep(.70, .86, phase);
    float closeL = 1. - smoothstep(.68, .84, phase);
    // Before opening, the seam parts slightly and core light leaks through.
    float crackR = shell * bump(phase, .09, .21);
    float crackL = shell * bump(phase, .10, .22);
    // Spring open (back-ease overshoot), close, then a small settling tap.
    float openR = shell * (easeBack(smoothstep(.17, .38, phase), 1.3) * closeR + .05 * bump(phase, .86, .93));
    float openL = shell * (easeBack(smoothstep(.20, .41, phase), 1.3) * closeL + .05 * bump(phase, .85, .92));
    setElytron(0, openR, crackR);
    setElytron(1, openL, crackL);
}

void updateFractal(float growIn, float growOut, float unfold) {
    // Growth with a soft overshoot; each heartbeat swells the crystal ~3 %.
    fractalGrowth = 1.06 * easeBack(growIn, .9) * smoothstep(0., 1., growOut) * unfold
                  * (1. + .02 * breath + .03 * beat * core);

    // Scale breathes a little. |s| < 1.2 makes the Mandelbox collapse, so clamp it.
    fractalScale = clamp(uFractalScale, -3., 3.)
                 + .10 * core * sin(2. * theta * speedHarmonic)
                 - .05 * beat * core;
    if (abs(fractalScale) < 1.2) fractalScale = fractalScale < 0. ? -1.2 : 1.2;

    // Unfolding: the fold planes start twisted and relax into the crystal.
    fractalTwist = rotation((1. - core) * .85 + .05 * sin(2. * theta * speedHarmonic));

    fractalHalfSize = .36;
    fractalZoom     = 2. / fractalHalfSize;   // maps the |z| <= 2 cube onto fractalHalfSize

    // Diamond pose: 45 deg about z, then 35.26 deg about x, stands the cube on
    // a corner (body diagonal pointing up). Plus a slow half-turn spin per loop;
    // the core is hidden at the wrap, so the spin never pops.
    fractalOrient = rotX3(.6155) * rotZ3(.7854) * rotY3(.5 * theta * speedHarmonic + .6 * (1. - core));

    fractalIterations = int(mix(6., 12., clamp(uFractalDetail, 0., 1.)) + .5);
}

void updateBodyPose() {
    float lm = clamp(uLegMotion, 0., 2.);
    // "alert": 0 at rest, 1 while the beetle is awake.
    float alert = envelope(phase, .08, .26, .76, .94);
    lift = .045 * alert * lm + .006 * breath;                          // body rises
    nod  = .14 * alert * lm + .02 * sin(2. * theta * speedHarmonic + .8);   // head lifts

    // Right-side legs only; sceneMapping() mirrors them to the left.
    for (int i = 0; i < PAIRS; i++) {
        float fi = float(i);   // 0 = front, 1 = middle, 2 = rear
        // Small twitch, phase-shifted per leg so they don't move in unison.
        float tw = lm * .012 * sin(2. * theta * speedHarmonic + fi * 2.1);

        vec3 coxa     = vec3(.20 + .03 * fi, -.10 + lift,                     -.42 + .42 * fi);
        vec3 knee     = vec3(.66 + .04 * fi, -.03 + .01 * breath + .55 * lift, -.66 + .62 * fi + .08 * fi * fi);
        vec3 tibiaEnd = vec3(.84 + .06 * fi, -.24,                            -.98 + .70 * fi + .08 * fi * fi);
        vec3 tip      = tibiaEnd + vec3(.06 + .04 * fi, -.04, -.18 + .20 * fi);

        // Fore-legs rise slightly while the beetle is alert.
        if (i == 0) {
            tibiaEnd.y += .07 * alert * lm;
            tip.y      += .10 * alert * lm;
            tip.z      -= .03 * alert * lm;
        }
        legCoxa[i]     = coxa;
        legKnee[i]     = knee     + vec3(0., tw, 0.);
        legTibiaEnd[i] = tibiaEnd + vec3(tw, 0., 0.);
        legTip[i]      = tip      + vec3(tw, tw * .5, 0.);
    }

    // Digging teeth point sideways from the fore-tibia, always outward.
    tibiaToothDir = normalize(cross(legTibiaEnd[0] - legKnee[0], vec3(0., 1., 0.)));
    if (tibiaToothDir.x < 0.) tibiaToothDir = -tibiaToothDir;
}

void updateAnimation(float seconds) {
    phase = fract(seconds / LOOP_SECONDS);
#ifdef DEBUG_T
    phase = DEBUG_T;
#endif
    theta         = TAU * phase;
    speedHarmonic = harmonic(uAnimationSpeed);

    breath = clamp(uBreathing, 0., 2.) * sin(2. * theta * speedHarmonic);   // 2 breaths per loop

    // Heart: active window + 4 beats per loop.
    float heart = envelope(phase, .07, .20, .80, .95);
    beatPhase   = fract(4. * phase * speedHarmonic);
    beat        = heartbeat(4. * phase * speedHarmonic);

    updateElytra();

    // Core reveal.
    float growIn  = smoothstep(.26, .50, phase);
    float growOut = 1. - smoothstep(.62, .80, phase);
    float unfold  = clamp(uFractalUnfold, 0., 1.);
    core          = growIn * growOut * unfold;
    glowEnvelope  = max(envelope(phase, .30, .50, .64, .84), .9 * smoothstep(0., .25, core));
    coreLight     = heart * (.30 + .70 * beat) * (.60 + .40 * core) * (.75 + .25 * glowEnvelope);

    updateFractal(growIn, growOut, unfold);
    updateBodyPose();
}


// -----------------------------------------------------------------------------
// 14. CAMERA
//    Elevated three-quarter view from behind; the head points up the screen.
//    During the reveal ("tour") the camera arcs right -> left over the open
//    shell, rises and pushes in toward the core.
// -----------------------------------------------------------------------------
void buildCamera(vec2 uv, float aspect, float S, out vec3 ro, out vec3 rd, out vec3 target) {
    float tour = envelope(phase, .10, .52, .60, .96) * clamp(uCameraTour, 0., 1.);
    target = mix(vec3(0., 0., .14), vec3(0., .08, .26), tour) * S;

    // Spherical coordinates (azimuth, elevation) -> direction from target to eye.
    float az  = radians(24. - 30. * tour + clamp(uCameraOrbit, 0., 12.) * sin(theta));
    float elv = radians(48. + 16. * tour + 1.5 * sin(theta));
    vec3 eyeDir = vec3(sin(az) * cos(elv), sin(elv), cos(az) * cos(elv));

    // Camera basis: forward, right, up. The reference "up" is -z (toward the
    // head), which is what makes the head read as screen-up.
    vec3 fw = -eyeDir;
    vec3 rt = normalize(cross(fw, vec3(0., 0., -1.)));
    vec3 up = cross(rt, fw);

    // A few degrees of roll (Dutch angle) for a more dynamic frame.
    float roll = radians(-6. + 1.5 * sin(theta));
    vec3  rt0  = rt;
    rt = cos(roll) * rt0 + sin(roll) * up;
    up = -sin(roll) * rt0 + cos(roll) * up;

    // 30 deg vertical field of view. Choose the distance so the creature
    // (radius ~1.95 tall, ~1.62 wide) fits both vertically and horizontally.
    float tanH = tan(radians(30.) * .5);
    float D = max(1.95 / tanH, 1.62 / (tanH * aspect)) * S * max(uCameraDistance, .6) * (1. - .12 * tour);

    ro = target + eyeDir * D;
    rd = normalize(fw + (uv.x * rt + uv.y * up) * tanH);
}


// -----------------------------------------------------------------------------
// 15. RAYMARCHING (sphere tracing)
//    The SDF guarantees "nothing is closer than d", so we can safely jump d
//    forward. Near a surface d shrinks -> smaller steps -> stop below eps.
//    We march only inside a bounding sphere around the creature, so rays that
//    miss it cost almost nothing.
// -----------------------------------------------------------------------------
bool raymarch(vec3 ro, vec3 rd, vec3 center, float radius, out float t, out float minFractal) {
    t = 0.;
    minFractal = 1e3;

    // Ray-sphere intersection: solve |ro + t*rd - center| = radius.
    vec3  oc = ro - center;
    float b  = dot(oc, rd);
    float h  = b * b - dot(oc, oc) + radius * radius;
    if (h < 0.) return false;               // ray misses the bounding sphere

    t = max(0., -b - sqrt(h));              // entry point
    float tExit = -b + sqrt(h);             // exit point

    for (int i = 0; i < MAX_STEPS; i++) {
        float d   = sceneMapping(ro + rd * t).x;
        float eps = max(.0004, t * .00022);              // tolerance grows with distance (~pixel size)
        minFractal = min(minFractal, gFractalDist);      // closest pass near the core -> halo
        if (d < eps) return true;
        t += max(d, eps * .6);                           // minimum step avoids stalling
        if (t > tExit) break;
    }
    return false;
}


// -----------------------------------------------------------------------------
// 16. MAIN
// -----------------------------------------------------------------------------
void main() {
    // A missing or broken clock falls back to frame 0 instead of NaN pixels.
    float seconds = uTimeSeconds;
    if (isnan(seconds) || isinf(seconds)) seconds = 0.;

    // 1. Animation ------------------------------------------------------------
    updateAnimation(seconds);

    // 2. Camera ---------------------------------------------------------------
    vec2  res    = uTDOutputInfo.res.zw;   // TD: res = (1/w, 1/h, w, h)
    float aspect = res.x / max(res.y, 1.);
    float S      = bodyScale();
    // Portrait output: nudge the subject up-left, away from the Reels action
    // buttons (right) and caption (bottom).
    vec2 placement = aspect < .8 ? vec2(-.02, .04) : vec2(0.);
    vec2 uv = (vUV.st - .5 - placement) * vec2(aspect, 1.) * 2.;   // y: -1..1, x scaled by aspect

    vec3 ro, rd, target;
    buildCamera(uv, aspect, S, ro, rd, target);

    // 3. Raymarch -------------------------------------------------------------
    float t, minFractal;
    bool hit = raymarch(ro, rd, target, 1.95 * S, t, minFractal);

#ifdef DEBUG_MASK
    fragColor = TDOutputSwizzle(vec4(vec3(hit ? 1. : 0.), 1.));
    return;
#endif

    // 4. Shade ----------------------------------------------------------------
    vec3 bg = mix(NAVY * .25, NAVY * 1.15, smoothstep(-1.2, 1.2, uv.y));   // vertical gradient
    bg += COBALT * .018 * exp(-dot(uv, uv) * 1.4);                         // faint centre glow
    vec3 col = bg * uBackground;

    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = normalAt(p, max(.0008, t * .0002));
        col = shade(p, n, rd);
    } else {
        // Rays that passed close to the core pick up a soft halo.
        col += mix(CYAN, COBALT, .4) * exp(-max(minFractal, 0.) * 24. / S)
             * .14 * glowEnvelope * (.6 + .6 * beat) * uBloomStrength;
    }

    // 5. Post-processing ------------------------------------------------------
    col *= 1. - .25 * smoothstep(.7, 1.7, length(uv * vec2(1., .75)));   // vignette
    col  = tonemapACES(max(col, 0.) * max(uExposure, 0.));
    col  = pow(col, vec3(1. / 2.2));                                      // linear -> display gamma
    vec2 dh = hash22(gl_FragCoord.xy);
    col += (dh.x + dh.y - 1.) / 255.;   // triangular dither: removes banding in dark gradients
    fragColor = TDOutputSwizzle(vec4(col, 1.));
}
