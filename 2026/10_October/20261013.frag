// GYROID MANTA RAY
// TouchDesigner GLSL TOP fragment shader | Seamless 10-second loop
// Refactor only: preserve palette, controls, animation, framing and output.
// Set EXTERNAL_CONTROLS to 1 only after binding every CONTROL uniform.

#define EXTERNAL_CONTROLS 0
#define MAX_STEPS 160
#define TAIL_SEGMENTS 10

out vec4 fragColor;
uniform float uTimeSeconds;

#if EXTERNAL_CONTROLS
    #define CONTROL(name, value) uniform float name
#else
    #define CONTROL(name, value) const float name = value
#endif

// -----------------------------------------------------------------------------
// Controls (original names and defaults)
// -----------------------------------------------------------------------------
CONTROL(uBodyScale,          1.0);
CONTROL(uGyroidFrequency,    8.0);
CONTROL(uGyroidThickness,    0.42);
CONTROL(uPorosity,           0.82);
CONTROL(uStructuralDensity,  1.0);
CONTROL(uSurfaceDeformation, 0.025);
CONTROL(uPatternSpeed,       1.0);

CONTROL(uWingAmplitude,      0.44);
CONTROL(uWingSpeed,          2.0);
CONTROL(uWingPhase,          1.5);
CONTROL(uTailMotion,         0.16);
CONTROL(uTailSpeed,          2.0);
CONTROL(uBreathingAmount,    0.025);
CONTROL(uBreathingSpeed,     1.0);

CONTROL(uCameraOrbit,        4.0);
CONTROL(uCameraDistance,     1.0);
CONTROL(uCameraRoll,         68.0);
CONTROL(uLoopSpeed,          1.0);

CONTROL(uFresnelStrength,    1.0);
CONTROL(uEmissionStrength,   1.0);
CONTROL(uBloomStrength,      0.8);
CONTROL(uBackground,         1.0);
CONTROL(uExposure,           1.25);

const float TAU = 6.28318530718;
const float LOOP_SECONDS = 10.0;

// Original palette. Do not substitute other colors.
const vec3 PEARL  = vec3(0.66, 0.68, 0.80);
const vec3 DARK   = vec3(0.005, 0.010, 0.028);
const vec3 CYAN   = vec3(0.10, 0.75, 1.00);
const vec3 VIOLET = vec3(0.55, 0.25, 1.00);

float phase;
vec3 tailNodes[TAIL_SEGMENTS + 1];

struct Camera {
    vec3 origin;
    vec3 forward;
    vec3 right;
    vec3 up;
    float tanHalfFov;
};

struct TraceResult {
    float distance;
    float hit;
    float nearest;
    float material;
};

// -----------------------------------------------------------------------------
// Shared math and distance primitives
// -----------------------------------------------------------------------------
mat2 rotation(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

// Integer harmonics keep motion periodic over exactly LOOP_SECONDS.
float harmonic(float value) {
    return max(0.0, floor(value + 0.5));
}

float smoothUnion(float a, float b, float softness) {
    float h = clamp(0.5 + 0.5 * (b - a) / softness, 0.0, 1.0);
    return mix(b, a, h) - softness * h * (1.0 - h);
}

float ellipsoid(vec3 p, vec3 radius) {
    float k0 = length(p / radius);
    float k1 = length(p / (radius * radius));
    return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float capsule(vec3 p, vec3 a, vec3 b, float radiusA, float radiusB) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - mix(radiusA, radiusB, h);
}

// Signed Euclidean distance in the x/z wing plane.
float triangle(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 e0 = b - a;
    vec2 e1 = c - b;
    vec2 e2 = a - c;
    vec2 v0 = p - a;
    vec2 v1 = p - b;
    vec2 v2 = p - c;

    vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);

    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(
        min(
            vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
            vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))
        ),
        vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x))
    );
    return -sqrt(d.x) * sign(d.y);
}

// -----------------------------------------------------------------------------
// Periodic animation and local-space deformation
// -----------------------------------------------------------------------------
void updatePhase() {
    // An unbound or invalid clock produces a stable pose.
    float seconds = uTimeSeconds;
    if (isnan(seconds) || isinf(seconds)) {
        seconds = 0.0;
    }

    phase = TAU * fract(seconds * max(uLoopSpeed, 0.0) / LOOP_SECONDS);

#ifdef DEBUG_T
    phase = TAU * DEBUG_T;
#endif
}

