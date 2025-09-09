// TouchDesigner GLSL TOP - Ultimate Spiritual Sacred Geometry Shader
uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

// Golden Ratio constant
const float PHI = 1.61803398875;
const float PI = 3.14159265359;

// Function to create a hexagonal grid (Sri Yantra-like Pattern)
vec2 sacredGrid(vec2 p) {
    vec2 q = vec2(p.x * 2.0, p.y * 1.73205);
    vec2 r = vec2(q.x + q.y, q.y - q.x) / 2.0;
    return fract(r) - 0.5;
}

// Smooth sin-based pulsing
float smoothBreath(float t) {
    return 0.5 + 0.5 * sin(t);
}

void main()
{
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord / uResolution; // Normalize UV
    vec2 aspectFix = vec2(uResolution.x / uResolution.y, 1.0);
    
    vec2 p = (uv - 0.5) * aspectFix * 2.0; // Center UV
    float time = uTime * 0.6;  // More meditative pace

    //Sri Yantra / Sacred Grid Pattern
    vec2 gridPos = sacredGrid(p * 10.0);
    float gridPattern = smoothstep(0.3, 0.0, length(gridPos));

    //Fractal Golden Ratio Spiral Motion
    float d = length(p);
    float goldenSpiral = sin(d * 16.0 * PHI - time * 1.8) * cos(d * 12.0 - time * 1.5) * 0.6;

    //Torus Energy Flow (Prana Circulation)
    float torusFlow = sin(p.x * 14.0 + time * 2.4) * cos(p.y * 14.0 - time * 2.2) * 0.4;

    //Breathing Expansion / Contraction
    float breath = smoothBreath(time * 1.2) * 0.5 + 0.5;

    //Cosmic Vibrations / Resonance (Kaleidoscopic Effect)
    float resonance = sin(p.x * 8.0 + sin(time * 0.7) * 5.0) * 
                      cos(p.y * 8.0 - cos(time * 0.9) * 5.0) * 0.3;

    //Mystical Light Blending
    vec3 color = vec3(
        0.6 + 0.4 * sin(time + goldenSpiral + resonance),  // Reds & Deep Violets
        0.5 + 0.5 * cos(time * 1.4 + torusFlow),  // Blues & Greens
        0.7 + 0.3 * sin(d * 5.0 - time * 1.0)  // Golden Magentas
    );

    //Glowing Light Field
    float glow = exp(-d * 1.3) * 4.5 + smoothstep(0.15, 0.0, d) * 0.6;
    color *= glow * breath;

    //Sri Yantra Overlay for Cosmic Symmetry
    color += gridPattern * 0.5;  

    // Enhance vibrancy & depth
    color = pow(color, vec3(1.5));

    fragColor = vec4(color, 1.0);
}
