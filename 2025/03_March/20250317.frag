// Enhanced Sacred Geometry Shader with Complex, Nested Polygonal Patterns

uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

// ---------------------------------------------------
// 1) Pseudo-random noise (hash-based)
// ---------------------------------------------------
float hash21(vec2 p)
{
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float noise2D(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ---------------------------------------------------
// 2) Hue rotation utility (HSV-like)
// ---------------------------------------------------
vec3 hueColor(float h)
{
    h = fract(h);
    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

// ---------------------------------------------------
// 3) Circle ring function for the Flower of Life
// ---------------------------------------------------
float circleRing(vec2 pos, vec2 center, float radius, float thickness)
{
    float distCircle = abs(length(pos - center) - radius);
    return smoothstep(0.0, thickness, thickness - distCircle);
}

// ---------------------------------------------------
// 4) Flower of Life arrangement (7 circles + 12 outer circles)
// ---------------------------------------------------
float flowerOfLife(vec2 uvSwirl)
{
    float R = 0.35;
    float ringThickness = 0.015;
    float coverage = 0.0;

    // Center circle
    coverage += circleRing(uvSwirl, vec2(0.0), R, ringThickness);

    // First ring: 6 surrounding circles
    for(int i = 0; i < 6; i++)
    {
        float angle = 2.0 * 3.14159 * float(i) / 6.0;
        vec2 c = vec2(cos(angle), sin(angle)) * R;
        coverage += circleRing(uvSwirl, c, R, ringThickness);
    }
    
    // Second ring: 12 outer circles
    float ringThickness2 = 0.01;
    for(int i = 0; i < 12; i++)
    {
        float angle = 2.0 * 3.14159 * float(i) / 12.0;
        vec2 c = vec2(cos(angle), sin(angle)) * (2.0 * R);
        coverage += circleRing(uvSwirl, c, R, ringThickness2);
    }
    
    return coverage;
}

// ---------------------------------------------------
// 5) SDF for a regular polygon
// ---------------------------------------------------
float sdPolygon(vec2 p, float n, float r)
{
    float a = 2.0 * 3.14159 / n;
    float modAngle = mod(atan(p.y, p.x) + 3.14159/n, a) - a/2.0;
    return cos(modAngle) * length(p) - r;
}

// ---------------------------------------------------
// 6) Complex geometry combining mandala and polygon layers
// ---------------------------------------------------
float complexGeometry(vec2 uv)
{
    // Start with the Flower of Life base pattern.
    float result = flowerOfLife(uv);
    
    // Add multiple rotating polygon layers for extra complexity.
    for (int i = 0; i < 3; i++)
    {
        float scale = 1.0 - float(i) * 0.2;
        vec2 p = uv * scale;
        
        // Rotate each layer uniquely over time.
        float angle = u_time * (0.3 + 0.1 * float(i));
        float ca = cos(angle);
        float sa = sin(angle);
        p = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
        
        // Vary the number of sides for each polygon.
        float sides = 5.0 + float(i);
        float poly = smoothstep(0.005, 0.0, abs(sdPolygon(p, sides, 0.3 * scale)));
        result += poly * (0.4 - 0.1 * float(i));
    }
    
    return result;
}

// ---------------------------------------------------
// 7) Main shader function
// ---------------------------------------------------
void main()
{
    // Normalize coordinates: center the UVs and adjust for aspect ratio.
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float lenUV = length(uv);
    
    // Apply a slow, global rotation.
    float globalRot = u_time * 0.1;
    mat2 rotMat = mat2(cos(globalRot), -sin(globalRot), sin(globalRot), cos(globalRot));
    uv = rotMat * uv;
    
    // Base swirl for the underlying effect.
    float swirlStrength = 0.5;
    float swirl = swirlStrength * sin(lenUV * 3.0 - u_time * 0.4);
    float ca = cos(swirl);
    float sa = sin(swirl);
    vec2 uvSwirl = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);
    
    // Radial gradient for fading the pattern at the edges.
    float radialGradient = smoothstep(0.3, 1.2, lenUV);
    
    // Compute the complex geometry coverage.
    float geomCoverage = complexGeometry(uvSwirl);
    
    // Chakra-like color modulation (using hue shifts over time, angle, and distance).
    float baseHue = 0.55 + 0.1 * sin(u_time * 0.3);
    float angleShift = 0.1 * sin(atan(uv.y, uv.x) * 6.0);
    float distShift  = 0.15 * sin(lenUV * 3.0 - u_time * 0.8);
    float finalHue   = baseHue + angleShift + distShift;
    vec3 spiritualColor = hueColor(finalHue);
    
    // Combine the complex geometry with color modulation.
    vec3 color = spiritualColor * geomCoverage * (1.0 - radialGradient);
    
    // Ambient noise-based aura.
    float noiseScale = 2.5;
    float n = noise2D(uvSwirl * noiseScale + u_time * 0.2);
    float aura = 0.2 * n * (1.0 - radialGradient);
    color += aura * vec3(0.7, 0.9, 1.0);
    
    // Pulsating energy rings.
    float energyRings = 0.5 * sin(lenUV * 25.0 - u_time * 3.0) + 0.5;
    energyRings *= smoothstep(0.1, 0.45, lenUV) * 0.7;
    vec3 ringColor = hueColor(baseHue + 0.05) * energyRings;
    color += ringColor;
    
    // Soft cosmic glow.
    float glowStrength = 0.16 / (lenUV + 0.12);
    color += glowStrength * vec3(1.2, 1.0, 0.8);
    
    // Gentle sparkles.
    float sparkles = sin(lenUV * 60.0 - u_time * 8.0)
                   * cos(lenUV * 40.0 + u_time * 7.0) * 0.03;
    color += vec3(sparkles * 1.2, sparkles * 0.8, sparkles * 1.0);
    
    // Refined vignette effect.
    float vignette = smoothstep(0.9, 0.4, lenUV);
    color *= vignette;
    
    // Final color adjustments: gamma correction and brightness boost.
    color = pow(color, vec3(1.3));
    color *= 1.6;
    
    fragColor = vec4(color, 1.0);
}
