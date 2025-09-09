uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

#define MAX_STEPS 150
#define MAX_DIST 100.0
#define SURF_DIST 0.001

// Smooth min for blending shapes
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Basic shapes
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.yz) - t.x, p.x);
    return length(q) - t.y;
}

float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735026;
}

// Soft flow noise
float flowNoise(vec3 p) {
    p += 0.5 * vec3(
        sin(p.y * 1.5 + u_time),
        sin(p.z * 1.2 + u_time * 0.8),
        sin(p.x * 1.3 + u_time * 1.2)
    );
    return sin(p.x * 3.0) * sin(p.y * 3.0) * sin(p.z * 3.0);
}

// Scene SDF
float mapScene(vec3 p) {
    // Spatial ripple
    float ripple = 0.08 * sin(length(p.xz) * 3.0 - u_time * 1.5);
    p += ripple * normalize(p);

    // Twisting torus
    float angle = u_time * 0.3 + length(p.xz) * 1.5;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    p.yz = rot * p.yz;

    float torus = sdTorus(p, vec2(1.4 + 0.2*sin(u_time*0.5), 0.3));
    vec3 spherePos = p - vec3(0.0, -1.5, 0.0);
    float sphere = sdSphere(spherePos, 1.0 + 0.1 * sin(u_time*2.0));
    vec3 corePos = p - vec3(0.0, 1.5, 0.0);
    float crystal = sdOctahedron(corePos, 0.6 + 0.2 * sin(u_time*1.7));

    float blend1 = opSmoothUnion(torus, sphere, 0.25);
    float blend2 = opSmoothUnion(blend1, crystal, 0.2);

    // Outer breathing shell
    float shell = sdSphere(p, 2.6 + 0.3 * flowNoise(p * 0.6));

    return opSmoothUnion(blend2, shell, 0.5);
}

// Normal calculation
vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        mapScene(p + e.xyy) - mapScene(p - e.xyy),
        mapScene(p + e.yxy) - mapScene(p - e.yxy),
        mapScene(p + e.yyx) - mapScene(p - e.yyx)
    ));
}

// Raymarching
float rayMarch(vec3 ro, vec3 rd, out vec3 pos) {
    float dO = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + dO * rd;
        float ds = mapScene(p);
        if (ds < SURF_DIST || dO > MAX_DIST) break;
        dO += ds;
    }
    pos = ro + dO * rd;
    return dO;
}

// Shading
vec3 shade(vec3 p, vec3 n, vec3 viewDir) {
    vec3 lightPos1 = vec3(5.5 * cos(u_time * 1.0), 5.0, 5.5 * sin(u_time * 1.0));
    vec3 lightPos2 = vec3(-5.5 * cos(u_time * 0.8), 5.0, -5.5 * sin(u_time * 0.8));

    vec3 L1 = normalize(lightPos1 - p);
    vec3 L2 = normalize(lightPos2 - p);

    float diff1 = max(dot(n, L1), 0.0);
    float diff2 = max(dot(n, L2), 0.0);

    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);

    float ambient = 0.25;

    vec3 baseColor = mix(
        vec3(0.3, 0.4 + 0.3*sin(p.y*0.5 + u_time*0.4), 0.7),
        vec3(0.8, 0.7, 1.0),
        0.5 + 0.5*sin(u_time * 0.3)
    );

    vec3 color = baseColor * (ambient + diff1 * 0.5 + diff2 * 0.4);
    color += rim * vec3(1.0, 0.8, 1.0) * 0.7;

    return color;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    float roll = 0.05 * sin(u_time * 0.2);
    uv = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;

    vec3 ro = vec3(0.0, 1.0, 40.0);
    vec3 ta = vec3(-2.0, 3.0, 0.0);

    vec3 forward = normalize(ta - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);

    vec3 rd = normalize(uv.x * right + uv.y * up + 2.0 * forward);

    vec3 p;
    float dist = rayMarch(ro, rd, p);

    vec3 col = vec3(0.0);

    if (dist < MAX_DIST) {
        vec3 n = getNormal(p);
        vec3 viewDir = normalize(ro - p);
        col = shade(p, n, viewDir);

        // Cosmic sparkles
        float sparkle = smoothstep(0.98, 1.0, fract(sin(dot(p.xy + u_time * 3.0, vec2(12.9898, 78.233))) * 43758.5453));
        col += sparkle * vec3(1.8, 1.4, 2.0) * 0.2;

        // Soft atmospheric fog
        float fog = clamp(1.0 - exp(-dist * 0.02), 0.0, 1.0);
        col = mix(col, vec3(0.95, 0.98, 1.0), fog);
    }

    fragColor = vec4(col, 1.0);
}
