// ✨ Mathematical Sacred Mandala Shader - Refactored Version
// A sophisticated black & white mandala featuring:
// - 13+ layers of complex mathematical geometry
// - Sacred patterns with hidden details
// - 3D depth simulation and realistic lighting
// - Advanced mathematical curves and spirals

uniform float u_time;
uniform vec2  u_resolution;
out vec4      fragColor;

// Mathematical constants
#define TAU 6.28318530718
#define PI 3.14159265359
#define PHI 1.618033988749

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Refined monochrome palette with elegant S-curve transitions
vec3 palette(float t) {
    float intensity = 0.5 + 0.48 * cos(TAU * (t + 0.3));
    intensity = pow(intensity, 2.2);
    intensity = smoothstep(0.02, 0.98, intensity);
    return vec3(intensity);
}

// Smooth noise function for organic effects
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ============================================================================
// GLASS AND REFRACTION EFFECTS
// ============================================================================

vec2 glassRefract(vec2 uv, float strength, float time) {
    float n1 = smoothNoise(uv * 8.0 + time * 0.1) * 2.0 - 1.0;
    float n2 = smoothNoise(uv * 15.0 - time * 0.15) * 2.0 - 1.0;
    float n3 = smoothNoise(uv * 25.0 + time * 0.08) * 2.0 - 1.0;
    
    vec2 refract1 = vec2(n1, n2) * 0.6;
    vec2 refract2 = vec2(n2, n3) * 0.3;
    vec2 combinedRefract = (refract1 + refract2) * 0.7;
    
    return uv + combinedRefract * strength;
}

float causticPattern(vec2 uv, float time) {
    vec2 p = uv * 12.0;
    float c = 0.0;
    
    for(int i = 0; i < 4; i++) {
        float fi = float(i);
        float phase = time * 0.25 + fi * PHI;
        vec2 offset = vec2(sin(phase), cos(phase * 1.3)) * (2.5 + 0.8 * sin(time * 0.1 + fi));
        
        float dist = length(p + offset);
        float wave = cos(dist - time * 0.6) * 0.5 + 0.5;
        c += pow(wave, 12.0) * (0.8 + 0.4 * sin(time * 0.2 + fi));
    }
    
    return c * 0.4;
}

// ============================================================================
// BACKGROUND EFFECTS
// ============================================================================

float particleField(vec2 uv, float time) {
    float particles = 0.0;
    vec2 pos = uv * 15.0;
    
    for(int i = 0; i < 6; i++) {
        float fi = float(i);
        vec2 offset = vec2(sin(time * 0.1 + fi * 2.3), cos(time * 0.15 + fi * 1.7)) * 3.0;
        vec2 particlePos = pos + offset;
        float dist = length(fract(particlePos) - 0.5);
        particles += exp(-50.0 * dist * dist) * (0.8 + 0.4 * sin(time * 0.3 + fi));
    }
    
    return particles;
}

float fractalPattern(vec2 uv, float time) {
    float value = 0.0;
    float amplitude = 0.8;
    vec2 pos = uv;
    
    for(int i = 0; i < 4; i++) {
        float fi = float(i);
        pos = abs(pos) / dot(pos, pos) - vec2(0.9 + 0.1 * sin(time * 0.1 + fi));
        value += amplitude * smoothNoise(pos * (2.0 + fi) + time * 0.05);
        amplitude *= 0.6;
    }
    
    return clamp(value, 0.0, 1.0);
}

// ============================================================================
// SACRED GEOMETRY PATTERNS
// ============================================================================

float sacredGeometry(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float geometry = 0.0;
    
    // Flower of Life pattern
    for(int i = 0; i < 6; i++) {
        float fi = float(i);
        float angle = fi * PI / 3.0 + time * 0.05;
        vec2 center = vec2(cos(angle), sin(angle)) * 0.25;
        float circle = length(uv - center) - 0.15;
        geometry += exp(-20.0 * abs(circle)) * smoothstep(0.02, 0.0, abs(circle));
    }
    
    return geometry;
}

