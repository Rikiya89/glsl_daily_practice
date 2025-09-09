uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

const float PI = 3.14159265359;
const float PHI = 1.61803398875;

// 2D rotation
mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// Sacred hex grid
vec2 sacredGrid(vec2 p) {
    vec2 q = vec2(p.x * 2.0, p.y * 1.73205);
    vec2 r = vec2(q.x + q.y, q.y - q.x) / 2.0;
    return fract(r) - 0.5;
}

// Mandala symmetry
float mandala(vec2 p, float segments) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    return abs(cos(angle * segments) * 0.5 + 0.5) * smoothstep(0.3, 0.0, radius);
}

// Breathing pulse
float smoothBreath(float t) {
    return 0.5 + 0.5 * sin(t);
}

// Twinkling star field
float stars(vec2 uv, float time) {
    vec2 grid = fract(uv * 80.0);
    float d = length(grid - 0.5);
    float twinkle = sin(dot(uv * 120.0, vec2(12.9898, 78.233)) + time * 6.0) * 0.5 + 0.5;
    return smoothstep(0.03, 0.005, d) * twinkle;
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord / uResolution;
    vec2 aspectFix = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspectFix * 2.0;

    float time = uTime;

    // Immersive camera floating / breathing effect
    float camBob = sin(time * 0.3) * 0.05;
    float camZoom = 1.0 + sin(time * 0.2) * 0.1;
    p.y += camBob;
    p *= rotate2D(time * 0.05);
    p *= camZoom;

    // Radial coords
    float r = length(p);
    float a = atan(p.y, p.x);
    float z = 1.0 / (r + 0.5);
    vec2 warpedP = vec2(cos(a), sin(a)) * z;

    warpedP += 0.1 * vec2(cos(time * 0.5), sin(time * 0.4));

    // Sacred overlays
    vec2 gridPos = sacredGrid(warpedP * 10.0);
    float gridPattern = smoothstep(0.3, 0.0, length(gridPos));
    float mandalaPattern = mandala(p, 12.0);

    // Multi-spiral energy
    float spiral = sin(r * 24.0 * PHI - time * 1.2) * cos(r * 12.0 - time * 0.9);
    float breath = smoothBreath(time * 0.8) * 0.5 + 0.5;
    float resonance = sin(warpedP.x * 6.0 + sin(time * 0.5) * 5.0) *
                      cos(warpedP.y * 6.0 - cos(time * 0.8) * 5.0);

    // Bloom intensity by center
    float bloom = exp(-r * 1.3) * 5.0 + smoothstep(0.25, 0.0, r) * 0.5;

    // Chakra-themed flowing color — inner to outer hue shift
    float hueShift = time * 0.12 + r * 0.6 + spiral * 0.1;
    vec3 baseColor = vec3(
        0.6 + 0.4 * sin(hueShift + resonance + mandalaPattern),
        0.5 + 0.5 * cos(hueShift + gridPos.x + mandalaPattern),
        0.7 + 0.3 * sin(r * 6.0 - time * 0.8)
    );

    // Blend breath + bloom + light depth
    vec3 color = baseColor * bloom * breath;

    // Sacred pattern overlays
    color += gridPattern * 0.25 + mandalaPattern * 0.4;

    // Twinkling star shimmer
    color += stars(p, time) * 1.0;

    // Subtle scanline shimmer
    color *= 1.0 - 0.07 * sin(fragCoord.y * 3.0 + time * 12.0);

    // Deep-space vignette for tunnel depth
    float vignette = smoothstep(1.5, 0.3, r);
    color *= vignette;

    // Final polish
    color = pow(color, vec3(1.4));

    fragColor = vec4(color, 1.0);
}
