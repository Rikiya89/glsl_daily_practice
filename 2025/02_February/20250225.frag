uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

// 2D rotation matrix helper
mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// Basic hash-based noise
float hash(vec2 p) {
    p = fract(p * vec2(5.3983, 5.4427));
    p += dot(p, p + 3.45);
    return fract(p.x * p.y);
}

// Simple noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal Brownian Motion for nebula texture
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    // Normalize and center coordinates
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    
    // Add liquid, time-based distortion for dynamic motion
    uv += 0.015 * vec2(sin(uv.y * 10.0 + u_time * 2.0),
                        cos(uv.x * 10.0 + u_time * 2.0));
    
    // Compute distance from center and add a spiritual swirl
    float len = length(uv);
    float swirlAngle = 0.7 * len * sin(u_time * 0.5);
    uv = rotate(swirlAngle) * uv;
    len = length(uv);
    
    // Background: a radial gradient modulated with time
    float radial = smoothstep(0.9, 0.2, len + 0.1 * sin(u_time * 0.3));
    
    // Nebula texture from fractal noise for cosmic complexity
    float nebula = fbm(uv * 3.0 + u_time * 0.2) * 0.25;
    
    // Sacred geometry: a meditative flower pattern
    float sacred = 0.0;
    float numCircles = 12.0;
    for (float i = 0.0; i < numCircles; i++) {
        float angle = (i / numCircles) * 6.28318 + u_time * 0.25;
        vec2 offset = vec2(cos(angle), sin(angle)) * 0.4;
        offset += 0.02 * vec2(sin(u_time * 2.0 + i), cos(u_time * 2.0 - i));
        float d = length(uv - offset);
        sacred += smoothstep(0.025, 0.005, d);
    }
    float centralSacred = smoothstep(0.025, 0.005, len);
    sacred += centralSacred;
    
    // Luminous beams radiating from the center
    float ang = atan(uv.y, uv.x);
    float beams = smoothstep(0.0, 0.1, abs(sin(10.0 * ang - u_time)));
    
    // Animated ripples: expanding circular waves
    float ripple = sin(20.0 * (len - u_time * 0.5)) * 0.02;
    
    // Twinkling star-like sparkles using noise
    float sparkle = step(0.95, fract(sin(dot(uv * 50.0, vec2(12.9898, 78.233))) * 43758.5453 + u_time));
    sparkle *= 0.05;
    
    // Aurora overlay: a drifting color gradient based on UV and time
    float auroraFactor = smoothstep(0.3, 0.0, abs(uv.x + 0.2 * sin(u_time * 1.0)));
    vec3 auroraColor = mix(vec3(0.8, 0.5, 1.0), vec3(1.0, 0.7, 0.3), auroraFactor);
    
    // Spiritual color palette: mystical purples, pinks, blues, and gentle golds
    vec3 baseColor = vec3(0.4, 0.3, 0.6);
    baseColor = mix(baseColor, vec3(0.9, 0.6, 0.4), 0.3 + 0.3 * sin(u_time * 0.2));
    
    // Combine layers: geometry, nebula, beams, ripples, sparkles, and aurora
    vec3 color = baseColor * sacred * radial;
    color += vec3(1.0, 0.8, 0.5) * beams * 0.5;
    color += nebula;
    color += vec3(ripple);
    color += sparkle;
    color = mix(color, auroraColor, 0.3);
    
    // Add a subtle, expanding aura glow near the center
    float aura = 0.25 / (len + 0.1);
    color += vec3(aura * 0.8, aura * 0.7, aura * 1.0);
    
    // Overall pulsation to simulate a gentle, spiritual heartbeat
    color *= 1.0 + 0.1 * sin(u_time * 1.5);
    
    // Final boost: enhance vibrancy and luminance
    color = pow(color, vec3(1.3));
    color *= 1.8;
    
    fragColor = vec4(color, 1.0);
}
