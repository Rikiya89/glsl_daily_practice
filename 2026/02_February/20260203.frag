// TouchDesigner GLSL TOP - Ethereal Mathematical Garden III
// Black & White | Sacred geometry, organic flows, crystalline dreams
// Ultimate edition: Metatron's Cube, peacock feathers, snowflakes, galaxies

uniform float uTime;
out vec4 fragColor;

#define PI 3.14159265359
#define TAU 6.28318530718
#define PHI 1.618033988749
#define SQRT3 1.732050808

mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

// Smooth noise
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = rot(PI / 5.0);
    for(int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = r * p * 2.0 + 100.0;
        a *= 0.5;
    }
    return v;
}

// Higher octave fbm for fine detail
float fbmFine(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = rot(PI / 7.0);
    for(int i = 0; i < 8; i++) {
        v += a * noise(p);
        p = r * p * 2.1 + 50.0;
        a *= 0.48;
    }
    return v;
}

// Smooth minimum for organic blending
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Smooth maximum
float smax(float a, float b, float k) {
    return -smin(-a, -b, k);
}

// === ELEGANT MANDALA ===
float mandala(vec2 uv, float segments, float t) {
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Fold into segment
    float segAngle = TAU / segments;
    a = abs(mod(a + segAngle * 0.5, segAngle) - segAngle * 0.5);

    vec2 p = r * vec2(cos(a), sin(a));

    float pattern = 0.0;

    // Petal shapes
    for(int i = 1; i <= 5; i++) {
        float ri = float(i) * 0.15;
        float petalWidth = 0.08 - float(i) * 0.01;
        float petalLen = 0.12 + float(i) * 0.02;

        vec2 petalCenter = vec2(ri, 0.0);
        vec2 d = p - petalCenter;
        d.x *= 1.0 / petalLen;
        d.y *= 1.0 / petalWidth;

        float petal = 1.0 - smoothstep(0.8, 1.0, length(d));
        pattern = max(pattern, petal * (1.0 - float(i) * 0.15));
    }

    // Concentric rings
    for(int i = 1; i <= 8; i++) {
        float ri = float(i) * 0.1 + 0.05;
        float ringWidth = 0.008 + 0.002 * sin(t + float(i));
        float ring = 1.0 - smoothstep(0.0, ringWidth, abs(r - ri));
        pattern = max(pattern, ring * 0.6);
    }

    // Decorative dots
    for(int i = 0; i < 3; i++) {
        float dotR = 0.2 + float(i) * 0.2;
        vec2 dotPos = dotR * vec2(cos(a), sin(a));
        float dotSize = 0.02 - float(i) * 0.005;
        float dot = 1.0 - smoothstep(0.0, dotSize, length(p - vec2(dotR, 0.0)));
        pattern = max(pattern, dot * 0.8);
    }

    return pattern;
}

// === FLOWING SILK RIBBONS ===
float silkRibbon(vec2 uv, float t) {
    float pattern = 0.0;

    for(int i = 0; i < 6; i++) {
        float fi = float(i);
        float phase = fi * 0.7 + t * 0.3;

        // Ribbon path
        float wave = sin(uv.x * 3.0 + phase) * 0.3;
        wave += sin(uv.x * 5.0 - phase * 1.3) * 0.15;
        wave += sin(uv.x * 8.0 + phase * 0.7) * 0.08;

        float y = uv.y - wave - (fi - 2.5) * 0.25;

        // Ribbon thickness varies
        float thickness = 0.04 + 0.02 * sin(uv.x * 4.0 + phase);
        float ribbon = 1.0 - smoothstep(0.0, thickness, abs(y));

        // Soft edges
        ribbon *= smoothstep(-1.5, -0.5, uv.x) * smoothstep(1.5, 0.5, uv.x);

        pattern = max(pattern, ribbon * (0.9 - fi * 0.1));
    }

    return pattern;
}

// === CRYSTAL FORMATION ===
float crystal(vec2 uv, float t) {
    float pattern = 0.0;

    // Central crystal
    vec2 p = uv * rot(t * 0.1);

    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0;
        vec2 axis = vec2(cos(angle), sin(angle));

        // Crystal face
        float d = abs(dot(p, axis));
        float face = 1.0 - smoothstep(0.0, 0.01, abs(d - 0.3));
        pattern = max(pattern, face * 0.5);

        // Inner facets
        float inner = 1.0 - smoothstep(0.0, 0.008, abs(d - 0.15));
        pattern = max(pattern, inner * 0.4);

        // Growth lines
        float growth = 1.0 - smoothstep(0.0, 0.005, abs(d - 0.2 - 0.05 * sin(t + angle)));
        pattern = max(pattern, growth * 0.3);
    }

    // Hexagonal outline
    float hex = 0.0;
    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + PI / 6.0;
        vec2 n = vec2(cos(angle), sin(angle));
        hex = max(hex, dot(p, n));
    }
    float outline = 1.0 - smoothstep(0.0, 0.015, abs(hex - 0.35));
    pattern = max(pattern, outline * 0.8);

    // Inner glow
    float glow = exp(-length(p) * 5.0) * 0.3;
    pattern += glow;

    return pattern;
}

// === LOTUS FLOWER ===
float lotus(vec2 uv, float t) {
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    float pattern = 0.0;

    // Multiple petal layers
    for(int layer = 0; layer < 4; layer++) {
        float layerOffset = float(layer) * 0.08;
        float layerRot = float(layer) * PI / 12.0 + t * 0.05;
        float petals = 8.0 + float(layer) * 4.0;

        float petalAngle = a + layerRot;
        float petalR = 0.2 + layerOffset + 0.1 * pow(cos(petalAngle * petals * 0.5), 2.0);

        // Petal shape
        float petal = smoothstep(petalR + 0.05, petalR, r);
        petal *= smoothstep(0.05 + layerOffset, 0.1 + layerOffset, r);

        // Petal edges
        float edge = abs(sin(petalAngle * petals * 0.5));
        petal *= smoothstep(0.0, 0.3, edge);

        pattern = max(pattern, petal * (1.0 - float(layer) * 0.2));
    }

    // Center detail
    float center = 1.0 - smoothstep(0.0, 0.08, r);
    float centerPattern = center * (0.5 + 0.5 * sin(a * 12.0 + t));
    pattern = max(pattern, centerPattern * 0.8);

    // Stamen dots
    for(int i = 0; i < 12; i++) {
        float sa = float(i) * TAU / 12.0;
        vec2 sp = 0.05 * vec2(cos(sa), sin(sa));
        float stamen = 1.0 - smoothstep(0.0, 0.015, length(uv - sp));
        pattern = max(pattern, stamen * 0.9);
    }

    return pattern;
}

// === FEATHER / FERN ===
float feather(vec2 uv, float t) {
    float pattern = 0.0;

    // Main stem
    float stem = 1.0 - smoothstep(0.0, 0.01, abs(uv.x));
    stem *= smoothstep(-0.8, 0.8, uv.y);
    pattern = max(pattern, stem * 0.7);

    // Barbs on each side
    for(int i = -15; i <= 15; i++) {
        if(i == 0) continue;

        float fi = float(i);
        float y = fi * 0.05;
        float side = sign(fi);

        // Barb angle varies along stem
        float barbAngle = side * (0.4 + 0.2 * (1.0 - abs(y)));
        vec2 barbDir = vec2(cos(barbAngle), sin(barbAngle));

        // Local coordinates
        vec2 local = uv - vec2(0.0, y);
        float along = dot(local, barbDir);
        float perp = abs(dot(local, vec2(-barbDir.y, barbDir.x)));

        // Barb shape - tapers
        float barbLen = 0.3 * (1.0 - abs(y) * 0.8);
        float barbWidth = 0.015 * (1.0 - along / barbLen);

        float barb = smoothstep(barbWidth, 0.0, perp);
        barb *= smoothstep(-0.01, 0.02, along);
        barb *= smoothstep(barbLen, barbLen * 0.7, along);

        pattern = max(pattern, barb * 0.6);
    }

    return pattern;
}

