// "Ethereal Radiant Mandala" Shader
//
// Uniforms expected:
//   - u_time (float): Time in seconds
//   - u_resolution (vec2): The width and height of the viewport
//
// The final color is written to fragColor.

uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

#define PI 3.14159265359

// ---------------------------------------------------
// 1) Noise and Fractal Functions
// ---------------------------------------------------
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.78));
    p += dot(p, p + 23.45);
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
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
        value += amp * noise2D(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return value;
}

// ---------------------------------------------------
// 2) Hue Rotation Utility
// ---------------------------------------------------
vec3 hueShift(float h) {
    h = fract(h);
    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

// ---------------------------------------------------
// 3) Main Shader Function: Ethereal Radiant Mandala
// ---------------------------------------------------
void main() {
    // Normalize coordinates (center at (0,0))
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    
    // Apply a gentle time-dependent zoom and swirl distortion
    float zoom = 1.0 + 0.1 * sin(u_time * 0.4);
    uv *= zoom;
    float ang = atan(uv.y, uv.x);
    float rad = length(uv);
    ang += 0.2 * sin(u_time + rad * 12.0);
    uv = vec2(rad * cos(ang), rad * sin(ang));
    
    // Convert to polar coordinates
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    
    // Apply ultra-fine kaleidoscopic symmetry with 24 segments
    float segments = 24.0;
    a = mod(a, 2.0 * PI / segments);
    a = abs(a - PI / segments);
    
    // ---------------------------------------------------
    // Layer 1: Radiant Petals
    // Use a sine modulation to create soft, swirling petal shapes
    float petals = smoothstep(0.42, 0.44, abs(sin(14.0 * a + u_time * 2.0)));
    
    // ---------------------------------------------------
    // Layer 2: Fractal Texture
    // Map polar coordinates into FBM space for organic, fine detail
    float fractal = fbm(vec2(r * 10.0, a * 10.0));
    
    // ---------------------------------------------------
    // Layer 3: Radial Beams
    // High-frequency sine waves generate glimmering, radiating beams
    float beams = sin(40.0 * r - u_time * 2.5);
    
    // ---------------------------------------------------
    // Layer 4: Ambient Particle Field
    // A dense overlay of tiny, twinkling particles enhances the ethereal feel
    vec2 partUV = fract(uv * 25.0 + u_time * 0.7);
    float particles = smoothstep(0.3, 0.0, length(partUV - 0.5));
    
    // ---------------------------------------------------
    // Composite Mandala Pattern
    float pattern = petals + 0.5 * fractal + 0.4 * beams;
    vec3 mandalaColor = hueShift(0.8 + 0.3 * sin(u_time + r * 12.0));
    mandalaColor *= pattern;
    
    // ---------------------------------------------------
    // Background: Deep Nebula and Ambient Haze
    float nebula = fbm(uv * 3.5 + u_time * 0.15);
    vec3 bgColor = mix(vec3(0.03, 0.02, 0.08), vec3(0.1, 0.15, 0.4), nebula);
    bgColor *= smoothstep(1.0, 0.2, r);
    
    // ---------------------------------------------------
    // Central Glow: Radiant Bloom at the Core
    float glow = 1.0 - smoothstep(0.0, 0.5, r);
    vec3 glowColor = vec3(1.0, 0.96, 0.9) * glow * 0.6;
    
    // ---------------------------------------------------
    // Particle Overlay: Enhance with Sparkling Stars
    vec3 particleColor = vec3(1.0, 0.97, 0.92) * particles * 0.35;
    
    // ---------------------------------------------------
    // Final Composite: Blend all layers together
    vec3 finalColor = mandalaColor + bgColor + glowColor + particleColor;
    
    // Apply final gamma correction for smooth transitions
    finalColor = pow(finalColor, vec3(1.4));
    
    fragColor = vec4(finalColor, 1.0);
}
