uniform float uTime;
uniform vec2  uRes;      // TD resolution — e.g. 1920  1080
uniform float uSpeed;    // animation speed       [0.3–2.0]  default 1.0
uniform float uGlow;     // glow / emission       [0.0–1.5]  default 0.8
uniform float uPulse;    // music pulse energy    [0.0–1.0]  default 0.5
uniform float uFog;      // depth fog density     [0.0–1.0]  default 0.35
out vec4 fragColor;

// ── Hatsune Miku palette ─────────────────────────────────────────────────
#define C_MIKU    vec3(0.224, 0.773, 0.733)   // #39C5BB  iconic teal
#define C_MIKU_D  vec3(0.090, 0.320, 0.320)   // deep teal shadow
#define C_MIKU_L  vec3(0.400, 0.920, 0.880)   // light teal highlight
#define C_PINK    vec3(0.953, 0.361, 0.529)   // #F35C87  accent pink
#define C_CYAN    vec3(0.500, 0.960, 1.000)   // electric cyan
#define C_VOID    vec3(0.012, 0.020, 0.045)   // deep void background
#define C_WHITE   vec3(0.930, 0.965, 0.975)   // near-white highlight
#define C_PURPLE  vec3(0.420, 0.260, 0.650)   // purple accent
#define C_GRID    vec3(0.045, 0.160, 0.165)   // cyber grid line color
#define C_SAKURA  vec3(1.000, 0.760, 0.810)   // soft sakura pink
#define C_HAIR    vec3(0.160, 0.560, 0.540)   // darker hair teal

// ── utility ──────────────────────────────────────────────────────────────
mat2 rot2(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}
float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise3(vec3 p) {
    vec3 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
    return mix(
        mix(mix(hash31(i),              hash31(i+vec3(1,0,0)), u.x),
            mix(hash31(i+vec3(0,1,0)),  hash31(i+vec3(1,1,0)), u.x), u.y),
        mix(mix(hash31(i+vec3(0,0,1)),  hash31(i+vec3(1,0,1)), u.x),
            mix(hash31(i+vec3(0,1,1)),  hash31(i+vec3(1,1,1)), u.x), u.y),
        u.z);
}
const mat3 M3 = mat3( 0.00, 0.80, 0.60,
                     -0.80, 0.36,-0.48,
                     -0.60,-0.48, 0.64);
float fbm3(vec3 p) {
    float v=0., a=.5;
    for(int i=0;i<4;i++){ v+=a*noise3(p); p=M3*p*2.+.5; a*=.5; }
    return v;
}

// ── smooth min — organic SDF blending ────────────────────────────────────
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// ── 3D signed distance functions ─────────────────────────────────────────
float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735027;
}
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}

// ── centerpiece — the heart of the Miku tribute ─────────────────────────
// TODO(human): Design the central 3D sculpture using SDF primitives.
//
// Available SDFs:
//   sdSphere(p, radius)
//   sdBox(p, vec3(halfX, halfY, halfZ))
//   sdOctahedron(p, size)
//   sdTorus(p, vec2(majorR, minorR))
//   sdCapsule(p, pointA, pointB, radius)
//
// Combining SDFs:
//   min(a, b)       — union (join shapes)
//   max(a, b)       — intersection (keep overlap)
//   max(a, -b)      — subtraction (carve b from a)
//   smin(a, b, k)   — smooth blend (k=smoothness, try 0.1–0.5)
//
// Use rot2() on p.xz or p.xy to rotate, and (p - offset) to translate.
// T is the current time — use it for animation.
//
// Example ideas:
//   - A torus with an octahedron core (digital crown)
//   - A sphere with box-shaped cuts (cyber crystal)
//   - Multiple blended spheres orbiting (musical energy)
//

