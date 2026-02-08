// TouchDesigner GLSL TOP - Raymarched Triply Periodic Minimal Surfaces
// Morphing Gyroid ↔ Schwarz P ↔ Schwarz Diamond
// Palette: Deep indigo → lavender → sky blue → dark teal

uniform float uTime;
out vec4 fragColor;

// ─── Color Palette (10 colors) ───────────────────────────
const vec3 PAL[10] = vec3[10](
    vec3(0.212, 0.176, 0.471),  // #362d78 deep indigo
    vec3(0.322, 0.247, 0.639),  // #523fa3 purple
    vec3(0.569, 0.424, 0.800),  // #916ccc medium purple
    vec3(0.741, 0.631, 0.898),  // #bda1e5 light lavender
    vec3(0.784, 0.753, 0.914),  // #c8c0e9 pale lavender
    vec3(0.518, 0.729, 0.906),  // #84bae7 sky blue
    vec3(0.318, 0.416, 0.831),  // #516ad4 royal blue
    vec3(0.200, 0.247, 0.529),  // #333f87 dark blue
    vec3(0.161, 0.188, 0.224),  // #293039 charcoal
    vec3(0.157, 0.212, 0.192)   // #283631 dark teal
);

// Smooth palette interpolation with cubic easing
vec3 getColor(float t) {
    t = clamp(t, 0.0, 1.0) * 9.0;
    int i = int(floor(t));
    float f = smoothstep(0.0, 1.0, fract(t));
    return mix(PAL[min(i, 9)], PAL[min(i + 1, 9)], f);
}

// ─── Mathematical Constants ──────────────────────────────
const float PHI = 1.618033988749895;  // Golden ratio φ = (1+√5)/2
const float PI  = 3.141592653589793;
const float TAU = 6.283185307179586;  // 2π

// ─── Utilities ───────────────────────────────────────────
mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// Polynomial smooth minimum — blends two SDFs organically
// k controls the blending radius (Inigo Quilez's formulation)
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// ─── Signed Distance Functions ───────────────────────────
// Gyroid minimal surface (Alan Schoen, 1970)
// sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x) = 0
float gyroid(vec3 p, float s) {
    p *= s;
    return abs(sin(p.x) * cos(p.y) +
               sin(p.y) * cos(p.z) +
               sin(p.z) * cos(p.x)) / s;
}

// Schwarz P-surface (Hermann Schwarz, 1865)
// cos(x) + cos(y) + cos(z) = 0
float schwarzP(vec3 p, float s) {
    p *= s;
    return abs(cos(p.x) + cos(p.y) + cos(p.z)) / s;
}

// Schwarz Diamond surface
// Combines all sin/cos permutations of 3 axes
float schwarzD(vec3 p, float s) {
    p *= s;
    return abs(
        sin(p.x) * sin(p.y) * sin(p.z) +
        sin(p.x) * cos(p.y) * cos(p.z) +
        cos(p.x) * sin(p.y) * cos(p.z) +
        cos(p.x) * cos(p.y) * sin(p.z)
    ) / s;
}

// ─── Scene Definition ────────────────────────────────────
float map(vec3 p) {
    // Gentle rotation — Euler angles evolving at irrational rates
    p.xz *= rot2(uTime * 0.08);
    p.yz *= rot2(uTime * 0.05 * PHI);
    p.xy *= rot2(sin(uTime * 0.03) * 0.25);

    // Scale breathes with golden-ratio timing
    float scale = PI + sin(uTime * 0.1 / PHI) * 0.5;

    // Barycentric morph between 3 minimal surfaces
    // Weights cycle at 120° phase offsets → always sums to ~1
    float phase = uTime * 0.12;
    float w1 = sin(phase) * 0.5 + 0.5;
    float w2 = sin(phase + TAU / 3.0) * 0.5 + 0.5;
    float w3 = sin(phase + 2.0 * TAU / 3.0) * 0.5 + 0.5;
    float wt = w1 + w2 + w3;
    w1 /= wt; w2 /= wt; w3 /= wt;

    // Evaluate each surface
    float g = gyroid(p, scale);
    float s = schwarzP(p, scale);
    float d = schwarzD(p, scale);

    // Weighted blend + shell thickness
    float surface = g * w1 + s * w2 + d * w3;
    surface -= 0.03;

    // Bounding sphere (golden ratio × 1.6 ≈ 2.589)
    float bound = length(p) - PHI * 1.6;

    return max(surface, bound);
}