float hiddenSacredPatterns(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float hidden = 0.0;
    
    // Metatron's Cube overlay
    for(int i = 0; i < 13; i++) {
        float fi = float(i);
        float angle = fi * TAU / 13.0 + time * 0.03;
        float radius = 0.18 + 0.12 * sin(fi * 2.1);
        vec2 center = vec2(cos(angle), sin(angle)) * radius;
        
        float hexDist = length(uv - center);
        float hexPattern = abs(cos(theta * 6.0 + fi)) * 0.02 + 0.015;
        hidden += smoothstep(hexPattern + 0.005, hexPattern, hexDist) * 0.3;
        
        // Connecting lines between nodes
        for(int j = i + 1; j < 13; j++) {
            float fj = float(j);
            float angle2 = fj * TAU / 13.0 + time * 0.03;
            float radius2 = 0.18 + 0.12 * sin(fj * 2.1);
            vec2 center2 = vec2(cos(angle2), sin(angle2)) * radius2;
            
            vec2 lineDir = center2 - center;
            float lineDist = abs(dot(uv - center, vec2(-lineDir.y, lineDir.x))) / length(lineDir);
            float lineLength = dot(uv - center, lineDir) / dot(lineDir, lineDir);
            
            if(lineLength >= 0.0 && lineLength <= 1.0) {
                hidden += exp(-200.0 * lineDist) * 0.1;
            }
        }
    }
    
    return hidden;
}

float fibonacciSpiral(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    
    float goldenAngle = theta + time * 0.02;
    float spiralR = 0.1 * exp(goldenAngle * 0.306);
    
    float spiral = 0.0;
    for(int i = 0; i < 8; i++) {
        float fi = float(i);
        float offset = fi * TAU / 8.0;
        float spiralDist = abs(r - spiralR * (1.0 + 0.3 * sin(goldenAngle * 3.0 + offset)));
        spiral += exp(-30.0 * spiralDist) * (0.5 - fi * 0.05);
    }
    
    return spiral * exp(-r * 2.0);
}

float secretRunes(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float runes = 0.0;
    
    // Outer runic ring
    float runicRadius1 = 0.42;
    for(int i = 0; i < 24; i++) {
        float fi = float(i);
        float runeAngle = theta - fi * TAU / 24.0 - time * 0.01;
        float runeDist = abs(r - runicRadius1);
        
        float runePattern = abs(sin(runeAngle * 12.0)) * abs(cos(runeAngle * 8.0));
        runePattern = pow(runePattern, 4.0);
        
        runes += runePattern * exp(-50.0 * runeDist) * 0.4;
    }
    
    // Inner runic ring
    float runicRadius2 = 0.28;
    for(int i = 0; i < 16; i++) {
        float fi = float(i);
        float runeAngle = theta + fi * TAU / 16.0 + time * 0.015;
        float runeDist = abs(r - runicRadius2);
        
        float runePattern = abs(cos(runeAngle * 16.0)) * abs(sin(runeAngle * 6.0));
        runePattern = smoothstep(0.5, 1.0, runePattern);
        
        runes += runePattern * exp(-60.0 * runeDist) * 0.3;
    }
    
    return runes;
}

float microSacredDetails(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float micro = 0.0;
    
    // Vesica Piscis patterns
    for(int i = 0; i < 12; i++) {
        float fi = float(i);
        float vesicaAngle = fi * TAU / 12.0 + time * 0.004;
        vec2 center1 = vec2(cos(vesicaAngle), sin(vesicaAngle)) * 0.35;
        vec2 center2 = center1 + vec2(cos(vesicaAngle + PI/2.0), sin(vesicaAngle + PI/2.0)) * 0.08;
        
        float circle1 = length(uv - center1) - 0.04;
        float circle2 = length(uv - center2) - 0.04;
        float vesica = max(-circle1, -circle2);
        micro += smoothstep(0.005, 0.0, vesica) * 0.2;
    }
    
    // Golden ratio grid
    float phiGrid = 0.0;
    for(int i = 1; i <= 5; i++) {
        float fi = float(i);
        float gridRadius = 0.1 * pow(PHI, fi / 3.0);
        float gridLine = abs(r - gridRadius);
        phiGrid += exp(-100.0 * gridLine) * (0.3 - fi * 0.04);
        
        for(int j = 0; j < 21; j++) {
            float fj = float(j);
            float phiAngle = fj * TAU / 21.0;
            float angularDist = abs(sin((theta - phiAngle) * 10.5));
            phiGrid += exp(-200.0 * angularDist) * exp(-r * 4.0) * 0.15;
        }
    }
    
    return micro + phiGrid * 0.5;
}

// ============================================================================
// MAIN FLOWER STRUCTURES
// ============================================================================