// === ROSE CURVE ===
float rose(vec2 uv, float t) {
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    float pattern = 0.0;

    // Rose: r = cos(k * theta)
    float k = 5.0; // 5 petals

    for(int i = 0; i < 3; i++) {
        float scale = 1.0 - float(i) * 0.25;
        float phase = float(i) * 0.2 + t * 0.1;

        float roseR = 0.4 * scale * abs(cos(k * a + phase));

        // Soft petal
        float petal = smoothstep(0.03, 0.0, abs(r - roseR));
        pattern = max(pattern, petal * (0.8 - float(i) * 0.2));

        // Petal fill
        float fill = smoothstep(roseR + 0.02, roseR - 0.05, r);
        fill *= smoothstep(0.02, 0.08, r);
        pattern = max(pattern, fill * (0.4 - float(i) * 0.1));
    }

    // Center
    float center = 1.0 - smoothstep(0.0, 0.05, r);
    pattern = max(pattern, center * 0.9);

    return pattern;
}

// === WATER RIPPLES ===
float ripples(vec2 uv, float t) {
    float pattern = 0.0;

    // Multiple ripple sources
    vec2 sources[4];
    sources[0] = vec2(0.0, 0.0);
    sources[1] = vec2(0.4, 0.3) * rot(t * 0.2);
    sources[2] = vec2(-0.3, 0.4) * rot(-t * 0.15);
    sources[3] = vec2(0.2, -0.35) * rot(t * 0.25);

    for(int i = 0; i < 4; i++) {
        float d = length(uv - sources[i]);
        float ripple = sin(d * 30.0 - t * 3.0 - float(i)) * 0.5 + 0.5;
        ripple *= exp(-d * 2.0); // Fade with distance
        ripple *= smoothstep(0.0, 0.1, d); // No center spike

        pattern += ripple * 0.4;
    }

    // Interference creates beautiful patterns
    pattern = smoothstep(0.3, 0.7, pattern);

    return pattern;
}

// === SPIROGRAPH ===
float spirograph(vec2 uv, float t) {
    float pattern = 0.0;

    float R = 1.0;  // Fixed circle radius
    float r = 0.4;  // Rolling circle radius
    float d = 0.8;  // Pen distance from center

    vec2 prevPoint = vec2(0.0);

    for(int i = 0; i < 500; i++) {
        float theta = float(i) * 0.05 + t * 0.2;

        // Spirograph parametric equations
        float x = (R - r) * cos(theta) + d * cos((R - r) / r * theta);
        float y = (R - r) * sin(theta) - d * sin((R - r) / r * theta);

        vec2 point = vec2(x, y) * 0.35;

        // Draw point
        float dist = length(uv - point);
        pattern += exp(-dist * dist * 500.0) * 0.1;
    }

    return clamp(pattern, 0.0, 1.0);
}

// === FLOWING ENERGY FIELD ===
float energyField(vec2 uv, float t) {
    float pattern = 0.0;

    for(int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 flow = uv;

        // Curl noise flow
        float n = fbm(flow * 2.0 + fi * 10.0 + t * 0.1);
        float angle = n * TAU;

        flow += vec2(cos(angle), sin(angle)) * 0.3;

        // Energy lines
        float line = sin(flow.x * 10.0 + flow.y * 10.0 + t + fi);
        line = abs(line);
        line = pow(line, 8.0);

        pattern += line * 0.15;
    }

    return pattern;
}

// === FLOWER OF LIFE - Sacred Geometry ===
float flowerOfLife(vec2 uv, float t) {
    float pattern = 0.0;
    float circleR = 0.15;

    // Central circle
    float d = length(uv);
    pattern = max(pattern, 1.0 - smoothstep(0.0, 0.008, abs(d - circleR)));

    // First ring - 6 circles
    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + t * 0.02;
        vec2 center = circleR * vec2(cos(angle), sin(angle));
        d = length(uv - center);
        pattern = max(pattern, 1.0 - smoothstep(0.0, 0.008, abs(d - circleR)));
    }

    // Second ring - 12 circles
    for(int i = 0; i < 12; i++) {
        float angle = float(i) * TAU / 12.0 + PI / 12.0 + t * 0.02;
        vec2 center = circleR * SQRT3 * vec2(cos(angle), sin(angle));
        d = length(uv - center);
        pattern = max(pattern, (1.0 - smoothstep(0.0, 0.006, abs(d - circleR))) * 0.8);
    }

    // Third ring - 18 circles
    for(int i = 0; i < 18; i++) {
        float angle = float(i) * TAU / 18.0 + t * 0.02;
        vec2 center = circleR * 2.0 * vec2(cos(angle), sin(angle));
        d = length(uv - center);
        pattern = max(pattern, (1.0 - smoothstep(0.0, 0.005, abs(d - circleR))) * 0.6);
    }

    // Vesica piscis highlights (almond shapes where circles overlap)
    float vesica = 0.0;
    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + PI / 6.0;
        vec2 p = uv * rot(-angle);
        float v = smoothstep(0.02, 0.0, abs(p.x)) * smoothstep(circleR, 0.0, abs(p.y));
        vesica = max(vesica, v * 0.3);
    }
    pattern += vesica;

    return pattern;
}

// === FIBONACCI SPIRAL - Golden Ratio Beauty ===
float fibonacciSpiral(vec2 uv, float t) {
    float pattern = 0.0;

    // Golden spiral: r = a * e^(b * theta), b = ln(PHI) / (PI/2)
    float b = log(PHI) / (PI * 0.5);

    for(int arm = 0; arm < 2; arm++) {
        float armOffset = float(arm) * PI;

        for(int i = 0; i < 400; i++) {
            float theta = float(i) * 0.04 + t * 0.15 + armOffset;
            float r = 0.02 * exp(b * theta);

            if(r > 1.2) break;

            vec2 point = r * vec2(cos(theta), sin(theta));
            float dist = length(uv - point);

            // Varying thickness along spiral
            float thickness = 0.003 + 0.002 * sin(theta * 0.5);
            pattern += exp(-dist * dist / (thickness * thickness)) * 0.08;
        }
    }

    // Fibonacci seed pattern in center
    for(int i = 0; i < 150; i++) {
        float fi = float(i);
        float angle = fi * TAU / PHI; // Golden angle
        float r = 0.012 * sqrt(fi);

        if(r > 0.25) break;

        vec2 seed = r * vec2(cos(angle + t * 0.1), sin(angle + t * 0.1));
        float dist = length(uv - seed);
        float size = 0.006 + 0.003 * sin(fi * 0.3 + t);
        pattern += smoothstep(size, 0.0, dist) * 0.5;
    }

    return clamp(pattern, 0.0, 1.0);
}