float centerpiece(vec3 p, float T) {
    // ── voice ring — tilts gently like a spinning record ─────────
    vec3 rp = p;
    rp.xy *= rot2(sin(T * 0.3) * 0.25);         // gentle tilt
    rp.xz *= rot2(T * 0.4);                      // slow spin
    float ring = sdTorus(rp, vec2(0.5, 0.12));

    // ── crystal core — spins faster, pulses with energy ──────────
    vec3 cp = p;
    cp.xz *= rot2(T * 1.2);                      // fast spin on Y axis
    cp.xy *= rot2(T * 0.7);                       // tumble on Z axis
    float pulse = 0.35 + sin(T * 2.5) * 0.05;    // breathing size
    float core = sdOctahedron(cp, pulse);

    // ── hollow out the crystal — carve a sphere from inside ──────
    float hollow = sdSphere(p, 0.22);             // inner void
    core = max(core, -hollow);                     // subtraction!

    // ── inner spark — tiny spinning sphere visible through gaps ──
    vec3 sp = p;
    sp.xz *= rot2(T * 3.0);                       // fast spin
    float spark = sdOctahedron(sp, 0.1 + sin(T * 4.0) * 0.03);
    core = min(core, spark);                       // add inside the hollow

    // ── second ring — perpendicular, like an atom orbit ──────────
    vec3 rp2 = p;
    rp2.yz *= rot2(1.57);                         // flip 90° (vertical)
    rp2.xz *= rot2(T * -0.3);                     // counter-rotate
    float ring2 = sdTorus(rp2, vec2(0.55, 0.06)); // thinner outer ring

    // ── third ring — diagonal, completing the gyroscope ──────────
    vec3 rp3 = p;
    rp3.xy *= rot2(0.78);                          // 45° tilt
    rp3.yz *= rot2(0.78);                          // diagonal plane
    rp3.xz *= rot2(T * 0.5);                      // slow spin
    float ring3 = sdTorus(rp3, vec2(0.48, 0.04)); // thinnest ring

    // ── combine everything ───────────────────────────────────────
    float d = smin(ring, core, 0.18);              // melt ring + crystal
    d = smin(d, ring2, 0.08);                      // atom orbit ring
    d = smin(d, ring3, 0.06);                      // diagonal ring

    return d;
}

// ── material ID helper ───────────────────────────────────────────────────
#define MAT_FLOOR   0
#define MAT_CENTER  1
#define MAT_ORB_L   2   // large orbiter (×3)
#define MAT_ORB_S   3   // small orbiter (×9)
#define MAT_RIBBON  4

// ── scene SDF + material ─────────────────────────────────────────────────
vec2 sceneSDF(vec3 p, float T) {
    // returns vec2(distance, materialID)
    float d = 1e9;
    float mat = -1.0;

    // ── centerpiece ──────────────────────────────────────────────────────
    float cp = centerpiece(p, T);
    if (cp < d) { d = cp; mat = float(MAT_CENTER); }

    // ── 3 large orbiting octahedron crystals — the "3" in 39 ─────────────
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float ang = fi / 3.0 * 6.2831 + T * 0.35;
        float orbitR = 2.2 + sin(T * 0.25 + fi * 2.09) * 0.25;
        float bobY = sin(T * 0.55 + fi * 2.09) * 0.5;
        vec3 op = p - vec3(cos(ang) * orbitR, bobY, sin(ang) * orbitR);
        op.xz *= rot2(T * 0.6 + fi * 2.09);
        op.xy *= rot2(T * 0.4 + fi);
        float pulse = 1.0 + sin(T * 2.5 + fi * 2.09) * uPulse * 0.15;
        float shape = sdOctahedron(op, 0.32 * pulse);
        if (shape < d) { d = shape; mat = float(MAT_ORB_L); }
    }

    // ── 9 small orbiting cubes — the "9" in 39 ──────────────────────────
    for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float ang = fi / 9.0 * 6.2831 + T * 0.55 + 0.35;
        float orbitR = 3.6 + sin(T * 0.35 + fi * 0.7) * 0.4;
        float bobY = sin(T * 0.7 + fi * 0.7) * 0.7 + cos(T * 0.3 + fi) * 0.2;
        vec3 op = p - vec3(cos(ang) * orbitR, bobY, sin(ang) * orbitR);
        op.xz *= rot2(T * 1.2 + fi);
        op.xy *= rot2(T * 0.9 + fi * 0.7);
        float shape = sdBox(op, vec3(0.11 + 0.03 * sin(T + fi)));
        if (shape < d) { d = shape; mat = float(MAT_ORB_S); }
    }

    // ── twin-tail ribbons — torus arcs sweeping behind center ────────────
    for (int s = 0; s < 2; s++) {
        float side = float(s) * 2.0 - 1.0;
        vec3 rp = p - vec3(side * 0.4, 0.6, -0.2);
        rp.xz *= rot2(side * 0.5 + T * 0.2);
        rp.xy *= rot2(side * 0.3);
        float ribbon = sdTorus(rp, vec2(1.2 + sin(T * 0.4) * 0.15, 0.045));
        // cut to arc (only keep back half + flowing tail)
        float cut = -rp.z - 0.2 * sin(rp.x * 2.0 + T);
        ribbon = max(ribbon, cut);
        if (ribbon < d) { d = ribbon; mat = float(MAT_RIBBON); }
    }

    // ── ground plane ─────────────────────────────────────────────────────
    float floor_ = p.y + 2.0;
    if (floor_ < d) { d = floor_; mat = float(MAT_FLOOR); }

    return vec2(d, mat);
}