float wingOffset(float x, float z) {
    float w = smoothstep(0.38, 2.85, abs(x));
    return clamp(uWingAmplitude, 0.0, 0.65) * w * w
        * sin(phase * harmonic(uWingSpeed) - w * clamp(uWingPhase, 0.0, 3.0) - z * 0.65)
        + 0.10 * w * w;
}

vec3 surfaceDeformation(vec3 p) {
    p.y -= wingOffset(p.x, p.z);
    p.y -= clamp(uSurfaceDeformation, 0.0, 0.04)
        * smoothstep(0.4, 2.4, abs(p.x))
        * sin(p.z * 3.0 + phase)
        * sin(p.x * 2.0);
    return p;
}

vec3 tailPoint(float w) {
    float ph = phase * harmonic(uTailSpeed) - 3.5 * w - 0.9;
    return vec3(
        clamp(uTailMotion, 0.0, 0.3) * w * w * sin(ph),
        -0.055 + 0.10 * w * w * sin(ph + 0.6),
        0.78 + 2.65 * w
    );
}

void updateTailNodes() {
    for (int i = 0; i <= TAIL_SEGMENTS; i++) {
        tailNodes[i] = tailPoint(float(i) / float(TAIL_SEGMENTS));
    }
}

vec3 creatureSpace(vec3 p) {
    p.y -= 0.035 * sin(phase);
    p.xz = rotation(0.018 * sin(phase)) * p.xz;
    return p / (
        max(uBodyScale, 0.2) *
        (1.0 + clamp(uBreathingAmount, 0.0, 0.06)
            * sin(phase * harmonic(uBreathingSpeed)))
    );
}

// -----------------------------------------------------------------------------
// Creature geometry and gyroid lattice
// -----------------------------------------------------------------------------
float bodyGeometry(vec3 p) {
    return ellipsoid(p - vec3(0.0, 0.0, -0.08), vec3(0.69, 0.235, 1.08));
}

float wingGeometry(vec3 p) {
    float x = abs(p.x);
    float w = clamp(x / 2.85, 0.0, 1.0);
    float planar = triangle(
        vec2(x, p.z),
        vec2(0.30, -0.94),
        vec2(2.88, 0.25),
        vec2(0.42, 1.03)
    ) - 0.075;
    float height = mix(0.145, 0.045, w);
    vec2 d = vec2(planar, abs(p.y) - height);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 0.025;
}

float tailGeometry(vec3 p) {
    float d = 1e3;
    for (int i = 0; i < TAIL_SEGMENTS; i++) {
        float a = float(i) / float(TAIL_SEGMENTS);
        float b = float(i + 1) / float(TAIL_SEGMENTS);
        d = min(d, capsule(
            p, tailNodes[i], tailNodes[i + 1],
            mix(0.074, 0.009, a), mix(0.074, 0.009, b)
        ));
    }
    return d;
}

float cephalicGeometry(vec3 p) {
    p.x = abs(p.x);
    float a = capsule(
        p, vec3(0.40, -0.015, -0.73), vec3(0.49, -0.055, -1.20),
        0.105, 0.074
    );
    float b = capsule(
        p, vec3(0.49, -0.055, -1.20), vec3(0.31, -0.01, -1.39),
        0.074, 0.048
    );
    return smoothUnion(a, b, 0.065);
}

float gyroidField(vec3 p) {
    float f = clamp(uGyroidFrequency, 4.0, 12.0)
        * clamp(uStructuralDensity, 0.65, 1.35);
    float t = phase * harmonic(uPatternSpeed);

    vec3 q = p * f + vec3(0.23 * sin(t), 0.20 * cos(t), 0.18 * sin(t + 0.7));
    q += 0.12 * vec3(
        sin(q.y * 0.35 + t),
        sin(q.z * 0.35 - t),
        sin(q.x * 0.35 + t)
    );

    float g = dot(sin(q), cos(q.yzx));
    float thick = clamp(uGyroidThickness, 0.25, 0.8)
        * (1.0 + 0.08 * sin(phase));

    // Conservative distance-estimator scale for lattice ray marching.
    return (abs(g) - thick) / (f * 3.8);
}

