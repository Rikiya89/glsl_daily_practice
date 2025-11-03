// TouchDesigner GLSL TOP - Pixel Shader
// Ultra Beautiful 3D Raymarching Scene
// Theme: Ethereal Purple-Blue Cosmic Dreams

out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// Your exquisite color palette
const vec3 col1 = vec3(0.212, 0.176, 0.471); // #362d78
const vec3 col2 = vec3(0.322, 0.247, 0.639); // #523fa3
const vec3 col3 = vec3(0.569, 0.424, 0.800); // #916ccc
const vec3 col4 = vec3(0.741, 0.631, 0.898); // #bda1e5
const vec3 col5 = vec3(0.784, 0.753, 0.914); // #c8c0e9
const vec3 col6 = vec3(0.518, 0.729, 0.906); // #84bae7
const vec3 col7 = vec3(0.318, 0.416, 0.831); // #516ad4
const vec3 col8 = vec3(0.200, 0.247, 0.529); // #333f87
const vec3 col9 = vec3(0.161, 0.188, 0.224); // #293039
const vec3 col10 = vec3(0.157, 0.212, 0.192); // #283631

#define PI 3.14159265359

// Smooth minimum for organic blending
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

// Rotation matrices
mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

mat3 rotateX(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

// Enhanced 3D noise
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3d(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(mix(hash(p + vec3(0, 0, 0)), hash(p + vec3(1, 0, 0)), f.x),
            mix(hash(p + vec3(0, 1, 0)), hash(p + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash(p + vec3(0, 0, 1)), hash(p + vec3(1, 0, 1)), f.x),
            mix(hash(p + vec3(0, 1, 1)), hash(p + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Fractal Brownian Motion with more octaves
float fbm(vec3 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 6; i++) {
        f += amp * noise3d(p);
        p = p * 2.32;
        amp *= 0.5;
    }
    return f;
}

// Domain repetition
vec3 opRep(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

// SDF primitives
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

// Complex scene with multiple elements
float map(vec3 p) {
    vec3 q = p;
    float time = u_time * 0.5;

    // Main centerpiece - morphing torus
    vec3 p1 = q;
    p1 = rotateY(time * 0.3) * p1;
    p1 = rotateX(sin(time * 0.4) * 0.5) * p1;
    p1.y += sin(p1.x * 2.0 + time) * 0.2;
    p1.x += cos(p1.z * 2.0 + time * 0.8) * 0.2;
    float torusSize = 1.8 + sin(time * 0.6) * 0.2;
    float d = sdTorus(p1, vec2(torusSize, 0.35));

    // Inner rotating sphere with displacement
    vec3 p2 = q;
    p2 = rotateY(-time * 0.8) * p2;
    float sphere1 = sdSphere(p2, 1.0);
    sphere1 += sin(p2.x * 10.0 + time * 2.0) * sin(p2.y * 10.0 - time * 2.0) * sin(p2.z * 10.0 + time) * 0.05;
    d = smin(d, sphere1, 0.8);

    // Orbiting octahedrons
    for(float i = 0.0; i < 4.0; i++) {
        float angle = time * 0.7 + i * PI * 0.5;
        vec3 p3 = q;
        p3.xz *= rot(angle);
        p3.x -= 2.5 + sin(time * 0.5 + i) * 0.3;
        p3.yz *= rot(time * (1.0 + i * 0.3));
        float octa = sdOctahedron(p3, 0.25);
        d = smin(d, octa, 0.4);
    }

    // Flowing capsules creating ribbons
    for(float i = 0.0; i < 3.0; i++) {
        float t = time * 0.6 + i * 2.094;
        vec3 p4 = q;
        p4 = rotateY(t) * p4;
        vec3 a = vec3(0.0, sin(t * 1.5) * 1.5, -2.0);
        vec3 b = vec3(0.0, cos(t * 1.5) * 1.5, 2.0);
        float caps = sdCapsule(p4, a, b, 0.15);
        d = smin(d, caps, 0.5);
    }

    // Outer shell with holes
    vec3 p5 = q;
    p5 = rotateY(time * 0.2) * p5;
    float shell = abs(sdSphere(p5, 3.2)) - 0.05;
    vec3 p5Rep = opRep(p5, vec3(0.8));
    float holes = sdSphere(p5Rep, 0.3);
    shell = max(shell, -holes);
    d = smin(d, shell, 1.2);

    // Small orbiting spheres (particles)
    vec3 p6 = q;
    p6.xz *= rot(time * 1.2);
    p6.yz *= rot(time * 0.9);
    vec3 p6Rep = opRep(p6 - vec3(2.8, 0, 0), vec3(1.4));
    float particles = sdSphere(p6Rep, 0.08);
    d = smin(d, particles, 0.3);

    // Add organic displacement
    d += fbm(q * 1.5 + time * 0.3) * 0.1;
    d += sin(q.x * 5.0 + time) * cos(q.y * 5.0 - time) * sin(q.z * 5.0 + time) * 0.02;

    return d;
}

// Enhanced normal calculation
vec3 calcNormal(vec3 p) {
    const float h = 0.0001;
    const vec2 k = vec2(1, -1);
    return normalize(
        k.xyy * map(p + k.xyy * h) +
        k.yyx * map(p + k.yyx * h) +
        k.yxy * map(p + k.yxy * h) +
        k.xxx * map(p + k.xxx * h)
    );
}

// Ambient occlusion
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = map(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

// Enhanced raymarching with glow accumulation
vec2 raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    float glow = 0.0;
    for(int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);

        // Accumulate glow
        glow += 0.01 / (0.1 + abs(d));

        if(d < 0.001) break;
        if(t > 30.0) {
            t = 30.0;
            break;
        }
        t += d * 0.6;
    }
    return vec2(t, glow);
}

// Dynamic color palette cycling
vec3 getColor(float t, vec3 normal, vec3 p) {
    float time = u_time * 0.5;

    // Multiple color gradients based on position
    float grad1 = sin(p.y * 3.0 + time * 0.7) * 0.5 + 0.5;
    float grad2 = sin(length(p.xz) * 2.0 - time) * 0.5 + 0.5;
    float grad3 = sin(p.x * 2.0 + p.z * 2.0 + time * 0.5) * 0.5 + 0.5;
    float grad4 = (normal.y * 0.5 + 0.5);

    // Base color mixing
    vec3 color = mix(col1, col2, grad1);
    color = mix(color, col3, grad2 * 0.7);
    color = mix(color, col7, grad3 * 0.5);

    // Add depth-based coloring
    float depth = length(p);
    color = mix(color, col8, smoothstep(2.0, 4.0, depth) * 0.3);

    // Normal-based highlights
    color = mix(color, col4, grad4 * 0.6);
    color = mix(color, col5, pow(grad4, 3.0) * 0.4);

    // Add ambient variations
    float ambient = (sin(normal.x * 2.0) * 0.5 + 0.5);
    color = mix(color, col6, ambient * 0.3);

    // Add noise-based color variation
    float noiseCol = fbm(p * 2.0 + time * 0.2);
    color = mix(color, col3, noiseCol * 0.2);

    return color;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    float time = u_time * 0.5;

    // Dynamic camera movement
    vec3 ro = vec3(0.0, 0.0, 6.0);  // Closer camera (was 6.0)
    ro.xz *= rot(time * 0.15);
    ro.y += sin(time * 0.3) * 0.8;
    ro.xy *= rot(sin(time * 0.2) * 0.2);

    vec3 target = vec3(0.0, 0.0, 0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0, 1, 0), forward));
    vec3 up = cross(forward, right);

    vec3 rd = normalize(forward + uv.x * right + uv.y * up);

    // Beautiful gradient background
    vec3 bgColor = mix(col9, col8, uv.y * 0.5 + 0.5);
    bgColor = mix(bgColor, col10, length(uv) * 0.4);
    bgColor = mix(bgColor, col1 * 0.5, smoothstep(0.5, 0.0, length(uv)));

    // Add stars to background
    float stars = pow(hash(vec3(uv * 50.0, 1.0)), 30.0) * 0.5;
    bgColor += col5 * stars;

    // Raymarch
    vec2 result = raymarch(ro, rd);
    float t = result.x;
    float glow = result.y;

    vec3 color = bgColor;

    if(t < 30.0) {
        vec3 p = ro + rd * t;
        vec3 normal = calcNormal(p);

        // Surface color
        vec3 surfaceColor = getColor(t, normal, p);

        // Multiple light sources
        vec3 light1Pos = vec3(sin(time * 0.7) * 4.0, 3.0, cos(time * 0.7) * 4.0);
        vec3 light2Pos = vec3(-sin(time * 0.5) * 3.0, -2.0, cos(time * 0.5) * 3.0);

        vec3 light1Dir = normalize(light1Pos - p);
        vec3 light2Dir = normalize(light2Pos - p);

        // Diffuse lighting
        float diff1 = max(dot(normal, light1Dir), 0.0);
        float diff2 = max(dot(normal, light2Dir), 0.0) * 0.6;

        // Specular highlights
        vec3 viewDir = normalize(ro - p);
        vec3 halfDir1 = normalize(light1Dir + viewDir);
        vec3 halfDir2 = normalize(light2Dir + viewDir);
        float spec1 = pow(max(dot(normal, halfDir1), 0.0), 64.0);
        float spec2 = pow(max(dot(normal, halfDir2), 0.0), 32.0);

        // Fresnel / rim lighting
        float rim = 1.0 - max(dot(viewDir, normal), 0.0);
        rim = pow(rim, 3.0);

        // Ambient occlusion
        float ao = calcAO(p, normal);

        // Subsurface scattering approximation
        float sss = pow(clamp(dot(viewDir, -light1Dir) + 1.0, 0.0, 1.0), 3.0) * 0.3;

        // Combine lighting
        color = surfaceColor * (0.2 + diff1 * 0.6 + diff2 * 0.3) * ao;
        color += col5 * spec1 * 1.5;
        color += col6 * spec2 * 0.8;
        color += mix(col3, col6, 0.5) * rim * 0.8;
        color += col4 * sss;

        // Atmospheric fog with color
        float fogAmount = 1.0 - exp(-t * 0.08);
        vec3 fogColor = mix(bgColor, col2 * 0.3, 0.5);
        color = mix(color, fogColor, fogAmount);

        // Add internal glow
        color += col3 * (1.0 - t / 30.0) * 0.15;
    }

    // Add glow effect from raymarch
    color += col3 * glow * 0.02;
    color += col6 * glow * 0.01;

    // Enhanced vignette
    float vignette = 1.0 - pow(length(uv) * 0.7, 2.0);
    color *= vignette;

    // Color grading
    color = pow(color, vec3(0.85)); // Gamma
    color = mix(color, col2 * 0.15, 0.08); // Color tint

    // Chromatic aberration (subtle)
    float aberration = length(uv) * 0.01;

    // Contrast and saturation boost
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.15);
    color = pow(color, vec3(1.0, 0.98, 0.96)); // Subtle color shift

    // Bloom simulation
    float bloom = smoothstep(0.8, 1.5, dot(color, vec3(0.333)));
    color += col5 * bloom * 0.2;

    fragColor = vec4(color, 1.0);
}
