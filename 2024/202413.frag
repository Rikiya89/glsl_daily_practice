// Refined Flower of Life with Balanced Glow and Aurora Shimmer (No Noise)
uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

// Function to draw a glowing circle with soft edges
float drawGlowCircle(vec2 uv, vec2 center, float radius, float glowIntensity) {
    float dist = length(uv - center);
    float glow = exp(-dist * glowIntensity) * smoothstep(radius + 0.01, radius - 0.01, dist);
    return glow * 0.5;  // Reduce overall glow intensity
}

// Function for central light pulse with bloom and rotating core
float centralLightPulse(vec2 uv, float pulseSpeed, float maxRadius, float layerOffset) {
    float dist = length(uv);
    float pulse = exp(-dist * 6.0) * (0.5 + 0.3 * sin(time * pulseSpeed));  // Softer central glow
    float glowRadius = smoothstep(maxRadius + layerOffset, maxRadius + layerOffset - 0.1, dist);
    
    // Add rotational vortex to the core for dynamic effect
    float angle = atan(uv.y, uv.x);
    float rotation = sin(angle * 8.0 + time * 2.0) * 0.15;  // Slightly toned down vortex effect
    return pulse * glowRadius * (1.0 + rotation);
}

// Function for radial rays with fractal-like detail
float radialRays(vec2 uv, float numRays, float intensity) {
    float angle = atan(uv.y, uv.x);
    float rays = abs(sin(angle * numRays + time * 1.0)) * intensity;
    rays += abs(cos(angle * numRays * 2.0 + time * 1.5)) * 0.2;  // Slightly reduce fractal details
    return rays * exp(-length(uv) * 2.5) * 0.5;  // Reduce intensity and fade faster
}

// Function for aurora shimmer effect across the pattern
vec3 auroraShimmer(vec2 uv, float speed) {
    float shimmer = sin(uv.x * 10.0 + time * speed) * cos(uv.y * 10.0 + time * speed);
    vec3 auroraColor = vec3(0.5 + 0.3 * sin(time + shimmer),  // Softer aurora colors
                            0.5 + 0.3 * cos(time * 0.5 + shimmer), 
                            0.7 + 0.2 * sin(time * 0.3 + shimmer));
    return auroraColor * 0.4;  // Lower aurora intensity
}

// Function for outer ripples (expanding energy waves from the center)
float rippleEffect(vec2 uv, float waveSpeed, float frequency, float amplitude) {
    float dist = length(uv);
    return amplitude * sin(dist * frequency - time * waveSpeed) * exp(-dist * 3.0) * 0.4;  // Reduce ripple amplitude
}

// Function for energy trails between the circles
float energyTrails(vec2 uv, vec2 center, float trailSpeed, float frequency) {
    vec2 dir = normalize(center - uv);
    float trail = sin(dot(uv, dir) * frequency + time * trailSpeed);
    return trail * exp(-length(uv - center) * 2.0) * 0.4;  // Softer trail effect
}

void main() {
    // Normalize UV coordinates to be centered and aspect ratio adjusted
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;

    // Rotation matrix for rotating the grid over time
    float angle = time * 0.05;  // Slow rotation for an epic, serene effect
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    
    // Apply rotation to UV coordinates
    uv = rotation * uv;

    // Define the base radius and dynamic scaling factor for pulsing effect
    float baseRadius = 0.2 + 0.05 * sin(time * 2.0);  // Expanding and contracting like breathing
    float radius = baseRadius;

    // Define a base distance between circle centers
    float spacing = radius * sqrt(3.0); // Hexagonal grid spacing

    // Initialize color with aurora shimmer background
    vec3 color = auroraShimmer(uv, 0.2);

    // Loop over a grid of circle centers for sacred geometry
    for (int i = -5; i <= 5; i++) {
        for (int j = -5; j <= 5; j++) {
            // Offset for hexagonal grid structure
            float x = float(i) * spacing;
            float y = float(j) * spacing * 0.5 * sqrt(3.0);

            // Apply a shift for every other row for hexagonal tiling
            if (j % 2 != 0) {
                x += spacing * 0.5;
            }

            // Apply a wave-like oscillation to the position of each circle
            x += 0.03 * sin(time * 2.0 + float(j) * 1.5);
            y += 0.03 * cos(time * 2.0 + float(i) * 1.5);

            // Add a glowing circle effect to the grid
            float circleGlow = drawGlowCircle(uv, vec2(x, y), radius, 10.0);
            color += vec3(circleGlow);

            // Add energy trails connecting the circles
            float trail = energyTrails(uv, vec2(x, y), 4.0, 15.0);
            color += vec3(0.4, 0.8, 1.0) * trail;  // Energy trails with blue tint
        }
    }

    // Central Light Pulse effect with multi-layered bloom
    float centralPulse = centralLightPulse(uv, 2.5, 0.5, 0.0) +  // First layer (inner)
                        centralLightPulse(uv, 1.8, 0.7, 0.3) +  // Second layer (outer)
                        centralLightPulse(uv, 1.2, 0.9, 0.5);   // Third layer (far outer)

    // Add radial rays emanating from the center
    float rays = radialRays(uv, 30.0, 0.5);  // Reduced ray intensity and fractal detail
    color += vec3(1.0, 0.85, 0.6) * (centralPulse + rays);  // Softer celestial gold glow

    // Add a ripple effect radiating from the center
    float ripple = rippleEffect(uv, 3.0, 8.0, 0.15);  // Wave speed, frequency, and amplitude
    color += vec3(0.9, 0.7, 1.0) * ripple;  // Ripple with soft purple hue

    // Output the final fragment color with balanced glow and aurora shimmer
    fragColor = vec4(color, 1.0);
}