// ── normal via central differences ───────────────────────────────────────
vec3 calcNormal(vec3 p, float T) {
    vec2 e = vec2(0.0008, 0.0);
    return normalize(vec3(
        sceneSDF(p + e.xyy, T).x - sceneSDF(p - e.xyy, T).x,
        sceneSDF(p + e.yxy, T).x - sceneSDF(p - e.yxy, T).x,
        sceneSDF(p + e.yyx, T).x - sceneSDF(p - e.yyx, T).x
    ));
}

// ── soft shadow ray ──────────────────────────────────────────────────────
float softShadow(vec3 ro, vec3 rd, float tMin, float tMax, float k, float T) {
    float res = 1.0, t = tMin;
    for (int i = 0; i < 32; i++) {
        float d = sceneSDF(ro + rd * t, T).x;
        if (d < 0.001) return 0.0;
        res = min(res, k * d / t);
        t += clamp(d, 0.02, 0.2);
        if (t > tMax) break;
    }
    return clamp(res, 0.0, 1.0);
}

// ── ambient occlusion ────────────────────────────────────────────────────
float calcAO(vec3 p, vec3 n, float T) {
    float ao = 0.0, s = 1.0;
    for (int i = 1; i <= 5; i++) {
        float d = 0.04 * float(i);
        ao += s * (d - sceneSDF(p + n * d, T).x);
        s *= 0.5;
    }
    return clamp(1.0 - ao * 3.0, 0.0, 1.0);
}

// ── digital particles — 2D overlay ───────────────────────────────────────
float digiParticles(vec2 uv, float T) {
    float p = 0.0;
    for (int i = 0; i < 25; i++) {
        float fi = float(i);
        float spd = 0.025 + hash21(vec2(fi, 30.0)) * 0.045;
        vec2 pos = vec2(
            hash21(vec2(fi, 31.0)) + sin(T * 0.25 + fi * 1.7) * 0.015,
            fract(T * spd + hash21(vec2(fi, 32.0)))
        );
        float r = 0.0015 + hash21(vec2(fi, 33.0)) * 0.003;
        float blink = 0.5 + 0.5 * sin(T * 2.8 + fi * 2.1);
        p += smoothstep(r * 4.0, 0.0, length(uv - pos)) * blink;
    }
    return p;
}