// Returns x = distance estimator, y = material ID (1 body, 2 tail, 3 eye).
vec2 sceneMapping(vec3 world) {
    float scale = max(uBodyScale, 0.2)
        * (1.0 + clamp(uBreathingAmount, 0.0, 0.06)
            * sin(phase * harmonic(uBreathingSpeed)));
    vec3 p = creatureSpace(world);

    // Cheap early-out for positions outside the creature's local bounding box.
    float bound = max(
        max(abs(p.x) - 3.12, abs(p.y) - 1.0),
        max(-1.6 - p.z, p.z - 3.65)
    );
    if (bound > 0.12) {
        return vec2(bound * 0.30 * scale, 0.0);
    }

    vec3 q = surfaceDeformation(p);
    float wing = wingGeometry(q);
    float body = bodyGeometry(q);
    float envelope = smoothUnion(body, wing, 0.18);
    float lattice = max(envelope, gyroidField(q));

    // Preserve a solid perimeter and spine inside the porous wing membrane.
    float edge = triangle(
        vec2(abs(q.x), q.z),
        vec2(0.30, -0.94),
        vec2(2.88, 0.25),
        vec2(0.42, 1.03)
    ) - 0.075;
    float spar = max(wing, abs(edge) - 0.065);
    float core = ellipsoid(
        q - vec3(0.0, 0.02, -0.16), vec3(0.47, 0.205, 0.91)
    );
    float solid = max(envelope, min(spar, core));
    float pores = smoothUnion(lattice, solid, 0.018);

    float d = mix(envelope, pores, clamp(uPorosity, 0.0, 1.0));
    d = smoothUnion(d, cephalicGeometry(p), 0.10);

    float material = 1.0;
    float tailDistance = tailGeometry(p);
    if (tailDistance < d) {
        d = tailDistance;
        material = 2.0;
    }

    // Solid bilateral eye sockets remain visible through the porous lattice.
    vec3 head = p;
    head.x = abs(head.x);
    float socket = ellipsoid(
        head - vec3(0.44, 0.135, -0.77), vec3(0.165, 0.145, 0.205)
    );
    d = smoothUnion(d, socket, 0.045);

    float eye = ellipsoid(
        head - vec3(0.44, 0.255, -0.81), vec3(0.103, 0.067, 0.128)
    );
    if (eye < d) {
        d = eye;
        material = 3.0;
    }

    // Inverse wing deformation and ellipsoids are distance estimators.
    return vec2(d * 0.40 * scale, material);
}

// -----------------------------------------------------------------------------
// Normals, ambient lighting and materials
// -----------------------------------------------------------------------------
vec3 normalAt(vec3 p, float epsilon) {
    vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * sceneMapping(p + k.xyy * epsilon).x
        + k.yyx * sceneMapping(p + k.yyx * epsilon).x
        + k.yxy * sceneMapping(p + k.yxy * epsilon).x
        + k.xxx * sceneMapping(p + k.xxx * epsilon).x
    );
}

vec3 environment(vec3 direction) {
    vec3 color = mix(
        vec3(0.0012, 0.0025, 0.007),
        vec3(0.004, 0.017, 0.032),
        smoothstep(-0.5, 0.9, direction.y)
    );
    color += vec3(0.018, 0.065, 0.09) * pow(max(direction.y, 0.0), 3.0);
    color += vec3(0.012, 0.004, 0.02)
        * exp(-length(direction.xz - vec2(-0.6, -0.5)) * 2.0);
    return color;
}

float ambientOcclusion(vec3 p, vec3 normal) {
    float occlusion = 0.0;
    for (int i = 1; i <= 3; i++) {
        float height = 0.035 * float(i);
        occlusion += max(
            0.0, height - sceneMapping(p + normal * height).x / 0.40
        ) / float(i);
    }
    return clamp(1.0 - occlusion * 3.2, 0.30, 1.0);
}

