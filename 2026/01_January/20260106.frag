// Enhanced Topology Shader for TouchDesigner
// Features: Klein bottle, Möbius forms, iridescence, bloom, subsurface scattering

out vec4 fragColor;
uniform float u_time;
uniform vec2  u_resolution;

// Original color palette - topology theme (preserved)
const vec3 color1 = vec3(0.212, 0.176, 0.471); // #362d78 deep violet
const vec3 color2 = vec3(0.322, 0.247, 0.639); // #523fa3 royal purple
const vec3 color3 = vec3(0.569, 0.424, 0.800); // #916ccc lavender
const vec3 color4 = vec3(0.741, 0.631, 0.898); // #bda1e5 soft lilac
const vec3 color5 = vec3(0.784, 0.753, 0.914); // #c8c0e9 pale violet
const vec3 color6 = vec3(0.518, 0.729, 0.906); // #84bae7 sky blue
const vec3 color7 = vec3(0.318, 0.416, 0.831); // #516ad4 cobalt
const vec3 color8 = vec3(0.200, 0.247, 0.529); // #333f87 navy
const vec3 color9 = vec3(0.161, 0.188, 0.224); // #293039 charcoal
const vec3 color10 = vec3(0.157, 0.212, 0.192); // #283631 dark teal

// Additional accent colors for iridescence
const vec3 iridescentPink = vec3(0.95, 0.6, 0.8);
const vec3 iridescentCyan = vec3(0.4, 0.9, 0.95);
const vec3 iridescentGold = vec3(0.95, 0.85, 0.5);

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot2D(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

mat3 rotX(float a) {
    float s = sin(a), c = cos(a);
    return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

mat3 rotY(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

mat3 rotZ(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c, -s, 0, s, c, 0, 0, 0, 1);
}

// Smooth blending operations
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
    return -smin(-a, -b, k);
}

// Exponential smooth min for organic blends
float sminExp(float a, float b, float k) {
    float res = exp2(-k * a) + exp2(-k * b);
    return -log2(res) / k;
}

// Hash functions for noise
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

// Smooth noise
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    return mix(
        mix(mix(hash(dot(i, vec3(1, 57, 113))),
                hash(dot(i + vec3(1, 0, 0), vec3(1, 57, 113))), f.x),
            mix(hash(dot(i + vec3(0, 1, 0), vec3(1, 57, 113))),
                hash(dot(i + vec3(1, 1, 0), vec3(1, 57, 113))), f.x), f.y),
        mix(mix(hash(dot(i + vec3(0, 0, 1), vec3(1, 57, 113))),
                hash(dot(i + vec3(1, 0, 1), vec3(1, 57, 113))), f.x),
            mix(hash(dot(i + vec3(0, 1, 1), vec3(1, 57, 113))),
                hash(dot(i + vec3(1, 1, 1), vec3(1, 57, 113))), f.x), f.y), f.z);
}

// Fractal Brownian Motion
float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < octaves; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// ═══════════════════════════════════════════════════════════════
// SIGNED DISTANCE FUNCTIONS - TOPOLOGICAL FORMS
// ═══════════════════════════════════════════════════════════════

// Standard primitives
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// ═══ KLEIN BOTTLE (Figure-8 immersion) ═══
float sdKleinBottle(vec3 p, float scale) {
    p /= scale;
    
    float u = atan(p.z, p.x);
    float v = atan(p.y, length(p.xz) - 2.0);
    
    // Figure-8 Klein bottle parametric approximation
    float r = 2.0 + cos(u * 0.5) * sin(v) - sin(u * 0.5) * sin(2.0 * v);
    
    vec3 klein;
    klein.x = (2.0 + cos(v)) * cos(u);
    klein.y = sin(v);
    klein.z = (2.0 + cos(v)) * sin(u);
    
    // Distance approximation with thickness
    float d = length(p - klein * 0.5) - 0.25;
    
    // Alternative: use torus-based approximation
    vec3 p1 = p;
    p1.xy *= rot2D(u * 0.5);
    float torus1 = sdTorus(p1, vec2(1.5, 0.35));
    
    vec3 p2 = p;
    p2.x -= 3.0;
    p2.xz *= rot2D(PI * 0.5);
    float torus2 = sdTorus(p2, vec2(1.5, 0.35));
    
    d = smin(torus1, torus2, 0.8);
    
    return d * scale;
}

