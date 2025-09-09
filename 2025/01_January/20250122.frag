// "Beautiful Flower of Life" in a spiritual, mandala-like style.
// 
// Uniforms expected:
//   - u_time (float): Time in seconds
//   - u_resolution (vec2): The width and height of the viewport
//
// The final color is written to fragColor.

uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

// ---------------------------------------------------
// 1) Simple pseudo-random noise (hash-based)
// ---------------------------------------------------
float hash21(vec2 p)
{
    // A quick, hacky hash function
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float noise2D(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    // 4 corners in 2D
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    // Smooth fade
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Bilinear blend
    return mix(
        mix(a, b, u.x),
        mix(c, d, u.x),
        u.y
    );
}

// ---------------------------------------------------
// 2) Hue rotation utility (HSV-like)
// ---------------------------------------------------
vec3 hueColor(float h)
{
    // Wrap hue to [0,1)
    h = fract(h);

    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);

    return clamp(vec3(r, g, b), 0.0, 1.0);
}

// ---------------------------------------------------
// 3) Function to add thin ring coverage around circle boundary
//    - Returns how much this circle contributes (for overlap summation)
// ---------------------------------------------------
float circleRing(vec2 pos, vec2 center, float radius, float thickness)
{
    // distance from ring boundary
    float distCircle = abs(length(pos - center) - radius);
    return smoothstep(0.0, thickness, thickness - distCircle);
}

// ---------------------------------------------------
// 4) Standard Flower of Life arrangement (7 circles)
//    - Center circle + 6 around at distance 'R'
//    - Each circle is radius 'R', so they intersect
//      at each other's centers in classic FOL geometry.
//    - Returns a "coverage" value where the rings form
//      thin boundaries (summed overlap).
// ---------------------------------------------------
float flowerOfLife(vec2 uvSwirl)
{
    // Circle radius for each ring
    float R = 0.35;
    // Thickness of each ring boundary
    float ringThickness = 0.015;

    float coverage = 0.0;

    // 1) Center circle (at 0,0)
    coverage += circleRing(uvSwirl, vec2(0.0), R, ringThickness);

    // 2) The 6 surrounding circles
    for(int i = 0; i < 6; i++)
    {
        float angle = 2.0 * 3.14159 * float(i) / 6.0;
        vec2 c = vec2(cos(angle), sin(angle)) * R;
        coverage += circleRing(uvSwirl, c, R, ringThickness);
    }

    // --- Uncomment if you want a larger pattern (2nd ring around) ---
    // for(int i = 0; i < 12; i++)
    // {
    //     float angle = 2.0 * 3.14159 * float(i) / 12.0;
    //     // centers at 2R for the second ring
    //     vec2 c = vec2(cos(angle), sin(angle)) * (2.0 * R);
    //     coverage += circleRing(uvSwirl, c, R, ringThickness);
    // }

    return coverage;
}

// ---------------------------------------------------
// 5) Main
// ---------------------------------------------------
void main()
{
    // Normalize coords to [-0.5*aspect, 0.5*aspect] x [-0.5, 0.5]
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float lenUV   = length(uv);
    float angleUV = atan(uv.y, uv.x);

    // -------------------------
    // Base swirl in background
    // -------------------------
    float swirlStrength = 0.5;
    float swirl = swirlStrength * sin(lenUV * 3.0 - u_time * 0.4);
    float ca    = cos(swirl);
    float sa    = sin(swirl);

    // Apply swirl rotation to uv
    vec2 uvSwirl;
    uvSwirl.x = uv.x * ca - uv.y * sa;
    uvSwirl.y = uv.x * sa + uv.y * ca;

    // Smooth radial fade from center
    float radialGradient = smoothstep(0.3, 1.2, lenUV);

    // -------------------------
    // Flower of Life coverage
    // -------------------------
    float folCoverage = flowerOfLife(uvSwirl);

    // -------------------------
    // Chakra-like color for interior
    // (Shift hue over time, plus angle & distance mods)
    // -------------------------
    float baseHue   = 0.55 + 0.1 * sin(u_time * 0.3);  // overall hue shift
    float angleShift = 0.1  * sin(angleUV * 6.0);
    float distShift  = 0.15 * sin(lenUV * 3.0 - u_time * 0.8);

    float finalHue   = baseHue + angleShift + distShift;
    vec3 spiritualColor = hueColor(finalHue);

    // Combine color with coverage from the FOL geometry & radial fade
    // (We invert radialGradient so that the pattern is strong near the center)
    vec3 color = spiritualColor * folCoverage * (1.0 - radialGradient);

    // -------------------------
    // Ambient swirl & "prana" (noise)
    // -------------------------
    float noiseScale = 2.5;
    float n = noise2D(uvSwirl * noiseScale + u_time * 0.2);
    // Soft aura around everything
    float aura = 0.2 * n * (1.0 - radialGradient);
    color += aura * vec3(0.7, 0.9, 1.0);

    // -------------------------
    // Pulsating energy rings
    // -------------------------
    float energyRings = 0.5 * sin(lenUV * 25.0 - u_time * 3.0) + 0.5;
    energyRings       *= smoothstep(0.1, 0.45, lenUV) * 0.7;

    // Shift ring color slightly
    vec3 ringColor = hueColor(baseHue + 0.05) * energyRings;
    color += ringColor;

    // -------------------------
    // Soft cosmic glow
    // -------------------------
    float glowStrength = 0.16 / (lenUV + 0.12);
    color += glowStrength * vec3(1.2, 1.0, 0.8);

    // -------------------------
    // Gentle sparkles
    // -------------------------
    float sparkles = sin(lenUV * 60.0 - u_time * 8.0)
                   * cos(lenUV * 40.0 + u_time * 7.0) * 0.03;
    color += vec3(sparkles * 1.2, sparkles * 0.8, sparkles * 1.0);

    // -------------------------
    // Final color adjustments
    // -------------------------
    // Mild gamma correction
    color = pow(color, vec3(1.3));
    // Slight brightness boost
    color *= 1.6;

    fragColor = vec4(color, 1.0);
}
