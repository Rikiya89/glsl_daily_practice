uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

void main()
{
    vec2 uv = (gl_FragCoord.xy - u_resolution / 2.0) / u_resolution.y;
    float len = length(uv);

    // Base colors with smooth transition
    float r = sin(len * 12.0 - u_time * 3.0) * 0.5 + 0.5;
    float g = sin(len * 12.0 - u_time * 3.0 + 0.6) * 0.5 + 0.5;
    float b = sin(len * 12.0 - u_time * 3.0 + 1.2) * 0.5 + 0.5;

    // Radial gradient for depth
    float radialGradient = smoothstep(0.3, 1.0, len);

    // Modulate colors based on distance and add wave pattern
    float wave = sin(len * 40.0 - u_time * 5.0) * 0.05;
    vec3 color = vec3(r, g, b) * radialGradient + wave;

    // Apply additional color variation for dynamic effect
    color.r += sin(len * 8.0 + u_time) * 0.15;
    color.g += sin(len * 8.0 + u_time + 2.0) * 0.15;
    color.b += sin(len * 8.0 + u_time + 4.0) * 0.15;

    // Enhanced bloom effect for stronger glow
    float bloom = 0.1 / (len + 0.1);
    color += vec3(bloom);

    // Add a beautiful rotating flower-like pattern
    float petals = 6.0;
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    float flower = sin(angle * petals + u_time) * 0.1 / radius;
    color += vec3(flower, flower * 0.5, flower * 0.2);

    // Add a dynamic star-like pattern
    float star = sin(len * 30.0 + u_time * 2.0) * cos(angle * 8.0) * 0.1;
    color += vec3(star, star * 0.5, star * 0.8);

    // Kaleidoscope effect
    float kaleidoscope = cos(angle * 12.0 + u_time) * sin(len * 20.0 - u_time * 3.0) * 0.1;
    color += vec3(kaleidoscope, kaleidoscope * 0.7, kaleidoscope * 0.4);

    // Enhanced saturation and brightness
    color = pow(color, vec3(1.2));
    color *= 1.2;

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}