// ── main ─────────────────────────────────────────────────────────────────
void main() {
    vec2  uv     = vUV.st;
    float asp    = uRes.x / uRes.y;
    vec2  screen = (uv - 0.5) * vec2(asp, 1.0);
    float T      = uTime * uSpeed * 0.38;

    // ── camera — slow orbit ──────────────────────────────────────────────
    float camAng = T * 0.12;
    float camR   = 6.5 + sin(T * 0.15) * 0.8;
    float camH   = 2.2 + sin(T * 0.18) * 0.6;
    vec3  ro     = vec3(cos(camAng) * camR, camH, sin(camAng) * camR);
    vec3  ta     = vec3(0.0, 0.15 + sin(T * 0.1) * 0.15, 0.0);
    vec3  fwd    = normalize(ta - ro);
    vec3  right  = normalize(cross(fwd, vec3(0, 1, 0)));
    vec3  up     = cross(right, fwd);
    vec3  rd     = normalize(screen.x * right + screen.y * up + 1.6 * fwd);

    // ── raymarch ─────────────────────────────────────────────────────────
    float t   = 0.0;
    vec3  col = C_VOID;
    int   mat = -1;
    vec3  hitP;
    bool  hit = false;

    for (int i = 0; i < 120; i++) {
        hitP = ro + rd * t;
        vec2 res = sceneSDF(hitP, T);
        if (res.x < 0.0008) { hit = true; mat = int(res.y); break; }
        if (t > 60.0) break;
        t += res.x * 0.85;  // slight under-step for stability
    }

    // ── light setup ──────────────────────────────────────────────────────
    vec3 lDir  = normalize(vec3(0.5, 0.95, 0.35));
    vec3 lDir2 = normalize(vec3(-0.6, 0.3, -0.5));

    if (hit) {
        vec3 n = calcNormal(hitP, T);
        float ao = calcAO(hitP, n, T);
        float sha = softShadow(hitP + n * 0.005, lDir, 0.02, 15.0, 12.0, T);

        // common lighting
        float diff  = max(dot(n, lDir), 0.0);
        float diff2 = max(dot(n, lDir2), 0.0) * 0.25;  // fill light
        float spec  = pow(max(dot(reflect(-lDir, n), -rd), 0.0), 48.0);
        float fres  = pow(1.0 - max(dot(n, -rd), 0.0), 3.5);

        if (mat == MAT_FLOOR) {
            // ── cyber grid floor ─────────────────────────────────────────
            vec2 gp = hitP.xz;
            // major grid (every 1 unit)
            vec2 gMaj = abs(fract(gp) - 0.5);
            float lineMaj = smoothstep(0.015, 0.0, min(gMaj.x, gMaj.y));
            // minor grid (every 0.25 units)
            vec2 gMin = abs(fract(gp * 4.0) - 0.5);
            float lineMin = smoothstep(0.04, 0.0, min(gMin.x, gMin.y)) * 0.25;
            float line = max(lineMaj, lineMin);

            col = mix(C_VOID * 1.2, C_GRID, line);
            col += C_MIKU * lineMaj * 0.35;
            // pulse wave on grid
            float dist = length(hitP.xz);
            float wave = smoothstep(0.15, 0.0, abs(fract(dist * 0.3 - T * 0.25) - 0.5)) * 0.4;
            col += C_MIKU * wave * lineMaj;
            col += C_PINK * wave * lineMin * 0.5;
            // floor reflective hint
            col += C_MIKU_D * fres * 0.15;
            // distance fade
            col *= exp(-dist * 0.04);
            col *= ao;

        } else if (mat == MAT_CENTER) {
            // ── centerpiece material — holographic teal ──────────────────
            vec3 matC = C_MIKU;
            // iridescent shift based on view angle
            float iri = dot(n, rd) * 0.5 + 0.5;
            matC = mix(matC, C_PINK, pow(iri, 3.0) * 0.35);
            matC = mix(matC, C_CYAN, pow(1.0 - iri, 4.0) * 0.3);

            col = matC * (0.12 + diff * 0.65 * sha) + matC * diff2;
            col += C_WHITE * spec * sha * 1.2;
            col += C_MIKU_L * fres * 0.6;
            // inner glow / emission
            col += C_MIKU * uGlow * 0.35;
            col += C_CYAN * uGlow * 0.08;
            // pulsing energy
            float ep = sin(T * 3.0) * 0.5 + 0.5;
            col += C_MIKU_L * ep * uPulse * 0.2;
            col *= ao;

        } else if (mat == MAT_ORB_L) {
            // ── large orbiting crystals — shifting teal/purple ───────────
            float hueShift = hash31(floor(hitP * 2.0 + 0.5));
            vec3 matC = mix(C_MIKU, C_PURPLE, hueShift * 0.55);
            col = matC * (0.10 + diff * 0.60 * sha) + matC * diff2;
            col += C_WHITE * spec * sha * 0.9;
            col += matC * fres * 0.45;
            col += matC * uGlow * 0.2;
            // crystal facet sparkle
            float sparkle = pow(abs(sin(dot(n, vec3(17.3, 31.7, 7.1)) * 40.0)), 16.0);
            col += C_WHITE * sparkle * 0.5;
            col *= ao;

        } else if (mat == MAT_ORB_S) {
            // ── small orbiting cubes — electric cyan ─────────────────────
            vec3 matC = mix(C_CYAN, C_MIKU_L, 0.4);
            col = matC * (0.08 + diff * 0.55 * sha) + matC * diff2;
            col += C_WHITE * spec * sha * 0.7;
            col += matC * fres * 0.35;
            col += matC * uGlow * 0.15;
            col *= ao;

        } else if (mat == MAT_RIBBON) {
            // ── twin-tail ribbons — glowing teal with pink edge ──────────
            vec3 matC = C_HAIR;
            col = matC * (0.15 + diff * 0.5 * sha);
            col += C_WHITE * spec * sha * 0.6;
            col += C_MIKU * fres * 0.7;
            // strong edge glow (like hair catching backlight)
            col += C_MIKU_L * pow(fres, 2.0) * 1.2;
            col += C_PINK * pow(fres, 4.0) * 0.4;
            col += matC * uGlow * 0.3;
            col *= ao;
        }

        // ── depth fog — teal-tinted ──────────────────────────────────────
        vec3 fogCol = C_VOID + C_MIKU_D * 0.08;
        col = mix(col, fogCol, 1.0 - exp(-t * uFog * 0.055));

    } else {
        // ── background void — subtle radial gradient ─────────────────────
        col = C_VOID;
        float bg = smoothstep(0.9, 0.0, length(screen));
        col += C_MIKU_D * bg * 0.12;
        col += C_PURPLE * 0.02 * smoothstep(0.0, -0.3, rd.y);
        // distant star field
        float stars = pow(hash21(floor(screen * 180.0)), 22.0);
        col += C_WHITE * stars * 0.6;
        col += C_MIKU_L * stars * 0.2;
    }

    // ── 2D overlays ──────────────────────────────────────────────────────
    // digital particles
    float parts = digiParticles(uv, T);
    col += mix(C_MIKU, C_CYAN, hash21(uv * 99.0)) * parts * 0.45;

    // sound wave rings (screen-space)
    float ringD = length(screen);
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float r = fract(T * 0.18 + fi * 0.33) * 0.8;
        float fade = pow(1.0 - fract(T * 0.18 + fi * 0.33), 2.0);
        float ring = smoothstep(0.006, 0.0, abs(ringD - r));
        col += C_MIKU * ring * fade * 0.25 * uPulse;
    }

    // ── scanline / holographic noise ─────────────────────────────────────
    float scan = sin(uv.y * uRes.y * 0.5 + T * 8.0) * 0.015;
    col += scan * C_MIKU * 0.15;
    // subtle color aberration (digital artifact)
    col.r += (hash21(uv + T) - 0.5) * 0.008;
    col.b += (hash21(uv + T + 1.0) - 0.5) * 0.008;

    // ── vignette — teal-purple corners ───────────────────────────────────
    float vig = dot(uv - 0.5, uv - 0.5);
    col *= 1.0 - vig * 1.6;
    col += C_MIKU_D * vig * vig * 0.6;

    // ── bloom ────────────────────────────────────────────────────────────
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += C_MIKU * max(0.0, lum - 0.45) * 0.55;
    col += C_WHITE * max(0.0, lum - 0.78) * 0.40;
    col += C_PINK  * max(0.0, lum - 0.65) * 0.12;

    // ── Reinhard tone map + gamma ────────────────────────────────────────
    col = col / (col + 0.32) * 1.22;
    col = pow(max(col, 0.0), vec3(0.86));

    fragColor = vec4(col, 1.0);
}
