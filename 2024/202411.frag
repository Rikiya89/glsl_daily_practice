uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;
    
    float len = length(uv);
    float angle = atan(uv.y, uv.x);

    // Increase number of segments for more intricate patterns
    float numSegments = 24.0;
    float segment = mod(angle * numSegments / (2.0 * 3.14159265), 1.0);
    
    // Create additional layers of patterns
    float pattern1 = sin(len * 10.0 - time * 2.0 + segment * 6.2831853) * 0.5 + 0.5;
    float pattern2 = sin(len * 20.0 - time * 3.0 + segment * 12.5663706) * 0.5 + 0.5;
    float pattern3 = sin(len * 30.0 - time * 4.0 + segment * 18.8495559) * 0.5 + 0.5;

    // Combine patterns for more complexity
    float combinedPattern = pattern1 * 0.5 + pattern2 * 0.3 + pattern3 * 0.2;

    // Color calculation with layered patterns
    float r = sin(len * 10.0 - time * 2.0 + segment * 3.14159265 + combinedPattern * 2.0) * 0.5 + 0.5;
    float g = sin(len * 10.0 - time * 2.0 + segment * 3.14159265 + 2.0 + combinedPattern * 2.0) * 0.5 + 0.5;
    float b = sin(len * 10.0 - time * 2.0 + segment * 3.14159265 + 4.0 + combinedPattern * 2.0) * 0.5 + 0.5;

    vec4 color = vec4(r, g, b, 1.0);
    
    // Apply radial gradient for more depth and beauty
    color.rgb *= smoothstep(0.0, 1.0, 1.0 - len);
    
    fragColor = TDOutputSwizzle(color);
}