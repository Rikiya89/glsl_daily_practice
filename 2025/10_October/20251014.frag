// TouchDesigner GLSL TOP - Pixel Shader
// Liquid Dreams - Black & White Shader Art

out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

#define MAX_STEPS 100
#define MAX_DIST 100.0
#define SURF_DIST 0.001

// Rotation matrix
mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Hash function for procedural patterns
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// 3D noise function
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep

    return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}

// Fractal Brownian Motion for organic textures
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Basic SDF primitives
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

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdVerticalCapsule(vec3 p, float h, float r) {
    p.y -= clamp(p.y, 0.0, h);
    return length(p) - r;
}

// Smooth minimum for blending shapes
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Scene SDF - defines the 3D objects
float getDist(vec3 p) {
    vec3 q = p;

    // Central multi-layered crystal mandala
    vec3 pOct = q;
    pOct.xz *= rot(u_time * 0.3);
    pOct.xy *= rot(u_time * 0.4);
    float crystal = sdOctahedron(pOct, 0.8 + 0.1 * sin(u_time * 1.5));

    // Inner nested octahedron
    vec3 pOct2 = q;
    pOct2.xz *= rot(-u_time * 0.4);
    pOct2.yz *= rot(u_time * 0.35);
    float crystal2 = sdOctahedron(pOct2 * 1.3, 0.5);
    crystal = smin(crystal, crystal2, 0.25);

    // Orbiting spheres around the crystal (increased count for symmetry)
    float orbitRadius = 1.3;
    for(float i = 0.0; i < 6.0; i++) {
        float angle = u_time * 0.5 + i * 1.047; // 60 degrees apart
        vec3 orbitPos = vec3(cos(angle) * orbitRadius, sin(u_time * 0.8 + i) * 0.3, sin(angle) * orbitRadius);
        float orbitSphere = sdSphere(q - orbitPos, 0.12);
        crystal = smin(crystal, orbitSphere, 0.25);
    }

    // Multiple concentric rotating rings
    vec3 p2 = p;
    p2.xz *= rot(u_time * 0.2);
    float ring1 = sdTorus(p2, vec2(1.5, 0.06));

    vec3 p3 = p;
    p3.xz *= rot(u_time * -0.25);
    p3.y += 0.5;
    float ring2 = sdTorus(p3, vec2(1.2, 0.06));

    // Third decorative ring
    vec3 p3b = p;
    p3b.xy *= rot(u_time * 0.18);
    float ring3 = sdTorus(p3b, vec2(1.35, 0.05));

    // Enhanced double-helix spiral structure
    float spiralD = MAX_DIST;
    for(float i = 0.0; i < 12.0; i++) {
        float t = i / 12.0;
        float spiralAngle = t * 6.28 * 3.0 + u_time * 0.5;
        float spiralHeight = (t - 0.5) * 2.8;
        float spiralRad = 0.75 + sin(t * 6.28 * 2.0) * 0.2;

        vec3 spiralPos = vec3(cos(spiralAngle) * spiralRad, spiralHeight, sin(spiralAngle) * spiralRad);
        vec3 spiralPos2 = spiralPos + vec3(0.0, 0.2, 0.0);
        float capsule = sdCapsule(p, spiralPos, spiralPos2, 0.04);
        spiralD = min(spiralD, capsule);

        // Counter-rotating second helix
        float spiralAngle2 = -spiralAngle;
        vec3 spiralPos3 = vec3(cos(spiralAngle2) * spiralRad, spiralHeight, sin(spiralAngle2) * spiralRad);
        vec3 spiralPos4 = spiralPos3 + vec3(0.0, 0.2, 0.0);
        float capsule2 = sdCapsule(p, spiralPos3, spiralPos4, 0.04);
        spiralD = min(spiralD, capsule2);
    }

    // Smooth blend everything together
    float d = smin(crystal, ring1, 0.2);
    d = smin(d, ring2, 0.2);
    d = smin(d, ring3, 0.18);
    d = smin(d, spiralD, 0.15);

    // Distant repeating elegant obelisks
    vec3 p5 = p;
    vec3 cellId = floor(p5 / 5.0);
    p5 = mod(p5, 5.0) - 2.5; // Create 5x5 unit repeating cells

    // Elegant capsule obelisks with varying heights - adjusted to new ground
    p5.y += 0.3; // Align base with new ground level
    float obeliskHeight = 2.5 + sin(cellId.x * 3.14 + cellId.z * 2.71 + u_time * 0.3) * 0.8;
    float obelisks = sdVerticalCapsule(p5, obeliskHeight, 0.15);

    // Only add obelisks if not too close to center
    float distFromCenter = length(p.xz);
    if(distFromCenter > 3.5) {
        d = min(d, obelisks);
    }

    // Distant floating crystal octahedrons - repositioned
    vec3 p6 = p;
    p6.y -= 1.5 + sin(u_time * 0.6 + length(p6.xz) * 0.3) * 0.5;
    vec3 crystalCell = floor(p6 / 7.0);
    p6 = mod(p6, 7.0) - 3.5;
    p6.xz *= rot(u_time * 0.2 + crystalCell.x);
    float distCrystals = sdOctahedron(p6, 0.5);

    if(distFromCenter > 6.0) {
        d = min(d, distCrystals);
    }

    // Ground plane - closer to center
    float ground = p.y + 0.3;
    d = min(d, ground);

    return d;
}

