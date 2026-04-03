uniform float uTime;
uniform vec2  uRes;

out vec4 fragColor;

// ── Mathematical Surface: Schwarz-D Minimal Surface ──
// The Schwarz Diamond surface is a triply-periodic minimal surface
// discovered by Hermann Schwarz in 1865. It divides space into two
// congruent labyrinths related by a translation.
//
// Formula: sin(x)*sin(y)*sin(z) + sin(x)*cos(y)*cos(z)
//        + cos(x)*sin(y)*cos(z) + cos(x)*cos(y)*sin(z) = 0

float sdSchwarzD(vec3 p, float scale) {
    p *= scale;
    return (sin(p.x)*sin(p.y)*sin(p.z)
          + sin(p.x)*cos(p.y)*cos(p.z)
          + cos(p.x)*sin(p.y)*cos(p.z)
          + cos(p.x)*cos(p.y)*sin(p.z)) / scale;
}

// Gyroid: another beautiful minimal surface
// Formula: cos(x)*sin(y) + cos(y)*sin(z) + cos(z)*sin(x) = 0
float sdGyroid(vec3 p, float scale) {
    p *= scale;
    return (dot(cos(p), sin(p.yzx))) / scale;
}

// Neovius surface: a more intricate triply-periodic minimal surface
// Formula: 3*(cos(x)+cos(y)+cos(z)) + 4*cos(x)*cos(y)*cos(z) = 0
float sdNeovius(vec3 p, float scale) {
    p *= scale;
    return (3.0*(cos(p.x)+cos(p.y)+cos(p.z))
          + 4.0*cos(p.x)*cos(p.y)*cos(p.z)) / scale;
}

// Blend between two distance fields
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0 - h);
}

// Bounding sphere
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// Scene: morphing minimal surfaces inside a breathing sphere
float map(vec3 p) {
    float t = uTime * 0.3;

    // Slowly rotate the space
    float c = cos(t * 0.4), s = sin(t * 0.4);
    p.xz *= mat2(c, -s, s, c);
    p.yz *= mat2(cos(t*0.3), -sin(t*0.3), sin(t*0.3), cos(t*0.3));

    // 3-phase morph cycle: Schwarz-D → Gyroid → Neovius → loop
    float phase = mod(t * 0.25, 3.0);  // cycles through 0–3
    float scale = 3.5 + sin(t * 0.7) * 0.5;

    float d1 = sdSchwarzD(p, scale);
    float d2 = sdGyroid(p, scale);
    float d3 = sdNeovius(p, scale * 0.5);  // Neovius needs smaller scale

    float surface;
    if (phase < 1.0) {
        surface = mix(d1, d2, smoothstep(0.0, 1.0, phase));
    } else if (phase < 2.0) {
        surface = mix(d2, d3, smoothstep(0.0, 1.0, phase - 1.0));
    } else {
        surface = mix(d3, d1, smoothstep(0.0, 1.0, phase - 2.0));
    }

    // Displacement wave rippling across the surface
    float wave = sin(length(p) * 4.0 - t * 2.0) * 0.015;
    surface += wave;

    // Animated shell thickness — breathing effect
    float thickness = 0.03 + 0.02 * sin(t * 0.8);
    float shell = abs(surface) - thickness;

    // Breathing bounding sphere
    float radius = 2.2 + 0.3 * sin(t * 0.5);
    float sphere = sdSphere(p, radius);

    return max(shell, sphere);
}

// Calculate normal via gradient
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

// Ambient occlusion — gives depth to crevices
float calcAO(vec3 p, vec3 n) {
    float ao = 0.0;
    float w = 1.0;
    for (int i = 1; i <= 5; i++) {
        float d = float(i) * 0.08;
        ao += w * (d - map(p + n * d));
        w *= 0.5;
    }
    return clamp(1.0 - ao * 3.0, 0.0, 1.0);
}

void main()
{
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

    // Camera setup — slow gentle orbit
    float t = uTime * 0.05;
    vec3 ro = vec3(7.0 * cos(t), 0.8 * sin(t * 0.5), 7.0 * sin(t));
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.8 * ww);

    // ── Raymarching ──
    float d = 0.0;
    float totalDist = 0.0;
    vec3 p;

    for (int i = 0; i < 120; i++) {
        p = ro + rd * totalDist;
        d = map(p);
        if (abs(d) < 0.001 || totalDist > 12.0) break;
        totalDist += d * 0.8;  // slight under-step for stability
    }

    // ── Shading: Black & White ──
    vec3 col = vec3(0.0);  // black background

    if (totalDist < 12.0) {
        vec3 n = calcNormal(p);
        float ao = calcAO(p, n);

        // Main directional light
        vec3 lightDir = normalize(vec3(1.0, 1.0, -0.5));
        float diff = max(dot(n, lightDir), 0.0);

        // Rim light for dramatic silhouette
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

        // Specular highlight
        vec3 h = normalize(lightDir - rd);
        float spec = pow(max(dot(n, h), 0.0), 64.0);

        // Fill light from below (subtle)
        float fill = max(dot(n, vec3(0.0, -1.0, 0.0)), 0.0) * 0.15;

        // Compose: all white tones on black
        col = vec3(diff * 0.6 + rim * 0.5 + spec * 0.8 + fill) * ao;

        // Subtle depth fog
        float fog = exp(-totalDist * 0.08);
        col *= fog;
    }

    // Gamma correction
    col = pow(col, vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}