// === BUTTERFLY WINGS ===
float butterflyWing(vec2 uv, float t) {
    float pattern = 0.0;

    // Wing shape using polar coordinates
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Wing outline - cardioid-like shape
    float wingR = 0.35 * (1.0 - 0.3 * cos(a)) * (1.0 + 0.2 * cos(2.0 * a + t * 0.3));
    wingR *= smoothstep(-PI, -PI * 0.1, a) * smoothstep(PI, PI * 0.1, a); // Only right side

    // Wing fill
    float wing = smoothstep(wingR + 0.02, wingR - 0.02, r);
    wing *= smoothstep(0.0, 0.05, r);

    // Wing veins
    for(int i = 1; i <= 7; i++) {
        float veinAngle = -PI * 0.5 + float(i) * PI * 0.12;
        vec2 veinDir = vec2(cos(veinAngle), sin(veinAngle));
        float along = dot(uv, veinDir);
        float perp = abs(dot(uv, vec2(-veinDir.y, veinDir.x)));

        float vein = smoothstep(0.004, 0.0, perp);
        vein *= smoothstep(-0.02, 0.05, along);
        vein *= smoothstep(wingR, wingR * 0.5, length(uv));

        pattern = max(pattern, vein * 0.7);
    }

    // Eye spots
    vec2 eyePos = vec2(0.15, 0.1);
    float eye = 1.0 - smoothstep(0.0, 0.06, length(uv - eyePos));
    float eyeRing = 1.0 - smoothstep(0.0, 0.008, abs(length(uv - eyePos) - 0.04));
    pattern = max(pattern, eye * 0.4 + eyeRing * 0.8);

    // Smaller spots
    for(int i = 0; i < 5; i++) {
        vec2 spotPos = vec2(0.08 + float(i) * 0.05, -0.05 + float(i) * 0.03);
        float spot = 1.0 - smoothstep(0.0, 0.02, length(uv - spotPos));
        pattern = max(pattern, spot * 0.5);
    }

    // Wing edge detail
    float edge = 1.0 - smoothstep(0.0, 0.015, abs(r - wingR));
    edge *= smoothstep(0.0, 0.1, r);
    pattern = max(pattern, edge * 0.9);

    // Scalloped edge
    float scallop = sin(a * 15.0 + t) * 0.02;
    float scallopEdge = 1.0 - smoothstep(0.0, 0.01, abs(r - wingR - scallop));
    pattern = max(pattern, scallopEdge * 0.5);

    pattern *= wing + 0.1; // Mask to wing shape but keep some edge

    return pattern;
}

float butterfly(vec2 uv, float t) {
    // Mirror for both wings
    float left = butterflyWing(vec2(-uv.x, uv.y) * 1.5, t);
    float right = butterflyWing(uv * 1.5, t);

    // Body
    float body = smoothstep(0.025, 0.0, abs(uv.x)) * smoothstep(0.25, 0.0, abs(uv.y - 0.05));

    // Antennae
    for(int i = 0; i < 2; i++) {
        float side = float(i) * 2.0 - 1.0;
        vec2 antBase = vec2(side * 0.02, 0.2);
        vec2 antTip = vec2(side * 0.08, 0.35);
        vec2 antDir = normalize(antTip - antBase);
        vec2 local = uv - antBase;
        float along = dot(local, antDir);
        float perp = abs(dot(local, vec2(-antDir.y, antDir.x)));
        float ant = smoothstep(0.006, 0.0, perp) * smoothstep(-0.02, 0.0, along) * smoothstep(0.18, 0.12, along);
        body = max(body, ant * 0.8);

        // Antenna tip
        float tip = 1.0 - smoothstep(0.0, 0.015, length(uv - antTip));
        body = max(body, tip * 0.9);
    }

    return max(max(left, right), body * 0.9);
}

// === AURORA WAVES ===
float aurora(vec2 uv, float t) {
    float pattern = 0.0;

    for(int i = 0; i < 6; i++) {
        float fi = float(i);
        float phase = fi * 0.8 + t * 0.2;

        // Layered flowing waves
        float wave = 0.0;
        wave += sin(uv.x * 2.0 + phase) * 0.3;
        wave += sin(uv.x * 3.5 - phase * 1.2) * 0.2;
        wave += sin(uv.x * 6.0 + phase * 0.8) * 0.1;
        wave += fbm(vec2(uv.x * 2.0 + t * 0.1, fi)) * 0.2;

        float y = uv.y - wave - (fi - 2.5) * 0.15;

        // Soft gradient band
        float band = exp(-y * y * 20.0);

        // Vertical curtain effect
        float curtain = 0.5 + 0.5 * sin(uv.x * 30.0 + fi * 5.0 + t + wave * 10.0);
        curtain = pow(curtain, 3.0);

        pattern += band * curtain * (0.3 - fi * 0.04);
    }

    // Shimmer
    float shimmer = noise(uv * 50.0 + t * 2.0);
    pattern *= 0.8 + shimmer * 0.4;

    return pattern;
}

// === DELICATE LACE FILIGREE ===
float lace(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Main lace circles
    for(int ring = 1; ring <= 4; ring++) {
        float ringR = float(ring) * 0.12;
        float segments = 6.0 + float(ring) * 6.0;

        // Scalloped edge
        float scallop = 0.02 * sin(a * segments + t * 0.1);
        float edge = 1.0 - smoothstep(0.0, 0.006, abs(r - ringR - scallop));
        pattern = max(pattern, edge * (1.0 - float(ring) * 0.15));

        // Connecting threads
        for(int i = 0; i < int(segments); i++) {
            float threadAngle = float(i) * TAU / segments;
            vec2 threadDir = vec2(cos(threadAngle), sin(threadAngle));
            float along = dot(uv, threadDir);
            float perp = abs(dot(uv, vec2(-threadDir.y, threadDir.x)));

            float thread = smoothstep(0.003, 0.0, perp);
            thread *= smoothstep(ringR - 0.12, ringR - 0.02, along);
            thread *= smoothstep(ringR + 0.02, ringR, along);

            pattern = max(pattern, thread * 0.5);
        }

        // Decorative dots
        for(int i = 0; i < int(segments); i++) {
            float dotAngle = (float(i) + 0.5) * TAU / segments;
            vec2 dotPos = (ringR - 0.03) * vec2(cos(dotAngle), sin(dotAngle));
            float dot = 1.0 - smoothstep(0.0, 0.008, length(uv - dotPos));
            pattern = max(pattern, dot * 0.6);
        }
    }

    // Central rosette
    float rosette = 0.0;
    for(int i = 0; i < 8; i++) {
        float petalA = float(i) * TAU / 8.0;
        vec2 petalDir = vec2(cos(petalA), sin(petalA));
        vec2 local = uv;
        float along = dot(local, petalDir);
        float perp = dot(local, vec2(-petalDir.y, petalDir.x));

        // Teardrop petal
        float petal = smoothstep(0.08, 0.0, along) * smoothstep(-0.01, 0.02, along);
        petal *= smoothstep(0.015 * (1.0 - along * 10.0), 0.0, abs(perp));
        rosette = max(rosette, petal);
    }
    pattern = max(pattern, rosette * 0.7);

    // Fine mesh in background
    float mesh = 0.0;
    vec2 meshUV = uv * 30.0;
    mesh = max(mesh, smoothstep(0.1, 0.0, abs(fract(meshUV.x) - 0.5)));
    mesh = max(mesh, smoothstep(0.1, 0.0, abs(fract(meshUV.y) - 0.5)));
    mesh *= smoothstep(0.5, 0.2, r); // Fade out
    pattern = max(pattern, mesh * 0.15);

    return pattern;
}

