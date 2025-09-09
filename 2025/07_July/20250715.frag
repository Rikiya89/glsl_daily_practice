// 🔺✨ CRYSTALLINE PRISM - Dynamic Geometric Art
// Abstract geometric patterns with prismatic color separation,
// rotating crystal formations, and dynamic lighting effects

uniform float u_time;
uniform vec2  u_resolution;
out vec4      fragColor;

#define TAU 6.28318530718
#define PI 3.14159265359
#define SQRT3 1.73205080757

// Rotation matrix
mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

// Hash function for randomness
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), 
                          dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// Hexagonal tiling
vec2 hexTile(vec2 p) {
    vec2 q = vec2(p.x * 2.0/3.0, p.y);
    vec2 r = vec2(p.x / 3.0, p.y);
    
    vec2 h = vec2(floor(q.x + 0.5), floor(q.y + 0.5));
    vec2 a = q - h;
    vec2 b = r - vec2(floor(r.x + 0.5), floor(r.y + 0.5));
    
    return length(a) < length(b) ? h : vec2(floor(r.x + 0.5), floor(r.y + 0.5));
}

// Distance to hexagon
float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, SQRT3))), p.x);
}

// Voronoi-like pattern
float voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    
    float dist = 1.0;
    for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
            vec2 g = vec2(i, j);
            vec2 o = hash2(n + g);
            o = 0.5 + 0.5 * sin(u_time * 0.5 + o * TAU);
            vec2 r = g + o - f;
            dist = min(dist, length(r));
        }
    }
    return dist;
}

// Prismatic color separation
vec3 prismColor(float t, vec2 p) {
    // Base colors for light spectrum
    vec3 colors[7];
    colors[0] = vec3(0.9, 0.1, 0.2); // Red
    colors[1] = vec3(0.9, 0.5, 0.1); // Orange
    colors[2] = vec3(0.9, 0.9, 0.2); // Yellow
    colors[3] = vec3(0.2, 0.9, 0.3); // Green
    colors[4] = vec3(0.2, 0.7, 0.9); // Blue
    colors[5] = vec3(0.3, 0.2, 0.9); // Indigo
    colors[6] = vec3(0.7, 0.2, 0.9); // Violet
    
    // Add position-based dispersion
    float dispersion = length(p) * 0.5;
    t = fract(t + dispersion);
    
    float index = t * 6.0;
    int i = int(index);
    float f = fract(index);
    
    vec3 c1 = colors[i];
    vec3 c2 = colors[(i + 1) % 7];
    
    return mix(c1, c2, f);
}

// Crystal formation
float crystal(vec2 p, float size, float rotation) {
    p = rot(rotation) * p;
    
    // Create crystalline structure
    float d = 1000.0;
    
    // Main crystal body
    for (int i = 0; i < 6; i++) {
        float angle = float(i) * TAU / 6.0;
        vec2 dir = vec2(cos(angle), sin(angle));
        float plane = dot(p, dir) - size;
        d = min(d, plane);
    }
    
    // Inner structure
    for (int i = 0; i < 3; i++) {
        float angle = float(i) * TAU / 3.0;
        vec2 dir = vec2(cos(angle), sin(angle));
        float plane = abs(dot(p, dir)) - size * 0.3;
        d = max(d, -plane);
    }
    
    return d;
}

// Fractal crystal pattern
float fractalCrystal(vec2 p, float t) {
    float scale = 1.0;
    float result = 0.0;
    
    for (int i = 0; i < 4; i++) {
        float rotation = t * 0.1 + float(i) * 0.5;
        float size = 0.3 / scale;
        
        float c = crystal(p * scale, size, rotation);
        result += abs(c) / scale;
        
        scale *= 2.0;
        p = rot(0.5) * p;
    }
    
    return result;
}

// Kaleidoscope effect
vec2 kaleidoscope(vec2 p, int segments) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    
    float segmentAngle = TAU / float(segments);
    angle = mod(angle, segmentAngle);
    
    // Mirror every other segment
    if (mod(floor(atan(p.y, p.x) / segmentAngle), 2.0) == 1.0) {
        angle = segmentAngle - angle;
    }
    
    return vec2(cos(angle), sin(angle)) * radius;
}