float ultraComplexFlower(vec2 p, float time) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    
    // Fibonacci spiral base
    float fibAngle = angle + time * 0.02;
    float spiralRadius = 0.08 * exp(fibAngle * 0.2) * sin(fibAngle * PHI);
    
    // Mathematical petal curves
    float cardioid = pow((1.0 + cos(angle * 4.0 + time * 0.08)) * 0.5, 1.8);
    float roseCurve = pow(abs(cos(angle * 6.0 + time * 0.06)), 0.8) * (1.0 + 0.3 * sin(time * 0.25));
    float epicycloid = smoothstep(0.2, 1.0, (cos(angle * 8.0 + time * 0.04) + cos(angle * 24.0 - time * 0.03) * 0.3 + 1.2) * 0.4);
    float hypocycloid = abs(sin(angle * 16.0 + time * 0.05) * cos(angle * 32.0 - time * 0.02)) * 0.15 + 0.85;
    float lemniscate = sqrt(abs(cos(2.0 * angle + time * 0.07))) * (1.0 + 0.2 * sin(time * 0.18));
    
    float mathShape = cardioid * roseCurve * epicycloid * hypocycloid * lemniscate;
    
    // Organic breathing and modulation
    float organicBreath = 1.0 + 0.12 * sin(time * 0.28) + 0.05 * cos(time * 0.43);
    float spiralMod = 1.0 + spiralRadius * sin(angle * 12.0 + time * 0.1);
    float parametricTips = 1.0 + 0.35 * sin(angle * 8.0 + time * 0.12) * exp(-radius * 2.5) * cos(angle * 16.0 - time * 0.08);
    
    float finalRadius = 0.32 * (1.0 - mathShape * 0.88) * organicBreath * spiralMod * parametricTips;
    return abs(radius - finalRadius);
}

float flowerCenter(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float center = 0.0;
    
    // Inner sacred circle
    float innerCircle = smoothstep(0.08, 0.06, r) * (1.0 - smoothstep(0.06, 0.04, r));
    center += innerCircle;
    
    // Radiating center petals
    float centerPetals = abs(cos(theta * 16.0 + time * 0.2)) * 0.04 + 0.05;
    float petalRing = smoothstep(centerPetals - 0.008, centerPetals, r) * (1.0 - smoothstep(centerPetals, centerPetals + 0.012, r));
    center += petalRing * 0.8;
    
    // Delicate inner starbursts
    for(int i = 0; i < 8; i++) {
        float fi = float(i);
        float burstAngle = theta + PI * 0.25 * fi + time * 0.1;
        float burstPattern = abs(sin(burstAngle * 4.0)) * exp(-12.0 * r);
        center += burstPattern * 0.3;
    }
    
    return center;
}

// ============================================================================
// PETAL RING STRUCTURES
// ============================================================================

float organicPetalRing3D(vec2 uv, float innerRad, float thickness, float petals, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    
    // Multi-layered organic petal shape
    float primaryPetals = abs(cos(theta * petals + time * 0.1)) * 0.4 + 0.6;
    float secondaryPetals = abs(sin(theta * petals * 2.0 - time * 0.08)) * 0.2 + 0.8;
    float microDetails = abs(cos(theta * petals * 4.0 + time * 0.15)) * 0.1 + 0.9;
    float combinedPetals = primaryPetals * secondaryPetals * microDetails;
    
    // Petal tip variations
    float petalTips = 1.0 + 0.15 * sin(theta * petals + time * 0.2) * exp(-(r - innerRad) * 8.0);
    float targetRadius = innerRad * combinedPetals * petalTips;
    
    // Variable thickness ring
    float variableThickness = thickness * (1.0 + 0.3 * sin(theta * petals * 2.0));
    float ring = smoothstep(targetRadius - variableThickness * 0.5, targetRadius, r) * 
                 smoothstep(targetRadius + variableThickness * 0.5, targetRadius, r);
    
    // 3D depth effects
    float petalHeight = 1.0 - 0.3 * exp(-abs(r - targetRadius) * 15.0);
    float shadowEffect = 1.0 - 0.2 * smoothstep(targetRadius, targetRadius + thickness, r);
    
    return ring * petalHeight * shadowEffect;
}