// === JELLYFISH TENDRILS ===
float jellyfish(vec2 uv, float t) {
    float pattern = 0.0;

    // Bell (dome)
    vec2 bellUV = uv - vec2(0.0, 0.1);
    float bellR = length(bellUV);
    float bellA = atan(bellUV.y, bellUV.x);

    // Pulsing bell shape
    float pulse = 1.0 + 0.1 * sin(t * 2.0);
    float bellShape = 0.25 * pulse * (1.0 + 0.3 * cos(bellA * 8.0) * smoothstep(0.0, -0.5, bellUV.y));
    bellShape *= smoothstep(-0.3, 0.1, bellUV.y);

    float bell = smoothstep(bellShape + 0.02, bellShape - 0.02, bellR);
    bell *= smoothstep(-0.25, 0.0, bellUV.y);

    // Bell edge detail
    float bellEdge = 1.0 - smoothstep(0.0, 0.015, abs(bellR - bellShape));
    bellEdge *= smoothstep(-0.2, 0.05, bellUV.y);
    pattern = max(pattern, bellEdge * 0.9);

    // Internal structure
    for(int i = 0; i < 8; i++) {
        float ribAngle = float(i) * PI / 8.0 - PI * 0.5;
        vec2 ribDir = vec2(cos(ribAngle), sin(ribAngle));
        float along = dot(bellUV, ribDir);
        float perp = abs(dot(bellUV, vec2(-ribDir.y, ribDir.x)));
        float rib = smoothstep(0.008, 0.0, perp) * bell;
        pattern = max(pattern, rib * 0.4);
    }

    // Tendrils
    for(int i = 0; i < 12; i++) {
        float fi = float(i);
        float tendrilX = (fi - 5.5) * 0.035;

        // Wavy tendril path
        float wave = 0.0;
        wave += sin((uv.y + 0.3) * 8.0 + fi + t * 1.5) * 0.02;
        wave += sin((uv.y + 0.3) * 15.0 - fi * 0.5 + t * 2.0) * 0.01;

        float tendrilPath = uv.x - tendrilX - wave;

        // Thickness varies
        float thickness = 0.006 + 0.004 * sin((uv.y + 0.3) * 20.0 + fi);
        thickness *= smoothstep(-0.8, -0.3, uv.y); // Taper

        float tendril = smoothstep(thickness, 0.0, abs(tendrilPath));
        tendril *= smoothstep(0.0, -0.1, uv.y) * smoothstep(-0.9, -0.4, uv.y);

        pattern = max(pattern, tendril * (0.6 + 0.2 * sin(fi)));
    }

    // Oral arms (frilly center tendrils)
    for(int i = 0; i < 4; i++) {
        float fi = float(i);
        float armX = (fi - 1.5) * 0.04;

        // More complex wave pattern
        float wave = sin((uv.y + 0.15) * 12.0 + fi * 2.0 + t * 2.0) * 0.025;
        wave += sin((uv.y + 0.15) * 25.0 - t * 3.0) * 0.01;

        float armPath = uv.x - armX - wave;
        float arm = smoothstep(0.012, 0.0, abs(armPath));
        arm *= smoothstep(0.0, -0.05, uv.y) * smoothstep(-0.5, -0.15, uv.y);

        // Ruffled edges
        float ruffle = abs(sin((uv.y + 0.15) * 40.0 + fi)) * 0.008;
        float ruffleEdge = smoothstep(0.015 + ruffle, 0.01, abs(armPath));

        pattern = max(pattern, (arm + ruffleEdge * 0.5) * 0.7);
    }

    // Bioluminescent spots
    for(int i = 0; i < 8; i++) {
        float spotAngle = float(i) * TAU / 8.0 + t * 0.3;
        vec2 spotPos = vec2(0.0, 0.1) + 0.12 * vec2(cos(spotAngle), sin(spotAngle) * 0.5 + 0.3);
        float spot = exp(-length(uv - spotPos) * 30.0);
        pattern += spot * 0.3;
    }

    pattern += bell * 0.3;

    return pattern;
}

// === COSMIC DUST / STARDUST ===
float stardust(vec2 uv, float t) {
    float pattern = 0.0;

    // Multiple layers of particles
    for(int layer = 0; layer < 3; layer++) {
        float fl = float(layer);
        float scale = 20.0 + fl * 15.0;
        float speed = 0.1 + fl * 0.05;

        vec2 p = uv * scale + vec2(t * speed, t * speed * 0.7);
        vec2 cell = floor(p);
        vec2 local = fract(p) - 0.5;

        for(int y = -1; y <= 1; y++) {
            for(int x = -1; x <= 1; x++) {
                vec2 offset = vec2(float(x), float(y));
                vec2 cellId = cell + offset;

                // Random position within cell
                float rnd = hash(cellId + fl * 100.0);
                if(rnd > 0.7) continue; // Skip some cells

                vec2 starPos = offset + vec2(hash(cellId * 1.1), hash(cellId * 2.3)) - 0.5;
                float dist = length(local - starPos);

                // Twinkling
                float twinkle = 0.5 + 0.5 * sin(t * 3.0 + rnd * TAU);
                float size = (0.03 + rnd * 0.04) * twinkle;

                // Star glow
                float star = exp(-dist * dist / (size * size * 0.5));
                pattern += star * (0.3 - fl * 0.08);

                // Tiny cross flare on bright stars
                if(rnd < 0.2) {
                    float flareH = exp(-abs(local.y - starPos.y) * 50.0) * exp(-abs(local.x - starPos.x) * 10.0);
                    float flareV = exp(-abs(local.x - starPos.x) * 50.0) * exp(-abs(local.y - starPos.y) * 10.0);
                    pattern += (flareH + flareV) * 0.1 * twinkle;
                }
            }
        }
    }

    return pattern;
}

// === METATRON'S CUBE - Ultimate Sacred Geometry ===
float metatronsCube(vec2 uv, float t) {
    float pattern = 0.0;
    float lineWidth = 0.006;

    // 13 circles of the Fruit of Life
    float circleR = 0.08;

    // Center circle
    pattern = max(pattern, 1.0 - smoothstep(0.0, lineWidth, abs(length(uv) - circleR)));

    // Inner ring - 6 circles
    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + t * 0.02;
        vec2 center = circleR * 2.0 * vec2(cos(angle), sin(angle));
        float d = length(uv - center);
        pattern = max(pattern, 1.0 - smoothstep(0.0, lineWidth, abs(d - circleR)));
    }

    // Outer ring - 6 circles
    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + PI / 6.0 + t * 0.02;
        vec2 center = circleR * 2.0 * SQRT3 * vec2(cos(angle), sin(angle));
        float d = length(uv - center);
        pattern = max(pattern, (1.0 - smoothstep(0.0, lineWidth * 0.8, abs(d - circleR))) * 0.8);
    }

    // Connecting lines forming the cube projection
    // Hexagon vertices
    vec2 verts[6];
    for(int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0 + t * 0.02;
        verts[i] = circleR * 2.0 * vec2(cos(angle), sin(angle));
    }

    // Draw all connecting lines (complete graph)
    for(int i = 0; i < 6; i++) {
        for(int j = i + 1; j < 6; j++) {
            vec2 a = verts[i];
            vec2 b = verts[j];
            vec2 ab = b - a;
            float len = length(ab);
            vec2 dir = ab / len;

            vec2 local = uv - a;
            float along = dot(local, dir);
            float perp = abs(dot(local, vec2(-dir.y, dir.x)));

            float line = smoothstep(lineWidth * 0.7, 0.0, perp);
            line *= smoothstep(-0.01, 0.02, along) * smoothstep(len + 0.01, len - 0.02, along);
            pattern = max(pattern, line * 0.6);
        }
    }

    // Lines from center to vertices
    for(int i = 0; i < 6; i++) {
        vec2 dir = normalize(verts[i]);
        float along = dot(uv, dir);
        float perp = abs(dot(uv, vec2(-dir.y, dir.x)));
        float line = smoothstep(lineWidth * 0.6, 0.0, perp);
        line *= smoothstep(-0.01, 0.0, along) * smoothstep(length(verts[i]) + 0.01, length(verts[i]) - 0.02, along);
        pattern = max(pattern, line * 0.5);
    }

    // Inner hexagram (Star of David)
    for(int i = 0; i < 6; i++) {
        vec2 a = verts[i];
        vec2 b = verts[(i + 2) % 6];
        vec2 ab = b - a;
        float len = length(ab);
        vec2 dir = ab / len;
        vec2 local = uv - a;
        float along = dot(local, dir);
        float perp = abs(dot(local, vec2(-dir.y, dir.x)));
        float line = smoothstep(lineWidth, 0.0, perp);
        line *= smoothstep(-0.01, 0.02, along) * smoothstep(len + 0.01, len - 0.02, along);
        pattern = max(pattern, line * 0.7);
    }

    return pattern;
}

