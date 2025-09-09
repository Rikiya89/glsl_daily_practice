// Enhanced Flower of Life with Multi-Layered Central Light Pulse and Bloom
uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

// Function to draw a glowing circle with soft edges
float drawGlowCircle(vec2 uv, vec2 center, float radius, float glowIntensity) {
    float dist = length(uv - center);
    float glow = exp(-dist * glowIntensity) * smoothstep(radius + 0.01, radius - 0.01, dist);
    return glow;
}

// Function for the central light pulse with bloom and layered radiance
float centralLightPulse(vec2 uv, float pulseSpeed, float maxRadius, float layerOffset) {
    float dist = length(uv);
    float pulse = exp(-dist * 6.0) * (0.7 + 0.3 * sin(time * pulseSpeed));  // Stronger central glow
    float glowRadius = smoothstep(maxRadius + layerOffset, maxRadius + layerOffset - 0.1, dist);
    return pulse * glowRadius;
}

// Function for outer ripples (expanding energy waves from the center)
float rippleEffect(vec2 uv, float waveSpeed, float frequency, float amplitude) {
    float dist = length(uv);
    return amplitude * sin(dist * frequency - time * waveSpeed) * exp(-dist * 3.0);
}

void main() {
    // Normalize UV coordinates to be centered and aspect ratio adjusted
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / resolution.y;

    // Rotation matrix for rotating the grid over time
    float angle = time * 0.1;  // Slow rotation for a meditative effect
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    
    // Apply rotation to UV coordinates
    uv = rotation * uv;

    // Define the base radius and dynamic scaling factor for pulsing effect
    float baseRadius = 0.15;
    float radius = baseRadius * (0.9 + 0.1 * sin(time * 3.0));  // Soft, rhythmic pulsing

    // Define a base distance between circle centers
    float spacing = radius * sqrt(3.0); // Hexagonal grid spacing

    // Initialize color
    vec3 color = vec3(0.0);

    // Loop over a grid of circle centers
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
            color += vec3(drawGlowCircle(uv, vec2(x, y), radius, 10.0));
        }
    }

    // Central Light Pulse effect with multi-layered bloom
    float centralPulse = centralLightPulse(uv, 2.5, 0.5, 0.0) +  // First layer (inner)
                        centralLightPulse(uv, 1.8, 0.7, 0.3) +  // Second layer (outer)
                        centralLightPulse(uv, 1.2, 0.9, 0.5);   // Third layer (far outer)
    
    // Add a ripple effect radiating from the center
    float ripple = rippleEffect(uv, 3.0, 8.0, 0.15);  // Wave speed, frequency, and amplitude

    // Combine the central pulse with ripple energy and glowing color
    color += vec3(1.0, 0.85, 0.6) * (centralPulse + ripple);  // Celestial gold glow

    // Gradient color effect shifting over time, evoking cosmic energy
    vec3 gradientColor = vec3(0.6 + 0.4 * sin(time * 0.5 + uv.x * 3.0), 
                              0.4 + 0.6 * cos(time * 0.4 + uv.y * 2.0), 
                              0.8 + 0.2 * sin(time * 0.7 + uv.x * uv.y * 5.0));

    // Blend the base pattern color with the glowing gradient
    color *= gradientColor;

    // Add a subtle harmonic vibration to the entire pattern
    float harmonicVibration = 0.01 * sin(time * 12.0 + length(uv) * 10.0);
    uv += harmonicVibration;

    // Apply bloom effect by amplifying the brighter areas
    vec3 bloom = pow(color, vec3(2.0)) * 0.4;

    // Output the final fragment color with enhanced central pulse and bloom
    fragColor = vec4(bloom + color, 1.0);
}