float ultraComplexRoseLayers(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float layers = 0.0;
    
    for(int i = 0; i < 7; i++) {
        float fi = float(i);
        float layerRadius = 0.18 + fi * 0.07;
        float petalCount = 5.0 + fi * 1.5;
        float rotation = time * 0.04 + fi * 0.4;
        
        // Mathematical petal curves
        float rhodonea = pow(abs(cos((theta + rotation) * petalCount)) * 0.5 + 0.5, 1.2 + fi * 0.2);
        float epitrochoid = smoothstep(0.3, 1.0, cos((theta + rotation) * (petalCount + 1.0)) * 0.3 + 0.7);
        float hypotrochoid = sin((theta + rotation) * petalCount * 2.0 + time * 0.1) * 0.2 + 0.8;
        float astroid = pow(pow(abs(cos((theta + rotation) * petalCount)), 2.0/3.0) + 
                           pow(abs(sin((theta + rotation) * petalCount)), 2.0/3.0), 0.8) * 0.4 + 0.6;
        
        float mathPetal = rhodonea * epitrochoid * hypotrochoid * astroid;
        
        float layerMask = smoothstep(layerRadius - 0.015, layerRadius, r) *
                         (1.0 - smoothstep(layerRadius, layerRadius + 0.02, r));
        
        // Advanced petal curl with cycloid curves
        float cycloidCurl = 1.0 + 0.25 * sin(theta * petalCount * 4.0 + time * 0.08) * 
                           cos(theta * petalCount * 2.0 - time * 0.06) *
                           exp(-abs(r - layerRadius) * 25.0);
        
        // Fibonacci spiral modulation
        float fibSpiral = 1.0 + 0.15 * sin(theta * PHI + time * 0.03 + fi) * exp(-r * 3.0);
        
        layers += layerMask * mathPetal * cycloidCurl * fibSpiral * (0.9 - fi * 0.1);
    }
    
    return layers;
}

float parametricOrnaments(vec2 uv, float time) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    float ornaments = 0.0;
    
    // Butterfly curves
    for(int i = 0; i < 8; i++) {
        float fi = float(i);
        float butterflyAngle = theta + fi * TAU / 8.0 + time * 0.05;
        
        float butterflyR = exp(cos(butterflyAngle)) * 0.1 - 
                          0.02 * cos(4.0 * butterflyAngle) +
                          0.05 * pow(sin(butterflyAngle / 12.0), 5.0);
        butterflyR = abs(butterflyR) * 0.3 + 0.25;
        
        float butterflyDist = abs(r - butterflyR);
        ornaments += exp(-40.0 * butterflyDist) * 0.3;
    }
    
    // Lissajous curves
    for(int i = 0; i < 12; i++) {
        float fi = float(i);
        float lissajousPhase = time * 0.02 + fi * 0.5;
        
        float lissX = sin(3.0 * (theta + lissajousPhase)) * 0.15;
        float lissY = sin(2.0 * (theta + lissajousPhase) + PI/4.0) * 0.15;
        vec2 lissPos = vec2(lissX, lissY);
        
        float lissDist = length(uv - lissPos);
        ornaments += exp(-50.0 * lissDist) * 0.2;
    }
    
    return ornaments * exp(-r * 2.0);
}

// ============================================================================
// LIGHTING SYSTEM
// ============================================================================

struct LightingData {
    float depth3D;
    float petalHeight;
    vec3 directional1;
    vec3 directional2;
    vec3 ambient;
};

LightingData calculateLighting(vec2 uv, float r, float flowerDist) {
    LightingData light;
    
    light.depth3D = smoothstep(0.0, 0.15, r);
    light.petalHeight = 1.0 - 0.4 * exp(-8.0 * flowerDist);
    
    // Multiple directional lights
    float lightAngle1 = dot(normalize(uv), vec2(0.7, 0.7));
    float lightAngle2 = dot(normalize(uv), vec2(-0.6, 0.8));
    float lightAngle3 = dot(normalize(uv), vec2(0.5, -0.8));
    
    light.directional1 = vec3(0.7 + 0.3 * lightAngle1);
    light.directional2 = vec3(0.6 + 0.4 * lightAngle2);
    light.ambient = vec3(0.6 + 0.4 * lightAngle3);
    
    return light;
}

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