// === PEACOCK FEATHER EYE ===
float peacockEye(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Concentric eye rings
    float eye1 = 1.0 - smoothstep(0.0, 0.015, abs(r - 0.05));
    float eye2 = 1.0 - smoothstep(0.0, 0.01, abs(r - 0.09));
    float eye3 = 1.0 - smoothstep(0.0, 0.008, abs(r - 0.12));
    float eye4 = 1.0 - smoothstep(0.0, 0.006, abs(r - 0.15));

    pattern = max(pattern, eye1 * 0.9);
    pattern = max(pattern, eye2 * 0.7);
    pattern = max(pattern, eye3 * 0.5);
    pattern = max(pattern, eye4 * 0.4);

    // Fill zones
    float fill1 = smoothstep(0.05, 0.03, r);
    float fill2 = smoothstep(0.09, 0.06, r) * (1.0 - smoothstep(0.05, 0.04, r));
    pattern = max(pattern, fill1 * 0.6);
    pattern = max(pattern, fill2 * 0.3);

    // Radiating barbs
    for(int i = 0; i < 60; i++) {
        float barbAngle = float(i) * TAU / 60.0;
        vec2 barbDir = vec2(cos(barbAngle), sin(barbAngle));
        float along = dot(uv, barbDir);
        float perp = abs(dot(uv, vec2(-barbDir.y, barbDir.x)));

        // Barb tapers outward
        float barbWidth = 0.003 + 0.002 * smoothstep(0.15, 0.4, along);
        float barb = smoothstep(barbWidth, 0.0, perp);
        barb *= smoothstep(0.12, 0.18, along) * smoothstep(0.5, 0.35, along);

        // Feathery edge
        float feather = sin(along * 80.0 + float(i)) * 0.3 + 0.7;
        barb *= feather;

        pattern = max(pattern, barb * 0.5);
    }

    // Iridescent shimmer effect (concentric waves)
    float shimmer = sin(r * 60.0 - t * 2.0) * 0.5 + 0.5;
    shimmer *= smoothstep(0.5, 0.15, r);
    pattern += shimmer * 0.15;

    return pattern;
}

// === SNOWFLAKE / ICE CRYSTAL ===
float snowflake(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // 6-fold symmetry
    float segAngle = TAU / 6.0;
    float foldedA = abs(mod(a + segAngle * 0.5, segAngle) - segAngle * 0.5);
    vec2 p = r * vec2(cos(foldedA), sin(foldedA));

    // Main arm
    float arm = smoothstep(0.008, 0.0, abs(p.y));
    arm *= smoothstep(-0.01, 0.02, p.x) * smoothstep(0.4, 0.35, p.x);
    pattern = max(pattern, arm * 0.9);

    // Side branches
    for(int i = 1; i <= 5; i++) {
        float fi = float(i);
        float branchX = fi * 0.06 + 0.05;
        float branchLen = 0.08 - fi * 0.01;

        // Branch angle
        float branchAngle = 1.05; // ~60 degrees
        vec2 branchDir = vec2(cos(branchAngle), sin(branchAngle));

        vec2 branchStart = vec2(branchX, 0.0);
        vec2 local = p - branchStart;
        float along = dot(local, branchDir);
        float perp = abs(dot(local, vec2(-branchDir.y, branchDir.x)));

        float branch = smoothstep(0.005, 0.0, perp);
        branch *= smoothstep(-0.005, 0.01, along) * smoothstep(branchLen, branchLen * 0.8, along);
        pattern = max(pattern, branch * 0.7);

        // Sub-branches
        for(int j = 1; j <= 2; j++) {
            float subX = float(j) * branchLen * 0.35;
            vec2 subStart = branchStart + branchDir * subX;
            vec2 subLocal = p - subStart;
            float subAlong = dot(subLocal, branchDir);
            float subPerp = abs(dot(subLocal, vec2(-branchDir.y, branchDir.x)));
            float subLen = 0.02;
            float sub = smoothstep(0.003, 0.0, abs(subAlong)) * smoothstep(subLen, 0.0, subPerp);
            pattern = max(pattern, sub * 0.5);
        }
    }

    // Center hexagon
    float hex = 0.0;
    for(int i = 0; i < 6; i++) {
        float hexAngle = float(i) * TAU / 6.0 + PI / 6.0;
        vec2 n = vec2(cos(hexAngle), sin(hexAngle));
        hex = max(hex, abs(dot(uv, n)));
    }
    float hexRing = 1.0 - smoothstep(0.0, 0.006, abs(hex - 0.04));
    pattern = max(pattern, hexRing * 0.8);

    // Center detail
    float center = 1.0 - smoothstep(0.0, 0.02, r);
    pattern = max(pattern, center * 0.7);

    return pattern;
}

// === GALAXY SPIRAL ===
float galaxy(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Spiral arms (logarithmic spiral)
    float arms = 2.0;
    float twist = 3.0;

    for(int arm = 0; arm < 2; arm++) {
        float armOffset = float(arm) * PI;

        // Spiral equation: theta = a + b * ln(r)
        float spiralA = a - twist * log(r + 0.01) + t * 0.1 + armOffset;
        float spiral = sin(spiralA * arms) * 0.5 + 0.5;
        spiral = pow(spiral, 4.0);

        // Fade with radius
        float fade = exp(-r * 2.0) * smoothstep(0.0, 0.1, r);
        pattern += spiral * fade * 0.6;
    }

    // Central bulge
    float bulge = exp(-r * r * 50.0);
    pattern += bulge * 0.8;

    // Star clusters along arms
    for(int i = 0; i < 80; i++) {
        float fi = float(i);
        float starR = 0.05 + fi * 0.008;
        float starA = fi * PHI * TAU + twist * log(starR + 0.01) + t * 0.1;

        // Wobble
        starA += sin(fi * 0.5) * 0.3;
        starR += cos(fi * 0.7) * 0.02;

        vec2 starPos = starR * vec2(cos(starA), sin(starA));
        float dist = length(uv - starPos);

        float star = exp(-dist * dist * 2000.0);
        pattern += star * 0.4 * (1.0 - fi / 100.0);
    }

    // Dust lanes (dark regions)
    float dust = fbm(uv * 8.0 + t * 0.05);
    dust = smoothstep(0.4, 0.6, dust);
    pattern *= 0.7 + dust * 0.3;

    return pattern;
}

