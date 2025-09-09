// "Immersive Animated Flower of Life" Shader
//
// Uniforms expected:
//   - u_time (float): Time in seconds
//   - u_resolution (vec2): The width and height of the viewport
//
// The final color is written to fragColor.

uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

// ---------------------------------------------------
// 1) Basic hash and noise functions with fbm
// ---------------------------------------------------
float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise2D(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// ---------------------------------------------------
// 2) Hue rotation utility (HSV-like)
// ---------------------------------------------------
vec3 hueColor(float h) {
    h = fract(h);
    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

// ---------------------------------------------------
// 3) Circle ring function with soft glow
// ---------------------------------------------------
float circleRing(vec2 pos, vec2 center, float radius, float thickness) {
    float dist = abs(length(pos - center) - radius);
    return smoothstep(thickness, 0.0, dist);
}

// ---------------------------------------------------
// 4) Immersive Flower of Life pattern with animated rotation & vortex warp
// ---------------------------------------------------
float flowerOfLife(vec2 uv) {
    float R = 0.35;
    // Pulsating ring thickness for a breathing effect
    float ringThickness = 0.015 + 0.005 * sin(u_time * 2.0);
    float coverage = 0.0;
    
    // Introduce a subtle vortex distortion to simulate depth
    float vortex = 0.1 * sin(u_time + length(uv) * 10.0);
    float angleOffset = vortex;
    
    // Global rotation offset for the entire pattern
    float rotationOffset = u_time * 0.15;
    
    // Central circle
    coverage += circleRing(uv, vec2(0.0), R, ringThickness);
    
    // First ring (6 circles)
    for (int i = 0; i < 6; i++) {
        float angle = 2.0 * 3.14159 * float(i) / 6.0 + rotationOffset + angleOffset;
        vec2 c = vec2(cos(angle), sin(angle)) * R;
        coverage += circleRing(uv, c, R, ringThickness);
    }
    
    // Second ring (12 circles)
    for (int i = 0; i < 12; i++) {
        float angle = 2.0 * 3.14159 * float(i) / 12.0 + rotationOffset + angleOffset;
        vec2 c = vec2(cos(angle), sin(angle)) * (2.0 * R);
        coverage += circleRing(uv, c, R, ringThickness);
    }
    
    // Optional Third ring (18 circles) for added depth
    for (int i = 0; i < 18; i++) {
        float angle = 2.0 * 3.14159 * float(i) / 18.0 + rotationOffset + angleOffset;
        vec2 c = vec2(cos(angle), sin(angle)) * (3.0 * R);
        coverage += circleRing(uv, c, R, ringThickness);
    }
    
    return coverage;
}

// ---------------------------------------------------
// 5) Animated particle field for immersive foreground sparkle
// ---------------------------------------------------
float particles(vec2 uv, float scale) {
    // Create a moving grid of particles
    vec2 grid = fract(uv * scale);
    vec2 id = floor(uv * scale);
    float n = noise2D(id + u_time * 0.1);
    // Particles appear when within a small central region of each cell
    float particle = smoothstep(0.3, 0.2, length(grid - 0.5));
    return particle * n;
}

// ---------------------------------------------------
// 6) Main shader function: Layering immersive animation
// ---------------------------------------------------
void main() {
    // Normalize coordinates with a subtle time-based zoom to enhance immersion
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    uv *= 1.0 + 0.05 * sin(u_time * 0.5);
    
    float len = length(uv);
    float angle = atan(uv.y, uv.x);
    
    // Layer 1: Immersive Background
    // Apply a slow rotation and warp to create a fluid, organic backdrop
    vec2 bgUV = uv;
    float bgRotation = 0.1 * u_time;
    float ca = cos(bgRotation);
    float sa = sin(bgRotation);
    bgUV = vec2(bgUV.x * ca - bgUV.y * sa, bgUV.x * sa + bgUV.y * ca);
    float bgNoise = fbm(bgUV * 2.0 + u_time * 0.2);
    vec3 bgColor = mix(vec3(0.05, 0.02, 0.1), vec3(0.1, 0.15, 0.3), bgNoise);
    bgColor *= smoothstep(1.2, 0.0, len);
    
    // Layer 2: Immersive Flower of Life Pattern
    // Add an additional swirling effect to the pattern for a sense of depth
    vec2 patternUV = uv;
    float swirlAmount = 0.5 * sin(len * 4.0 - u_time * 0.3);
    float pca = cos(swirlAmount);
    float psa = sin(swirlAmount);
    patternUV = vec2(patternUV.x * pca - patternUV.y * psa, patternUV.x * psa + patternUV.y * pca);
    float pattern = flowerOfLife(patternUV);
    
    // Base hue modulated over time and space for a vibrant look
    float baseHue = 0.55 + 0.1 * sin(u_time * 0.4);
    float hueMod = baseHue + 0.1 * sin(angle * 5.0) + 0.15 * sin(len * 3.0 - u_time * 0.6);
    vec3 patternColor = hueColor(hueMod);
    vec3 patternLayer = patternColor * pattern * (1.0 - smoothstep(0.0, 1.2, len));
    
    // Layer 3: Animated Particle Foreground
    float part = particles(uv, 20.0);
    vec3 particleColor = vec3(1.0, 0.9, 0.8) * part;
    
    // Combine layers using additive blending
    vec3 color = bgColor + patternLayer + particleColor;
    
    // Add a deep cosmic glow that intensifies near the center
    float glow = 0.25 / (len + 0.1);
    color += glow * vec3(1.2, 1.1, 0.9);
    
    // Final gamma correction and brightness boost for a truly immersive feel
    color = pow(color, vec3(1.4));
    color *= 1.8;
    
    fragColor = vec4(color, 1.0);
}