// ─── Rendering Helpers ───────────────────────────────────
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

// Screen-space ambient occlusion via SDF
float calcAO(vec3 p, vec3 n) {
    float ao = 0.0;
    for (int i = 1; i <= 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        ao += (h - map(p + n * h)) / pow(2.0, float(i));
    }
    return clamp(1.0 - ao * 2.5, 0.0, 1.0);
}

// ─── Color Mapping ───────────────────────────────────────
// Maps the 10-color palette onto the 3D geometry.
// Inputs: p = surface position, n = normal, dist = ray depth, ao = occlusion
vec3 mapColor(vec3 p, vec3 n, float dist, float ao) {
    // Layer 1: position-driven sweep through the full palette
    // Golden-ratio dot product ensures irrational, non-repeating color bands
    float t1 = dot(p, vec3(PHI, 1.0, PHI - 1.0)) * 0.18 + 0.5;

    // Layer 2: normal-based tint — surface curvature picks a second color
    float t2 = dot(n, normalize(vec3(1.0, PHI, 0.0))) * 0.5 + 0.5;

    // Layer 3: depth fade — near surfaces get indigos, far gets teals
    float t3 = clamp(dist / 12.0, 0.0, 1.0);

    // Layer 4: slow animation — colors flow across the whole surface
    float flow = uTime * 0.04;

    // Blend all layers: position is primary, normal adds iridescence,
    // depth adds atmospheric perspective
    vec3 cPos    = getColor(fract(t1 + flow));
    vec3 cNormal = getColor(fract(t2 + flow * 0.7));
    vec3 cDepth  = getColor(fract(t3 * 0.8 + flow * 0.3));

    // Mix: 50% position, 25% normal, 25% depth
    vec3 col = cPos * 0.50 + cNormal * 0.25 + cDepth * 0.25;

    // AO darkens into the deepest palette colors (charcoal/teal)
    col = mix(PAL[8], col, ao * 0.85 + 0.15);

    return col;
}

// ─── Main ────────────────────────────────────────────────
void main() {
    vec2 res = uTDOutputInfo.res.zw;
    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);

    // Camera orbiting on golden-ratio-phased ellipse
    float camAngle = uTime * 0.1;
    float camR = 4.5 + sin(uTime * 0.07 / PHI) * 0.8;
    vec3 ro = vec3(
        camR * cos(camAngle),
        sin(uTime * 0.08) * 1.5,
        camR * sin(camAngle)
    );

    // Look-at camera matrix
    vec3 target = vec3(0.0);
    vec3 fwd   = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up    = cross(right, fwd);
    vec3 rd    = normalize(fwd * 1.8 + right * uv.x + up * uv.y);

    // ── Raymarch ──
    float t = 0.0;
    for (int i = 0; i < 128; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (abs(d) < 0.0004 || t > 25.0) break;
        t += d * 0.7;  // relaxation factor for stability
    }

    vec3 col;

    if (t < 25.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        float ao = calcAO(p, n);

        // Two-point lighting
        vec3 l1 = normalize(vec3(1.0, 1.2, 0.8));
        vec3 l2 = normalize(vec3(-0.6, 0.3, -1.0));
        float diff1 = max(dot(n, l1), 0.0);
        float diff2 = max(dot(n, l2), 0.0) * 0.25;

        // Blinn-Phong specular
        vec3 h1 = normalize(l1 - rd);
        float spec = pow(max(dot(n, h1), 0.0), 64.0);

        // Palette color
        col = mapColor(p, n, t, ao);

        // Fresnel rim glow
        float fresnel = pow(1.0 - abs(dot(-rd, n)), 4.0);

        // Compose final shading
        col = col * (0.12 + diff1 * 0.75 + diff2) * ao;
        col += spec * PAL[4] * 0.35;
        col += fresnel * getColor(0.45) * 0.3;
    } else {
        // Background — subtle gradient from charcoal to teal
        float bg = length(uv) * 0.3;
        col = mix(PAL[8], PAL[9], bg + uv.y * 0.2);
        col *= 1.0 - length(uv) * 0.25;
    }

    // Reinhard tone mapping + gamma correction
    col = col / (col + 0.8);
    col = pow(col, vec3(0.4545));

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
