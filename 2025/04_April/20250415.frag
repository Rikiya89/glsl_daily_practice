// Sacred Portal Shader – Spiritually Tuned Mandala Cosmos

uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 hueColor(float h) {
    h = fract(h);
    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

float circleRing(vec2 pos, vec2 center, float radius, float thickness) {
    float d = abs(length(pos - center) - radius);
    return smoothstep(0.0, thickness, thickness - d);
}

float mandalaSacred(vec2 uv, float radius, float thickness, float depth, float index) {
    // Sacred scale with Z-depth
    float scale = 1.0 / (1.0 + depth * 0.5);
    uv *= scale;

    // Breathing & symmetry rotation
    float t = u_time;
    float breath = 1.0 + 0.05 * sin(t * 1.5 + index * 2.0);
    float rotation = t * 0.05 + index * 0.6;
    mat2 rot = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
    uv = rot * uv * breath;

    float shape = circleRing(uv, vec2(0.0), radius, thickness);

    // Lotus grid pattern
    for (int i = 0; i < 6; i++) {
        float a = 6.28318 * float(i) / 6.0;
        vec2 p = vec2(cos(a), sin(a)) * radius;
        shape += circleRing(uv, p, radius, thickness);
    }

    for (int i = 0; i < 12; i++) {
        float a = 6.28318 * float(i) / 12.0;
        vec2 p = vec2(cos(a), sin(a)) * radius * 2.0;
        shape += circleRing(uv, p, radius, thickness * 0.7);
    }

    return shape * scale;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float r = length(uv);

    // Breathing radial flow (spiritual inhale/exhale)
    float breath = 1.0 + 0.1 * sin(u_time * 0.4);
    uv *= 1.0 + pow(r, 2.0) * 0.3 * breath;

    vec3 color = vec3(0.0);

    // 🧿 Multi-depth sacred mandala layers
    for (int i = 0; i < 7; i++) {
        float z = float(i) * 0.3 - 1.2;
        float layer = mandalaSacred(uv, 0.32 + 0.015 * float(i), 0.015, z, float(i));
        float hue = 0.6 + 0.12 * sin(u_time * 0.25 + float(i));
        vec3 col = hueColor(hue);
        float fade = smoothstep(1.6, -0.6, z);
        color += col * layer * fade;
    }

    // 🔮 Center inner soul flame
    float core = 0.25 / (r + 0.05);
    float pulse = 0.9 + 0.2 * sin(u_time * 2.0);
    vec3 coreColor = mix(vec3(1.0, 0.85, 0.7), vec3(0.7, 1.0, 1.0), 0.5 + 0.5 * sin(u_time * 1.1));
    color += coreColor * core * pulse;

    // 🌌 Astral spark particles
    float sparkle = sin(r * 80.0 - u_time * 5.0) * cos(r * 60.0 + u_time * 4.5);
    sparkle *= smoothstep(0.1, 0.02, fract(uv.x * 18.0 + uv.y * 22.0)) * 0.04;
    color += vec3(sparkle * 1.3, sparkle * 0.8, sparkle);

    // 🌬 Cosmic fog shimmer
    float fogNoise = noise2D(uv * 5.0 + u_time * 0.2);
    color += vec3(0.1, 0.12, 0.15) * fogNoise * (1.0 - smoothstep(0.2, 1.3, r));

    // 🪷 Lotus edge softness
    color *= smoothstep(1.1, 0.4, r);

    // 🎨 Final gamma glow
    color = pow(color, vec3(1.25)) * 1.65;

    fragColor = vec4(color, 1.0);
}
