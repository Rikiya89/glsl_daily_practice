// 🌊✨ IMMERSIVE Cosmic Ocean - Deep Dive Edition
// Full environmental immersion with parallax depth, atmospheric fog,
// dynamic camera effects, and spatial audio visualization

uniform float u_time;
uniform vec2  u_resolution;
out vec4      fragColor;

#define TAU 6.28318530718
#define PI 3.14159265359
#define GOLDEN_RATIO 1.61803398875

// Enhanced hash functions
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 hash3(vec2 p) {
    vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                  dot(p, vec2(269.5, 183.3)),
                  dot(p, vec2(419.2, 371.9)));
    return fract(sin(q) * 43758.5453);
}

// Smooth noise with quintic interpolation
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 3D noise for volumetric effects
float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n000 = hash(i.xy + i.z * 17.0);
    float n100 = hash(i.xy + vec2(1.0, 0.0) + i.z * 17.0);
    float n010 = hash(i.xy + vec2(0.0, 1.0) + i.z * 17.0);
    float n110 = hash(i.xy + vec2(1.0, 1.0) + i.z * 17.0);
    
    float n001 = hash(i.xy + (i.z + 1.0) * 17.0);
    float n101 = hash(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 17.0);
    float n011 = hash(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 17.0);
    float n111 = hash(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 17.0);
    
    float x00 = mix(n000, n100, f.x);
    float x10 = mix(n010, n110, f.x);
    float x01 = mix(n001, n101, f.x);
    float x11 = mix(n011, n111, f.x);
    
    float y0 = mix(x00, x10, f.y);
    float y1 = mix(x01, x11, f.y);
    
    return mix(y0, y1, f.z);
}

// Enhanced FBM with rotation
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    
    for (int i = 0; i < 8; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.1;
        p = rot * p;
    }
    return value;
}

// 3D FBM for volumetric effects
float fbm3D(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise3D(p);
        amplitude *= 0.5;
        p *= 2.0;
    }
    return value;
}

// Turbulent warp with depth
vec3 turbulentWarp3D(vec3 p, float t) {
    vec3 q = vec3(fbm(p.xy + vec2(0.0, t * 0.1)),
                  fbm(p.xz + vec2(5.2, t * 0.12)),
                  fbm(p.yz + vec2(3.7, t * 0.08)));

    vec3 r = vec3(fbm(p.xy + 4.0 * q.xy + vec2(1.7, t * 0.08)),
                  fbm(p.xz + 4.0 * q.xz + vec2(8.3, t * 0.09)),
                  fbm(p.yz + 4.0 * q.yz + vec2(4.2, t * 0.07)));

    return vec3(fbm(p.xy + 4.0 * r.xy), 
                fbm(p.xz + 4.0 * r.xz),
                fbm(p.yz + 4.0 * r.yz)) * 1.2;
}

// Iridescent color with viewing angle
vec3 iridescentColor(float t, float angle, float depth) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.1, 0.2) + angle * 0.3 + depth * 0.2;
    return a + b * cos(TAU * (c * t + d));
}

// Dynamic aurora palette
vec3 auroraColor(float t, float height) {
    vec3 col1 = vec3(0.1, 0.9, 0.6);
    vec3 col2 = vec3(0.3, 0.1, 0.9);
    vec3 col3 = vec3(0.9, 0.2, 0.5);
    vec3 col4 = vec3(0.1, 0.4, 0.8);
    vec3 col5 = vec3(0.9, 0.9, 0.1);
    
    float phase = t * 5.0 + height * 2.0;
    float w1 = 0.5 + 0.5 * sin(phase);
    float w2 = 0.5 + 0.5 * sin(phase + TAU * 0.2);
    float w3 = 0.5 + 0.5 * sin(phase + TAU * 0.4);
    float w4 = 0.5 + 0.5 * sin(phase + TAU * 0.6);
    
    return normalize(w1 * col1 + w2 * col2 + w3 * col3 + w4 * col4 + (1.0 - w1 - w2 - w3 - w4) * col5);
}

