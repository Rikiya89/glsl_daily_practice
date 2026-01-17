// TouchDesigner GLSL TOP - Ethereal Garden
// Organic flowing forms with enhanced animations

uniform float u_time;
uniform vec2 u_resolution;

#define PI 3.14159265359
#define TAU 6.28318530718
#define PHI 1.61803398875

#define MAX_STEPS 100
#define MAX_DIST 80.0
#define SURF_DIST 0.001

// Color palette
const vec3 pal[10] = vec3[10](
    vec3(0.212, 0.176, 0.471), // deep purple
    vec3(0.322, 0.247, 0.639), // purple
    vec3(0.569, 0.424, 0.800), // light purple
    vec3(0.741, 0.631, 0.898), // lavender
    vec3(0.784, 0.753, 0.914), // pale lavender
    vec3(0.518, 0.729, 0.906), // sky blue
    vec3(0.318, 0.416, 0.831), // royal blue
    vec3(0.200, 0.247, 0.529), // navy
    vec3(0.161, 0.188, 0.224), // dark slate
    vec3(0.157, 0.212, 0.192)  // dark teal
);

// Smooth animated palette interpolation
vec3 getPalette(float t) {
    t = fract(t) * 10.0;
    int i = int(floor(t));
    float f = smoothstep(0.0, 1.0, fract(t));
    return mix(pal[i], pal[(i + 1) % 10], f);
}

// Animated palette - cycles through the purple/blue palette over time
vec3 animatedPalette(float t, float time) {
    // Offset by time for animation
    float animT = fract(t + time * 0.05);
    return getPalette(animT);
}

// Blend between specific palette colors with animation
vec3 blendPalette(int i1, int i2, float t, float time) {
    float blend = sin(t + time) * 0.5 + 0.5;
    return mix(pal[i1], pal[i2], blend);
}

// Accent colors - softer cyan/teal to match palette
const vec3 accentCyan = vec3(0.35, 0.75, 0.85);    // soft cyan
const vec3 accentTeal = vec3(0.25, 0.55, 0.58);    // muted teal
const vec3 accentAqua = vec3(0.4, 0.7, 0.75);      // gentle aqua

// Pink/Magenta accent colors - soft and ethereal
const vec3 accentPink = vec3(0.85, 0.45, 0.65);    // soft pink
const vec3 accentMagenta = vec3(0.75, 0.35, 0.6);  // muted magenta
const vec3 accentRose = vec3(0.9, 0.55, 0.7);      // gentle rose

// Get cyan accent with pulse
vec3 getAccentCyan(float t, float time) {
    float pulse = sin(time * 2.0 + t * 5.0) * 0.5 + 0.5;
    return mix(accentTeal, accentCyan, pulse);
}

// Get pink accent with pulse
vec3 getAccentPink(float t, float time) {
    float pulse = sin(time * 1.8 + t * 4.0) * 0.5 + 0.5;
    return mix(accentMagenta, accentPink, pulse);
}

// Noise for organic motion
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Gyroid minimal surface
float gyroid(vec3 p, float scale) {
    p *= scale;
    return dot(sin(p), cos(p.zxy)) / scale;
}

float sphere(vec3 p, float r) {
    return length(p) - r;
}

