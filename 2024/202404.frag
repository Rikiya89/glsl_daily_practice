uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

void main()
{
    vec2 uv = (gl_FragCoord.xy - u_resolution / 2.0) / u_resolution.y;
    float len = length(uv);
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Base colors with smooth transition and increased intensity for a brighter effect
    float r = sin(len * 12.0 - u_time * 3.0) * 0.5 + 0.5;
    float g = sin(len * 12.0 - u_time * 3.0 + 0.6) * 0.2 + 0.2;
    float b = sin(len * 12.0 - u_time * 3.0 + 1.2) * 0.4 + 0.4;

    // Radial gradient for depth
    float radialGradient = smoothstep(0.3, 1.0, len);

    // Modulate colors based on distance and add wave pattern with increased intensity
    float wave = sin(len * 40.0 - u_time * 5.0) * 0.05;
    vec3 color = vec3(r, g, b) * radialGradient + wave;

    // Apply additional color variation for dynamic effect with increased intensity
    color.r += sin(len * 8.0 + u_time) * 0.15;
    color.g += sin(len * 8.0 + u_time + 2.0) * 0.05;
    color.b += sin(len * 8.0 + u_time + 4.0) * 0.1;

    // Enhanced bloom effect for brighter glow
    float bloom = 0.1 / (len + 0.1);
    color += vec3(bloom, bloom * 0.5, bloom * 0.75);

    // Add a beautiful rotating flower-like pattern with increased intensity
    float petals = 8.0; // Increased petals for more complexity
    float flower = sin(angle * petals + u_time) * 0.1 / radius;
    color += vec3(flower, flower * 0.5, flower * 0.4);

    // Add a dynamic star-like pattern with increased intensity
    float star = sin(len * 30.0 + u_time * 2.0) * cos(angle * 8.0) * 0.1;
    color += vec3(star, star * 0.5, star * 0.7);

    // Kaleidoscope effect with increased intensity
    float kaleidoscope = cos(angle * 12.0 + u_time) * sin(len * 20.0 - u_time * 3.0) * 0.1;
    color += vec3(kaleidoscope, kaleidoscope * 0.7, kaleidoscope * 0.6);

    // Mandala-like pattern with increased complexity
    float mandala = sin(len * 60.0 + u_time * 4.0) * 0.1 * cos(angle * 16.0);
    color += vec3(mandala, mandala * 0.75, mandala * 0.9);

    // Additional geometric shapes for enhanced visual appeal
    float shape1 = cos(len * 15.0 - u_time * 6.0) * sin(angle * 10.0) * 0.1;
    float shape2 = sin(len * 20.0 + u_time * 5.0) * cos(angle * 12.0) * 0.1;
    color += vec3(shape1, shape1 * 0.5, shape1 * 0.3);
    color += vec3(shape2, shape2 * 0.5, shape2 * 0.7);

    // Additional layer of mandala-like pattern
    float mandalaLayer = cos(len * 40.0 - u_time * 3.0) * sin(angle * 20.0) * 0.1;
    color += vec3(mandalaLayer, mandalaLayer * 0.4, mandalaLayer * 0.7);

    // Increase overall brightness and shift towards pink tones
    color *= vec3(1.2, 0.8, 1.1);

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}