// ═══ MÖBIUS STRIP ═══
float sdMobius(vec3 p, float R, float w, float thickness) {
    float u = atan(p.z, p.x);
    
    // Möbius parametric surface
    vec3 center = vec3(R * cos(u), 0.0, R * sin(u));
    vec3 toP = p - center;
    
    // Local frame that twists
    vec3 tangent = vec3(-sin(u), 0.0, cos(u));
    vec3 normal = vec3(cos(u) * cos(u * 0.5), sin(u * 0.5), sin(u) * cos(u * 0.5));
    vec3 binormal = cross(tangent, normal);
    
    // Project onto local frame
    float localX = dot(toP, normal);
    float localY = dot(toP, binormal);
    
    // Rectangle cross-section
    vec2 q = abs(vec2(localX, localY)) - vec2(w, thickness);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// ═══ TORUS KNOT (p,q) ═══
float sdTorusKnot(vec3 pos, float scale, float p_param, float q_param) {
    pos /= scale;
    
    float bestDist = 1e10;
    float R = 2.0;  // Major radius
    float r = 0.8;  // Minor radius
    float tubeR = 0.2;  // Tube thickness
    
    // Sample along the knot curve
    for(float i = 0.0; i < 64.0; i++) {
        float t = i / 64.0 * TAU;
        
        // Torus knot parametric equations
        float phi = q_param * t;
        float theta = p_param * t;
        
        vec3 knotPoint;
        knotPoint.x = (R + r * cos(phi)) * cos(theta);
        knotPoint.y = r * sin(phi);
        knotPoint.z = (R + r * cos(phi)) * sin(theta);
        
        bestDist = min(bestDist, length(pos - knotPoint));
    }
    
    return (bestDist - tubeR) * scale;
}

// ═══ TREFOIL KNOT ═══
float sdTrefoil(vec3 p, float scale) {
    p /= scale;
    
    float bestDist = 1e10;
    float tubeR = 0.25;
    
    for(float i = 0.0; i < 80.0; i++) {
        float t = i / 80.0 * TAU;
        
        // Trefoil parametric
        vec3 knot;
        knot.x = sin(t) + 2.0 * sin(2.0 * t);
        knot.y = cos(t) - 2.0 * cos(2.0 * t);
        knot.z = -sin(3.0 * t);
        
        bestDist = min(bestDist, length(p - knot * 0.5));
    }
    
    return (bestDist - tubeR) * scale;
}

// ═══ TWISTED TORUS with variable twist ═══
float sdTwistedTorus(vec3 p, float R, float r, float twist) {
    float angle = atan(p.z, p.x);
    p.xy *= rot2D(angle * twist);
    return sdTorus(p, vec2(R, r));
}

// ═══ GYROID (triply periodic minimal surface) ═══
float sdGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    float g = sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
    return (abs(g) - thickness) / scale;
}

// ═══ SCHWARZ P-SURFACE ═══
float sdSchwarzP(vec3 p, float scale, float thickness) {
    p *= scale;
    float s = cos(p.x) + cos(p.y) + cos(p.z);
    return (abs(s) - thickness) / scale;
}

// ═══ CALABI-YAU inspired manifold ═══
float sdCalabiYau(vec3 p, float scale) {
    p /= scale;
    
    float r = length(p);
    float theta = acos(p.z / max(r, 0.001));
    float phi = atan(p.y, p.x);
    
    // 5-fold symmetry inspired by Calabi-Yau
    float n = 5.0;
    float k = 2.0;
    
    float surface = pow(r, n) - cos(n * theta) - cos(n * phi) * sin(k * theta);
    
    return (abs(surface) - 0.1) * scale * 0.3;
}

// ═══════════════════════════════════════════════════════════════
// DOMAIN OPERATIONS & REPETITION
// ═══════════════════════════════════════════════════════════════