float torus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// Scene with material ID
vec2 map(vec3 p, float t) {
    float matId = 0.0;

    // Breathing animation for whole scene
    float breath = 1.0 + 0.08 * sin(t * 0.8);

    // Slow rotation with wobble
    vec3 q = p;
    q.xz *= rot(t * 0.15 + sin(t * 0.3) * 0.1);
    q.xy *= rot(t * 0.1 + cos(t * 0.25) * 0.08);

    // Central organic core - pulsing and morphing
    float corePulse = 1.8 + 0.3 * sin(t * 1.2);
    float core = sphere(q, corePulse);
    // Organic surface displacement
    core += sin(q.x * 4.0 + t * 1.5) * 0.15 * sin(t * 0.7 + 1.0);
    core += sin(q.y * 3.0 - t * 1.2) * 0.12 * cos(t * 0.5);
    core += sin(q.z * 3.5 + t * 0.9) * 0.13 * sin(t * 0.6 + 2.0);
    // Add noise-based organic detail
    core += noise(q * 3.0 + t * 0.5) * 0.1;

    float d = core;
    matId = 1.0;

    // Inner gyroid - breathing and rotating
    vec3 g1 = p;
    g1.xz *= rot(-t * 0.12);
    g1.xy *= rot(t * 0.05);
    float gyScale1 = 1.0 + 0.15 * sin(t * 0.6);
    float gyThick1 = 0.12 + 0.04 * sin(t * 0.9);
    float gy1 = abs(gyroid(g1, gyScale1)) - gyThick1;
    float innerR = 5.5 + 0.3 * sin(t * 0.7);
    float outerR = 4.0 + 0.2 * sin(t * 0.8 + 1.0);
    gy1 = max(gy1, sphere(p, innerR));
    gy1 = max(gy1, -sphere(p, outerR));

    if (gy1 < d) {
        d = gy1;
        matId = 2.0;
    }

    // Outer gyroid - counter-rotating, morphing
    vec3 g2 = p;
    g2.yz *= rot(t * 0.07);
    g2.xz *= rot(-t * 0.04);
    float gyScale2 = 0.5 + 0.1 * sin(t * 0.5 + 1.5);
    float gy2 = abs(gyroid(g2, gyScale2)) - 0.08;
    float outer2 = 8.0 + 0.5 * sin(t * 0.4);
    float inner2 = 6.5 + 0.4 * sin(t * 0.5 + 0.5);
    gy2 = max(gy2, sphere(p, outer2));
    gy2 = max(gy2, -sphere(p, inner2));

    if (gy2 < d) {
        d = gy2;
        matId = 3.0;
    }

    // Torus rings - undulating and wobbling
    vec3 t1 = p;
    t1.xz *= rot(t * 0.2);
    t1.y += sin(atan(t1.z, t1.x) * 3.0 + t * 2.0) * 0.15; // Wave along ring
    float tor1Radius = 3.2 + 0.2 * sin(t * 0.8);
    float tor1 = torus(t1, vec2(tor1Radius, 0.15 + 0.03 * sin(t * 1.5)));
    if (tor1 < d) {
        d = tor1;
        matId = 4.0;
    }

    vec3 t2 = p;
    t2.xy *= rot(PI * 0.5 + sin(t * 0.3) * 0.1);
    t2.xz *= rot(t * 0.15);
    t2.y += sin(atan(t2.z, t2.x) * 4.0 - t * 1.8) * 0.12;
    float tor2 = torus(t2, vec2(3.6 + 0.15 * sin(t * 0.7), 0.12));
    if (tor2 < d) {
        d = tor2;
        matId = 5.0;
    }

    vec3 t3 = p;
    t3.yz *= rot(PI * 0.5 + cos(t * 0.25) * 0.08);
    t3.xz *= rot(-t * 0.12);
    t3.y += sin(atan(t3.z, t3.x) * 5.0 + t * 2.2) * 0.1;
    float tor3 = torus(t3, vec2(4.0 + 0.25 * sin(t * 0.6 + 1.0), 0.1));
    if (tor3 < d) {
        d = tor3;
        matId = 6.0;
    }

    // Orbiting spheres - dancing in spiral patterns
    for (int i = 0; i < 21; i++) {
        float fi = float(i);
        float theta = fi * TAU / PHI;
        float phi = acos(1.0 - 2.0 * (fi + 0.5) / 21.0);

        // Dynamic radius with individual timing
        float r = 5.0 + sin(t * 0.8 + fi * 0.3) * 0.8
                + cos(t * 0.5 + fi * 0.7) * 0.3;

        // Spiral motion
        float spiralOffset = sin(t * 0.6 + fi * 0.5) * 0.5;

        vec3 op = r * vec3(
            sin(phi + spiralOffset) * cos(theta + t * 0.2 + fi * 0.02),
            cos(phi) + sin(t * 0.9 + fi * 0.4) * 0.3,
            sin(phi + spiralOffset) * sin(theta + t * 0.2 + fi * 0.02)
        );

        // Pulsing size
        float sz = 0.2 + 0.08 * sin(t * 2.5 + fi * 1.2)
                 + 0.04 * cos(t * 1.8 + fi * 0.9);
        float orb = sphere(p - op, sz);
        if (orb < d) {
            d = orb;
            matId = 7.0 + fi * 0.1;
        }
    }

    // Extra: floating particles ring
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float angle = fi * TAU / 12.0 + t * 0.3;
        float particleR = 7.0 + sin(t + fi) * 0.5;
        float height = sin(t * 1.2 + fi * 0.8) * 1.5;

        vec3 pp = vec3(cos(angle) * particleR, height, sin(angle) * particleR);
        float particle = sphere(p - pp, 0.08 + 0.03 * sin(t * 3.0 + fi));

        if (particle < d) {
            d = particle;
            matId = 9.0;
        }
    }

    return vec2(d, matId);
}