// Light ray
float lightRay(vec2 p, vec2 start, vec2 end, float width) {
    vec2 pa = p - start;
    vec2 ba = end - start;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return smoothstep(width, 0.0, length(pa - ba * h));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    
    // Time variables
    float t1 = u_time * 0.2;  // Slow rotation
    float t2 = u_time * 0.5;  // Medium animation
    float t3 = u_time * 1.0;  // Fast effects
    
    // Apply kaleidoscope transformation
    p = kaleidoscope(p, 8);
    
    // Zoom and rotate
    float zoom = 1.0 + 0.3 * sin(t1);
    p *= zoom;
    p = rot(t1 * 0.3) * p;
    
    // Initialize color
    vec3 color = vec3(0.0);
    
    // ═══════════════════════════════════════
    // BACKGROUND GRADIENT
    // ═══════════════════════════════════════
    
    float bgGradient = length(p) * 0.5;
    vec3 bgColor = mix(vec3(0.05, 0.02, 0.1), vec3(0.02, 0.05, 0.15), bgGradient);
    color += bgColor;
    
    // ═══════════════════════════════════════
    // MAIN CRYSTAL STRUCTURES
    // ═══════════════════════════════════════
    
    // Large rotating crystals
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 crystalPos = vec2(cos(fi * TAU/3.0 + t2), sin(fi * TAU/3.0 + t2)) * 0.4;
        vec2 localP = p - crystalPos;
        
        float crystalDist = crystal(localP, 0.15, t2 + fi);
        float crystalEdge = smoothstep(0.02, 0.0, abs(crystalDist));
        
        // Prismatic coloring based on angle and distance
        float colorPhase = atan(localP.y, localP.x) / TAU + fi * 0.333;
        vec3 crystalColor = prismColor(colorPhase + t2 * 0.1, localP);
        
        color += crystalColor * crystalEdge;
        
        // Inner glow
        float innerGlow = exp(-abs(crystalDist) * 5.0);
        color += crystalColor * innerGlow * 0.3;
    }
    
    // ═══════════════════════════════════════
    // FRACTAL DETAILS
    // ═══════════════════════════════════════
    
    float fractal = fractalCrystal(p, t1);
    float fractalEdge = smoothstep(0.1, 0.08, fractal);
    
    vec3 fractalColor = prismColor(fractal * 0.5 + t2 * 0.05, p);
    color += fractalColor * fractalEdge * 0.5;
    
    // ═══════════════════════════════════════
    // VORONOI CELLS
    // ═══════════════════════════════════════
    
    vec2 voronoiP = p * 3.0;
    voronoiP = rot(t1 * 0.1) * voronoiP;
    
    float voronoiDist = voronoi(voronoiP);
    float voronoiEdge = smoothstep(0.05, 0.02, voronoiDist);
    
    vec3 voronoiColor = prismColor(voronoiDist * 2.0 + t2 * 0.2, p);
    color += voronoiColor * voronoiEdge * 0.3;
    
    // ═══════════════════════════════════════
    // LIGHT RAYS
    // ═══════════════════════════════════════
    
    // Animated light rays
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float angle = fi * TAU / 12.0 + t2 * 0.5;
        vec2 rayStart = vec2(0.0, 0.0);
        vec2 rayEnd = vec2(cos(angle), sin(angle)) * 2.0;
        
        float rayIntensity = lightRay(p, rayStart, rayEnd, 0.01);
        rayIntensity *= (0.5 + 0.5 * sin(t3 + fi));
        
        vec3 rayColor = prismColor(fi * 0.083 + t2 * 0.1, p);
        color += rayColor * rayIntensity * 0.4;
    }
    
    // ═══════════════════════════════════════
    // HEXAGONAL GRID
    // ═══════════════════════════════════════
    
    vec2 hexP = p * 8.0;
    hexP = rot(t1 * 0.2) * hexP;
    
    vec2 hexId = hexTile(hexP);
    vec2 hexCenter = hexId;
    vec2 hexLocal = hexP - hexCenter;
    
    float hexDist = hexDist(hexLocal);
    float hexEdge = smoothstep(0.02, 0.0, abs(hexDist - 0.3));
    
    // Animate individual hexagons
    float hexHash = hash(hexId);
    float hexPhase = hexHash * TAU + t2;
    float hexPulse = 0.5 + 0.5 * sin(hexPhase);
    
    vec3 hexColor = prismColor(hexHash + t2 * 0.05, hexLocal);
    color += hexColor * hexEdge * hexPulse * 0.2;
    
    // ═══════════════════════════════════════
    // CENTRAL STAR
    // ═══════════════════════════════════════
    
    float starDist = length(p);
    float starIntensity = exp(-starDist * 3.0);
    
    // Rotating star pattern
    float starAngle = atan(p.y, p.x);
    float starPattern = sin(starAngle * 8.0 + t2 * 2.0) * 0.5 + 0.5;
    
    vec3 starColor = prismColor(starPattern + t2 * 0.3, p);
    color += starColor * starIntensity * starPattern * 0.6;
    
    // ═══════════════════════════════════════
    // SPARKLES
    // ═══════════════════════════════════════
    
    for (int i = 0; i < 30; i++) {
        float fi = float(i);
        vec2 sparklePos = hash2(vec2(fi)) * 2.0 - 1.0;
        sparklePos *= 1.5;
        
        float sparklePhase = hash(sparklePos) * TAU + t3;
        float sparkleIntensity = 0.5 + 0.5 * sin(sparklePhase);
        
        float sparkleDist = length(p - sparklePos);
        float sparkle = exp(-sparkleDist * 50.0) * sparkleIntensity;
        
        vec3 sparkleColor = prismColor(hash(sparklePos) + t2 * 0.1, sparklePos);
        color += sparkleColor * sparkle * 0.8;
    }
    
    // ═══════════════════════════════════════
    // POST-PROCESSING
    // ═══════════════════════════════════════
    
    // Chromatic aberration
    float aberration = length(p) * 0.02;
    vec2 rOffset = vec2(aberration, 0.0);
    vec2 bOffset = vec2(-aberration, 0.0);
    
    float r = color.r;
    float g = color.g;
    float b = color.b;
    
    // Subtle color shift
    color = vec3(r + aberration * 0.1, g, b + aberration * 0.1);
    
    // Vignette
    float vignette = 1.0 - length(p) * 0.5;
    vignette = smoothstep(0.2, 1.0, vignette);
    color *= vignette;
    
    // Contrast and brightness
    color = pow(color, vec3(0.8));
    color *= 1.2;
    
    // Color enhancement
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.4);
    
    // Bloom effect
    float brightness = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 bloom = color * smoothstep(0.3, 0.8, brightness);
    color += bloom * 0.3;
    
    // Final gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);
    
    fragColor = vec4(color, 1.0);
}