// Calculate surface normal
vec3 getNormal(vec3 p) {
    float d = getDist(p);
    vec2 e = vec2(0.001, 0.0);
    vec3 n = d - vec3(
        getDist(p - e.xyy),
        getDist(p - e.yxy),
        getDist(p - e.yyx)
    );
    return normalize(n);
}

// Raymarching algorithm
float rayMarch(vec3 ro, vec3 rd) {
    float dO = 0.0;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float dS = getDist(p);
        dO += dS;
        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }

    return dO;
}

// Soft shadows
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 32; i++) {
        float h = getDist(ro + rd * t);
        if(h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
        if(t > maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}

// Ambient occlusion
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = getDist(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

void main() {
    // Normalized pixel coordinates
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // Camera setup - centered on sculpture
    vec3 ro = vec3(0.0, 0.3, 5.0); // Ray origin (camera position - centered height)
    vec3 rd = normalize(vec3(uv, -1.5)); // Ray direction (wider field of view)

    // Rotate camera - looking more directly at center
    ro.yz *= rot(-0.05);
    rd.yz *= rot(-0.05);
    ro.xz *= rot(u_time * 0.15);
    rd.xz *= rot(u_time * 0.15);

    // Perform raymarching
    float d = rayMarch(ro, rd);

    // Brighter background gradient
    vec3 col = vec3(0.15 + 0.2 * (1.0 - uv.y * 0.5));

    // If we hit something
    if(d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 normal = getNormal(p);

        // Procedural surface patterns
        float pattern1 = fbm(p * 3.0 + u_time * 0.1);
        float pattern2 = sin(p.x * 10.0) * sin(p.y * 10.0) * sin(p.z * 10.0) * 0.5 + 0.5;
        float voronoi = fract(sin(dot(floor(p * 5.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);

        // Combine patterns for material variation
        float materialPattern = mix(pattern1, pattern2 * 0.3 + voronoi * 0.2, 0.5);
        materialPattern = smoothstep(0.3, 0.7, materialPattern);

        // Multiple light sources for brighter scene
        vec3 lightPos1 = vec3(3.0 * sin(u_time * 0.5), 3.0, 3.0 * cos(u_time * 0.5));
        vec3 lightDir1 = normalize(lightPos1 - p);

        // Second fill light
        vec3 lightPos2 = vec3(-2.0, 2.0, -2.0);
        vec3 lightDir2 = normalize(lightPos2 - p);

        // Diffuse lighting from both lights
        float diff1 = max(dot(normal, lightDir1), 0.0);
        float diff2 = max(dot(normal, lightDir2), 0.0) * 0.5;

        // Specular highlights (enhanced with pattern)
        vec3 viewDir = normalize(ro - p);
        vec3 halfDir1 = normalize(lightDir1 + viewDir);
        float spec1 = pow(max(dot(normal, halfDir1), 0.0), 32.0 + materialPattern * 32.0);
        vec3 halfDir2 = normalize(lightDir2 + viewDir);
        float spec2 = pow(max(dot(normal, halfDir2), 0.0), 64.0);

        // Soft shadows
        float shadow = softShadow(p + normal * 0.02, lightDir1, 0.02, 2.5, 8.0);

        // Ambient occlusion
        float ao = calcAO(p, normal);

        // Combine lighting (much brighter)
        float ambient = 0.5 + materialPattern * 0.15; // Pattern-enhanced ambient
        float lighting = ambient + (diff1 + diff2) * (0.3 + shadow * 0.7);
        lighting *= ao;

        // Add brighter specular with pattern influence
        lighting += (spec1 + spec2) * shadow * (0.8 + materialPattern * 0.3);

        // Apply material pattern for surface detail
        lighting = mix(lighting * 0.85, lighting * 1.15, materialPattern);

        // Final color (brighter black and white)
        col = vec3(lighting);

        // Stronger edge highlight with pattern
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        col += fresnel * (0.4 + materialPattern * 0.2);

        // Gentler contrast adjustment
        col = smoothstep(0.1, 1.0, col);

        // Lighter atmospheric fog
        float fogAmount = 1.0 - exp(-d * 0.05); // Lighter fog
        vec3 fogColor = vec3(0.2); // Lighter fog color
        col = mix(col, fogColor, fogAmount);
    }

    // Enhanced glow effect with pulsing
    float glow = exp(-d * 0.3) * (0.15 + 0.05 * sin(u_time * 2.0));
    col += glow;

    // Radial light burst effect from center
    float radialDist = length(uv);
    float radialAngle = atan(uv.y, uv.x);
    float radialPattern = sin(radialAngle * 6.0 + u_time) * 0.5 + 0.5;
    float radialGlow = (1.0 - radialDist) * radialPattern * 0.08;
    col += radialGlow;

    // Depth-based color enhancement
    float depthFade = smoothstep(0.0, 20.0, d);
    col = mix(col * 1.1, col * 0.9, depthFade);

    // Gentle vignette (reduced for brighter scene)
    float vignette = 1.0 - 0.12 * length(uv * 0.4);
    col *= vignette;

    // Overall brightness boost
    col = pow(col, vec3(0.82)); // Gamma adjustment for more brightness

    // Add subtle film grain for texture
    float grain = hash(vec3(uv * u_resolution.xy, u_time)) * 0.03;
    col += grain;

    // Ensure we stay in valid range
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