vec3 shade(vec3 p, vec3 normal, vec3 rayDirection, float material) {
    vec3 q = creatureSpace(p);
    vec3 lightDirection = normalize(vec3(-0.45, 0.85, 0.55));

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float fill = max(dot(normal, normalize(vec3(0.65, 0.3, -0.65))), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.6);
    float ao = ambientOcclusion(p, normal);
    float specular = pow(
        max(dot(normal, normalize(lightDirection - rayDirection)), 0.0), 70.0
    );

    vec3 glow = mix(CYAN, VIOLET, 0.5 + 0.5 * cos(q.z * 2.0 + q.x * 0.8));
    float sweep = pow(
        0.5 + 0.5 * cos(
            q.z * 3.0 - phase * harmonic(uPatternSpeed) + q.x * 0.7
        ), 8.0
    );

    vec3 color = mix(DARK, PEARL * 0.5, 0.48)
        * (0.20 + 0.85 * diffuse + 0.30 * fill) * ao;
    color += vec3(0.8, 0.9, 1.0) * specular * 0.65;
    color += environment(reflect(rayDirection, normal))
        * 3.5 * fresnel * uFresnelStrength;
    color += glow * (0.055 + 0.21 * fresnel + 0.12 * sweep)
        * uEmissionStrength * (0.4 + 0.6 * ao);

    if (material > 1.5 && material < 2.5) {
        color = PEARL * 0.32 * (0.25 + 0.6 * diffuse)
            + glow * (0.16 * fresnel + 0.09 * sweep) * uEmissionStrength;
    }

    if (material > 2.5) {
        // Dark lens, cyan iris and small pearl catchlight.
        vec3 eyePoint = q;
        eyePoint.x = abs(eyePoint.x);
        eyePoint -= vec3(0.44, 0.255, -0.81);

        float iris = exp(
            -dot(
                eyePoint.xz / vec2(0.055, 0.065),
                eyePoint.xz / vec2(0.055, 0.065)
            ) * 2.0
        );
        float lensSpecular = pow(
            max(dot(normal, normalize(lightDirection - rayDirection)), 0.0),
            110.0
        );
        color = DARK * 0.5 + CYAN * 0.055 * iris
            + vec3(0.8, 0.9, 1.0) * lensSpecular * 0.85
            + CYAN * 0.025 * fresnel;
    }

    return color * exp(-length(q) * 0.035);
}

// -----------------------------------------------------------------------------
// Camera and automatic vertical-Reels framing
// -----------------------------------------------------------------------------
float cameraFitDistance(
    vec3 target, vec3 forward, vec3 right, vec3 up,
    float tanHalfFov, float aspect
) {
    // Fit 12 feature envelopes rather than one large empty bounding box.
    float width = 0.0;
    float height = 0.0;
    float depth = 0.0;

    for (int i = 0; i < 12; i++) {
        float side = (i % 2) == 0 ? -1.0 : 1.0;
        int part = i / 2;
        vec3 center;
        vec3 padding;

        if (part == 0) {
            center = vec3(side * 2.90, 0.0, 0.25);
            padding = vec3(0.18, 0.80, 0.18);
        } else if (part == 1) {
            center = vec3(side * 0.50, 0.0, -0.95);
            padding = vec3(0.23, 0.28, 0.20);
        } else if (part == 2) {
            center = vec3(side * 0.48, 0.0, 1.03);
            padding = vec3(0.25, 0.28, 0.20);
        } else if (part == 3) {
            center = vec3(side * 0.40, 0.0, -1.28);
            padding = vec3(0.20, 0.18, 0.22);
        } else if (part == 4) {
            center = vec3(side * 0.20, 0.0, 3.45);
            padding = vec3(0.17, 0.28, 0.15);
        } else {
            center = vec3(0.0, 0.0, 0.25);
            padding = vec3(0.74, 0.34, 1.05);
        }

        center = center * max(uBodyScale, 0.2) * 1.06 - target;
        padding *= max(uBodyScale, 0.2) * 1.06;

        width = max(width, abs(dot(right, center)) + dot(abs(right), padding));
        height = max(height, abs(dot(up, center)) + dot(abs(up), padding));
        depth = max(depth, abs(dot(forward, center)) + dot(abs(forward), padding));
    }

    return (
        max(width / max(aspect * tanHalfFov, 0.025), height / tanHalfFov)
        + depth
    ) * max(uCameraDistance, 0.7);
}

Camera buildCamera(float aspect) {
    vec3 target = vec3(0.0, 0.0, 0.55);
    float yaw = radians(12.0 + clamp(uCameraOrbit, 0.0, 8.0) * sin(phase));
    vec3 eyeDirection = normalize(vec3(sin(yaw), 0.95, -cos(yaw)));

    Camera camera;
    camera.forward = -eyeDirection;
    camera.right = normalize(cross(camera.forward, vec3(0.0, 1.0, 0.0)));
    camera.up = cross(camera.right, camera.forward);

    float roll = radians(uCameraRoll);
    vec3 originalRight = camera.right;
    camera.right = cos(roll) * originalRight + sin(roll) * camera.up;
    camera.up = -sin(roll) * originalRight + cos(roll) * camera.up;

    camera.tanHalfFov = tan(radians(34.0) * 0.5);
    float distance = cameraFitDistance(
        target, camera.forward, camera.right, camera.up,
        camera.tanHalfFov, aspect
    );
    camera.origin = target + eyeDirection * distance;
    return camera;
}