// === DIVINE LIGHT RAYS ===
float lightRays(vec2 uv, float t) {
    float pattern = 0.0;
    float a = atan(uv.y, uv.x);
    float r = length(uv);

    // Multiple ray frequencies
    float rays1 = pow(abs(sin(a * 12.0 + t * 0.2)), 8.0);
    float rays2 = pow(abs(sin(a * 24.0 - t * 0.15)), 12.0);
    float rays3 = pow(abs(sin(a * 6.0 + t * 0.1)), 6.0);

    // Combine with different falloffs
    pattern += rays1 * exp(-r * 3.0) * 0.5;
    pattern += rays2 * exp(-r * 4.0) * 0.3;
    pattern += rays3 * exp(-r * 2.0) * 0.4;

    // Shimmer
    float shimmer = noise(vec2(a * 10.0, t * 2.0));
    pattern *= 0.8 + shimmer * 0.4;

    // Central glow
    pattern += exp(-r * r * 20.0) * 0.3;

    return pattern;
}

// === LUNA MOTH WING ===
float lunaMothWing(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Wing shape - more elongated than butterfly
    float wingShape = 0.4 * (1.0 + 0.5 * cos(a - PI * 0.3));
    wingShape *= smoothstep(PI, PI * 0.2, abs(a)) * smoothstep(-PI * 0.1, PI * 0.2, a);

    // Tail extension
    float tail = smoothstep(0.3, 0.0, abs(a + PI * 0.4)) * smoothstep(0.2, 0.5, r);
    wingShape += tail * 0.3;

    float wing = smoothstep(wingShape + 0.02, wingShape - 0.03, r);
    wing *= smoothstep(0.0, 0.08, r);

    // Wing veins - curved
    for(int i = 0; i < 8; i++) {
        float veinA = -PI * 0.3 + float(i) * PI * 0.12;
        float curve = 0.1 * sin((r - 0.1) * 8.0);

        vec2 veinDir = vec2(cos(veinA + curve), sin(veinA + curve));
        float along = dot(uv, veinDir);
        float perp = abs(dot(uv, vec2(-veinDir.y, veinDir.x)));

        float vein = smoothstep(0.004, 0.0, perp);
        vein *= smoothstep(0.0, 0.05, along) * smoothstep(wingShape, wingShape * 0.3, r);
        pattern = max(pattern, vein * 0.6 * wing);
    }

    // Eyespot
    vec2 eyePos = vec2(0.18, 0.08);
    float eyeDist = length(uv - eyePos);
    float eyeOuter = 1.0 - smoothstep(0.0, 0.008, abs(eyeDist - 0.05));
    float eyeMiddle = 1.0 - smoothstep(0.0, 0.006, abs(eyeDist - 0.035));
    float eyeInner = 1.0 - smoothstep(0.0, 0.02, eyeDist);

    pattern = max(pattern, eyeOuter * 0.8 * wing);
    pattern = max(pattern, eyeMiddle * 0.6 * wing);
    pattern = max(pattern, eyeInner * 0.9 * wing);

    // Scalloped edge
    float scallop = sin(a * 20.0) * 0.015;
    float edge = 1.0 - smoothstep(0.0, 0.012, abs(r - wingShape - scallop));
    pattern = max(pattern, edge * 0.9);

    // Scale texture
    float scales = sin(r * 50.0) * sin(a * 30.0);
    scales = smoothstep(0.5, 1.0, scales) * wing * 0.2;
    pattern += scales;

    return pattern;
}

float lunaMoth(vec2 uv, float t) {
    // Both wings
    float left = lunaMothWing(vec2(-uv.x, uv.y) * 1.3, t);
    float right = lunaMothWing(uv * 1.3, t);

    // Fuzzy body
    float body = exp(-pow(abs(uv.x) * 15.0, 2.0)) * smoothstep(0.35, 0.0, abs(uv.y - 0.05));
    body *= 0.8 + 0.2 * noise(uv * 50.0);

    // Feathered antennae
    for(int i = 0; i < 2; i++) {
        float side = float(i) * 2.0 - 1.0;
        for(int j = 0; j < 8; j++) {
            float fj = float(j);
            float antY = 0.22 + fj * 0.015;
            float antX = side * (0.02 + fj * 0.008);

            vec2 antPos = vec2(antX, antY);
            float ant = 1.0 - smoothstep(0.0, 0.008, length(uv - antPos));
            body = max(body, ant * 0.7);

            // Feather barbs
            vec2 barbPos = antPos + vec2(side * 0.015, 0.005);
            float barb = 1.0 - smoothstep(0.0, 0.004, length(uv - barbPos));
            body = max(body, barb * 0.5);
        }
    }

    return max(max(left, right), body * 0.85);
}

// === DANDELION SEED HEAD ===
float dandelion(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Center sphere
    float center = 1.0 - smoothstep(0.0, 0.06, r);
    float centerRing = 1.0 - smoothstep(0.0, 0.008, abs(r - 0.05));
    pattern = max(pattern, center * 0.4);
    pattern = max(pattern, centerRing * 0.7);

    // Seeds radiating outward
    for(int i = 0; i < 40; i++) {
        float fi = float(i);
        float seedA = fi * PHI * TAU; // Golden angle distribution
        float seedR = 0.06;

        vec2 seedBase = seedR * vec2(cos(seedA), sin(seedA));
        vec2 seedDir = normalize(seedBase);

        // Seed stem
        vec2 local = uv - seedBase;
        float along = dot(local, seedDir);
        float perp = abs(dot(local, vec2(-seedDir.y, seedDir.x)));

        float stemLen = 0.15 + 0.05 * sin(fi + t);
        float stem = smoothstep(0.003, 0.0, perp);
        stem *= smoothstep(-0.01, 0.02, along) * smoothstep(stemLen, stemLen * 0.8, along);
        pattern = max(pattern, stem * 0.5);

        // Pappus (fluffy part)
        vec2 pappusCenter = seedBase + seedDir * stemLen;

        // Radiating filaments
        for(int j = 0; j < 12; j++) {
            float fj = float(j);
            float filamentA = seedA + (fj - 5.5) * 0.15;
            vec2 filamentDir = vec2(cos(filamentA), sin(filamentA));

            vec2 filLocal = uv - pappusCenter;
            float filAlong = dot(filLocal, filamentDir);
            float filPerp = abs(dot(filLocal, vec2(-filamentDir.y, filamentDir.x)));

            float filament = smoothstep(0.002, 0.0, filPerp);
            filament *= smoothstep(-0.005, 0.005, filAlong) * smoothstep(0.04, 0.02, filAlong);

            pattern = max(pattern, filament * 0.4);
        }
    }

    return pattern;
}