void main() {
    // Initialize coordinates with breathing effect
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float breathe = 0.65 + 0.08 * sin(u_time * 0.15) + 0.02 * sin(u_time * 0.43);
    uv /= breathe;

    // Sophisticated rotation with wobble
    float rot = u_time * 0.18 + 0.05 * sin(u_time * 0.31);
    mat2 rotMat = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    uv = rotMat * uv;

    // Multi-layer glass refraction
    vec2 glassUV1 = glassRefract(uv, 0.025, u_time);
    vec2 glassUV2 = glassRefract(uv, 0.015, u_time * 1.3);
    vec2 finalUV = mix(glassUV1, glassUV2, 0.6);
    
    float r = length(finalUV);
    float theta = atan(finalUV.y, finalUV.x);

    // Initialize with sophisticated dark foundation
    vec3 col = vec3(0.08, 0.12, 0.16) * smoothstep(1.5, 0.0, r);

    // ====== BACKGROUND LAYERS ======
    
    // Layer 1: Ethereal background glow
    float bgGlow = exp(-3.5 * pow(r, 1.8)) * (1.0 + 0.3 * sin(u_time * 0.12));
    col += palette(0.15 + 0.1 * sin(u_time * 0.14)) * bgGlow * 0.4;

    // Layer 2: Sacred geometry foundation
    float sacred = sacredGeometry(finalUV * 1.2, u_time);
    col += palette(0.2 + 0.15 * sin(u_time * 0.11)) * sacred * exp(-1.8 * r) * 0.6;

    // Layer 3: Hidden sacred patterns
    float hiddenPatterns = hiddenSacredPatterns(finalUV, u_time);
    col += palette(0.25 + 0.1 * sin(u_time * 0.09)) * hiddenPatterns * exp(-2.2 * r) * 0.3;

    // Layer 4: Fibonacci spirals
    float fibonacci = fibonacciSpiral(finalUV, u_time);
    col += palette(0.35 + 0.12 * cos(u_time * 0.08)) * fibonacci * 0.4;

    // Layer 5: Particle field
    float particles = particleField(finalUV * 0.9, u_time);
    col += palette(0.35 + 0.2 * sin(u_time * 0.13)) * particles * exp(-2.5 * r) * 0.4;

    // Layer 6: Fractal foundation
    float fractal = fractalPattern(finalUV * 0.8, u_time);
    col += palette(0.3 + 0.2 * fractal) * fractal * exp(-2.0 * r) * 0.25;

    // ====== MAIN FLOWER STRUCTURE ======
    
    // Calculate lighting for 3D effects
    float flowerDist = ultraComplexFlower(finalUV, u_time);
    LightingData lighting = calculateLighting(finalUV, r, flowerDist);
    
    // Layer 7: Ultra complex mathematical flower
    float flowerMask = smoothstep(0.03, 0.0, flowerDist);
    float flowerEdge = smoothstep(0.045, 0.03, flowerDist) - smoothstep(0.03, 0.018, flowerDist);
    
    vec3 flowerCol = palette(0.75 + 0.15 * sin(u_time * 0.27 + theta * 2.0)) * lighting.petalHeight;
    col += flowerCol * flowerMask * 1.4;
    col += vec3(0.85) * flowerEdge * 2.2 * lighting.depth3D;
    
    // Flower glow effects
    float innerGlow = exp(-12.0 * flowerDist) * (0.8 + 0.2 * sin(u_time * 0.25)) * lighting.depth3D;
    float outerGlow = exp(-8.0 * flowerDist) * (0.9 + 0.1 * sin(u_time * 0.33 + theta));
    col += flowerCol * (innerGlow * 0.25 + outerGlow * 0.2);

    // Layer 8: Flower center details
    float centerDetails = flowerCenter(finalUV, u_time);
    float centerDepth = 1.0 - 0.6 * exp(-25.0 * r * r);
    col += palette(0.6 + 0.1 * sin(u_time * 0.22)) * centerDepth * centerDetails * 1.0;
    
    float subtleSparkle = centerDetails * (0.8 + 0.2 * sin(u_time * 0.8 + theta * 8.0));
    col += vec3(0.65) * subtleSparkle * 0.25;

    // ====== PETAL LAYERS ======
    
    // Layer 9: Ultra complex rose petal layers
    float roseLayers = ultraComplexRoseLayers(finalUV, u_time);
    float roseDepth = 1.0 - 0.3 * exp(-r * 6.0);
    col += palette(0.65 + 0.25 * sin(u_time * 0.2)) * roseLayers * 1.3 * lighting.ambient.x * roseDepth;
    
    float roseShimmer = roseLayers * (0.8 + 0.2 * sin(theta * 24.0 + u_time * 0.7)) * lighting.ambient.x;
    col += vec3(0.75) * roseShimmer * 0.35;

    // Layer 10-11: 3D organic petal rings
    float organicRing1 = organicPetalRing3D(finalUV, 0.32, 0.02, 8.0, u_time);
    col += palette(0.6 + 0.3 * cos(u_time * 0.22)) * organicRing1 * 1.2 * lighting.directional1.x;
    col += vec3(0.75) * organicRing1 * smoothstep(0.28, 0.36, r) * lighting.directional1.x * 0.5;

    float organicRing2 = organicPetalRing3D(finalUV, 0.52, 0.025, 12.0, u_time * 0.8);
    col += palette(0.45 + 0.35 * sin(u_time * 0.18)) * organicRing2 * 1.1 * lighting.directional2.x;
    
    float petalTips = organicRing2 * (0.8 + 0.2 * sin(theta * 24.0 + u_time * 0.5)) * lighting.directional2.x;
    col += vec3(0.8) * petalTips * 0.3;

    // ====== DECORATIVE LAYERS ======
    
    // Layer 12: Secret runic inscriptions
    float runes = secretRunes(finalUV, u_time);
    col += palette(0.55 + 0.2 * sin(u_time * 0.07)) * runes * 0.35;

    // Layer 13: Parametric mathematical ornaments
    float ornaments = parametricOrnaments(finalUV, u_time);
    col += palette(0.7 + 0.2 * cos(u_time * 0.09)) * ornaments * 0.45;

    // Layer 14: Glass caustics
    vec2 causticUV = finalUV * (1.0 + 0.04 * sin(u_time * 0.16));
    float caustics = causticPattern(causticUV, u_time);
    col += palette(0.8 + 0.2 * caustics) * caustics * exp(-1.5 * r) * 0.8;
    col += vec3(0.95) * pow(caustics, 2.5) * exp(-2.0 * r) * 1.2;

    // Layer 15: Organic spiral energy streams
    float spiralAngle = theta * 8.0 + u_time * 0.35;
    float spiralGlow = pow(abs(sin(spiralAngle)) * exp(-3.5 * r), 3.5) * (1.0 + 0.5 * sin(u_time * 0.25));
    float spiralAngle2 = theta * 16.0 - u_time * 0.25;
    float spiralGlow2 = pow(abs(sin(spiralAngle2)) * exp(-4.0 * r), 5.0) * (1.0 + 0.3 * sin(u_time * 0.18));
    
    float petalMod = (1.0 + 0.3 * cos(theta * 8.0 + u_time * 0.1));
    col += palette(0.7 + 0.3 * sin(u_time * 0.33)) * (spiralGlow * 0.7 + spiralGlow2 * 0.4) * petalMod;

    // Layer 16: Micro sacred details
    float microDetails = microSacredDetails(finalUV, u_time);
    col += palette(0.4 + 0.15 * sin(u_time * 0.05)) * microDetails * 0.25;

    // Layer 17: Outer ethereal halo
    float outerHalo = smoothstep(0.9, 0.3, r) * (1.0 - smoothstep(0.3, 0.1, r));
    outerHalo *= 1.0 + 0.3 * sin(u_time * 0.11 + theta * 2.0);
    
    float rimPulse = smoothstep(0.85, 0.9, r) * (1.0 - smoothstep(0.9, 0.95, r));
    rimPulse *= 1.0 + 0.5 * sin(u_time * 0.4) + 0.2 * cos(theta * 8.0 + u_time * 0.2);
    
    col += palette(0.25 + 0.15 * sin(u_time * 0.16)) * outerHalo * 0.5;
    col += vec3(0.9) * rimPulse * 0.8;

    // ====== POST-PROCESSING ======
    
    // Sophisticated depth and atmosphere
    float depth = smoothstep(1.2, 0.15, r);
    col *= 0.8 + 0.2 * depth;

    // Atmospheric perspective
    float atmosphere = exp(-1.5 * r * r) * (1.0 + 0.1 * sin(u_time * 0.09));
    col += vec3(0.05) * atmosphere;

    // Elegant color temperature
    col = mix(col, vec3(0.14, 0.10, 0.18), 0.06);

    // Enhanced cinematic vignette
    float vignette = smoothstep(1.5, 0.25, r);
    float vignetteEdge = smoothstep(1.3, 1.5, r);
    col *= 0.7 + 0.3 * vignette;
    col *= 1.0 - vignetteEdge * 0.4;

    // Final monochrome conversion and enhancement
    float luminance = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = vec3(luminance);
    
    // Multi-stage contrast enhancement
    col = pow(col, vec3(1.25));
    col = smoothstep(0.01, 0.99, col);
    col = pow(col, vec3(0.95));
    
    // Enhanced highlight bloom
    vec3 highlights = pow(max(vec3(0.0), col - vec3(0.65)), vec3(1.8));
    col += vec3(0.12) * highlights;
    
    // Final luminosity boost
    col *= 1.1;
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}