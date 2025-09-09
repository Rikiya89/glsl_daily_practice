uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

void main()
{
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;

    // Dynamic scaling and rotation for the fractal over time
    float scale = 1.5 + 0.5 * sin(time * 0.2);
    float angle = time * 0.1;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    uv *= rotation;
    
    vec2 c = vec2(-0.7, 0.27015 + 0.05 * sin(time * 0.3)); // Dynamic Julia set parameter
    vec2 z = uv * scale;
    
    float iterations = 0.0;
    float maxIterations = 600.0;  // High iteration count for detail
    
    for (int i = 0; i < int(maxIterations); i++) {
        if (length(z) > 2.0) break;
        z = vec2(
            z.x * z.x - z.y * z.y + c.x,
            2.0 * z.x * z.y + c.y
        );
        iterations += 1.0;
    }
    
    // Enhanced color palette with smooth and rich transitions
    float colorFactor = iterations / maxIterations;
    vec3 col = vec3(0.0);
    
    if (iterations < maxIterations) {
        float hue = 0.6 + 0.4 * cos(6.2831 * colorFactor + time * 0.5);
        float saturation = 0.8 + 0.2 * sin(6.2831 * colorFactor + time * 0.6);
        float brightness = 0.7 + 0.3 * sin(6.2831 * colorFactor + time * 0.4);
        
        col = vec3(hue, saturation, brightness);
        col = col * (1.0 - colorFactor * 0.8) + 0.2 * vec3(1.0 - colorFactor) * sin(time * 0.7);

        // Adding a spectral effect for more vibrant colors
        col += 0.15 * vec3(
            sin(3.0 * colorFactor + time * 0.8),
            sin(4.0 * colorFactor + time * 0.9),
            sin(5.0 * colorFactor + time * 1.0)
        );
    }

    // Apply a final gradient and time-based vignette for more focus
    float vignette = 0.8 + 0.2 * pow(1.0 - length(uv), 2.0) * (0.8 + 0.2 * sin(time * 0.6));
    col *= vignette;

    fragColor = vec4(col, 1.0);
}