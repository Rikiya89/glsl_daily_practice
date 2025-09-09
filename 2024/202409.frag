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

    // Add radial symmetry with harmonious complexity
    float angle = atan(uv.y, uv.x);
    float symmetry = 12.0; // Reduced symmetry for a more calming, spiritual pattern
    angle = mod(angle, 3.14159265 / symmetry) * symmetry;
    float mirror = mod(floor(angle * symmetry / 3.14159265), 2.0) * 2.0 - 1.0;
    angle *= mirror;

    // Create a dynamic pattern using smooth sine and cosine waves and time
    float wave1 = sin(dist * 15.0 - time * 2.0 + angle * 7.0);
    float wave2 = cos(dist * 20.0 + time * 2.5 + angle * 6.0);
    float wave3 = sin(dist * 25.0 - time * 3.0 - angle * 7.0);
    float wave4 = cos(dist * 30.0 + time * 3.5 - angle * 5.0);
    float wave5 = sin(dist * 35.0 - time * 4.0 + angle * 8.0);
    float pattern = wave1 * wave2 * wave3 * wave4 * wave5;

    // Generate softer, more spiritual RGB colors
    float r = 0.5 + 0.5 * sin(pattern + time * 0.8);
    float g = 0.5 + 0.5 * sin(pattern + time * 1.0);
    float b = 0.5 + 0.5 * sin(pattern + time * 1.2);

    // Introduce a gentle pulsating effect to simulate a breathing pattern
    float brightness = 0.7 + 0.3 * sin(time * 1.5); // Slower, more meditative pulse
    vec4 color = vec4(r * brightness, g * brightness, b * brightness, 1.0);

    // Add a vignette effect to gently focus attention inward
    float vignette = smoothstep(0.4, 0.1, dist);
    color.rgb *= vignette;

    // Soften and expand the dynamic glow effect for an ethereal feel
    float glow1 = exp(-dist * 10.0) * 1.0;  // Soft and diffused central glow
    float glow2 = exp(-dist * 5.0) * 0.8;   // Expansive, subtle outer glow
    float glow3 = exp(-dist * 2.5) * 0.5;   // Very broad, barely visible halo
    color.rgb += vec3(glow1 + glow2 + glow3);

    // Add very subtle noise for texture, barely perceptible
    float noise = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    color.rgb += noise * 0.005;

    // Introduce smoother, slower dynamic color shifts
    color.rgb += 0.04 * vec3(sin(time + dist * 5.0), cos(time + dist * 7.5), sin(time + dist * 10.0));

    // Soften the radial blur effect to add depth without distraction
    float blur = smoothstep(0.2, 0.5, dist);
    color.rgb = mix(color.rgb, vec3(0.3, 0.3, 0.3), blur * 0.3);

    // Introduce a slower, more spiritual kaleidoscopic effect
    uv *= mat2(cos(time * 0.5), sin(time * 0.5), -sin(time * 0.5), cos(time * 0.5));
    uv = fract(uv * 4.0) * 2.0 - 1.0;
    float kaleidoPattern = sin(length(uv) * 30.0 - time * 3.0);

    // Combine kaleidoscopic effect with the original pattern
    color.rgb *= 0.6 + 0.4 * kaleidoPattern;

    // Increase final brightness slightly for a luminous spiritual effect
    color.rgb *= 1.1;

    // Output final color
    fragColor = TDOutputSwizzle(color);
}