vec2 getScreenUv(float aspect) {
    // Portrait offset leaves space for Instagram's action rail and caption.
    // TouchDesigner's output resolution remains unchanged.
    vec2 placement = aspect < 0.8 ? vec2(-0.035, 0.045) : vec2(0.0);
    return (vUV.st - 0.5 - placement) * vec2(aspect, 1.0) * 2.0;
}

vec3 cameraRay(Camera camera, vec2 uv) {
    return normalize(
        camera.forward
        + (uv.x * camera.right + uv.y * camera.up) * camera.tanHalfFov
    );
}

// -----------------------------------------------------------------------------
// Ray marching, composition and tone mapping
// -----------------------------------------------------------------------------
TraceResult traceScene(vec3 rayOrigin, vec3 rayDirection) {
    // Sphere around world origin; retain the original conservative clip volume.
    float radius = 4.25 * max(uBodyScale, 0.2);
    float b = dot(rayOrigin, rayDirection);
    float h = b * b - dot(rayOrigin, rayOrigin) + radius * radius;

    TraceResult result;
    result.distance = 0.0;
    result.hit = 0.0;
    result.nearest = 1e3;
    result.material = 0.0;

    if (h >= 0.0) {
        result.distance = max(0.0, -b - sqrt(h));
        float stop = -b + sqrt(h);

        for (int i = 0; i < MAX_STEPS; i++) {
            vec2 sampleResult = sceneMapping(
                rayOrigin + rayDirection * result.distance
            );
            float epsilon = max(0.00045, result.distance * 0.000045);

            if (sampleResult.x < epsilon) {
                result.hit = 1.0;
                result.material = sampleResult.y;
                break;
            }
            if (sampleResult.y > 0.5) {
                result.nearest = min(result.nearest, sampleResult.x);
            }

            result.distance += max(sampleResult.x, epsilon * 0.6);
            if (result.distance > stop) {
                break;
            }
        }
    }
    return result;
}

vec3 composeColor(
    vec3 rayOrigin, vec3 rayDirection, vec2 uv, TraceResult trace
) {
    vec3 color = environment(rayDirection) * uBackground;

    if (trace.hit > 0.5) {
        vec3 p = rayOrigin + rayDirection * trace.distance;
        vec3 normal = normalAt(p, 0.0012);
        color = shade(p, normal, rayDirection, trace.material);
        color = mix(
            color, environment(rayDirection) * uBackground,
            1.0 - exp(-trace.distance * 0.012)
        );
    } else {
        color += mix(CYAN, VIOLET, 0.5)
            * (0.035 * exp(-trace.nearest * 38.0)) * uBloomStrength;
    }

    return color * (1.0 - 0.22
        * smoothstep(0.6, 1.6, length(uv * vec2(1.0, 0.8))));
}

vec2 hash22(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

vec3 film(vec3 x) {
    return clamp(
        (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14),
        0.0, 1.0
    );
}

vec3 postProcess(vec3 color) {
    color = pow(
        film(max(color, 0.0) * max(uExposure, 0.0)),
        vec3(1.0 / 2.2)
    );
    vec2 noise = hash22(gl_FragCoord.xy);
    return color + (noise.x + noise.y - 1.0) / 255.0;
}

void main() {
    updatePhase();
    updateTailNodes();

    vec2 resolution = uTDOutputInfo.res.zw;
    float aspect = resolution.x / max(resolution.y, 1.0);

    Camera camera = buildCamera(aspect);
    vec2 uv = getScreenUv(aspect);
    vec3 rayDirection = cameraRay(camera, uv);
    TraceResult trace = traceScene(camera.origin, rayDirection);

#ifdef DEBUG_MASK
    fragColor = TDOutputSwizzle(vec4(vec3(trace.hit), 1.0));
    return;
#endif

    vec3 color = composeColor(camera.origin, rayDirection, uv, trace);
    fragColor = TDOutputSwizzle(vec4(postProcess(color), 1.0));
}
