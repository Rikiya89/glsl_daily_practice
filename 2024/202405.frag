uniform float time;
uniform vec2 resolution;

out vec4 fragColor;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float circle(vec2 uv, vec2 position, float radius) {
    return smoothstep(radius + 0.01, radius - 0.01, length(uv - position));
}

void main()
{
    vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;

    float radius = 0.1 + 0.02 * sin(time * 3.0); // Pulsating effect
    vec3 color = vec3(0.0);
    float t = time * 0.5;

    for (int y = -5; y <= 5; y++) {
        for (int x = -5; x <= 5; x++) {
            // Rotating positions for more dynamic animation
            float angle = time * 0.3 + float(x + y) * 0.1;
            vec2 pos = vec2(x, y) * 0.2;
            pos = vec2(pos.x * cos(angle) - pos.y * sin(angle), pos.x * sin(angle) + pos.y * cos(angle));
            pos.x += mod(float(y), 2.0) * 0.1;
            float d = length(uv - pos);
            float circleShape = circle(uv, pos, radius);
            color += vec3(circleShape * smoothstep(0.1, 0.0, d));
        }
    }

    // Add some noise for texture
    float n = noise(uv * 5.0 + time * 0.1);
    color *= 0.5 + 0.5 * n;

    // Adding radial gradient for extra effect
    float radialGradient = 0.5 + 0.5 * cos(length(uv) * 15.0 - time * 3.0);
    color *= radialGradient;

    // Adding a vibrant gradient
    vec3 gradient = vec3(uv.x, uv.y, 1.0 - uv.x);
    color = mix(color, gradient, 0.5);

    // Color modulation
    color = mix(color, vec3(1.0, 0.5, 0.2) * 0.6, 0.5 * cos(t) + 0.5);

    // Subtle glow effect
    float glow = smoothstep(0.3, 0.0, length(uv) - 0.5) * 0.1;
    color += vec3(glow);

    // Subtle movement effect
    uv += 0.01 * vec2(sin(time * 2.0), cos(time * 2.0));
    vec3 subtleEffect = vec3(circle(uv, vec2(0.0), radius));
    color += subtleEffect * 0.1;

    // Additional layer of rotating circles
    float layerAngle = time * 0.2;
    vec2 layerPos = uv * 2.0;
    layerPos = vec2(layerPos.x * cos(layerAngle) - layerPos.y * sin(layerAngle), layerPos.x * sin(layerAngle) + layerPos.y * cos(layerAngle));
    vec3 layerColor = vec3(circle(layerPos, vec2(0.0), radius * 0.5));
    color += layerColor * 0.3;

    // Additional animated shapes
    float shape1 = smoothstep(0.2, 0.1, length(uv - vec2(sin(time), cos(time)) * 0.5));
    float shape2 = smoothstep(0.2, 0.1, length(uv - vec2(cos(time), sin(time)) * 0.5));
    color += vec3(shape1, shape2, shape1 * shape2) * 0.2;

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}