
out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// TODO(human): Experiment with these parameters to customize the visual
// Try different values: CIRCLES (3-12), LAYERS (2-5), SPEED (0.2-0.8)
#define CIRCLES 7.0
#define LAYERS 4.0
#define SPEED 0.6

// Golden ratio - the sacred proportion
const float PHI = 1.618033988749895;

// 2D rotation matrix
mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

// Flower of Life pattern - overlapping circles in sacred geometry
float flowerOfLife(vec2 uv, float radius) {
    float d = 1e10; // Start with large distance

    // Create hexagonal arrangement of circles
    for(float i = 0.0; i < CIRCLES; i++) {
        float angle = i * 6.283185 / CIRCLES;
        vec2 offset = vec2(cos(angle), sin(angle)) * radius;

        // Distance to circle edge
        float circle = abs(length(uv - offset) - radius);
        d = min(d, circle);

        // Center circle
        d = min(d, abs(length(uv) - radius));
    }

    return d;
}

// Fibonacci spiral using golden ratio
float fibonacciSpiral(vec2 uv, float t) {
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Logarithmic spiral based on golden ratio
    float spiral = abs(radius - exp(angle / PHI + t));
    return spiral;
}

// Metatron's Cube - sacred geometry pattern
float metatronsCube(vec2 uv) {
    float d = 1e10;

    // Create vertices of a cube in 2D projection
    for(float i = 0.0; i < 6.0; i++) {
        float a = i * 1.0472; // 60 degrees
        vec2 p = vec2(cos(a), sin(a)) * 0.5;

        // Connect to all other points
        for(float j = i + 1.0; j < 6.0; j++) {
            float b = j * 1.0472;
            vec2 q = vec2(cos(b), sin(b)) * 0.5;

            // Line segment distance
            vec2 pa = uv - p;
            vec2 ba = q - p;
            float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            float dist = length(pa - ba * h);
            d = min(d, dist);
        }
    }

    return d;
}

// Mandala-like pattern with symmetry
float mandala(vec2 uv, float time, float petals) {
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Create petal symmetry
    float a = mod(angle, 6.283185 / petals) * petals;

    // Animate the petals opening and closing
    float petal = abs(sin(a + time) * 0.3 + 0.5 - radius);

    return petal;
}

// Vesica Piscis - sacred geometry intersection
float vesicaPiscis(vec2 uv, float offset, float radius) {
    float c1 = length(uv - vec2(offset, 0.0)) - radius;
    float c2 = length(uv + vec2(offset, 0.0)) - radius;

    // Intersection of two circles
    return max(c1, c2);
}

// Sri Yantra inspired triangular pattern
float sriYantra(vec2 uv, float time) {
    float d = 1e10;

    // Create interlocking triangles (upward and downward)
    for(float i = 0.0; i < 9.0; i++) {
        float scale = 0.3 + i * 0.08;
        float angle = time * 0.05 + i * 0.3;

        // Upward triangle
        vec2 uv1 = uv * rot(angle);
        float tri1 = abs(abs(atan(uv1.y, uv1.x) * 3.0 / 3.14159) - 1.0);
        tri1 = abs(length(uv1) * tri1 - scale);

        // Downward triangle
        vec2 uv2 = uv * rot(-angle + 3.14159);
        float tri2 = abs(abs(atan(uv2.y, uv2.x) * 3.0 / 3.14159) - 1.0);
        tri2 = abs(length(uv2) * tri2 - scale);

        d = min(d, min(tri1, tri2));
    }

    return d;
}

// Torus knot - beautiful 3D mathematical curve projected to 2D
float torusKnot(vec2 uv, float time, float p, float q) {
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Parametric torus knot equations
    float t = angle * p + time;
    float knotRadius = 0.4 + 0.2 * cos(q * angle - time * 2.0);

    float d = abs(radius - knotRadius);
    return d;
}

// Concentric rings with golden ratio spacing
float goldenRings(vec2 uv, float time) {
    float r = length(uv);
    float d = 1e10;

    // Create rings spaced by golden ratio
    for(float i = 1.0; i < 8.0; i++) {
        float ringRadius = 0.15 * pow(PHI, i - 4.0);
        float ring = abs(r - ringRadius);

        // Animate ring thickness
        float thickness = 0.015 + 0.01 * sin(time * 2.0 + i);
        ring = smoothstep(thickness, thickness * 0.5, ring);

        d = max(d, ring);
    }

    return d;
}