// Atmospheric scattering
vec3 atmosphericScattering(vec3 color, float distance, vec3 lightDir) {
    vec3 scatterColor = vec3(0.5, 0.7, 1.0);
    float scatter = 1.0 - exp(-distance * 0.5);
    float sun = max(0.0, dot(lightDir, vec3(0.0, 1.0, 0.0)));
    scatter *= 1.0 + sun * 2.0;
    return mix(color, scatterColor, scatter * 0.4);
}

// Caustic patterns with depth
float caustics(vec2 p, float t, float depth) {
    float c = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 q = p + vec2(sin(t * 0.7 + fi), cos(t * 0.6 + fi * 1.3)) * 0.1;
        c += abs(sin(q.x * (8.0 + depth * 2.0) + t) * 
                 cos(q.y * (8.0 + depth * 2.0) + t * 1.1));
    }
    return pow(c / 4.0, 2.0 + depth);
}

// Water surface displacement
float waterSurface(vec2 p, float t) {
    float waves = 0.0;
    float amp = 1.0;
    vec2 shift = vec2(0.0);
    
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 dir = vec2(sin(fi * 0.7), cos(fi * 0.7));
        float freq = 1.0 + fi * 0.5;
        float speed = 1.0 + fi * 0.2;
        
        waves += amp * sin(dot(p + shift, dir) * freq + t * speed);
        amp *= 0.7;
        shift += vec2(0.12, 0.07);
    }
    
    return waves;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    
    // Time variables
    float t1 = u_time * 0.15;  // Very slow (environment)
    float t2 = u_time * 0.4;   // Slow (main motion)
    float t3 = u_time * 0.7;   // Medium (waves)
    float t4 = u_time * 1.1;   // Fast (particles)
    float t5 = u_time * 2.0;   // Very fast (sparkles)
    
    // ═══════════════════════════════════════
    // IMMERSIVE CAMERA EFFECTS
    // ═══════════════════════════════════════
    
    // Breathing camera motion
    float breathe = sin(t1 * 2.0) * 0.05 + sin(t1 * 3.7) * 0.03;
    p *= 1.0 + breathe;
    
    // Subtle camera sway (like floating in water)
    p.x += sin(t2 * 0.8) * 0.02 + sin(t2 * 1.3) * 0.01;
    p.y += cos(t2 * 0.9) * 0.02 + cos(t2 * 1.7) * 0.01;
    
    // Depth of field preparation
    float focusDistance = 0.5 + 0.3 * sin(t1);
    
    // ═══════════════════════════════════════
    // PARALLAX DEPTH LAYERS
    // ═══════════════════════════════════════
    
    // Define depth layers
    float z_near = 0.0;
    float z_mid = 0.5;
    float z_far = 1.0;
    float z_veryfar = 2.0;
    
    // Parallax offset based on position
    vec2 parallax = p * 0.1;
    
    // ═══════════════════════════════════════
    // DEEP BACKGROUND - COSMIC NEBULA
    // ═══════════════════════════════════════
    
    vec2 bgPos = p * 0.3 - parallax * z_veryfar;
    vec3 bgColor = vec3(0.0);
    
    // Deep space nebula
    vec3 nebulaPos = vec3(bgPos * 0.5, t1 * 0.05);
    float nebula = fbm3D(nebulaPos);
    nebula = pow(nebula, 2.5);
    
    vec3 nebulaCol1 = vec3(0.05, 0.0, 0.2);
    vec3 nebulaCol2 = vec3(0.3, 0.05, 0.4);
    vec3 nebulaCol3 = vec3(0.1, 0.0, 0.5);
    
    bgColor += mix(nebulaCol1, nebulaCol2, nebula) * nebula * 0.5;
    bgColor += nebulaCol3 * pow(nebula, 3.0) * 0.3;
    
    // ═══════════════════════════════════════
    // FAR LAYER - DISTANT STARS & GALAXIES
    // ═══════════════════════════════════════
    
    vec2 farPos = p - parallax * z_far;
    
    // Star clusters with depth
    for (int i = 0; i < 200; i++) {
        float id = float(i);
        vec3 rnd = hash3(vec2(id * 1.1, id * 1.3));
        
        vec2 starPos = (rnd.xy * 2.0 - 1.0) * 2.5;
        float starDepth = rnd.z;
        starPos += parallax * (z_far + starDepth);
        
        float d = length(farPos - starPos);
        float size = 0.001 + rnd.z * 0.002;
        
        // Airy disk pattern for realism
        float airy = 1.0 / (1.0 + d * 500.0);
        airy *= sin(d * 200.0) / (d * 200.0 + 0.1);
        
        float intensity = smoothstep(size * 3.0, 0.0, d) + airy * 0.3;
        float twinkle = 0.5 + 0.5 * sin(t4 * (2.0 + rnd.z * 3.0) + id);
        
        vec3 starColor = mix(vec3(1.0, 0.95, 0.9), 
                            vec3(0.8, 0.8, 1.0), rnd.z);
        
        bgColor += starColor * intensity * twinkle;
    }
    
    // ═══════════════════════════════════════
    // VOLUMETRIC FOG LAYER
    // ═══════════════════════════════════════
    
    vec3 fogColor = vec3(0.4, 0.6, 0.9);
    float fogDensity = fbm3D(vec3(p * 2.0, t1 * 0.1)) * 0.4;
    fogDensity *= 1.0 - uv.y * 0.5; // Denser at bottom
    
    bgColor = mix(bgColor, fogColor, fogDensity * 0.3);
    
    // ═══════════════════════════════════════
    // MID LAYER - LIQUID METAL OCEAN
    // ═══════════════════════════════════════
    
    vec2 oceanPos = p - parallax * z_mid;
    
    // Complex ocean surface
    float waterHeight = waterSurface(oceanPos * 3.0, t3) * 0.1;
    vec3 oceanPoint = vec3(oceanPos, waterHeight);
    
    // 3D turbulent warping for realistic water
    vec3 warpedOcean = turbulentWarp3D(oceanPoint * 2.0, t2);
    float liquidBase = warpedOcean.x + sin(oceanPos.y * 6.0 + t3 * 0.5) * 0.08;
    
    // Multi-scale metal flow
    float metalFlow = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float scale = 10.0 + fi * 8.0;
        float speed = 1.0 + fi * 0.3;
        metalFlow += sin(liquidBase * scale + t3 * speed + fi) * (0.5 / (fi + 1.0));
    }
    metalFlow = metalFlow * 0.5 + 0.5;
    metalFlow = pow(metalFlow, 2.0);
    
    // Viewing angle for iridescence
    vec3 viewDir = normalize(vec3(oceanPos, 1.0));
    float viewAngle = dot(viewDir, vec3(0.0, 0.0, 1.0));
    
    // Iridescent coloring
    vec3 metalColor = iridescentColor(liquidBase * 0.5 + t2 * 0.1, viewAngle, waterHeight);
    vec3 oceanColor = mix(vec3(0.02, 0.08, 0.15), metalColor, metalFlow);
    
    // Subsurface scattering
    float scatter = exp(-abs(waterHeight) * 10.0);
    oceanColor += vec3(0.1, 0.4, 0.6) * scatter * 0.4;
    
    // Foam on wave crests
    float foam = smoothstep(0.7, 0.75, sin(waterHeight * 50.0 + t4));
    oceanColor = mix(oceanColor, vec3(0.9, 0.95, 1.0), foam * 0.6);
    
    // Caustic lighting
    float causticStrength = caustics(oceanPos * 10.0, t3, waterHeight);
    oceanColor += vec3(0.4, 0.7, 1.0) * causticStrength * 0.2;
    
    // ═══════════════════════════════════════
    // AURORA LAYER WITH DEPTH
    // ═══════════════════════════════════════
    
    vec3 auroraTotal = vec3(0.0);
    
    for (int layer = 0; layer < 5; layer++) {
        float layerF = float(layer);
        float layerHeight = 0.2 + layerF * 0.15;
        float layerDepth = z_mid + layerF * 0.1;
        
        vec2 auroraPos = p - parallax * layerDepth;
        
        float auroraShape = smoothstep(layerHeight - 0.2, layerHeight, auroraPos.y) *
                           smoothstep(layerHeight + 0.3, layerHeight, auroraPos.y);
        
        if (auroraShape > 0.0) {
            float auroraFlow = fbm(vec2(auroraPos.x * (3.0 + layerF) + t2 * (0.5 + layerF * 0.1), 
                                        auroraPos.y * 2.0 + t3 * 0.3));
            auroraFlow = pow(auroraFlow, 1.5 + layerF * 0.2);
            
            vec3 auroraCol = auroraColor(auroraFlow + t2 * 0.1, layerHeight);
            float intensity = auroraShape * auroraFlow * (0.8 + 0.2 * sin(t4 + auroraPos.x * 5.0));
            
            auroraTotal += auroraCol * intensity * (1.0 / (1.0 + layerF * 0.5));
        }
    }
    
    // ═══════════════════════════════════════
    // NEAR LAYER - PARTICLES & ORBS
    // ═══════════════════════════════════════
    
    vec2 nearPos = p - parallax * z_near;
    vec3 particleColor = vec3(0.0);
    
    // Floating light orbs with trails
    for (int i = 0; i < 15; i++) {
        float idx = float(i);
        float phase = idx * GOLDEN_RATIO;
        
        // 3D motion path
        vec3 orbPath = vec3(
            sin(t2 * 0.3 + phase) * 0.8,
            cos(t2 * 0.4 + phase * 1.2) * 0.6 + sin(t3 * 0.2 + idx) * 0.2,
            sin(t2 * 0.2 + phase * 0.7) * 0.3
        );
        
        vec2 orbPos = orbPath.xy - parallax * (z_near + orbPath.z);
        float orbDist = length(nearPos - orbPos);
        
        // Complex orb structure
        float orbRadius = 0.06 + 0.03 * sin(t4 * 2.0 + idx);
        float orbGlow = exp(-orbDist * 15.0 / (1.0 + orbPath.z));
        float orbCore = smoothstep(orbRadius * 2.0, orbRadius * 0.3, orbDist);
        
        // Orb color with depth fade
        vec3 orbColor = iridescentColor(idx * 0.2 + sin(t4 + idx) * 0.1, 0.0, orbPath.z);
        float depthFade = 1.0 / (1.0 + orbPath.z * 2.0);
        
        particleColor += orbColor * (orbGlow * 0.5 + orbCore * 1.5) * depthFade;
        
        // Motion trail
        vec2 velocity = vec2(cos(t2 * 0.3 + phase), -sin(t2 * 0.4 + phase * 1.2)) * 0.05;
        for (int t = 1; t < 10; t++) {
            float tf = float(t);
            vec2 trailPos = orbPos - velocity * tf * 0.5;
            float trailDist = length(nearPos - trailPos);
            float trailIntensity = exp(-trailDist * 30.0) * exp(-tf * 0.3);
            particleColor += orbColor * trailIntensity * 0.1 * depthFade;
        }
    }
    
    // Floating particles
    for (int i = 0; i < 50; i++) {
        float idx = float(i);
        vec3 rnd = hash3(vec2(idx, idx * 1.37));
        
        vec3 particlePos3D = vec3(
            fract(rnd.x + t2 * 0.05 * (0.5 + rnd.z)) * 2.0 - 1.0,
            fract(rnd.y + t2 * 0.08 * (0.5 + rnd.z * 0.5)) * 2.0 - 1.0,
            rnd.z * 0.5
        );
        
        vec2 pPos = particlePos3D.xy - parallax * (z_near + particlePos3D.z * 0.5);
        float d = length(nearPos - pPos);
        
        float size = 0.5 + rnd.z * 1.5;
        float glow = exp(-d * 80.0 / size);
        
        vec3 pColor = iridescentColor(rnd.x + rnd.y, rnd.z, particlePos3D.z);
        particleColor += pColor * glow * 0.2;
    }
    
    // ═══════════════════════════════════════
    // VOLUMETRIC LIGHTING
    // ═══════════════════════════════════════
    
    // God rays from above
    vec2 lightSource = vec2(0.0, 1.0);
    float lightAngle = dot(normalize(p), lightSource);
    float godRays = 0.0;
    
    if (lightAngle > 0.0) {
        for (int i = 0; i < 20; i++) {
            float fi = float(i) / 20.0;
            vec2 samplePos = p * (1.0 - fi);
            float density = fbm(samplePos * 4.0 + vec2(0.0, t2 * 0.1));
            godRays += density * fi * 0.05;
        }
        godRays *= lightAngle;
    }
    
    // ═══════════════════════════════════════
    // DEPTH COMPOSITE
    // ═══════════════════════════════════════
    
    // Base with background
    vec3 finalColor = bgColor;
    
    // Add ocean with depth blend
    float oceanAlpha = 1.0 - exp(-abs(waterHeight) * 5.0);
    finalColor = mix(finalColor, oceanColor, oceanAlpha * 0.8);
    
    // Add aurora
    finalColor += auroraTotal;
    
    // Add particles and orbs
    finalColor += particleColor;
    
    // Add volumetric lighting
    finalColor += vec3(1.0, 0.95, 0.8) * godRays * 0.3;
    
    // ═══════════════════════════════════════
    // IMMERSIVE POST-PROCESSING
    // ═══════════════════════════════════════
    
    // Depth of field blur simulation
    float dof = abs(length(p) - focusDistance);
    finalColor = mix(finalColor, vec3(dot(finalColor, vec3(0.299, 0.587, 0.114))), dof * 0.2);
    
    // Atmospheric scattering
    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
    finalColor = atmosphericScattering(finalColor, length(p) * 0.5, lightDir);
    
    // Water droplets on "lens"
    float droplets = 0.0;
    for (int i = 0; i < 5; i++) {
        vec2 dropPos = vec2(hash(vec2(float(i), 1.0)), hash(vec2(float(i), 2.0))) * 2.0 - 1.0;
        dropPos *= 0.8;
        float dropDist = length(p - dropPos);
        droplets += smoothstep(0.05, 0.03, dropDist) * 0.5;
    }
    finalColor = mix(finalColor, vec3(1.0), droplets * 0.1);
    
    // Lens flare from bright sources
    vec2 flarePos = vec2(0.3, 0.2);
    vec2 flareVec = p - flarePos;
    for (int i = 0; i < 5; i++) {
        float fi = float(i) / 5.0;
        vec2 flarePoint = flarePos + flareVec * fi;
        float flareDist = length(p - flarePoint);
        float flare = exp(-flareDist * 20.0) * (1.0 - fi);
        finalColor += vec3(1.0, 0.9, 0.7) * flare * 0.1;
    }
    
    // Chromatic aberration (fixed version)
    float aberration = 0.01 * length(p) * sin(t2 * 0.5);
    vec3 colR = finalColor * vec3(1.0 + aberration, 1.0, 1.0 - aberration * 0.5);
    vec3 colB = finalColor * vec3(1.0 - aberration * 0.5, 1.0, 1.0 + aberration);
    finalColor = vec3(colR.r, finalColor.g, colB.b);
    
    // Film grain
    float grain = (hash(p + vec2(t5, t5 * 1.3)) - 0.5) * 0.04;
    finalColor += grain;
    
    // Vignette with breathing
    float vignette = 1.0 - length(p) * (0.6 + breathe * 2.0);
    vignette = smoothstep(0.0, 1.0, vignette);
    finalColor *= vignette;
    
    // HDR tonemapping
    finalColor = finalColor / (finalColor + vec3(1.0));
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    
    // Color grading for mood
    finalColor = pow(finalColor, vec3(0.9, 0.95, 1.05));
    vec3 tint = vec3(0.98, 1.0, 1.02);
    finalColor *= tint;
    
    // Bloom
    float brightness = dot(finalColor, vec3(0.299, 0.587, 0.114));
    vec3 bloom = finalColor * smoothstep(0.5, 0.8, brightness);
    finalColor += bloom * 0.4;
    
    // Final saturation
    vec3 gray = vec3(dot(finalColor, vec3(0.299, 0.587, 0.114)));
    finalColor = mix(gray, finalColor, 1.3);
    
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    fragColor = vec4(finalColor, 1.0);
}