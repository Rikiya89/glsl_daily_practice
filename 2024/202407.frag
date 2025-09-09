uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

// Function to create a kaleidoscope effect
vec2 kaleidoscope(vec2 uv, float segments) {
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    float newAngle = mod(angle, 2.0 * 3.141592 / segments);
    return vec2(cos(newAngle), sin(newAngle)) * radius;
}

// Function to create a rotating star pattern
float starPattern(vec2 uv, float points, float radius, float innerRadius) {
    float angle = atan(uv.y, uv.x);
    float len = length(uv);
    float d = abs(sin(angle * points + time * 2.0)) * radius + innerRadius;
    return step(len, d);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - resolution.xy * 0.5) / resolution.y;
    uv = kaleidoscope(uv, 8.0); // Adding a kaleidoscope effect

    float len = length(uv);
    float angle = atan(uv.y, uv.x);

    // Base color patterns with sine waves
    float r = sin(len * 12.0 - time * 3.0 + cos(time * 0.5)) * 0.3 + 0.3;
    float g = sin(len * 12.0 - time * 3.0 + cos(time * 0.5 + 1.0)) * 0.3 + 0.3;
    float b = sin(len * 12.0 - time * 3.0 + cos(time * 0.5 + 2.0)) * 0.3 + 0.3;

    // Secondary pattern
    float secondaryPattern = sin(uv.x * 20.0 + time * 5.0) * sin(uv.y * 20.0 + time * 5.0);
    vec3 secondaryColor = vec3(0.6, 0.4, 0.8) * secondaryPattern;

    // Circular pattern
    float circularPattern = sin(len * 20.0 - time * 4.0) * 0.3 + 0.3;
    vec3 circularColor = vec3(0.3, 0.5, 0.7) * circularPattern;

    // Spiral pattern
    float spiralPattern = sin(angle * 10.0 + len * 15.0 - time * 6.0) * 0.3 + 0.3;
    vec3 spiralColor = vec3(0.7, 0.3, 0.5) * spiralPattern;

    // Star pattern
    float star = starPattern(uv, 5.0, 0.3, 0.1);
    vec3 starColor = vec3(0.8, 0.9, 0.3) * star;

    // Wave pattern
    float wavePattern = sin(uv.y * 10.0 + time * 2.0) * cos(uv.x * 10.0 + time * 2.0);
    vec3 waveColor = vec3(0.2, 0.4, 0.7) * wavePattern;

    // Dynamic grid pattern
    float gridPattern = step(0.1, abs(sin(uv.x * 40.0) * cos(uv.y * 40.0) * sin(time * 3.0)));
    vec3 gridColor = vec3(0.5, 0.2, 0.3) * gridPattern;

    // Adding a radial gradient for smoother background
    vec3 radialGradient = vec3(0.1, 0.2, 0.3) * (1.0 - len * 0.8);

    // Combining all patterns with reduced brightness
    vec4 color = vec4(r, g, b, 1.0)
               + vec4(secondaryColor, 0.2)
               + vec4(circularColor, 0.2)
               + vec4(spiralColor, 0.2)
               + vec4(starColor, 0.3)
               + vec4(waveColor, 0.2)
               + vec4(gridColor, 0.2)
               + vec4(radialGradient, 0.2);

    fragColor = TDOutputSwizzle(color);
}