out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// Color palette - purple and blue theme
const vec3 color1 = vec3(0.212, 0.176, 0.471); // #362d78
const vec3 color2 = vec3(0.322, 0.247, 0.639); // #523fa3
const vec3 color3 = vec3(0.569, 0.424, 0.800); // #916ccc
const vec3 color4 = vec3(0.741, 0.631, 0.898); // #bda1e5
const vec3 color5 = vec3(0.784, 0.753, 0.914); // #c8c0e9
const vec3 color6 = vec3(0.518, 0.729, 0.906); // #84bae7
const vec3 color7 = vec3(0.318, 0.416, 0.831); // #516ad4
const vec3 color8 = vec3(0.200, 0.247, 0.529); // #333f87
const vec3 color9 = vec3(0.161, 0.188, 0.224); // #293039

#define PI 3.14159265359
#define PHI 1.618033988749 // Golden ratio

// Rotation matrices
mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

mat3 rotateY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

// Hash function for procedural randomness
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// 3D noise function
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Fractal Brownian Motion
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Signed Distance Functions
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
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

// Smooth minimum function for organic blending
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// TODO(human)

// Grid repetition function
vec3 repeat(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

// Scene composition with grid system
float map(vec3 p) {
    // Domain warping using mathematical formulas
    float warp = fbm(p * 0.5 + u_time * 0.1) * 0.3;

    // Apply Fibonacci spiral warping
    float angle = atan(p.z, p.x) + u_time * 0.2;
    float radius = length(p.xz);
    p.y += sin(angle * PHI + u_time) * 0.2;

    // Store original position for effects
    vec3 originalP = p;

    // Rotating global space
    p.xz *= rot(u_time * 0.1);
    p.xy *= rot(sin(u_time * 0.3) * 0.2);

    // Grid system 1: Infinite octahedron grid
    vec3 gridSize = vec3(3.0, 3.0, 3.0);
    vec3 gridP = repeat(p, gridSize);

    // Rotate each cell based on its position
    vec3 cellId = floor((p + 0.5 * gridSize) / gridSize);
    float cellHash = hash(cellId);
    gridP.xy *= rot(u_time * 0.5 + cellHash * PI * 2.0);
    gridP.yz *= rot(u_time * 0.3 + cellHash * PI);

    float octGrid = sdOctahedron(gridP, 0.3 + sin(u_time + cellHash * 6.28) * 0.1);

    // Grid system 2: Box lattice with sine wave modulation
    vec3 boxGridSize = vec3(2.5);
    vec3 boxP = repeat(p + vec3(1.25), boxGridSize);
    vec3 boxId = floor((p + vec3(1.25) + 0.5 * boxGridSize) / boxGridSize);
    float boxHash = hash(boxId);

    // Modulate size with sine waves
    float sizeModulation = sin(length(boxId) * 0.5 + u_time) * 0.5 + 0.5;
    float boxGrid = sdBox(boxP, vec3(0.2 + sizeModulation * 0.15));

    // Central sphere with golden ratio scaling
    float centralSphere = sdSphere(p, 1.5 + sin(u_time * PHI) * 0.3);

    // Toroidal structure following parametric equation
    vec3 torusP = p;
    torusP.yz *= rot(u_time * 0.4);
    float majorR = 3.0 + sin(u_time * 0.7) * 0.5;
    float minorR = 0.3;
    vec2 q = vec2(length(torusP.xz) - majorR, torusP.y);
    float torusMain = length(q) - minorR;

    // Mandelbrot-inspired displacement
    float displacement = sin(10.0 * originalP.x + u_time) *
                        sin(10.0 * originalP.y - u_time * 0.7) *
                        sin(10.0 * originalP.z + u_time * 0.5) * 0.05;

    // Combine all elements
    float d = min(octGrid, boxGrid);
    d = max(d, -centralSphere); // Carve out center
    d += displacement; // Add surface detail
    d = min(d, torusMain);

    // Add FBM displacement for organic feel
    d += fbm(originalP * 2.0 + u_time * 0.2) * 0.05;

    return d;
}

// Calculate normal for lighting
vec3 calcNormal(vec3 p) {
    const float h = 0.001;
    const vec2 k = vec2(1, -1);
    return normalize(k.xyy * map(p + k.xyy * h) +
                     k.yyx * map(p + k.yyx * h) +
                     k.yxy * map(p + k.yxy * h) +
                     k.xxx * map(p + k.xxx * h));
}

// Raymarching function
float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001 || t > 100.0) break;
        t += d;
    }
    return t;
}