// === OCEAN WAVE ===
float oceanWave(vec2 uv, float t) {
    float pattern = 0.0;

    // Multiple wave layers
    for(int i = 0; i < 5; i++) {
        float fi = float(i);
        float y = uv.y + fi * 0.15 - 0.3;

        // Complex wave shape
        float wave = 0.0;
        wave += sin(uv.x * 4.0 + t + fi) * 0.08;
        wave += sin(uv.x * 7.0 - t * 1.3 + fi * 2.0) * 0.04;
        wave += sin(uv.x * 12.0 + t * 0.7 + fi * 0.5) * 0.02;
        wave += fbm(vec2(uv.x * 3.0 + t * 0.2, fi)) * 0.05;

        float waveY = y - wave;

        // Wave crest
        float crest = smoothstep(0.02, 0.0, waveY) * smoothstep(-0.15, -0.02, waveY);

        // Foam at crest
        float foam = smoothstep(0.01, -0.01, waveY);
        foam *= noise(uv * 30.0 + t + fi) * 0.5 + 0.5;

        pattern += crest * (0.4 - fi * 0.06);
        pattern += foam * 0.3 * smoothstep(0.01, -0.02, waveY);

        // Wave line
        float line = 1.0 - smoothstep(0.0, 0.008, abs(waveY));
        pattern = max(pattern, line * (0.7 - fi * 0.1));
    }

    return pattern;
}

// === CELTIC KNOT ===
float celticKnot(vec2 uv, float t) {
    float pattern = 0.0;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Trefoil knot pattern using 3-fold symmetry
    float segments = 3.0;
    float segAngle = TAU / segments;
    float foldedA = mod(a + segAngle * 0.5, segAngle) - segAngle * 0.5;
    vec2 p = r * vec2(cos(foldedA), sin(foldedA));

    // Interweaving loops
    for(int i = 0; i < 3; i++) {
        float loopAngle = float(i) * TAU / 3.0 + t * 0.03;
        vec2 loopCenter = 0.12 * vec2(cos(loopAngle), sin(loopAngle));
        float loopR = length(uv - loopCenter);

        // Loop ring
        float loop = 1.0 - smoothstep(0.0, 0.012, abs(loopR - 0.1));
        pattern = max(pattern, loop * 0.8);

        // Inner detail
        float inner = 1.0 - smoothstep(0.0, 0.008, abs(loopR - 0.06));
        pattern = max(pattern, inner * 0.5);
    }

    // Connecting bands
    for(int i = 0; i < 3; i++) {
        float bandA1 = float(i) * TAU / 3.0 + PI / 6.0;
        float bandA2 = float(i + 1) * TAU / 3.0 + PI / 6.0;

        vec2 p1 = 0.18 * vec2(cos(bandA1), sin(bandA1));
        vec2 p2 = 0.18 * vec2(cos(bandA2), sin(bandA2));

        vec2 dir = normalize(p2 - p1);
        vec2 local = uv - p1;
        float along = dot(local, dir);
        float perp = dot(local, vec2(-dir.y, dir.x));

        float bandLen = length(p2 - p1);

        // Curved band
        float curve = sin(along / bandLen * PI) * 0.04;
        float band = smoothstep(0.02, 0.0, abs(perp - curve));
        band *= smoothstep(-0.02, 0.02, along) * smoothstep(bandLen + 0.02, bandLen - 0.02, along);

        pattern = max(pattern, band * 0.6);
    }

    // Center trinity
    float trinity = 1.0 - smoothstep(0.0, 0.025, r);
    pattern = max(pattern, trinity * 0.7);

    return pattern;
}