vec3 calcNormal(vec3 p, float t) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy, t).x - map(p - e.xyy, t).x,
        map(p + e.yxy, t).x - map(p - e.yxy, t).x,
        map(p + e.yyx, t).x - map(p - e.yyx, t).x
    ));
}

vec3 march(vec3 ro, vec3 rd, float t) {
    float d = 0.0;
    float matId = 0.0;
    float hit = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * d;
        vec2 res = map(p, t);
        float h = res.x;
        matId = res.y;
        d += h * 0.8;
        if (abs(h) < SURF_DIST) {
            hit = 1.0;
            break;
        }
        if (d > MAX_DIST) break;
    }
    return vec3(d, matId, hit);
}

float calcAO(vec3 p, vec3 n, float t) {
    float occ = 0.0;
    float w = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.02 + 0.12 * float(i);
        occ += (h - map(p + h * n, t).x) * w;
        w *= 0.75;
    }
    return clamp(1.0 - occ * 1.5, 0.0, 1.0);
}

out vec4 fragColor;

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float t = u_time * 0.6;

    // Camera
    float camDist = 39.0 + sin(t * 0.3) * 1.5;
    float camAngle = t * 0.06;
    float camHeight = 2.5 * sin(t * 0.05);

    vec3 ro = vec3(camDist * sin(camAngle), camHeight, camDist * cos(camAngle));
    vec3 ta = vec3(0.0);

    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.0 * ww);

    // Animated background with palette colors
    vec3 bgBot = pal[8] * 0.3;  // dark slate base
    vec3 bgTop = pal[7] * 0.4;  // navy top
    vec3 bg = mix(bgBot, bgTop, uv.y * 0.5 + 0.5);
    // Add deep purple tint
    bg = mix(bg, pal[0] * 0.2, 0.3);

    // Aurora effect with palette colors
    float aurora1 = sin(uv.x * 3.0 + t * 0.3) * sin(uv.y * 2.0 - t * 0.2) * 0.5 + 0.5;
    aurora1 *= smoothstep(0.0, 0.5, uv.y + 0.3);
    float aurora2 = sin(uv.x * 2.0 - t * 0.25) * sin(uv.y * 3.0 + t * 0.15) * 0.5 + 0.5;
    aurora2 *= smoothstep(-0.2, 0.4, uv.y);
    // Blend aurora colors from palette
    bg += pal[5] * aurora1 * 0.1;  // sky blue
    bg += pal[6] * aurora2 * 0.06; // royal blue
    bg += pal[2] * sin(uv.x * 5.0 - t * 0.4) * 0.04; // light purple waves

    // Twinkling stars with palette tint + cyan accents
    vec2 starUV = uv * 30.0;
    float starField = hash(vec3(floor(starUV), 1.0));
    float twinkle = sin(t * 3.0 + starField * 20.0) * 0.5 + 0.5;
    float star = smoothstep(0.97, 1.0, starField) * twinkle;
    vec3 starColor = mix(pal[4], pal[5], starField);
    // Some stars have accent tints
    if (starField > 0.99) {
        starColor = mix(pal[5], accentCyan, 0.5);
    } else if (starField > 0.98 && starField <= 0.99) {
        starColor = mix(pal[3], accentPink, 0.4);
    }
    bg += starColor * star * 0.7;

    vec3 col = bg;

    // March
    vec3 res = march(ro, rd, t);
    float d = res.x;
    float matId = res.y;
    float hit = res.z;

    if (hit > 0.5) {
        vec3 p = ro + rd * d;
        vec3 n = calcNormal(p, t);
        vec3 v = normalize(ro - p);
        vec3 r = reflect(-v, n);

        // Strong directional lights
        vec3 l1 = normalize(vec3(sin(t * 0.5) * 2.0, 3.0, cos(t * 0.5) * 2.0));
        vec3 l2 = normalize(vec3(-1.5, 1.0, sin(t * 0.3) * 2.0));
        vec3 l3 = normalize(vec3(0.0, -1.0, 0.0)); // Bottom fill

        float diff1 = max(dot(n, l1), 0.0);
        float diff2 = max(dot(n, l2), 0.0);
        float diff3 = max(dot(n, l3), 0.0) * 0.3;
        float spec = pow(max(dot(r, l1), 0.0), 48.0);
        float fres = pow(1.0 - max(dot(v, n), 0.0), 3.0);
        float ao = calcAO(p, n, t);

        // Material color based on ID - animated with palette + cyan accents
        vec3 mat;
        float emission = 0.0;

        if (matId < 1.5) {
            // Core - pulsing purple with pink inner glow, cyan edge
            float pulse = sin(t * 1.5) * 0.5 + 0.5;
            float radial = length(p) * 0.2;
            mat = animatedPalette(radial + t * 0.08, t);
            mat = mix(mat, pal[2] * 1.3, pulse * 0.4);
            // Pink warm glow from center
            float pinkGlow = exp(-length(p) * 0.8) * (sin(t * 1.2) * 0.3 + 0.5);
            mat = mix(mat, accentRose, pinkGlow * 0.3);
            // Cyan accent on edges
            float edgeFactor = pow(1.0 - abs(dot(n, v)), 2.0);
            mat = mix(mat, accentCyan, edgeFactor * 0.2 * (sin(t * 2.0) * 0.3 + 0.2));
            emission = 0.3 + 0.15 * sin(t * 2.0);
        } else if (matId < 2.5) {
            // Inner gyroid - blue with cyan streaks and pink highlights
            float wave = sin(p.y * 2.0 + p.x * 1.5 + t * 1.2) * 0.5 + 0.5;
            mat = mix(pal[5], pal[6], wave);
            mat = mix(mat, pal[1], sin(p.z * 2.0 + t * 0.6) * 0.15 + 0.1);
            // Cyan streaks
            float streak = pow(sin(p.y * 4.0 + p.x * 3.0 + t * 1.5) * 0.5 + 0.5, 3.0);
            mat = mix(mat, accentAqua, streak * 0.2);
            // Subtle pink shimmer
            float pinkShimmer = pow(sin(p.x * 3.0 - p.z * 2.0 + t * 1.8) * 0.5 + 0.5, 4.0);
            mat = mix(mat, accentPink, pinkShimmer * 0.15);
            emission = 0.12 + 0.05 * sin(t * 1.8) + streak * 0.08;
        } else if (matId < 3.5) {
            // Outer gyroid - lavender with pink and teal accents
            float shift = sin(p.x * 1.5 + p.z * 1.2 - t * 0.8) * 0.5 + 0.5;
            mat = mix(pal[3], pal[4], shift);
            mat = mix(mat, pal[2], sin(t * 0.5 + p.y) * 0.2);
            // Subtle teal accent
            mat = mix(mat, accentTeal, sin(p.y * 2.0 - t) * 0.06 + 0.03);
            // Soft pink highlights
            float pinkHighlight = pow(sin(p.z * 2.5 + t * 0.9) * 0.5 + 0.5, 3.0);
            mat = mix(mat, accentRose, pinkHighlight * 0.12);
            emission = 0.1 + pinkHighlight * 0.05;
        } else if (matId < 7.0) {
            // Torus rings - alternating cyan and pink accents
            float ringIdx = matId - 4.0;
            float colorCycle = sin(t * 0.6 + ringIdx * 1.5) * 0.5 + 0.5;
            mat = mix(pal[5], pal[6], colorCycle);
            mat = mix(mat, pal[1], sin(t * 0.4 + ringIdx * 2.0) * 0.3 + 0.2);
            // Alternate between cyan and pink based on ring
            float accentPulse = pow(sin(t * 3.0 + ringIdx * 2.5) * 0.5 + 0.5, 2.0);
            if (ringIdx < 1.0) {
                mat = mix(mat, accentCyan, accentPulse * 0.25);
            } else if (ringIdx < 2.0) {
                mat = mix(mat, accentPink, accentPulse * 0.22);
            } else {
                mat = mix(mat, accentMagenta, accentPulse * 0.2);
            }
            emission = 0.18 + 0.08 * sin(t * 2.5 + ringIdx * 2.0) + accentPulse * 0.1;
        } else if (matId < 9.0) {
            // Orbiting spheres - cyan and pink alternating
            float orbIdx = (matId - 7.0) / 2.1;
            int sphereNum = int(mod(orbIdx * 21.0, 21.0));
            float sphereMod = mod(float(sphereNum), 7.0);
            if (sphereMod < 1.0) {
                // Cyan accent spheres
                mat = mix(pal[5], getAccentCyan(orbIdx, t), 0.5);
                emission = 0.35 + 0.15 * sin(t * 4.0 + orbIdx * 3.0);
            } else if (sphereMod < 2.0) {
                // Pink accent spheres
                mat = mix(pal[3], getAccentPink(orbIdx, t), 0.5);
                emission = 0.35 + 0.15 * sin(t * 3.5 + orbIdx * 2.5);
            } else {
                mat = animatedPalette(orbIdx * 0.8 + t * 0.1, t);
                mat = mix(mat, pal[4], 0.2);
                emission = 0.25 + 0.1 * sin(t * 3.0 + orbIdx * 5.0);
            }
        } else {
            // Floating particles - alternating cyan and pink sparkles
            float sparkle = sin(t * 5.0 + matId * 3.0) * 0.5 + 0.5;
            float particleType = mod(matId * 7.0, 2.0);
            if (particleType < 1.0) {
                mat = mix(accentTeal, mix(accentCyan, pal[5], 0.3), sparkle);
            } else {
                mat = mix(accentMagenta, mix(accentPink, pal[3], 0.3), sparkle);
            }
            emission = 0.4 + 0.25 * sin(t * 5.0 + matId);
        }

        // Rim lighting with alternating cyan/pink accent
        vec3 rimColor = mix(pal[5], pal[3], fres);
        // Cycle between cyan and pink rim
        float rimCycle = sin(t * 1.2) * 0.5 + 0.5;
        vec3 rimAccent = mix(accentCyan, accentPink, rimCycle);
        rimColor = mix(rimColor, rimAccent, 0.18);

        // Compose lighting - brighter overall
        col = mat * 0.15; // Ambient
        col += mat * vec3(1.0, 0.95, 0.9) * diff1 * 0.9;
        col += mat * pal[5] * diff2 * 0.4;
        col += mat * pal[1] * diff3;
        col += vec3(1.0, 0.9, 0.85) * spec * 0.7;
        col += rimColor * fres * 0.6;  // Strong rim
        col += mat * emission;
        col *= ao;

        // Subtle edge highlight
        float edge = 1.0 - abs(dot(v, n));
        col += pal[4] * pow(edge, 4.0) * 0.3;

        // Less fog to keep things clear
        float fog = 1.0 - exp(-d * 0.025);
        col = mix(col, bg, fog * 0.4);
    }

    // Animated central glow - palette colors with dual accents
    float glowPulse = 0.35 + 0.1 * sin(t * 1.2);
    vec3 glowColor = animatedPalette(t * 0.06, t);
    glowColor = mix(glowColor, pal[3], 0.3);
    col += glowColor * exp(-length(uv) * 2.0) * glowPulse;
    col += pal[5] * exp(-length(uv) * 3.5) * 0.25;
    col += pal[2] * exp(-length(uv) * 5.0) * 0.18;
    // Alternating cyan and pink glow pulses
    float cyanGlowPulse = pow(sin(t * 2.5) * 0.5 + 0.5, 2.0);
    float pinkGlowPulse = pow(sin(t * 2.0 + 1.5) * 0.5 + 0.5, 2.0);
    col += accentCyan * exp(-length(uv) * 4.0) * cyanGlowPulse * 0.12;
    col += accentRose * exp(-length(uv) * 3.8) * pinkGlowPulse * 0.1;

    // Light rays from center - cycling palette colors
    float rays = sin(atan(uv.y, uv.x) * 8.0 + t * 0.5) * 0.5 + 0.5;
    rays *= exp(-length(uv) * 2.5);
    vec3 rayColor = mix(pal[4], pal[3], sin(t * 0.4) * 0.5 + 0.5); // lavender tones
    col += rayColor * rays * 0.12;

    // Subtle vignette with purple tint
    float vig = 1.0 - length(uv) * 0.25;
    col *= vig;
    col = mix(col, col * (pal[0] * 2.0 + vec3(0.5)), (1.0 - vig) * 0.3);

    // Tone mapping
    col = col / (col + 0.85);
    col = pow(col, vec3(0.44));

    // Boost saturation
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.25);

    // Color grading - enhance purples and blues
    col.b = mix(col.b, col.b * 1.08, smoothstep(0.2, 0.6, luma));
    col.r = mix(col.r, col.r * 1.03, smoothstep(0.3, 0.7, col.b));

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
