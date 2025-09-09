uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

#define MAX_STEPS   120
#define MAX_DIST    100.0
#define SURF_DIST   0.001

float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.yz) - t.x, p.x);
    return length(q) - t.y;
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735026;
}

float mapScene(vec3 p) {
    float warpAmp = 0.1 + 0.05 * sin(u_time * 0.7);
    float pulse = 0.2 * sin(u_time * 1.2) * (0.5 + 0.5 * sin(u_time * 0.4));

    vec3 wp = p + warpAmp * vec3(
        sin(p.y * 2.0 + u_time * 1.2) * 0.8,
        sin(p.z * 2.5 + u_time * 1.5) * 0.6,
        sin(p.x * 3.0 + u_time * 1.1) * 0.7
    );

    float angle = u_time * 0.7 + sin(u_time * 0.3) * 0.3;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec3 rp = wp;
    rp.yz = rot * wp.yz;
    float d1 = sdTorus(rp, vec2(1.0 + pulse, 0.3 + 0.05 * cos(u_time * 2.5)));

    float d2 = sdBox(wp - vec3(0.0, 2.0, 0.0), vec3(0.5));

    float d3 = sdSphere(
        wp - vec3(0.0, -2.0 + 0.2 * sin(u_time * 0.8), 0.0),
        0.7 + 0.1 * sin(u_time * 1.7)
    );

    float u12 = opSmoothUnion(d1, d2, 0.4);
    float u123 = opSmoothUnion(u12, d3, 0.3);

    float angle2 = u_time * 0.7;
    mat2 rot2 = mat2(cos(angle2), -sin(angle2), sin(angle2), cos(angle2));
    vec3 rp2 = wp;
    rp2.xz = rot2 * wp.xz;
    float d4 = sdTorus(rp2, vec2(1.2 + 0.2 * sin(u_time * 1.5), 0.2 + 0.05 * cos(u_time * 1.8)));

    float d5 = 1e5;
    for (int i = 0; i < 6; i++) {
        float a = u_time * 0.8 + float(i) / 6.0 * 6.2831853;
        vec3 sp = vec3(0.0, cos(a) * 2.5, sin(a) * 2.5);
        d5 = min(d5, sdSphere(wp - sp, 0.08));
    }

    float baseBlend = opSmoothUnion(u123, d4, 0.25);

    float angle3 = u_time * 1.3;
    mat2 rot3 = mat2(cos(angle3), -sin(angle3), sin(angle3), cos(angle3));
    vec3 bp = wp;
    bp.xy = rot3 * wp.xy;
    float cubeSize = 0.3 + 0.1 * sin(u_time * 2.2);
    float d6 = sdBox(bp, vec3(cubeSize));
    float withCube = opSmoothUnion(baseBlend, d6, 0.2);

    float angle4 = u_time * 0.6;
    mat2 rot4 = mat2(cos(angle4), -sin(angle4), sin(angle4), cos(angle4));
    vec3 rp7 = wp;
    rp7.yz = rot4 * wp.yz;
    float d7 = sdOctahedron(rp7, 0.8 + 0.2 * sin(u_time * 1.3));

    float blendAll = opSmoothUnion(withCube, d5, 0.15);
    return opSmoothUnion(blendAll, d7, 0.2);
}

vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        mapScene(p + e.xyy) - mapScene(p - e.xyy),
        mapScene(p + e.yxy) - mapScene(p - e.yxy),
        mapScene(p + e.yyx) - mapScene(p - e.yyx)
    ));
}

float softShadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.02;
    for (int i = 0; i < 30; i++) {
        float h = mapScene(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, 10.0 * h / t);
        t += clamp(h, 0.02, 0.1);
        if (t > MAX_DIST) break;
    }
    return res;
}

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

void main() {
    vec2 res = vec2(1080.0, 1920.0);
    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;

    float roll = 0.02 * sin(u_time * 0.3);
    uv = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;

    vec3 ro = vec3(0.0, 0.3, 18.0);
    vec3 ta = vec3(-0.8, 1.5, 0.0);

    vec3 cw = normalize(ta - ro);
    vec3 cu = normalize(cross(vec3(0.0, 1.0, 0.0), cw));
    vec3 cv = cross(cw, cu);

    vec3 rd = normalize(uv.x * cu + uv.y * cv + 2.0 * cw);

    vec3 p;
    float dist = rayMarch(ro, rd, p);

    float focusDist = 15.0;
    float blurAmount = clamp(abs(dist - focusDist) * 0.1, 0.0, 1.0);

    vec3 col = vec3(0.0);

    if (dist < MAX_DIST) {
        vec3 n = getNormal(p);
        vec3 viewDir = normalize(ro - p);
        vec3 lightPos = vec3(6.0 * cos(u_time * 1.2), 4.5 + sin(u_time * 0.4) * 1.5, 6.0 * sin(u_time * 1.1));
        vec3 L = normalize(lightPos - p);

        float diff = max(dot(n, L), 0.0);
        float shadow = softShadow(p + n * SURF_DIST * 2.0, L);
        float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        float amb = 0.2;

        float lum = amb + diff * shadow + rim * 0.3;
        float fogFactor = clamp(1.0 - exp(-dist * 0.01), 0.0, 1.0);
        lum = mix(lum, 1.0, fogFactor);

        lum += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453 + u_time) - 0.5) * 0.02;

        vec3 halfway = normalize(L + viewDir);
        float spec = pow(max(dot(n, halfway), 0.0), 32.0);
        lum += spec * 0.5;

        float glow = pow(clamp(1.0 - dist * 0.05, 0.0, 1.0), 2.0);
        lum += glow * 0.1;

        float vig = smoothstep(1.0, 0.4, length(uv));
        lum *= vig;

        col = vec3(lum);
    }

    // ✨ Sparkles
    float sparkle = step(0.995, fract(sin(dot(p.xy + u_time, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(sparkle) * 1.2;

    fragColor = vec4(mix(col, col, blurAmount), 1.0);
}