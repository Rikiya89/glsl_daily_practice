uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution / 2.0) / u_resolution.y;
    float len = length(uv);

    // Base radial gradient for depth and cosmic feel
    float radialGradient = smoothstep(0.4, 1.2, len);

    // Flower of Life geometry pattern
    float flower = 0.0;
    float numCircles = 18.0; // Increased for more intricate pattern
    for (float i = 0.0; i < numCircles; i++) {
        float angle = (i / numCircles) * 2.0 * 3.14159 + u_time * 0.2;
        vec2 offset = vec2(cos(angle), sin(angle)) * 0.35;
        float dist = length(uv - offset);
        flower += smoothstep(0.008, 0.015, 0.015 - dist);
    }

    // Add central circle for Flower of Life
    float centralCircle = smoothstep(0.008, 0.015, 0.015 - len);
    flower += centralCircle;

    // Pulsating energy rings with smoother transitions
    float energyRings = 0.5 * sin(len * 25.0 - u_time * 3.0) + 0.5;
    energyRings *= smoothstep(0.15, 0.45, len) * 0.9;

    // Subtle color blending based on flower pattern
    vec3 color = vec3(0.0);
    color.r = sin(u_time * 0.5) * 0.5 + 0.5;
    color.g = sin(u_time * 0.7 + 1.2) * 0.5 + 0.5;
    color.b = sin(u_time * 0.9 + 2.5) * 0.5 + 0.5;

    color *= flower * radialGradient;

    // Add a glowing aura around the pattern
    float glow = 0.15 / (len + 0.12);
    color += vec3(glow * 1.3, glow * 1.0, glow * 0.9);

    // Enhance with dynamic, harmonious gradients
    float gradientEffect = sin(len * 20.0 + u_time * 1.8) * 0.12;
    color += vec3(gradientEffect * 0.6, gradientEffect * 0.7, gradientEffect * 0.9);

    // Star-like sparkles
    float sparkles = sin(len * 60.0 - u_time * 8.0) * cos(len * 40.0 + u_time * 7.0) * 0.03;
    color += vec3(sparkles * 1.2, sparkles * 0.8, sparkles * 1.0);

    // Kaleidoscopic radiating effect for additional beauty
    float kaleidoscope = sin(atan(uv.y, uv.x) * 14.0 + u_time) * 0.12;
    color += vec3(kaleidoscope * 0.6, kaleidoscope * 0.8, kaleidoscope * 0.7);

    // Subtle golden shimmer overlay
    float shimmer = sin(len * 30.0 + u_time * 5.0) * 0.05;
    color += vec3(shimmer * 1.0, shimmer * 0.9, shimmer * 0.6);

    // Enhance brightness and saturation for vivid output
    color = pow(color, vec3(1.5));
    color *= 1.7;

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
