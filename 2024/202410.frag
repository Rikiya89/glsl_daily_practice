uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

void main()
{
    // Normalize pixel coordinates (from 0 to 1)
    vec2 uv = gl_FragCoord.xy / resolution;

    // Move coordinates from (0,1) to (-1,1)
    uv = uv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;

    // Create a radial gradient based on distance from center
    float dist = length(uv);

    // Create a dynamic pattern using multiple sine and cosine waves and time
    float angle = atan(uv.y, uv.x);
    float wave1 = sin(dist * 10.0 - time * 2.0 + angle * 5.0);
    float wave2 = cos(dist * 15.0 + time * 3.0 + angle * 3.0);
    float wave3 = sin(dist * 20.0 - time * 4.0 - angle * 4.0);
    float pattern = wave1 * wave2 * wave3;

    // Generate RGB colors with a phase shift for variety
    float r = 0.5 + 0.5 * sin(pattern + time * 0.5);
    float g = 0.5 + 0.5 * sin(pattern + time * 0.8);
    float b = 0.5 + 0.5 * sin(pattern + time * 1.2);

    // Introduce a pulsating effect by modulating brightness
    float brightness = 0.5 + 0.5 * sin(time * 2.0);
    vec4 color = vec4(r * brightness, g * brightness, b * brightness, 1.0);

    // Add a vignette effect for a more dramatic look
    float vignette = smoothstep(0.8, 0.2, dist);
    color.rgb *= vignette;

    // Output final color
    fragColor = TDOutputSwizzle(color);
}