void main() {
    vec2 res = uTDOutputInfo.res.zw;
    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
    vec2 uv0 = uv;

    float t = uTime * 0.5;

    // === SCENE COMPOSITION ===

    // Slow rotation for the whole scene
    vec2 uvRot = uv * rot(t * 0.02);

    // Central mandala
    float mandalaPat = mandala(uvRot * 1.2, 12.0, t);

    // Lotus overlay
    float lotusPat = lotus(uvRot * 1.5, t);

    // Crystal structure
    vec2 crystalUV = uv * rot(-t * 0.03);
    float crystalPat = crystal(crystalUV * 0.8, t);

    // Rose curves floating
    vec2 roseUV1 = (uv - vec2(0.5, 0.3)) * 2.0;
    vec2 roseUV2 = (uv - vec2(-0.5, -0.3)) * 2.0;
    float rosePat = rose(roseUV1, t) * 0.5 + rose(roseUV2, t + PI) * 0.5;

    // Feathers on sides
    vec2 featherUV1 = (uv - vec2(0.7, 0.0)) * rot(-0.3) * vec2(2.0, 1.5);
    vec2 featherUV2 = (uv - vec2(-0.7, 0.0)) * rot(0.3) * vec2(-2.0, 1.5);
    float featherPat = feather(featherUV1, t) + feather(featherUV2, t);

    // Water ripples as background
    float ripplePat = ripples(uv * 1.5, t);

    // Spirograph accent
    float spiroPat = spirograph(uv * 1.2, t);

    // Energy field undertone
    float energyPat = energyField(uv, t);

    // Silk ribbons flowing through
    vec2 silkUV = uv * rot(t * 0.05);
    float silkPat = silkRibbon(silkUV * 1.5, t);

    // === NEW ELEMENTS ===

    // Flower of Life - sacred geometry foundation
    vec2 flowerUV = uvRot * rot(t * 0.01);
    float flowerPat = flowerOfLife(flowerUV * 0.9, t);

    // Fibonacci spiral - golden ratio elegance
    vec2 fiboUV = uv * rot(-t * 0.04);
    float fiboPat = fibonacciSpiral(fiboUV * 0.8, t);

    // Butterflies floating
    vec2 bfly1UV = (uv - vec2(0.45, 0.35)) * rot(t * 0.1 + 0.3);
    vec2 bfly2UV = (uv - vec2(-0.4, -0.4)) * rot(-t * 0.08 - 0.5);
    vec2 bfly3UV = (uv - vec2(-0.5, 0.3)) * rot(t * 0.12);
    float bflyPat = butterfly(bfly1UV * 3.0, t) * 0.7;
    bflyPat += butterfly(bfly2UV * 3.5, t + 1.0) * 0.6;
    bflyPat += butterfly(bfly3UV * 4.0, t + 2.0) * 0.5;

    // Aurora waves in background
    vec2 auroraUV = uv * rot(PI * 0.5); // Vertical orientation
    float auroraPat = aurora(auroraUV * 1.2, t);

    // Delicate lace overlay
    float lacePat = lace(uvRot * 1.1, t);

    // Jellyfish drifting
    vec2 jellyUV = (uv - vec2(0.0, -0.15 + 0.1 * sin(t * 0.3)));
    float jellyPat = jellyfish(jellyUV * 1.8, t);

    // Stardust background
    float starPat = stardust(uv, t);

    // === ULTIMATE NEW ELEMENTS ===

    // Metatron's Cube - supreme sacred geometry
    vec2 metatronUV = uvRot * rot(-t * 0.015);
    float metatronPat = metatronsCube(metatronUV * 1.8, t);

    // Peacock feather eyes - floating in corners
    vec2 peacock1UV = (uv - vec2(0.55, 0.4)) * 4.0;
    vec2 peacock2UV = (uv - vec2(-0.55, -0.4)) * 4.0;
    vec2 peacock3UV = (uv - vec2(0.5, -0.45)) * 3.5;
    float peacockPat = peacockEye(peacock1UV, t) * 0.6;
    peacockPat += peacockEye(peacock2UV * rot(PI), t + 1.0) * 0.5;
    peacockPat += peacockEye(peacock3UV * rot(PI * 0.5), t + 2.0) * 0.4;

    // Snowflakes drifting
    vec2 snow1UV = (uv - vec2(-0.45, 0.5)) * rot(t * 0.05) * 3.0;
    vec2 snow2UV = (uv - vec2(0.6, -0.3)) * rot(-t * 0.04) * 3.5;
    float snowPat = snowflake(snow1UV, t) * 0.6;
    snowPat += snowflake(snow2UV, t + 1.5) * 0.5;

    // Galaxy spiral - cosmic beauty
    vec2 galaxyUV = uv * rot(t * 0.02);
    float galaxyPat = galaxy(galaxyUV * 1.2, t);

    // Divine light rays emanating from center
    float raysPat = lightRays(uv, t);

    // Luna moths - ethereal creatures
    vec2 moth1UV = (uv - vec2(0.5, -0.1)) * rot(t * 0.06 + 0.5);
    vec2 moth2UV = (uv - vec2(-0.55, 0.2)) * rot(-t * 0.05 - 0.3);
    float mothPat = lunaMoth(moth1UV * 2.5, t) * 0.5;
    mothPat += lunaMoth(moth2UV * 2.8, t + 2.0) * 0.45;

    // Dandelion seed heads - whimsical nature
    vec2 dandelionUV = (uv - vec2(-0.4, -0.55)) * 2.5;
    float dandelionPat = dandelion(dandelionUV, t);

    // Ocean waves - bottom layer
    vec2 oceanUV = uv + vec2(0.0, 0.4);
    float oceanPat = oceanWave(oceanUV * 1.5, t);

    // Celtic knot - mystical center option
    vec2 celticUV = uvRot * rot(t * 0.01);
    float celticPat = celticKnot(celticUV * 2.0, t);

    // === LAYERED COMPOSITION - CLEAR CENTER FOCUS ===

    float r = length(uv0);

    // Distinct radial zones
    float coreZone = 1.0 - smoothstep(0.0, 0.12, r);
    float innerZone = smoothstep(0.05, 0.15, r) * (1.0 - smoothstep(0.15, 0.35, r));
    float midZone = smoothstep(0.2, 0.4, r) * (1.0 - smoothstep(0.5, 0.75, r));
    float outerZone = smoothstep(0.4, 0.6, r);
    float edgeZone = smoothstep(0.55, 0.85, r);

    // Inverse masks
    float notCenter = smoothstep(0.0, 0.25, r);
    float notInner = smoothstep(0.0, 0.4, r);

    // Extended scene morphing - 6 distinct moods that blend
    float scene = fract(t * 0.02);
    float sceneA = smoothstep(0.0, 0.08, scene) * smoothstep(0.2, 0.12, scene);   // Sacred geometry
    float sceneB = smoothstep(0.15, 0.23, scene) * smoothstep(0.38, 0.3, scene);  // Nature/botanical
    float sceneC = smoothstep(0.33, 0.41, scene) * smoothstep(0.55, 0.47, scene); // Ethereal/cosmic
    float sceneD = smoothstep(0.5, 0.58, scene) * smoothstep(0.72, 0.64, scene);  // Mystical/celtic
    float sceneE = smoothstep(0.67, 0.75, scene) * smoothstep(0.88, 0.8, scene);  // Ocean/flow
    float sceneF = smoothstep(0.83, 0.91, scene) + smoothstep(0.08, 0.0, scene);  // Winter/crystal

    float bw = 0.0;

    // === LAYER 1: COSMIC BACKGROUND ===
    bw += starPat * 0.15 * notInner;
    bw += galaxyPat * 0.25 * edgeZone * (0.3 + sceneC * 0.7);
    bw += auroraPat * 0.12 * edgeZone * (0.4 + sceneC * 0.6);

    // === LAYER 2: ATMOSPHERIC EFFECTS ===
    bw += ripplePat * 0.08 * notCenter;
    bw += energyPat * 0.06 * notCenter;
    bw += oceanPat * 0.2 * edgeZone * (0.3 + sceneE * 0.7);
    bw += raysPat * 0.15 * notCenter * (0.2 + sceneD * 0.4 + sceneA * 0.4);

    // === LAYER 3: OUTER CREATURES & NATURE ===
    bw += featherPat * 0.35 * outerZone;
    bw += bflyPat * 0.45 * outerZone * (0.5 + sceneB * 0.5);
    bw += mothPat * 0.4 * outerZone * (0.4 + sceneC * 0.6);
    bw += peacockPat * 0.5 * outerZone * (0.4 + sceneB * 0.6);
    bw += dandelionPat * 0.35 * edgeZone * (0.3 + sceneB * 0.7);

    // === LAYER 4: MID-RING DECORATIONS ===
    bw += silkPat * 0.25 * midZone;
    bw += spiroPat * 0.3 * midZone * (0.5 + sceneA * 0.5);
    bw += rosePat * 0.35 * midZone * (0.4 + sceneB * 0.6);
    bw += lacePat * 0.25 * (midZone + outerZone * 0.3) * (0.4 + sceneD * 0.6);
    bw += snowPat * 0.4 * (midZone + outerZone * 0.5) * (0.3 + sceneF * 0.7);

    // === LAYER 5: INNER SACRED GEOMETRY (CLEAR FOCAL POINT) ===
    float sacredCenter = 0.0;

    // Metatron's Cube - ultimate sacred geometry
    sacredCenter = max(sacredCenter, metatronPat * 0.85 * (0.4 + sceneA * 0.6));

    // Mandala - primary pattern
    sacredCenter = max(sacredCenter, mandalaPat * 0.9);

    // Flower of Life
    sacredCenter = max(sacredCenter, flowerPat * 0.7 * (0.5 + sceneA * 0.5));

    // Celtic knot for mystical scenes
    sacredCenter = max(sacredCenter, celticPat * 0.75 * (0.3 + sceneD * 0.7));

    // Crystal structure
    sacredCenter = max(sacredCenter, crystalPat * 0.6 * (0.5 + sceneF * 0.5));

    // Lotus
    sacredCenter = max(sacredCenter, lotusPat * 0.6 * (0.5 + sceneB * 0.5));

    // Apply with clear center mask
    float centerMask = 1.0 - smoothstep(0.0, 0.45, r);
    bw = max(bw, sacredCenter * centerMask);

    // === LAYER 6: FIBONACCI (transition zone) ===
    bw += fiboPat * 0.35 * innerZone * (0.4 + sceneA * 0.6);

    // === LAYER 7: FLOATING CREATURES ===
    bw += jellyPat * 0.3 * (0.2 + sceneC * 0.8) * smoothstep(0.1, 0.3, r);

    // === FINISHING TOUCHES ===

    // Soft divine glow from center
    float glow = exp(-r * r * 8.0) * 0.08;
    bw += glow;

    // Gentle breathing
    float breath = 1.0 + 0.015 * sin(t * 0.7);
    bw *= breath;

    // Crisp contrast
    bw = pow(bw, 0.75);

    // Smooth S-curve
    float contrast = smoothstep(-0.02, 1.02, bw);
    bw = mix(bw, contrast, 0.55);

    // Soft radial gradient (brighter center)
    float radialGlow = 1.0 + (1.0 - r) * 0.1;
    bw *= radialGlow;

    // Elegant vignette
    float vignette = 1.0 - pow(r, 2.8) * 0.4;
    bw *= vignette;

    // Ultra-fine film grain
    float grain = (noise(uv * 180.0 + t) - 0.5) * 0.008;
    bw += grain;

    // Delicate highlight bloom
    float bloom = smoothstep(0.7, 1.0, bw) * 0.06;
    bw += bloom;

    // Subtle shadow depth
    float shadow = smoothstep(0.3, 0.0, bw) * 0.05;
    bw -= shadow;

    bw = clamp(bw, 0.0, 1.0);

    fragColor = vec4(vec3(bw), 1.0);
    fragColor = TDOutputSwizzle(fragColor);
}
