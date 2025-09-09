uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

void main()
{
    vec2 uv = (gl_FragCoord.xy - u_resolution / 2.0) / u_resolution.y;
    float len = length(uv);

    // Base harmonic oscillations for radiant colors
    float baseR = sin(len * 10.0 - u_time * 1.5) * 0.5 + 0.5;
    float baseG = sin(len * 10.0 - u_time * 1.5 + 2.0) * 0.5 + 0.5;
    float baseB = sin(len * 10.0 - u_time * 1.5 + 4.0) * 0.5 + 0.5;

    // Sacred mandala with soft rotational movement
    float petals = 32.0; // More intricate geometry
    float angle = atan(uv.y, uv.x);
    float radius = len;
    float mandala = sin(angle * petals + u_time * 0.8) * cos(angle * petals * 0.5 - u_time * 0.5) * 0.1;
    vec3 mandalaColor = vec3(0.7, 0.9, 1.0) * mandala;

    // Divine glow and aura
    float aura = smoothstep(0.15, 0.9, len) * (0.3 / (len + 0.1));
    vec3 auraColor = vec3(1.0, 0.9, 0.8) * aura;

    // Halo effect for divine radiance
    float halo = exp(-10.0 * pow((len - 0.5), 2.0)) * 0.5;
    vec3 haloColor = vec3(1.2, 1.0, 0.7) * halo;

    // Concentric geometric rings (echoes of sacred patterns)
    float rings = sin(len * 40.0 - u_time * 2.5) * 0.08;
    vec3 ringColor = vec3(0.8, 0.6, 0.4) * rings;

    // Cosmic starburst pattern for interconnectedness
    float starburst = sin(len * 35.0 + u_time * 3.0) * cos(angle * 24.0) * 0.1;
    vec3 starColor = vec3(1.0, 0.8, 0.6) * starburst;

    // Infinite kaleidoscope fractals for transcendent depth
    float fractal = cos(angle * 24.0 + u_time * 0.8) * sin(len * 20.0 - u_time * 3.0) * 0.1;
    vec3 fractalColor = vec3(fractal * 1.0, fractal * 0.7, fractal * 0.5);

    // Add glowing center for divine focus
    float centerGlow = exp(-30.0 * len) * 0.6;
    vec3 centerColor = vec3(1.2, 1.0, 0.9) * centerGlow;

    // Blend all elements harmoniously
    vec3 color = vec3(baseR, baseG, baseB) 
                 + mandalaColor 
                 + auraColor 
                 + haloColor 
                 + ringColor 
                 + starColor 
                 + fractalColor 
                 + centerColor;

    // Final color adjustments for radiance
    color = pow(color, vec3(1.2)) * 1.3;

    // Add a soft, living pulse to simulate breath and energy
    float pulse = 0.8 + 0.2 * sin(u_time * 1.5);
    color *= pulse;

    // Output final color
    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