void main() {
    // Normalize coordinates
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // Camera setup
    vec3 ro = vec3(0.0, 0.0, 8.0); // ray origin
    vec3 rd = normalize(vec3(uv, -1.0)); // ray direction

    // Rotate camera
    rd.xz *= rot(sin(u_time * 0.1) * 0.3);
    rd.yz *= rot(cos(u_time * 0.15) * 0.2);

    // Raymarch
    float t = rayMarch(ro, rd);

    // Background color
    vec3 col = mix(color9, color1, uv.y * 0.5 + 0.5);
    col = mix(col, color8, length(uv) * 0.3);

    // If we hit something
    if (t < 100.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // Multiple light sources
        vec3 lightPos1 = vec3(sin(u_time) * 5.0, 5.0, cos(u_time) * 5.0);
        vec3 lightPos2 = vec3(-sin(u_time * 0.7) * 4.0, 3.0, -cos(u_time * 0.7) * 4.0);
        vec3 lightDir1 = normalize(lightPos1 - p);
        vec3 lightDir2 = normalize(lightPos2 - p);

        // Diffuse lighting from multiple sources
        float diff1 = max(dot(n, lightDir1), 0.0);
        float diff2 = max(dot(n, lightDir2), 0.0);

        // Specular lighting
        vec3 viewDir = normalize(ro - p);
        vec3 halfDir1 = normalize(lightDir1 + viewDir);
        vec3 halfDir2 = normalize(lightDir2 + viewDir);
        float spec1 = pow(max(dot(n, halfDir1), 0.0), 32.0);
        float spec2 = pow(max(dot(n, halfDir2), 0.0), 16.0);

        // Mathematical color distribution using FBM and grid patterns
        float colorNoise = fbm(p * 1.5 + u_time * 0.1);
        float gridPattern = sin(p.x * PI * 2.0) * sin(p.y * PI * 2.0) * sin(p.z * PI * 2.0);

        // Create color layers using golden ratio and Fibonacci patterns
        float layer1 = sin(length(p) * PHI - u_time) * 0.5 + 0.5;
        float layer2 = sin(atan(p.y, p.x) * 8.0 + u_time * 0.5) * 0.5 + 0.5;
        float layer3 = sin(length(p.xz) * 3.0 + p.y - u_time * 0.3) * 0.5 + 0.5;

        // Build base color from mathematical patterns
        vec3 objColor = mix(color1, color2, layer1);
        objColor = mix(objColor, color3, layer2 * colorNoise);
        objColor = mix(objColor, color4, layer3);

        // Add grid-influenced coloring
        objColor = mix(objColor, color7, gridPattern * 0.3 * (sin(u_time * 0.5) * 0.5 + 0.5));

        // Distance-based color variation
        float distField = length(mod(p, 2.0) - 1.0);
        objColor = mix(objColor, color6, smoothstep(0.3, 0.7, distField) * 0.4);

        // Fresnel effect with color variation
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        vec3 fresnelColor = mix(color7, color6, sin(u_time * 0.3) * 0.5 + 0.5);

        // Combine lighting with color-tinted lights
        col = objColor * (diff1 * 0.6 + diff2 * 0.4 + 0.2);
        col += color5 * spec1 * 0.8;
        col += color3 * spec2 * 0.5;
        col += fresnelColor * fresnel * 0.4;

        // Add ambient occlusion approximation
        float ao = 1.0 - smoothstep(0.0, 2.0, t * 0.1);
        col *= ao * 0.3 + 0.7;

        // Atmospheric depth with color shift
        vec3 fogColor = mix(color1, color8, sin(u_time * 0.2) * 0.5 + 0.5);
        col = mix(col, fogColor, smoothstep(0.0, 50.0, t) * 0.6);

        // Add rim lighting effect
        float rim = 1.0 - max(dot(n, viewDir), 0.0);
        rim = smoothstep(0.6, 1.0, rim);
        col += color4 * rim * 0.3;
    } else {
        // Procedural starfield using mathematical patterns
        vec2 starUV = uv * 20.0;
        vec2 starId = floor(starUV);
        vec2 starLocal = fract(starUV);

        float starHash = fract(sin(dot(starId, vec2(12.9898, 78.233))) * 43758.5453);
        float starDist = length(starLocal - 0.5);
        float star = smoothstep(0.05, 0.0, starDist) * step(0.95, starHash);

        // Twinkling stars
        star *= sin(u_time * 3.0 + starHash * 6.28) * 0.5 + 0.5;

        col += mix(color5, color6, starHash) * star * 0.8;

        // Nebula effect in background
        float nebula = fbm(vec3(uv * 2.0, u_time * 0.05));
        col += mix(color2, color8, nebula) * nebula * 0.15;
    }

    // Vignette
    col *= 1.0 - length(uv) * 0.3;

    // Color grading
    col = pow(col, vec3(0.9)); // Slight gamma adjustment

    fragColor = vec4(col, 1.0);
}
