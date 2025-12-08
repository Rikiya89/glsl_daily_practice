out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// Theme color palette - deep purples to teals
const vec3 COL0 = vec3(0.212, 0.176, 0.471); // #362d78
const vec3 COL1 = vec3(0.322, 0.247, 0.639); // #523fa3
const vec3 COL2 = vec3(0.569, 0.424, 0.800); // #916ccc
const vec3 COL3 = vec3(0.741, 0.631, 0.898); // #bda1e5
const vec3 COL4 = vec3(0.784, 0.753, 0.914); // #c8c0e9
const vec3 COL5 = vec3(0.518, 0.729, 0.906); // #84bae7
const vec3 COL6 = vec3(0.318, 0.416, 0.831); // #516ad4
const vec3 COL7 = vec3(0.200, 0.247, 0.529); // #333f87
const vec3 COL8 = vec3(0.161, 0.188, 0.224); // #293039
const vec3 COL9 = vec3(0.157, 0.212, 0.192); // #283631

#define PI 3.14159265359
#define TAU 6.28318530718

// Rotation matrices
mat2 rot2D(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

mat3 rotateX(float a) {
    float s = sin(a), c = cos(a);
    return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

mat3 rotateY(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

// Smooth operators
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
    return -smin(-a, -b, k);
}

// Noise functions
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p *= 2.02;
    f += 0.2500 * noise(p); p *= 2.03;
    f += 0.1250 * noise(p); p *= 2.01;
    f += 0.0625 * noise(p);
    return f / 0.9375;
}

// SDF primitives
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdCappedTorus(vec3 p, vec2 sc, float ra, float rb) {
    p.x = abs(p.x);
    float k = (sc.y * p.x > sc.x * p.y) ? dot(p.xy, sc) : length(p.xy);
    return sqrt(dot(p, p) + ra * ra - 2.0 * ra * k) - rb;
}

float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    float m = p.x + p.y + p.z - s;
    vec3 q;
    if(3.0 * p.x < m) q = p.xyz;
    else if(3.0 * p.y < m) q = p.yzx;
    else if(3.0 * p.z < m) q = p.zxy;
    else return m * 0.57735027;
    float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
    return length(vec3(q.x, q.y - s + k, q.z - k));
}

float sdGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    return (abs(dot(sin(p), cos(p.zxy))) - thickness) / scale;
}

float sdMenger(vec3 p, int iterations) {
    float d = sdBox(p, vec3(1.0));
    float s = 1.0;
    for(int i = 0; i < 4; i++) {
        if(i >= iterations) break;
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;
        vec3 r = abs(1.0 - 3.0 * abs(a));
        float c = (min(max(r.x, r.y), min(max(r.y, r.z), max(r.z, r.x))) - 1.0) / s;
        d = max(d, c);
    }
    return d;
}

// Kaleidoscopic fold
vec3 kaleido(vec3 p, float n) {
    float angle = PI / n;
    for(int i = 0; i < 6; i++) {
        p.xy = abs(p.xy);
        p.xy *= rot2D(angle);
    }
    return p;
}

// Global material ID for coloring
float gMatId = 0.0;

