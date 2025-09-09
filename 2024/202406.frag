uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

float random(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(random(i), random(i + vec2(1.0, 0.0)), u.x),
        mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), u.x),
        u.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - resolution / 2.0) / resolution.y;
    
    // Add rotation to the UV coordinates
    float rotationSpeed = time * 0.6;
    float cosRot = cos(rotationSpeed);
    float sinRot = sin(rotationSpeed);
    uv = vec2(
        cosRot * uv.x - sinRot * uv.y,
        sinRot * uv.x + cosRot * uv.y
    );
    
    // Convert to polar coordinates
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    // Create kaleidoscope effect by repeating the angle
    float kaleido = 32.0; // Increase the number of segments for more complexity
    angle = mod(angle, 2.0 * 3.141592 / kaleido) * kaleido;
    
    // Convert back to Cartesian coordinates
    uv.x = radius * cos(angle);
    uv.y = radius * sin(angle);
    
    // Create more intricate patterns with fractal noise
    float pattern = cos(angle * 14.0 + time * 4.0) * 0.5 + 0.5;
    float n = fbm(uv * 22.0 + time * 4.0);
    
    float len = length(uv);
    
    // Adjust color cycling and smoother transitions
    float r = sin(len * 34.0 - time * 6.0 - pattern + n) * 0.5 + 0.5;
    float g = sin(len * 34.0 - time * 6.0 - pattern * 1.9 + n) * 0.5 + 0.5;
    float b = sin(len * 34.0 - time * 6.0 - pattern * 2.2 + n) * 0.5 + 0.5;
    vec3 color = vec3(r, g, b);
    
    // Add some glow effect
    float glow = exp(-len * 8.0) * 0.5;
    color += glow;
    
    // Add pulsating effect
    float pulse = sin(time * 8.0) * 0.4 + 0.6;
    color *= pulse;
    
    // Add additional color modulation
    color.rgb *= 0.4 + 0.6 * cos(time + len * 20.0);

    // Add a beautiful rotating flower-like pattern with reduced intensity
    float petals = 8.0;
    float flower = sin(angle * petals + time) * 0.05 / radius;
    color += vec3(flower, flower * 0.25, flower * 0.1);

    // Add a dynamic star-like pattern with reduced intensity
    float star = sin(len * 40.0 + time * 2.0) * cos(angle * 10.0) * 0.05;
    color += vec3(star, star * 0.25, star * 0.4);

    // Add additional dynamic pattern for more intricacy
    float dynamicPattern = cos(angle * 20.0 + time) * 0.1 * sin(len * 70.0 - time * 4.0);
    color += vec3(dynamicPattern, dynamicPattern * 0.5, dynamicPattern * 0.8);

    // Add a fractal-like pattern for added depth with reduced intensity
    vec2 p = uv;
    float fractal = 0.0;
    for (int i = 0; i < 5; i++) {
        p = abs(p) / dot(p, p) - 1.0;
        fractal += length(p);
    }
    color += vec3(fractal * 0.05, fractal * 0.1, fractal * 0.15);

    // Add additional animation with wave-like motion
    float wave = sin(len * 60.0 - time * 10.0) * 0.05;
    color += vec3(wave, wave * 0.3, wave * 0.6);

    // Final overall brightness adjustment
    color *= 0.6;

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}