vec3 opRep(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

vec3 opRepLim(vec3 p, float c, vec3 l) {
    return p - c * clamp(round(p / c), -l, l);
}

float opOnion(float d, float thickness) {
    return abs(d) - thickness;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCENE COMPOSITION
// ═══════════════════════════════════════════════════════════════

vec2 map(vec3 p) {
    float t = u_time * 0.3;
    vec3 origP = p;
    
    // Material ID: 1=central, 2=orbiting, 3=gyroid, 4=mobius
    float matId = 1.0;
    
    // ─── Central Form: Morphing Klein-Torus hybrid ───
    vec3 p1 = p;
    p1 *= rotY(t * 0.2) * rotX(t * 0.15);
    
    // Twisted torus as base
    float central = sdTwistedTorus(p1, 2.2, 0.5, 1.5 + sin(t * 0.5) * 0.5);
    
    // Add onion layers for depth
    float onionLayer = opOnion(central, 0.08);
    central = smin(central, onionLayer, 0.1);
    
    // Breathing animation
    float breath = 1.0 + sin(t * 0.8) * 0.05;
    central /= breath;
    
    float d = central;
    
    // ─── Orbiting Trefoil Knots ───
    for(int i = 0; i < 3; i++) {
        float angle = float(i) * TAU / 3.0 + t * 0.25;
        float orbitR = 4.5 + sin(t * 0.3 + float(i)) * 0.5;
        
        vec3 p2 = p;
        p2 *= rotY(angle);
        p2.x -= orbitR;
        p2 *= rotY(-t * 0.4 + float(i)) * rotX(t * 0.3);
        
        float knot = sdTrefoil(p2, 0.7);
        
        if(knot < d) matId = 2.0;
        d = smin(d, knot, 0.4);
    }
    
    // ─── Gyroid Shell ───
    vec3 p3 = p;
    p3 *= rotY(t * 0.1) * rotZ(t * 0.08);
    float gyroid = sdGyroid(p3, 1.2, 0.15);
    float gyroidSphere = sdSphere(p3, 3.5);
    gyroid = max(gyroid, gyroidSphere); // Bound to sphere
    gyroid = max(gyroid, -sdSphere(p3, 2.8)); // Hollow center
    
    if(gyroid < d) matId = 3.0;
    d = smin(d, gyroid, 0.3);
    
    // ─── Floating Möbius Strips ───
    for(int i = 0; i < 2; i++) {
        float mAngle = float(i) * PI + t * 0.15;
        float mR = 6.0;
        
        vec3 pm = p;
        pm *= rotY(mAngle);
        pm.x -= mR;
        pm *= rotX(t * 0.2 + float(i) * 1.5) * rotZ(t * 0.25);
        
        float mobius = sdMobius(pm, 1.2, 0.4, 0.08);
        
        if(mobius < d) matId = 4.0;
        d = smin(d, mobius, 0.25);
    }
    
    // ─── Inner Pulsing Core ───
    vec3 pc = p;
    float pulse = 1.0 + sin(t * 2.0) * 0.15;
    float core = sdSphere(pc, 0.8 * pulse);
    
    // Subtract core for hollow effect
    d = smax(d, -core, 0.2);
    
    // ─── Detail Noise Layer ───
    float noiseDetail = fbm(origP * 3.0 + t * 0.5, 3) * 0.03;
    d += noiseDetail;
    
    return vec2(d, matId);
}

// ═══════════════════════════════════════════════════════════════
// RAYMARCHING & LIGHTING
// ═══════════════════════════════════════════════════════════════

vec3 calcNormal(vec3 p) {
    const float h = 0.0001;
    const vec2 k = vec2(1, -1);
    return normalize(
        k.xyy * map(p + k.xyy * h).x +
        k.yyx * map(p + k.yyx * h).x +
        k.yxy * map(p + k.yxy * h).x +
        k.xxx * map(p + k.xxx * h).x
    );
}

vec2 raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    float matId = 0.0;
    
    for(int i = 0; i < 180; i++) {
        vec3 p = ro + rd * t;
        vec2 res = map(p);
        float d = res.x;
        matId = res.y;
        
        if(d < 0.0003 || t > 80.0) break;
        t += d * 0.5; // Smaller step for precision
    }
    
    return vec2(t, matId);
}

float calcAO(vec3 p, vec3 n) {
    float ao = 0.0;
    float scale = 1.0;
    
    for(int i = 0; i < 6; i++) {
        float hr = 0.01 + 0.06 * float(i);
        float dd = map(p + n * hr).x;
        ao += (hr - dd) * scale;
        scale *= 0.65;
    }
    
    return clamp(1.0 - 2.5 * ao, 0.0, 1.0);
}

float calcSoftShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    float ph = 1e10;
    
    for(int i = 0; i < 64; i++) {
        float h = map(ro + rd * t).x;
        
        if(h < 0.0005) return 0.0;
        
        float y = h * h / (2.0 * ph);
        float d = sqrt(h * h - y * y);
        res = min(res, k * d / max(0.0, t - y));
        ph = h;
        t += h * 0.5;
        
        if(t > maxt) break;
    }
    
    return clamp(res, 0.0, 1.0);
}