// Platonic solid projection - dodecahedron
float dodecahedron(vec2 uv, float time) {
    float d = 1e10;

    // Pentagon symmetry (5-fold)
    float angle = atan(uv.y, uv.x);
    float sector = mod(angle, 6.283185 / 5.0) * 5.0;

    vec2 uvSym = vec2(cos(sector), sin(sector)) * length(uv);

    // Create pentagonal pattern
    for(float i = 0.0; i < 5.0; i++) {
        float a = i * 6.283185 / 5.0 + time * 0.1;
        vec2 p = vec2(cos(a), sin(a)) * 0.4;
        d = min(d, length(uvSym - p));
    }

    return d;
}

void main()
{
    // Normalize coordinates to -1 to 1, aspect ratio corrected
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    float time = u_time * SPEED;

    // Initialize final value
    float value = 0.0;

    // Breathing effect - makes the whole composition pulse
    float breath = sin(time * 0.5) * 0.15 + 1.0;

    // Layer 1: Rotating Flower of Life with breathing
    vec2 uv1 = uv * rot(time * 0.2) * breath;
    float flower = flowerOfLife(uv1, 0.3);
    flower = smoothstep(0.015, 0.008, flower);
    value += flower * 0.5;

    // Layer 2: Counter-rotating smaller flower
    vec2 uv2 = uv * rot(-time * 0.3) * 1.5;
    float flower2 = flowerOfLife(uv2, 0.2);
    flower2 = smoothstep(0.01, 0.003, flower2);
    value += flower2 * 0.35;

    // Layer 3: Multiple Fibonacci spirals at different scales
    for(float i = 0.0; i < 3.0; i++) {
        vec2 uv3 = uv * rot(time * 0.1 * (i + 1.0)) * (1.0 + i * 0.5);
        float spiral = fibonacciSpiral(uv3 * 2.0, time + i);
        spiral = smoothstep(0.08, 0.02, spiral);
        value += spiral * 0.15;
    }

    // Layer 4: Metatron's Cube rotating and scaling
    vec2 uv4 = uv * rot(time * 0.18) * (2.0 + sin(time * 0.3) * 0.3);
    float metatron = metatronsCube(uv4);
    metatron = smoothstep(0.025, 0.008, metatron);
    value += metatron * 0.4;

    // Layer 5: Animated Mandala petals
    vec2 uv5 = uv * rot(-time * 0.12);
    float mandalaPattern = mandala(uv5 * 1.5, time * 2.0, 8.0);
    mandalaPattern = smoothstep(0.1, 0.05, mandalaPattern);
    value += mandalaPattern * 0.25;

    // Layer 6: Vesica Piscis - sacred lens shape that morphs
    vec2 uv6 = uv * rot(time * 0.08);
    float offset = 0.3 + sin(time * 0.4) * 0.1;
    float vesica = abs(vesicaPiscis(uv6, offset, 0.5));
    vesica = smoothstep(0.02, 0.005, vesica);
    value += vesica * 0.3;

    // Add multiple radial pulses based on golden ratio
    float pulse1 = sin(length(uv) * PHI * 3.0 - time * 3.0) * 0.5 + 0.5;
    pulse1 = pow(pulse1, 4.0) * 0.12;

    float pulse2 = sin(length(uv) * PHI * 6.0 + time * 2.0) * 0.5 + 0.5;
    pulse2 = pow(pulse2, 3.0) * 0.08;

    value += pulse1 + pulse2;

    // Add subtle noise texture for organic feel
    float noise = fract(sin(dot(uv * 10.0, vec2(12.9898, 78.233)) + time * 0.1) * 43758.5453);
    value += noise * 0.03;

    // Create contrast and clamp
    value = clamp(value, 0.0, 1.0);

    // Enhanced contrast curve for more dramatic blacks and whites
    value = pow(value, 0.7);
    value = smoothstep(0.2, 0.8, value);

    // Black and white output with subtle vignette
    float vignette = 1.0 - length(uv) * 0.3;
    value *= vignette;

    fragColor = vec4(vec3(value), 1.0);
}