// Scene definition
float map(vec3 p) {
    float t = u_time * 0.4;

    // Rotation animation
    mat3 rot = rotateY(t * 0.3) * rotateX(t * 0.2);

    // Central crystalline structure
    vec3 p1 = rot * p;

    // Morphing between shapes
    float morph = sin(t * 0.5) * 0.5 + 0.5;
    float octa = sdOctahedron(p1, 1.2);

    // Add gyroid surface detail
    float gyroid = sdGyroid(p1 + vec3(t * 0.1), 4.0, 0.03);
    float crystal = smax(octa, -gyroid, 0.1);

    // Inner glowing core
    float core = sdSphere(p1, 0.5 + 0.1 * sin(t * 2.0));
    core = smin(core, sdOctahedron(p1, 0.7), 0.2);

    // Orbiting ring system
    vec3 p2 = p;
    p2.xy *= rot2D(t * 0.5);
    float ring1 = sdTorus(p2, vec2(2.0, 0.08));

    vec3 p3 = p;
    p3.xz *= rot2D(t * 0.4);
    p3.yz *= rot2D(PI * 0.25);
    float ring2 = sdTorus(p3, vec2(2.2, 0.06));

    vec3 p4 = p;
    p4.yz *= rot2D(t * 0.3);
    p4.xy *= rot2D(PI * 0.35);
    float ring3 = sdTorus(p4, vec2(2.4, 0.05));

    // Capped torus arcs
    vec3 p5 = p;
    p5.xz *= rot2D(t * 0.6);
    float arc1 = sdCappedTorus(p5.xzy, vec2(sin(1.0), cos(1.0)), 1.8, 0.1);

    vec3 p6 = p;
    p6.xy *= rot2D(t * 0.5 + PI);
    float arc2 = sdCappedTorus(p6.yxz, vec2(sin(1.2), cos(1.2)), 1.9, 0.08);

    // Floating particles
    float particles = 1e10;
    for(int i = 0; i < 8; i++) {
        float fi = float(i);
        float angle = fi * TAU / 8.0 + t * 0.3;
        float radius = 2.8 + sin(fi * 2.3 + t) * 0.5;
        float height = sin(fi * 1.7 + t * 0.8) * 1.5;
        vec3 orbPos = vec3(cos(angle) * radius, height, sin(angle) * radius);
        float size = 0.08 + 0.04 * sin(fi * 3.1 + t * 2.0);
        particles = min(particles, sdSphere(p - orbPos, size));
    }

    // DNA helix structure
    float helix = 1e10;
    for(int i = 0; i < 12; i++) {
        float fi = float(i);
        float helixT = fi / 12.0 * TAU + t * 0.5;
        vec3 hp1 = vec3(cos(helixT) * 0.4, fi * 0.25 - 1.5, sin(helixT) * 0.4);
        vec3 hp2 = vec3(cos(helixT + PI) * 0.4, fi * 0.25 - 1.5, sin(helixT + PI) * 0.4);
        helix = min(helix, sdSphere(p - hp1, 0.06));
        helix = min(helix, sdSphere(p - hp2, 0.06));
    }
    vec3 helixP = p;
    helixP.xz *= rot2D(t * 0.3);
    helix = min(helix, sdTorus(vec3(helixP.x, mod(helixP.y + t * 0.5, 0.5) - 0.25, helixP.z), vec2(0.4, 0.02)));

    // Combine with material IDs
    float d = crystal;
    gMatId = 0.0;

    if(core < d) { d = core; gMatId = 1.0; }

    float rings = min(ring1, min(ring2, ring3));
    if(rings < d) { d = smin(d, rings, 0.1); gMatId = 2.0; }

    float arcs = min(arc1, arc2);
    d = smin(d, arcs, 0.15);

    if(particles < d) { d = particles; gMatId = 3.0; }

    d = smin(d, helix * 0.8, 0.2);

    // Add subtle noise displacement
    d += fbm(p * 3.0 + t * 0.2) * 0.02;

    return d * 0.8;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0005, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        float d = map(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 48; i++) {
        float h = map(ro + rd * t);
        res = min(res, k * max(h, 0.0) / t);
        t += clamp(h, 0.01, 0.15);
        if(res < 0.001 || t > maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}

// Subsurface scattering approximation
float subsurface(vec3 p, vec3 n, vec3 l, float thickness) {
    vec3 scatterDir = normalize(l + n * 0.5);
    float scatter = pow(clamp(dot(-scatterDir, n), 0.0, 1.0), 2.0);
    float backLight = pow(clamp(dot(l, -n), 0.0, 1.0), 3.0);
    return (scatter + backLight) * thickness;
}

// Iridescence
vec3 iridescence(float angle, float thickness) {
    float phase = TAU * thickness * cos(angle);
    return vec3(
        cos(phase),
        cos(phase + TAU / 3.0),
        cos(phase + 2.0 * TAU / 3.0)
    ) * 0.5 + 0.5;
}

// Color palette with smooth interpolation
vec3 getColor(float t, float variation) {
    t = fract(t + variation * 0.1);

    vec3 colors[10] = vec3[](COL0, COL1, COL2, COL3, COL4, COL5, COL6, COL7, COL8, COL9);

    float idx = t * 9.0;
    int i = int(idx);
    float f = fract(idx);
    f = f * f * (3.0 - 2.0 * f); // smoothstep

    return mix(colors[i], colors[(i + 1) % 10], f);
}

// Volumetric glow
vec3 volumetricGlow(vec3 ro, vec3 rd, float tmax) {
    vec3 glow = vec3(0.0);
    float dt = 0.15;
    float t = 0.1;

    for(int i = 0; i < 30; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);

        if(d < 0.5) {
            float intensity = exp(-d * 4.0) * 0.02;
            vec3 glowCol = mix(COL2, COL5, sin(t + u_time) * 0.5 + 0.5);
            glow += glowCol * intensity * (1.0 - t / tmax);
        }

        t += dt;
        if(t > tmax) break;
    }

    return glow;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

    float t = u_time;

    // Smooth camera orbit
    float camRadius = 5.5 + sin(t * 0.2) * 0.5;
    float camHeight = 2.5 + sin(t * 0.15) * 1.5;
    float camAngle = t * 0.15;

    vec3 ro = vec3(
        sin(camAngle) * camRadius,
        camHeight,
        cos(camAngle) * camRadius
    );
    vec3 ta = vec3(0.0, 0.0, 0.0);

    // Camera shake for organic feel
    ro += vec3(sin(t * 3.0), cos(t * 2.7), sin(t * 3.3)) * 0.02;

    // Camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);

    // Slight lens distortion
    float lens = 1.8 + length(uv) * 0.1;
    vec3 rd = normalize(uv.x * uu + uv.y * vv + lens * ww);

    // Background - cosmic nebula
    vec3 bgCol = mix(COL8, COL0, uv.y * 0.5 + 0.5);
    bgCol = mix(bgCol, COL9, smoothstep(-0.3, 0.3, uv.x) * 0.4);

    // Add stars
    float stars = pow(hash(vec3(floor(uv * 200.0), 1.0)), 20.0);
    bgCol += stars * COL4 * 0.5;

    // Nebula clouds
    vec2 nebulaUV = uv * 2.0 + vec2(t * 0.02);
    float nebula = fbm(vec3(nebulaUV * 3.0, t * 0.1));
    bgCol += mix(COL1, COL6, nebula) * nebula * 0.15;

    vec3 col = bgCol;

    // Volumetric glow pass
    vec3 glow = volumetricGlow(ro, rd, 12.0);

    // Raymarching
    float tRay = 0.0;
    float tmax = 15.0;

    for(int i = 0; i < 120; i++) {
        vec3 p = ro + rd * tRay;
        float d = map(p);
        if(d < 0.0005 || tRay > tmax) break;
        tRay += d * 0.7;
    }

    if(tRay < tmax) {
        vec3 p = ro + rd * tRay;
        vec3 n = calcNormal(p);

        // Store material ID before recalculating
        map(p);
        float matId = gMatId;

        // Multiple light sources
        vec3 l1 = normalize(vec3(1.0, 1.0, 0.5));
        vec3 l2 = normalize(vec3(-0.5, 0.5, -1.0));
        vec3 l3 = normalize(vec3(0.0, -1.0, 0.0));

        // Dynamic base color
        float colorSeed = dot(p, vec3(0.15)) + t * 0.1 + matId * 0.3;
        vec3 baseCol = getColor(colorSeed, matId);

        // Enhance based on material
        if(matId == 1.0) {
            baseCol = mix(baseCol, COL3, 0.5); // Core - brighter
        } else if(matId == 3.0) {
            baseCol = mix(baseCol, COL5, 0.6); // Particles - cyan tint
        }

        // View-dependent effects
        float NdotV = max(dot(n, -rd), 0.0);
        float fresnel = pow(1.0 - NdotV, 4.0);

        // Iridescent sheen
        vec3 iridescentCol = iridescence(acos(NdotV), 2.0 + sin(t + p.y * 2.0) * 0.5);
        baseCol = mix(baseCol, baseCol * iridescentCol, 0.3);

        // Lighting calculations
        float diff1 = max(dot(n, l1), 0.0);
        float diff2 = max(dot(n, l2), 0.0) * 0.4;
        float diff3 = max(dot(n, l3), 0.0) * 0.2; // Bottom fill

        // Specular
        vec3 h1 = normalize(l1 - rd);
        vec3 h2 = normalize(l2 - rd);
        float spec1 = pow(max(dot(n, h1), 0.0), 64.0);
        float spec2 = pow(max(dot(n, h2), 0.0), 32.0);

        // Shadows
        float shadow1 = softShadow(p + n * 0.01, l1, 0.02, 8.0, 24.0);
        float shadow2 = softShadow(p + n * 0.01, l2, 0.02, 8.0, 16.0);

        // Ambient occlusion
        float ao = calcAO(p, n);

        // Subsurface scattering for core
        float sss = 0.0;
        if(matId == 1.0) {
            sss = subsurface(p, n, l1, 0.5);
        }

        // Combine lighting
        vec3 ambient = mix(COL0, COL7, 0.5) * 0.25;

        col = baseCol * ambient;
        col += baseCol * diff1 * shadow1 * COL4 * 1.2;
        col += baseCol * diff2 * shadow2 * COL6 * 0.8;
        col += baseCol * diff3 * COL9 * 0.5;

        // Specular highlights
        col += spec1 * shadow1 * COL3 * 0.8;
        col += spec2 * shadow2 * mix(COL5, COL2, 0.5) * 0.4;

        // Fresnel rim
        vec3 rimCol = mix(COL5, COL2, sin(t + p.y * 3.0) * 0.5 + 0.5);
        col += fresnel * rimCol * 0.5;

        // SSS glow
        col += sss * mix(COL2, COL3, 0.5) * 0.4;

        // Apply AO
        col *= ao * 0.7 + 0.3;

        // Inner glow for core
        if(matId == 1.0) {
            col += COL3 * 0.2 * (1.0 - NdotV);
        }

        // Distance fog with color
        float fog = 1.0 - exp(-tRay * 0.06);
        vec3 fogCol = mix(COL0, COL7, 0.3);
        col = mix(col, fogCol, fog * 0.7);
    }

    // Add volumetric glow
    col += glow;

    // Bloom effect (fake)
    vec2 bloomUV = uv * 0.5;
    float bloomIntensity = exp(-length(bloomUV) * 2.0) * 0.1;
    col += mix(COL2, COL5, sin(t) * 0.5 + 0.5) * bloomIntensity;

    // Chromatic aberration
    vec2 caOffset = uv * 0.002;
    vec3 ca = vec3(
        col.r,
        col.g,
        col.b
    );
    // Subtle shift
    ca.r = mix(col.r, col.r * 1.02, length(uv));
    ca.b = mix(col.b, col.b * 0.98, length(uv));
    col = ca;

    // Vignette
    float vignette = 1.0 - pow(length(uv * 0.8), 2.5);
    col *= vignette;

    // Film grain
    float grain = hash(vec3(gl_FragCoord.xy, fract(t))) * 0.03;
    col += grain - 0.015;

    // Tone mapping (ACES approximation)
    col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);

    // Gamma correction
    col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));

    // Final color grading - push towards theme
    col = mix(col, col * vec3(0.92, 0.88, 1.12), 0.25);

    // Subtle purple tint in shadows
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, mix(col, COL1, 0.15), 1.0 - luma);

    fragColor = vec4(col, 1.0);
}