// Subsurface scattering approximation
float calcSSS(vec3 p, vec3 n, vec3 lightDir, float thickness) {
    float scatter = 0.0;
    
    for(int i = 0; i < 5; i++) {
        float hr = 0.01 + 0.1 * float(i);
        float dd = map(p - lightDir * hr).x;
        scatter += (hr - max(dd, 0.0));
    }
    
    return clamp(scatter * thickness, 0.0, 1.0);
}

// ═══════════════════════════════════════════════════════════════
// IRIDESCENCE & COLOR
// ═══════════════════════════════════════════════════════════════

// Thin-film interference for iridescence
vec3 iridescence(float cosTheta, float thickness) {
    float delta = thickness * cosTheta;
    
    vec3 color;
    color.r = sin(delta * 12.0) * 0.5 + 0.5;
    color.g = sin(delta * 12.0 + 2.094) * 0.5 + 0.5;
    color.b = sin(delta * 12.0 + 4.189) * 0.5 + 0.5;
    
    return color;
}

// Spectral color from wavelength approximation
vec3 spectralColor(float t) {
    vec3 c;
    if(t < 0.25) {
        c = mix(color1, color7, t * 4.0);
    } else if(t < 0.5) {
        c = mix(color7, color6, (t - 0.25) * 4.0);
    } else if(t < 0.75) {
        c = mix(color6, color3, (t - 0.5) * 4.0);
    } else {
        c = mix(color3, color4, (t - 0.75) * 4.0);
    }
    return c;
}

vec3 getMaterialColor(vec3 p, vec3 n, vec3 rd, float matId, float t) {
    float time = u_time * 0.25;
    vec3 col;
    
    // Fresnel
    float fresnel = pow(1.0 - abs(dot(n, -rd)), 4.0);
    
    // View-dependent iridescence
    float iriThickness = 1.5 + sin(time + length(p) * 2.0) * 0.5;
    vec3 iri = iridescence(dot(n, -rd), iriThickness);
    
    // Position-based color flow
    float flow = sin(p.x * 2.0 + p.y * 2.0 + p.z * 2.0 + time * 2.0) * 0.5 + 0.5;
    
    if(matId < 1.5) {
        // Central form - deep purples with iridescence
        col = mix(color1, color2, flow);
        col = mix(col, color3, fresnel * 0.5);
        col = mix(col, iri * color4, fresnel * 0.4);
    } else if(matId < 2.5) {
        // Trefoil knots - spectral shifting
        float spectral = fract(length(p) * 0.3 + time);
        col = spectralColor(spectral);
        col = mix(col, iri * color5, fresnel * 0.3);
    } else if(matId < 3.5) {
        // Gyroid - ethereal blue-violet
        col = mix(color6, color7, flow);
        col = mix(col, color5, abs(n.y) * 0.4);
        col = mix(col, iri * iridescentCyan, fresnel * 0.5);
    } else {
        // Möbius - golden iridescence
        col = mix(color2, color3, flow);
        vec3 goldIri = iri * iridescentGold;
        col = mix(col, goldIri, fresnel * 0.6);
    }
    
    return col;
}

// ═══════════════════════════════════════════════════════════════
// POST-PROCESSING
// ═══════════════════════════════════════════════════════════════

// Bloom approximation
vec3 bloom(vec3 col, float threshold, float intensity) {
    vec3 bright = max(col - threshold, 0.0);
    return col + bright * intensity;
}

// Chromatic aberration
vec3 chromaticAberration(vec2 uv, vec3 col, float amount) {
    vec2 dir = uv * amount;
    
    // Simplified - in full impl would re-raymarch
    // Here we simulate with color shift
    col.r *= 1.0 + length(dir) * 0.5;
    col.b *= 1.0 - length(dir) * 0.3;
    
    return col;
}

