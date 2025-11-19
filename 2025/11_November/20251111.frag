out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// Raymarching constants
#define MAX_STEPS 100
#define MAX_DIST 100.0
#define SURF_DIST 0.001

// Mandelbulb parameters
#define ITERATIONS 15

// Rotation matrix around Y axis
mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

// Rotation matrix around X axis
mat3 rotateX(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

// Rotation matrix around Z axis
mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

// Mandelbulb distance estimation with animated power
float mandelbulbDE(vec3 pos, float power) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;

    for(int i = 0; i < ITERATIONS; i++) {
        r = length(z);

        if(r > 2.0) break;

        // Convert to spherical coordinates
        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;

        // Scale and rotate the point
        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        // Convert back to cartesian coordinates
        z = zr * vec3(
            sin(theta) * cos(phi),
            sin(theta) * sin(phi),
            cos(theta)
        );
        z += pos;
    }

    return 0.5 * log(r) * r / dr;
}

// Global time variable for animations
float g_time = 0.0;

// Scene distance function with transformations
float getDist(vec3 p) {
    vec3 pos = p;

    // Pulsing scale animation
    float pulse = 1.0 + sin(g_time * 0.4) * 0.1;
    pos /= pulse;

    // Multi-axis rotation of the fractal
    float rotSpeed = g_time * 0.1;
    pos = rotateY(rotSpeed) * pos;
    pos = rotateX(rotSpeed * 0.7) * pos;
    pos = rotateZ(rotSpeed * 0.5) * pos;

    // Kaleidoscopic folding for extra symmetry
    float foldTime = sin(g_time * 0.2) * 0.3;
    pos.xy = abs(pos.xy);
    if(pos.x < pos.y) pos.xy = pos.yx;

    // Twist effect
    float twist = length(pos.xy) * (0.5 + sin(g_time * 0.3) * 0.3);
    pos.xy = rotateZ(twist)[0].xy * pos.x + rotateZ(twist)[1].xy * pos.y;

    // Animated power morphing (cycles between 5 and 11)
    float power = 8.0 + sin(g_time * 0.25) * 3.0;

    float d = mandelbulbDE(pos, power);

    return d * pulse; // Scale distance back
}

// Calculate normal using tetrahedron technique
vec3 getNormal(vec3 p) {
    float d = getDist(p);
    vec2 e = vec2(0.001, 0.0);

    vec3 n = d - vec3(
        getDist(p - e.xyy),
        getDist(p - e.yxy),
        getDist(p - e.yyx)
    );

    return normalize(n);
}

// Raymarching function
float rayMarch(vec3 ro, vec3 rd) {
    float dO = 0.0;

    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float dS = getDist(p);
        dO += dS;

        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }

    return dO;
}

// Ambient occlusion for depth perception
float calculateAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = getDist(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

// Advanced lighting calculation
float calculateLighting(vec3 p, vec3 n) {
    // Animated light positions
    vec3 light1 = normalize(vec3(
        sin(u_time * 0.5) * 2.0,
        cos(u_time * 0.3) * 2.0 + 1.0,
        cos(u_time * 0.5) * 2.0 + 1.0
    ));

    vec3 light2 = normalize(vec3(-1.0, -0.5, 1.0));

    // Diffuse lighting from multiple sources
    float diff1 = max(dot(n, light1), 0.0);
    float diff2 = max(dot(n, light2), 0.0) * 0.5;

    // Rim lighting for dramatic edges
    vec3 viewDir = normalize(-p);
    float rim = pow(1.0 - abs(dot(n, viewDir)), 2.5);

    // Ambient occlusion
    float ao = calculateAO(p, n);

    // Combine all lighting
    float ambient = 0.15;
    float diffuse = diff1 + diff2;

    float brightness = ambient + diffuse * ao + rim * 0.6;

    return clamp(brightness, 0.0, 1.0);
}

void main() {
    // Normalized pixel coordinates (centered)
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // Set global time for animations
    g_time = u_time;

    // Dynamic camera animation
    float time = u_time * 0.15;

    // Camera position with smooth circular motion and height variation
    float radius = 2.5 + sin(time * 0.3) * 0.5; // Breathing distance
    float angle = time;
    float height = sin(time * 0.4) * 0.5; // Smooth vertical movement

    vec3 ro = vec3(
        radius * cos(angle),
        height,
        radius * sin(angle)
    );

    // Look at center with slight offset
    vec3 target = vec3(0.0, sin(time * 0.5) * 0.2, 0.0);
    vec3 forward = normalize(target - ro);

    // Camera up vector
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(forward, up));
    up = cross(right, forward);

    // Ray direction with proper camera matrix
    vec3 rd = normalize(forward + uv.x * right + uv.y * up);

    // Raymarch
    float d = rayMarch(ro, rd);

    vec3 color = vec3(0.0); // Start with black

    if(d < MAX_DIST) {
        // Hit the fractal
        vec3 p = ro + rd * d;
        vec3 n = getNormal(p);

        float brightness = calculateLighting(p, n);

        // Add depth-based darkening for atmosphere
        float depth = d / MAX_DIST;
        brightness *= (1.0 - depth * 0.3);

        // Enhanced contrast for dramatic black and white
        brightness = pow(brightness, 0.8);

        color = vec3(brightness);
    } else {
        // Add subtle glow in the background
        float glow = 0.02 / (d * 0.1 + 0.1);
        color = vec3(glow);
    }

    // Vignette effect for focus
    float vignette = 1.0 - length(uv) * 0.3;
    color *= vignette;

    // Final contrast boost
    color = smoothstep(0.0, 1.0, color);

    fragColor = vec4(color, 1.0);
}
