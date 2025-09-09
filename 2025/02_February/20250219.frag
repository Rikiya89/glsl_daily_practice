uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

//--------------------------------------------------
// Utility Functions
//--------------------------------------------------

// Pseudo-random function for noise
float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898,78.233))) * 43758.5453123);
}

// Basic noise function for organic texture
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x)
         + (c - a) * u.y * (1.0 - u.x)
         + (d - b) * u.x * u.y;
}

// 2D rotation function
vec2 rotate(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

//--------------------------------------------------
// Complex Animated Shape SDF Function
//--------------------------------------------------

// Combines multiple animated effects:
// 1. A mandala petal pattern with time-varying petal count and amplitude.
// 2. A pulsating ring.
// 3. A fractal folding effect whose parameters breathe with time.
float complexSDF(vec2 p) {
    float d = 1e5;
    
    // --- Mandala Petal Pattern Animation ---
    float petals = 8.0 + 2.0 * sin(u_time * 0.5); // Oscillating petal count
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float modAngle = mod(angle, 2.0 * 3.14159265 / petals) - (3.14159265 / petals);
    // Time-modulated petal amplitude creates a breathing effect
    float petal = radius - (0.5 + 0.3 * cos(3.0 * modAngle + u_time * 0.5));
    d = min(d, petal);
    
    // --- Pulsating Ring ---
    float ring = abs(radius - (0.7 + 0.1 * sin(u_time * 2.0)));
    d = min(d, ring);
    
    // --- Fractal Folding with Time-based Modulation ---
    vec2 pFold = p;
    // Increased from 4 to 5 iterations for more detail
    for (int i = 0; i < 5; i++) {
        // Introduce a slight time offset for a breathing fractal effect
        pFold = abs(pFold) - (0.25 + 0.05 * sin(u_time + float(i)));
        // Add minor time-based rotation variation
        pFold = rotate(pFold, 0.3 + u_time * 0.05 + 0.02 * sin(u_time + float(i) * 1.3));
    }
    float fold = length(pFold) - (0.3 + 0.05 * cos(u_time));
    d = min(d, fold);
    
    return d;
}

//--------------------------------------------------
// Dynamic Color Palette Function
//--------------------------------------------------

// Computes a dynamic color blending a mystical gradient with time-based highlights.
vec3 getColor(float d, vec2 p) {
    // Base gradient: from deep indigo to shimmering cyan
    vec3 baseColor = mix(
        vec3(0.1, 0.0, 0.2),
        vec3(0.0, 0.5, 0.7),
        smoothstep(0.0, 1.0, length(p))
    );
    
    // Time-evolving highlights for a vibrant, animated feel
    vec3 dynamic = 0.5 + 0.5 * cos(u_time + p.xyx * 4.0 + vec3(0.0, 1.0, 2.0));
    
    // Mix the colors with an animated factor
    float mixFactor = smoothstep(0.0, 0.5, d) * (0.5 + 0.5 * sin(u_time * 1.5));
    return mix(baseColor, dynamic, mixFactor);
}

//--------------------------------------------------
// Main Fragment Shader
//--------------------------------------------------
void main() {
    // Normalize and center coordinates using the smaller dimension to preserve aspect ratio
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Shift horizontally (user-chosen offset) to recenter shape
    uv.x += -0.142;

    // --- Subtle Swirl Distortion ---
    // Gently warp the coordinates for a flowing effect
    float swirlFactor = 0.15 * sin(u_time * 0.3);
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    a += swirlFactor * r * 2.0;
    uv = vec2(cos(a), sin(a)) * r;

    // Apply a gentle, time-modulated global rotation
    uv = rotate(uv, u_time * 0.1);
    
    // Compute the SDF for the complex animated shape
    float d = complexSDF(uv);
    
    // Create a smooth, animated mask for the shape's edge
    float shapeMask = smoothstep(0.02 + 0.005 * sin(u_time * 2.0), -0.02, d);
    
    // Calculate the animated color for the shape
    vec3 shapeColor = getColor(d, uv) * shapeMask;
    
    // Background: a dynamic radial gradient that subtly pulsates over time
    vec3 bg = mix(vec3(0.05, 0.02, 0.1), vec3(0.0), length(uv) + 0.05 * sin(u_time));
    
    // Blend the shape with the background
    vec3 color = mix(bg, shapeColor, shapeMask);
    
    // Add a soft, animated glow along the shape edges
    float glow = 0.08 / (abs(d) + 0.01);
    glow *= (0.5 + 0.5 * sin(u_time * 3.0));
    color += vec3(glow);
    
    // Overlay a gentle noise texture for extra organic animated detail
    float n = noise(uv * 5.0 + u_time * 0.3) * 0.05;
    color += n;
    
    // Final color enhancement for a polished, luminous animated appearance
    color = pow(color, vec3(1.25));
    
    fragColor = vec4(color, 1.0);
}