// Film grain
float grain(vec2 uv, float time, float amount) {
    return (hash21(uv + time) - 0.5) * amount;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 uvOrig = gl_FragCoord.xy / u_resolution.xy;
    
    // Camera with smooth orbital motion
    float camTime = u_time * 0.12;
    float camDist = 12.0 + sin(u_time * 0.1) * 2.0;
    
    vec3 ro = vec3(
        cos(camTime) * camDist,
        sin(camTime * 0.6) * 4.0 + 2.0,
        sin(camTime) * camDist
    );
    
    vec3 target = vec3(0.0, 0.0, 0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    
    // Lens distortion for cinematic feel
    float distortion = length(uv) * 0.08;
    vec2 uvDist = uv * (1.0 + distortion * distortion);
    
    vec3 rd = normalize(forward + uvDist.x * right + uvDist.y * up);
    
    // ─── Raymarch ───
    vec2 res = raymarch(ro, rd);
    float t = res.x;
    float matId = res.y;
    
    vec3 col = vec3(0.0);
    
    if(t < 80.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        
        // Ambient occlusion
        float ao = calcAO(p, n);
        
        // Multi-light setup
        vec3 lightDir1 = normalize(vec3(3.0, 5.0, 4.0));
        vec3 lightDir2 = normalize(vec3(-4.0, 2.0, -3.0));
        vec3 lightDir3 = normalize(vec3(0.0, -1.0, 0.0)); // Bottom fill
        
        vec3 lightCol1 = color5 * 1.2;
        vec3 lightCol2 = color6 * 0.6;
        vec3 lightCol3 = color3 * 0.3;
        
        // Shadows
        float shadow1 = calcSoftShadow(p + n * 0.01, lightDir1, 0.02, 8.0, 12.0);
        float shadow2 = calcSoftShadow(p + n * 0.01, lightDir2, 0.02, 8.0, 8.0);
        
        // Base material color
        col = getMaterialColor(p, n, rd, matId, t);
        
        // Diffuse lighting
        float diff1 = max(dot(n, lightDir1), 0.0);
        float diff2 = max(dot(n, lightDir2), 0.0);
        float diff3 = max(dot(n, -lightDir3), 0.0) * 0.5;
        
        // Specular (Blinn-Phong)
        vec3 h1 = normalize(lightDir1 - rd);
        vec3 h2 = normalize(lightDir2 - rd);
        float spec1 = pow(max(dot(n, h1), 0.0), 64.0);
        float spec2 = pow(max(dot(n, h2), 0.0), 32.0);
        
        // Subsurface scattering
        float sss = calcSSS(p, n, lightDir1, 0.4);
        vec3 sssColor = color3 * sss * 0.5;
        
        // Rim light
        float rim = pow(1.0 - abs(dot(n, -rd)), 4.0);
        vec3 rimColor = mix(color4, color6, rim) * rim;
        
        // Combine lighting
        vec3 lighting = vec3(0.0);
        lighting += lightCol1 * diff1 * shadow1;
        lighting += lightCol2 * diff2 * shadow2;
        lighting += lightCol3 * diff3;
        lighting += color5 * spec1 * shadow1 * 0.8;
        lighting += color6 * spec2 * shadow2 * 0.4;
        
        col *= lighting;
        col += sssColor;
        col += rimColor * 0.5;
        
        // Ambient
        vec3 ambient = mix(color9, color8, n.y * 0.5 + 0.5) * 0.15;
        col += ambient * ao;
        
        // Apply AO
        col *= 0.4 + 0.6 * ao;
        
        // Distance fog with color
        float fogAmount = 1.0 - exp(-t * 0.04);
        vec3 fogColor = mix(color9, color8, uvOrig.y);
        fogColor = mix(fogColor, color1, sin(u_time * 0.15) * 0.2 + 0.3);
        col = mix(col, fogColor, fogAmount * 0.7);
        
    } else {
        // Background - gradient with subtle patterns
        float bgGrad = uvOrig.y;
        col = mix(color9, color8, bgGrad);
        col = mix(col, color1, bgGrad * bgGrad * 0.4);
        
        // Subtle nebula effect
        float nebula = fbm(vec3(uv * 3.0, u_time * 0.05), 4);
        col = mix(col, color2 * 0.3, nebula * 0.3);
        
        // Stars
        float stars = pow(max(0.0, hash21(floor(uv * 500.0)) - 0.98) * 50.0, 2.0);
        col += color5 * stars * 0.5;
    }
    
    // ─── Post-processing ───
    
    // Bloom
    col = bloom(col, 0.7, 0.6);
    
    // Chromatic aberration
    col = chromaticAberration(uv, col, 0.003);
    
    // Vignette with color tint
    float vignette = 1.0 - pow(length(uv) * 0.7, 2.0);
    vignette = smoothstep(0.0, 1.0, vignette);
    col *= vignette;
    col = mix(col, color9, (1.0 - vignette) * 0.4);
    
    // Color grading
    col = mix(col, col * col * 2.5, 0.25); // Contrast
    col = pow(col, vec3(0.92)); // Saturation boost
    
    // Tone mapping (ACES approximation)
    col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
    
    // Gamma correction
    col = pow(col, vec3(0.4545));
    
    // Film grain
    col += grain(uvOrig, u_time, 0.025);
    
    // Final clamp
    col = clamp(col, 0.0, 1.0);
    
    fragColor = vec4(col, 1.0);
}
