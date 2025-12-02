out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// Rotation matrix
mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

// Signed Distance Functions
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// Sacred Geometry: Octahedron (Platonic solid)
float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    float m = p.x + p.y + p.z - s;
    vec3 q;
    if(3.0 * p.x < m) q = p.xyz;
    else if(3.0 * p.y < m) q = p.yzx;
    else if(3.0 * p.z < m) q = p.zxy;
    else return m * 0.57735027;
    float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
    return length(vec3(q.x, q.y - s + k, q.z - k));
}

// Sacred Geometry: Tetrahedron
float sdTetrahedron(vec3 p, float r) {
    float md = max(max(-p.x - p.y - p.z, p.x + p.y - p.z),
                   max(-p.x + p.y + p.z, p.x - p.y + p.z));
    return (md - r) / sqrt(3.0);
}

// Smooth minimum for blending shapes
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Grid repetition function
vec3 repeat(vec3 p, vec3 spacing) {
    return mod(p + spacing * 0.5, spacing) - spacing * 0.5;
}

// Scene composition with sacred geometry and grid system
float scene(vec3 p) {
    // Apply 3D grid repetition for infinite pattern
    vec3 gridSpacing = vec3(5.0, 5.0, 5.0);
    vec3 gridPos = repeat(p, gridSpacing);

    // Store original position for variation across grid
    vec3 cellId = floor(p / gridSpacing);
    float cellVariation = sin(cellId.x * 3.7 + cellId.y * 2.3 + cellId.z * 4.1);

    // Central rotating octahedron (Platonic solid)
    vec3 octaPos = gridPos;
    octaPos.xy *= rot(u_time * 0.4 + cellVariation);
    octaPos.yz *= rot(u_time * 0.3 - cellVariation * 0.5);
    float pulse = sin(u_time * 1.0 + cellVariation * 3.0) * 0.1;
    float octa = sdOctahedron(octaPos, 0.8 + pulse);

    // Nested tetrahedron (sacred duality)
    vec3 tetraPos = gridPos;
    tetraPos.xz *= rot(-u_time * 0.5 + cellVariation * 2.0);
    tetraPos.xy *= rot(u_time * 0.35);
    float tetra = sdTetrahedron(tetraPos, 0.6);

    // Flower of Life inspired: 6 orbiting spheres
    float orbitRadius = 1.3;
    float orbitingElements = 1e10; // Start with large value

    for(float i = 0.0; i < 6.0; i++) {
        float angle = (i / 6.0) * 6.28318 + u_time * 0.6;
        vec3 orbitPos = gridPos;
        orbitPos.x += orbitRadius * cos(angle + cellVariation);
        orbitPos.y += orbitRadius * sin(angle + cellVariation);
        orbitPos.xy *= rot(u_time * 0.2);
        float orbitSphere = sdSphere(orbitPos, 0.15);
        orbitingElements = min(orbitingElements, orbitSphere);
    }

    // Three perpendicular rings (Metatron's Cube inspired)
    vec3 ring1Pos = gridPos;
    ring1Pos.xz *= rot(u_time * 0.3);
    float ring1 = sdTorus(ring1Pos, vec2(1.1, 0.08));

    vec3 ring2Pos = gridPos;
    ring2Pos.xy *= rot(u_time * 0.3);
    float ring2 = sdTorus(ring2Pos, vec2(1.1, 0.08));

    vec3 ring3Pos = gridPos;
    ring3Pos.yz *= rot(u_time * 0.3);
    float ring3 = sdTorus(ring3Pos, vec2(1.1, 0.08));

    // Smooth blend sacred geometry
    float result = smin(octa, tetra, 0.4);
    result = smin(result, orbitingElements, 0.2);
    result = min(result, ring1);
    result = min(result, ring2);
    result = min(result, ring3);

    return result;
}

// Raymarching
float raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for(int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        float d = scene(p);
        if(d < 0.001 || t > 100.0) break;
        t += d;
    }
    return t;
}

// Calculate normal using gradient
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        scene(p + e.xyy) - scene(p - e.xyy),
        scene(p + e.yxy) - scene(p - e.yxy),
        scene(p + e.yyx) - scene(p - e.yyx)
    ));
}

void main() {
    // Normalized coordinates (-1 to 1)
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // Beautiful cinematic camera movement
    float camTime = u_time * 0.15;

    // Camera orbits in a spiral path through the grid
    float radius = 8.0 + sin(u_time * 0.1) * 2.0; // Breathing radius
    vec3 ro = vec3(
        radius * cos(camTime),
        sin(u_time * 0.08) * 3.0, // Gentle vertical wave
        radius * sin(camTime)
    );

    // Camera target - look at origin with slight offset
    vec3 target = vec3(
        sin(u_time * 0.05) * 2.0,
        cos(u_time * 0.07) * 1.5,
        0.0
    );

    // Build camera matrix for proper look-at
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);

    // Ray direction using camera matrix
    vec3 rd = normalize(forward + uv.x * right + uv.y * up);

    // Raymarch
    float t = raymarch(ro, rd);

    // Color
    vec3 col = vec3(0.0); // black background

    if(t < 100.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // Lighting
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(n, lightDir), 0.0);

        // Ambient occlusion approximation
        float ao = 1.0 - (float(t) / 100.0);

        // Fresnel effect for edges
        float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);

        // Combine lighting for black & white aesthetic
        col = vec3(diff * 0.7 + ao * 0.2 + fresnel * 0.4);
    }

    fragColor = vec4(col, 1.0);
}
