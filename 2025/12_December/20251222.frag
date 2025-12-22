out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// Color palette - original cool purples and blues
const vec3 color1 = vec3(0.212, 0.176, 0.471); // deep purple
const vec3 color2 = vec3(0.322, 0.247, 0.639); // royal purple
const vec3 color3 = vec3(0.569, 0.424, 0.800); // lavender
const vec3 color4 = vec3(0.741, 0.631, 0.898); // light purple
const vec3 color5 = vec3(0.784, 0.753, 0.914); // pale lavender
const vec3 color6 = vec3(0.518, 0.729, 0.906); // sky blue
const vec3 color7 = vec3(0.318, 0.416, 0.831); // blue
const vec3 color8 = vec3(0.200, 0.247, 0.529); // navy
const vec3 color9 = vec3(0.08, 0.06, 0.15);    // darker background

// Christmas colors - original
const vec3 snowWhite = vec3(1.0);
const vec3 starGold = vec3(1.0, 0.85, 0.4);
const vec3 warmGlow = vec3(1.0, 0.7, 0.3);
const vec3 treeGreen = vec3(0.1, 0.35, 0.2);
const vec3 ornamentRed = vec3(0.9, 0.2, 0.25);
const vec3 ornamentBlue = vec3(0.3, 0.5, 0.95);
const vec3 moonColor = vec3(0.95, 0.92, 0.85);
const vec3 frostColor = vec3(0.85, 0.95, 1.0);
const vec3 cozyOrange = vec3(1.0, 0.6, 0.3);   // for cabin firelight

// Hash function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(41.1, 289.7))) * 45758.5453);
}

// 2D Noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

// FBM
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// Beautiful snowflake with glow
float snowflake(vec2 uv, float size) {
    float d = length(uv);
    float angle = atan(uv.y, uv.x);

    // 6-fold crystal shape
    float crystal = abs(cos(angle * 3.0));
    float shape = smoothstep(size, size * 0.2, d * (0.8 + crystal * 0.4));

    // Bright center glow
    float glow = exp(-d * 15.0 / size) * 1.5;

    return shape + glow;
}

// Falling snow with parallax
float snowLayer(vec2 uv, float speed, float size, float density) {
    float snow = 0.0;
    vec2 grid = uv * density;
    vec2 id = floor(grid);
    vec2 gv = fract(grid) - 0.5;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(x, y);
            vec2 cellId = id + offset;

            float randX = hash(cellId) - 0.5;
            float randY = hash(cellId + 100.0);
            float randSize = hash(cellId + 200.0) * 0.6 + 0.4;

            float fallOffset = hash(cellId + 300.0) * 6.28;
            float sway = sin(u_time * 0.8 + fallOffset) * 0.15;

            vec2 snowPos = gv - offset - vec2(randX + sway, 0.0);
            snowPos.y += mod(u_time * speed + randY * 10.0, 2.5) - 1.25;

            snow += snowflake(snowPos, size * randSize);
        }
    }
    return snow;
}

// Gentle twinkling stars
float stars(vec2 uv, float density) {
    vec2 grid = uv * density;
    vec2 id = floor(grid);
    vec2 gv = fract(grid) - 0.5;

    float rand = hash(id);
    if (rand > 0.68) {
        vec2 starPos = gv - (vec2(hash(id + 10.0), hash(id + 20.0)) - 0.5) * 0.7;
        float d = length(starPos);

        // Gentle, slow twinkle
        float twinkle = sin(u_time * (1.2 + rand * 1.5) + rand * 6.28) * 0.35 + 0.65;
        twinkle = pow(twinkle, 1.2);

        // Soft star glow
        float star = exp(-d * 45.0) * twinkle * 1.5;

        // Subtle 4-point rays
        float angle = atan(starPos.y, starPos.x);
        float rays = pow(abs(cos(angle * 2.0)), 10.0);
        star += exp(-d * 25.0) * rays * twinkle * 0.6;

        return star;
    }
    return 0.0;
}

// Beautiful Christmas tree with gradient
float christmasTree(vec2 uv, out float treeGrad) {
    uv.x = abs(uv.x);
    float tree = 0.0;
    treeGrad = 0.0;

    // Softer tree layers with smooth edges
    float y1 = uv.y + 0.05;
    float layer1 = smoothstep(0.01, 0.0, uv.x - (0.28 - y1 * 0.55)) * smoothstep(-0.15, -0.05, uv.y) * smoothstep(0.45, 0.35, uv.y);

    float y2 = uv.y + 0.2;
    float layer2 = smoothstep(0.01, 0.0, uv.x - (0.24 - y2 * 0.5)) * smoothstep(-0.3, -0.2, uv.y) * smoothstep(0.15, 0.05, uv.y);

    float y3 = uv.y + 0.32;
    float layer3 = smoothstep(0.01, 0.0, uv.x - (0.2 - y3 * 0.45)) * smoothstep(-0.42, -0.32, uv.y) * smoothstep(-0.02, -0.12, uv.y);

    // Trunk
    float trunk = smoothstep(0.01, 0.0, uv.x - 0.05) * smoothstep(-0.55, -0.45, uv.y) * smoothstep(-0.4, -0.42, uv.y);

    tree = max(max(layer1, layer2), max(layer3, trunk));
    treeGrad = (uv.y + 0.5) * 0.8; // For color gradient

    return tree;
}

// Glowing ornaments
vec3 ornaments(vec2 uv, float treeMask) {
    vec3 col = vec3(0.0);
    if (treeMask < 0.5) return col;

    vec2 grid = uv * 18.0;
    vec2 id = floor(grid);
    vec2 gv = fract(grid) - 0.5;

    float rand = hash(id);
    if (rand > 0.55) {
        vec2 ornPos = gv - (vec2(hash(id + 30.0), hash(id + 40.0)) - 0.5) * 0.4;
        float d = length(ornPos);

        // Pulsing glow
        float pulse = sin(u_time * 2.0 + rand * 6.28) * 0.3 + 0.7;
        float glow = exp(-d * 12.0) * pulse * 1.5;

        // Choose ornament color
        vec3 ornColor;
        float colorChoice = hash(id + 500.0);
        if (colorChoice < 0.3) ornColor = ornamentRed;
        else if (colorChoice < 0.5) ornColor = starGold;
        else if (colorChoice < 0.7) ornColor = ornamentBlue;
        else ornColor = color4;

        col = ornColor * glow;
    }
    return col;
}

// String lights on tree
vec3 stringLights(vec2 uv, float treeMask) {
    vec3 col = vec3(0.0);
    if (treeMask < 0.5) return col;

    // Multiple light strings
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float yLevel = -0.35 + fi * 0.18;

        // Wavy string
        float wave = sin(uv.x * 25.0 + fi * 2.0) * 0.02;
        float stringY = yLevel + wave;

        // Lights along string
        float lightX = fract(uv.x * 8.0 + fi * 0.3 + u_time * 0.1);
        float lightD = abs(uv.y - stringY);

        if (lightD < 0.03 && abs(lightX - 0.5) < 0.15) {
            float brightness = exp(-lightD * 50.0);
            brightness *= sin(u_time * 3.0 + fi + floor(uv.x * 8.0) * 1.5) * 0.4 + 0.6;

            vec3 lightColor = mix(warmGlow, color6, hash(vec2(floor(uv.x * 8.0), fi)));
            col += lightColor * brightness * 0.8;
        }
    }
    return col;
}

// Beautiful 5-pointed star on top
vec3 topStar(vec2 uv) {
    vec2 starUV = uv - vec2(0.0, 0.42);
    float d = length(starUV);
    float angle = atan(starUV.y, starUV.x);

    // Proper 5-pointed star shape using polar coordinates
    float starShape = cos(angle * 2.5 + 1.5708) * 0.4 + 0.6;
    float star5 = smoothstep(0.035 * starShape, 0.01 * starShape, d);

    // Elegant 5 main rays
    float mainRays = pow(abs(cos(angle * 2.5 + 1.5708)), 12.0);
    float rayGlow = exp(-d * 12.0) * mainRays * 0.5;

    // Subtle secondary sparkle rays (10 points)
    float sparkleRays = pow(abs(cos(angle * 5.0 + u_time * 0.3)), 20.0);
    float sparkle = exp(-d * 18.0) * sparkleRays * 0.25;

    // Soft core glow - reduced brightness
    float core = exp(-d * 30.0) * 0.8;
    float outerGlow = exp(-d * 6.0) * 0.2;

    // Gentle pulsing
    float pulse = sin(u_time * 1.8) * 0.1 + 0.9;

    // Combine all elements
    float starBright = (star5 * 0.7 + core + outerGlow + rayGlow + sparkle) * pulse;

    // Color: warm gold center fading to white at edges
    vec3 starCol = mix(starGold, snowWhite * 0.9, smoothstep(0.0, 0.08, d));

    return starCol * starBright * 0.7;  // Overall brightness reduction
}

// Aurora borealis - soft and gentle
vec3 aurora(vec2 uv) {
    vec3 col = vec3(0.0);

    // Soft aurora curtains with pastel colors
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 p = uv * (1.0 + fi * 0.2);
        p.x += u_time * 0.012 * (1.0 + fi * 0.3);  // Slower movement

        // Gentle wave pattern
        float wave = sin(p.x * 1.5 + fi * 0.6) * 0.1;
        wave += sin(p.x * 2.5 + u_time * 0.03 + fi) * 0.06;
        wave += fbm(p * 2.0 + u_time * 0.01) * 0.06;

        // Very subtle shimmer
        float shimmer = sin(uv.y * 15.0 + u_time * 1.0 + fi * 2.0) * 0.01;

        float band = exp(-pow(uv.y - 0.32 - wave - fi * 0.05 + shimmer, 2.0) * 18.0);

        // Original color palette - greens, cyans, purples
        vec3 auroraColor;
        if (fi < 1.0) {
            auroraColor = mix(vec3(0.2, 0.85, 0.4), color6, sin(u_time * 0.08 + fi) * 0.5 + 0.5);
        } else if (fi < 2.5) {
            auroraColor = mix(color6, color3, sin(u_time * 0.1 + fi * 0.4) * 0.5 + 0.5);
        } else {
            auroraColor = mix(color3, vec3(0.6, 0.3, 0.8), sin(u_time * 0.09) * 0.5 + 0.5);
        }

        // Gentle intensity
        float intensity = (0.35 - fi * 0.06) * (sin(u_time * 0.15 + fi * 0.8) * 0.15 + 0.85);
        col += auroraColor * band * intensity;
    }

    // Very subtle vertical rays
    float rays = sin(uv.x * 20.0 + u_time * 0.25) * 0.5 + 0.5;
    rays = pow(rays, 5.0) * 0.05;
    col *= (1.0 + rays);

    return col;
}

// Ground with snow drifts
float snowGround(vec2 uv) {
    float ground = -0.52;  // Lower ground level - less snow area

    // Gentler wavy snow drifts
    ground += sin(uv.x * 3.0) * 0.025;
    ground += sin(uv.x * 7.0 + 1.0) * 0.015;
    ground += fbm(uv * 4.0) * 0.035;

    return smoothstep(ground + 0.015, ground - 0.015, uv.y);
}

// Sparkle particles
float sparkles(vec2 uv) {
    float sp = 0.0;

    for (int i = 0; i < 20; i++) {
        float fi = float(i);
        vec2 pos = vec2(
            hash(vec2(fi, 0.0)) * 2.0 - 1.0,
            hash(vec2(fi, 1.0)) * 1.2 - 0.5
        );

        float t = u_time * 0.5 + hash(vec2(fi, 2.0)) * 6.28;
        pos += vec2(sin(t * 0.7), cos(t * 0.5)) * 0.05;

        float d = length(uv - pos);
        float twinkle = pow(sin(u_time * (4.0 + fi * 0.3) + fi) * 0.5 + 0.5, 3.0);

        sp += exp(-d * 80.0) * twinkle;
    }

    return sp;
}

// Beautiful moon with halo
vec3 moon(vec2 uv) {
    vec2 moonPos = vec2(0.45, 0.38);
    vec2 moonUV = uv - moonPos;
    float d = length(moonUV);

    // Moon disc with slight texture
    float disc = smoothstep(0.08, 0.075, d);
    float texture = fbm(moonUV * 30.0) * 0.15;
    vec3 moonSurface = moonColor * (0.9 + texture);

    // Outer halo glow
    float halo = exp(-d * 8.0) * 0.4;
    float halo2 = exp(-d * 3.0) * 0.15;

    // Rainbow-ish ring effect (like ice crystals)
    float ring = smoothstep(0.12, 0.11, d) * smoothstep(0.09, 0.10, d);
    vec3 ringColor = mix(color6, color4, sin(atan(moonUV.y, moonUV.x) * 3.0) * 0.5 + 0.5);

    vec3 col = moonSurface * disc;
    col += moonColor * halo;
    col += mix(moonColor, color5, 0.5) * halo2;
    col += ringColor * ring * 0.3;

    return col;
}

// Snow/frost on tree edges
float treeFrost(vec2 uv, float treeMask) {
    // Get edge of tree using gradient
    vec2 eps = vec2(0.008, 0.0);
    float tg;
    float dx = christmasTree(uv + eps.xy, tg) - christmasTree(uv - eps.xy, tg);
    float dy = christmasTree(uv + eps.yx, tg) - christmasTree(uv - eps.yx, tg);
    float edge = length(vec2(dx, dy));

    // Add noise to frost
    float frostNoise = fbm(uv * 40.0) * 0.5 + 0.5;
    float frost = edge * frostNoise * 4.0;

    // More frost on upper parts of tree
    frost *= smoothstep(-0.4, 0.3, uv.y);

    return frost * treeMask;
}

// Volumetric light rays from star
vec3 starLightRays(vec2 uv) {
    vec2 starPos = vec2(0.0, 0.42);
    vec2 dir = uv - starPos;
    float d = length(dir);
    float angle = atan(dir.y, dir.x);

    // God rays effect
    float rays = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float rayAngle = fi * 0.785 + u_time * 0.1; // 8 rays, slowly rotating
        float angleDiff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
        float ray = exp(-angleDiff * 8.0) * exp(-d * 2.0);
        rays += ray;
    }

    // Fade based on distance and direction (mostly downward)
    float fade = smoothstep(0.8, 0.0, d) * smoothstep(-0.5, 0.3, -dir.y);

    return warmGlow * rays * fade * 0.15;
}

// Ground sparkles (snow glitter)
float groundSparkles(vec2 uv, float groundMask) {
    if (groundMask < 0.5) return 0.0;

    vec2 grid = uv * 50.0;
    vec2 id = floor(grid);
    vec2 gv = fract(grid) - 0.5;

    float sparkle = 0.0;
    float rand = hash(id);

    if (rand > 0.85) {
        vec2 pos = gv - (vec2(hash(id + 10.0), hash(id + 20.0)) - 0.5) * 0.6;
        float sd = length(pos);
        float twinkle = pow(sin(u_time * (5.0 + rand * 8.0) + rand * 6.28) * 0.5 + 0.5, 4.0);
        sparkle = exp(-sd * 60.0) * twinkle;
    }

    return sparkle;
}

// Gentle shooting stars
vec3 shootingStars(vec2 uv) {
    vec3 col = vec3(0.0);

    for (int i = 0; i < 2; i++) {  // Fewer shooting stars
        float fi = float(i);
        float cycle = mod(u_time * 0.08 + fi * 5.0, 12.0); // Slower, longer cycle

        if (cycle < 2.0) { // Longer visibility, slower motion
            // Starting position
            vec2 startPos = vec2(
                hash(vec2(fi, 100.0)) * 0.7,
                hash(vec2(fi, 200.0)) * 0.25 + 0.38
            );

            // Gentler direction and slower speed
            vec2 dir = normalize(vec2(-1.0, -0.4 - hash(vec2(fi, 300.0)) * 0.2));
            float speed = 0.35 + hash(vec2(fi, 400.0)) * 0.15;

            vec2 pos = startPos + dir * cycle * speed;

            // Softer trail
            vec2 toPoint = uv - pos;
            float alongTrail = dot(toPoint, -dir);
            float perpDist = length(toPoint - alongTrail * (-dir));

            float trail = 0.0;
            if (alongTrail > 0.0 && alongTrail < 0.12) {
                trail = exp(-perpDist * 120.0) * exp(-alongTrail * 18.0);
                trail *= smoothstep(0.0, 0.5, cycle) * smoothstep(2.0, 1.5, cycle);
            }

            // Soft head glow
            float head = exp(-length(uv - pos) * 40.0);
            head *= smoothstep(0.0, 0.4, cycle) * smoothstep(2.0, 1.6, cycle);

            col += (snowWhite * trail * 0.5 + starGold * head * 0.8);
        }
    }

    return col;
}

// Distant snowy hills silhouette
float distantHills(vec2 uv) {
    float hills = 0.0;

    // Layer 1 - far hills
    float h1 = sin(uv.x * 2.0 + 1.0) * 0.04 + sin(uv.x * 5.0) * 0.02;
    h1 += fbm(uv * vec2(3.0, 1.0)) * 0.03;
    hills = smoothstep(-0.32 + h1, -0.34 + h1, uv.y);

    // Layer 2 - closer hills
    float h2 = sin(uv.x * 3.0 - 0.5) * 0.05 + sin(uv.x * 7.0 + 2.0) * 0.02;
    h2 += fbm(uv * vec2(4.0, 1.0) + 10.0) * 0.04;
    float hills2 = smoothstep(-0.38 + h2, -0.40 + h2, uv.y);

    return max(hills * 0.3, hills2 * 0.5);
}

// Reflection of tree/star glow on snow
vec3 snowReflection(vec2 uv, float groundMask) {
    if (groundMask < 0.5) return vec3(0.0);

    vec3 col = vec3(0.0);

    // Reflected star glow - adjusted for lower ground
    float starDist = length(uv - vec2(0.0, -0.62));
    float starRefl = exp(-starDist * 3.5) * 0.2;
    col += starGold * starRefl;

    // Green tree reflection
    float treeWidth = 0.2 * (1.0 + (uv.y + 0.55) * 0.4);
    float treeDist = abs(uv.x) / treeWidth;
    float treeRefl = exp(-treeDist * 2.5) * smoothstep(-0.65, -0.52, uv.y) * 0.12;
    col += treeGreen * 1.5 * treeRefl;

    // Shimmer on reflection
    float shimmer = sin(uv.x * 40.0 + u_time * 2.0) * sin(uv.y * 30.0 - u_time) * 0.5 + 0.5;
    col *= (0.8 + shimmer * 0.4);

    return col;
}

// Gift boxes under tree
vec3 giftBoxes(vec2 uv) {
    vec3 col = vec3(0.0);

    // Gift 1 - red box (left) - adjusted for lower ground
    vec2 box1 = uv - vec2(-0.10, -0.56);
    if (abs(box1.x) < 0.035 && box1.y > -0.03 && box1.y < 0.03) {
        col = ornamentRed * 0.9;
        // Ribbon
        if (abs(box1.x) < 0.007 || abs(box1.y) < 0.005) {
            col = starGold;
        }
        // Bow
        float bowDist = length(box1 - vec2(0.0, 0.03));
        if (bowDist < 0.018) {
            col = starGold * (1.0 + exp(-bowDist * 80.0) * 0.5);
        }
        // Shading
        col *= 0.8 + box1.x * 3.0 + box1.y * 2.0;
    }

    // Gift 2 - blue box (right)
    vec2 box2 = uv - vec2(0.08, -0.57);
    if (abs(box2.x) < 0.03 && box2.y > -0.025 && box2.y < 0.025) {
        col = ornamentBlue * 0.9;
        // Ribbon
        if (abs(box2.x) < 0.005 || abs(box2.y) < 0.004) {
            col = snowWhite * 0.95;
        }
        // Bow
        float bowDist2 = length(box2 - vec2(0.0, 0.025));
        if (bowDist2 < 0.015) {
            col = snowWhite * (0.9 + exp(-bowDist2 * 80.0) * 0.3);
        }
        col *= 0.8 + box2.x * 2.5 + box2.y * 2.0;
    }

    // Gift 3 - small gold box (center)
    vec2 box3 = uv - vec2(-0.01, -0.565);
    if (abs(box3.x) < 0.022 && box3.y > -0.018 && box3.y < 0.018) {
        col = starGold * 0.85;
        if (abs(box3.x) < 0.004 || abs(box3.y) < 0.004) {
            col = ornamentRed;
        }
        col *= 0.85 + box3.x * 3.0 + box3.y * 2.5;
    }

    return col;
}

// Soft cloud wisps
vec3 cloudWisps(vec2 uv) {
    vec3 col = vec3(0.0);

    // Subtle high clouds
    float cloud1 = fbm(uv * vec2(2.0, 4.0) + vec2(u_time * 0.02, 0.0));
    cloud1 = smoothstep(0.45, 0.7, cloud1) * smoothstep(0.6, 0.3, uv.y) * smoothstep(0.15, 0.25, uv.y);

    float cloud2 = fbm(uv * vec2(3.0, 5.0) + vec2(u_time * 0.015 + 5.0, 0.0));
    cloud2 = smoothstep(0.5, 0.75, cloud2) * smoothstep(0.7, 0.35, uv.y) * smoothstep(0.2, 0.35, uv.y);

    col = mix(color5, snowWhite, 0.5) * (cloud1 * 0.08 + cloud2 * 0.06);

    return col;
}

// Magical floating particles - gentle and warm
vec3 magicParticles(vec2 uv) {
    vec3 col = vec3(0.0);

    for (int i = 0; i < 12; i++) {
        float fi = float(i);

        // Slow, dreamy floating path
        float t = u_time * (0.08 + hash(vec2(fi, 0.0)) * 0.05);  // Much slower
        vec2 pos = vec2(
            sin(t * 1.0 + fi * 0.6) * 0.3 + cos(t * 0.5 + fi) * 0.12,
            sin(t * 0.7 + fi * 0.9) * 0.22 + cos(t * 0.35) * 0.08
        );
        pos += vec2(hash(vec2(fi, 1.0)) - 0.5, hash(vec2(fi, 2.0)) * 0.35) * 0.45;

        float d = length(uv - pos);

        // Gentle breathing glow
        float pulse = sin(u_time * 1.5 + fi * 2.0) * 0.4 + 0.6;  // Slower pulse
        pulse = pow(pulse, 1.5);

        // Soft, diffuse particle glow
        float glow = exp(-d * 35.0) * pulse;

        // Warm color palette - golds and soft pinks
        vec3 particleCol;
        float colorSel = hash(vec2(fi, 3.0));
        if (colorSel < 0.5) particleCol = starGold * 0.9;
        else if (colorSel < 0.75) particleCol = cozyOrange * 0.7;
        else particleCol = vec3(1.0, 0.8, 0.85);  // Soft warm pink

        col += particleCol * glow * 0.4;
    }

    return col;
}

// Distant cabin with cozy warm window glow
vec3 distantCabin(vec2 uv) {
    vec3 col = vec3(0.0);

    vec2 cabinPos = vec2(-0.42, -0.44);
    vec2 cabinUV = uv - cabinPos;

    // Cabin silhouette
    float cabin = 0.0;

    // Main body
    if (abs(cabinUV.x) < 0.035 && cabinUV.y > -0.025 && cabinUV.y < 0.015) {
        cabin = 1.0;
    }

    // Roof (triangle)
    float roofY = cabinUV.y - 0.015;
    if (roofY > 0.0 && roofY < 0.025 && abs(cabinUV.x) < (0.045 - roofY * 1.2)) {
        cabin = 1.0;
    }

    // Chimney
    if (cabinUV.x > 0.015 && cabinUV.x < 0.025 && cabinUV.y > 0.02 && cabinUV.y < 0.045) {
        cabin = 1.0;
    }

    // Dark cabin silhouette with warm tint
    col = mix(col, color9 * 0.4, cabin);

    // Cozy warm window glow - enhanced
    vec2 windowUV = cabinUV - vec2(-0.012, -0.005);
    if (abs(windowUV.x) < 0.012 && abs(windowUV.y) < 0.012) {
        float windowGlow = 1.0 - length(windowUV) * 25.0;
        windowGlow = max(0.0, windowGlow);
        // Flickering firelight effect
        float flicker = sin(u_time * 8.0) * 0.05 + sin(u_time * 12.0) * 0.03 + 0.92;
        col = cozyOrange * (0.75 + windowGlow * 0.25) * flicker;

        // Window frame
        if (abs(windowUV.x) < 0.002 || abs(windowUV.y) < 0.002) {
            col *= 0.25;
        }
    }

    // Warm light spill from window onto snow - enhanced
    float lightSpill = exp(-length(cabinUV - vec2(-0.012, -0.035)) * 10.0) * 0.4;
    float lightSpill2 = exp(-length(cabinUV - vec2(-0.02, -0.025)) * 12.0) * 0.2;
    col += cozyOrange * (lightSpill + lightSpill2);

    // Soft ambient glow around cabin
    float ambientGlow = exp(-length(cabinUV) * 6.0) * 0.15;
    col += warmGlow * ambientGlow;

    // Gentle smoke from chimney - slower
    vec2 smokeUV = cabinUV - vec2(0.02, 0.05);
    float smokeTime = u_time * 0.25;  // Slower smoke
    smokeUV.x += sin(smokeUV.y * 12.0 + smokeTime) * 0.008;
    float smoke = exp(-length(smokeUV * vec2(2.5, 0.8)) * 6.0);
    smoke *= smoothstep(0.0, 0.025, smokeUV.y);
    col += vec3(0.7, 0.68, 0.72) * smoke * 0.12;

    return col;
}

// Lens flare from star
vec3 lensFlare(vec2 uv) {
    vec3 col = vec3(0.0);
    vec2 starPos = vec2(0.0, 0.42);
    vec2 dir = uv - starPos;
    float d = length(dir);

    // Main flare elements along the line from star to center
    vec2 flareDir = normalize(-starPos);

    for (int i = 1; i < 5; i++) {
        float fi = float(i);
        vec2 flarePos = starPos + flareDir * fi * 0.15;
        float flareDist = length(uv - flarePos);

        // Hexagonal flare shape
        float angle = atan(uv.y - flarePos.y, uv.x - flarePos.x);
        float hex = cos(angle * 3.0) * 0.3 + 0.7;

        float flare = exp(-flareDist * (20.0 + fi * 5.0) / hex) * (0.15 - fi * 0.025);

        // Color shifts for each flare
        vec3 flareCol = mix(starGold, color6, fi * 0.2);
        col += flareCol * flare;
    }

    // Anamorphic streak (horizontal)
    float streak = exp(-abs(dir.y) * 80.0) * exp(-abs(dir.x) * 3.0) * 0.2;
    col += mix(starGold, snowWhite, 0.5) * streak;

    return col * 0.4;
}

// Pine tree silhouettes on distant hills
float pineTreeSilhouette(vec2 uv, vec2 pos, float size) {
    vec2 treeUV = (uv - pos) / size;
    treeUV.x = abs(treeUV.x);

    // Simple triangular pine shape
    float tree = 0.0;
    if (treeUV.y > 0.0 && treeUV.y < 1.0) {
        float width = (1.0 - treeUV.y) * 0.4;
        tree = smoothstep(width + 0.05, width, treeUV.x);
    }
    // Trunk
    if (treeUV.y > -0.15 && treeUV.y < 0.0 && treeUV.x < 0.06) {
        tree = 1.0;
    }

    return tree;
}

vec3 distantTrees(vec2 uv) {
    float trees = 0.0;

    // Row of trees on hills
    trees += pineTreeSilhouette(uv, vec2(-0.55, -0.38), 0.06);
    trees += pineTreeSilhouette(uv, vec2(-0.48, -0.40), 0.045);
    trees += pineTreeSilhouette(uv, vec2(-0.35, -0.42), 0.035);
    trees += pineTreeSilhouette(uv, vec2(0.50, -0.39), 0.05);
    trees += pineTreeSilhouette(uv, vec2(0.58, -0.41), 0.04);
    trees += pineTreeSilhouette(uv, vec2(0.38, -0.43), 0.03);

    trees = min(trees, 1.0);

    return vec3(trees) * color9 * 0.5;
}

// Enhanced ornaments with glass reflection
vec3 enhancedOrnaments(vec2 uv, float treeMask) {
    vec3 col = vec3(0.0);
    if (treeMask < 0.5) return col;

    vec2 grid = uv * 16.0;
    vec2 id = floor(grid);
    vec2 gv = fract(grid) - 0.5;

    float rand = hash(id);
    if (rand > 0.6) {
        vec2 ornPos = gv - (vec2(hash(id + 30.0), hash(id + 40.0)) - 0.5) * 0.35;
        float d = length(ornPos);
        float ornSize = 0.12 + hash(id + 60.0) * 0.05;

        if (d < ornSize) {
            // Base ornament color
            vec3 ornColor;
            float colorChoice = hash(id + 500.0);
            if (colorChoice < 0.25) ornColor = ornamentRed;
            else if (colorChoice < 0.45) ornColor = starGold;
            else if (colorChoice < 0.65) ornColor = ornamentBlue;
            else if (colorChoice < 0.8) ornColor = vec3(0.8, 0.2, 0.7); // Purple
            else ornColor = vec3(0.2, 0.8, 0.5); // Teal

            // Sphere shading
            float sphere = sqrt(max(0.0, 1.0 - (d / ornSize) * (d / ornSize)));

            // Specular highlight (glass reflection)
            vec2 highlightPos = ornPos + vec2(0.03, 0.03);
            float highlight = exp(-length(highlightPos) * 40.0);

            // Secondary highlight
            vec2 highlight2Pos = ornPos + vec2(-0.02, 0.04);
            float highlight2 = exp(-length(highlight2Pos) * 60.0) * 0.5;

            // Pulsing glow
            float pulse = sin(u_time * 2.0 + rand * 6.28) * 0.2 + 0.8;

            // Combine
            col = ornColor * sphere * pulse;
            col += snowWhite * highlight * 0.8;
            col += snowWhite * highlight2 * 0.4;

            // Rim light
            float rim = smoothstep(ornSize * 0.5, ornSize, d);
            col += ornColor * rim * 0.3;
        }
    }
    return col;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 centeredUV = (gl_FragCoord.xy - u_resolution.xy * 0.5) / min(u_resolution.x, u_resolution.y);

    // === Rich background gradient with deeper colors ===
    vec3 col = mix(color9 * 0.7, color1 * 0.5, pow(uv.y, 0.5));
    col = mix(col, color8 * 0.6, smoothstep(0.25, 0.95, uv.y));

    // === Subtle cloud wisps ===
    col += cloudWisps(centeredUV);

    // === Aurora (behind stars) ===
    col += aurora(centeredUV) * 0.85;

    // === Shooting stars ===
    col += shootingStars(centeredUV);

    // === Stars - three layers for depth ===
    float starLayer1 = stars(centeredUV, 10.0);
    float starLayer2 = stars(centeredUV + 50.0, 18.0) * 0.7;
    float starLayer3 = stars(centeredUV + 100.0, 30.0) * 0.4;
    col += snowWhite * starLayer1 * 1.2;
    col += mix(snowWhite, starGold, 0.4) * starLayer2;
    col += mix(snowWhite, color6, 0.3) * starLayer3;

    // === Floating sparkles ===
    col += snowWhite * sparkles(centeredUV) * 0.35;

    // === Distant snowy hills ===
    float hills = distantHills(centeredUV);
    vec3 hillColor = mix(color8 * 0.6, color5 * 0.4, hills);
    col = mix(col, hillColor, hills * 0.7);

    // === Pine tree silhouettes on hills ===
    col += distantTrees(centeredUV);

    // === Distant cabin with warm glow ===
    col += distantCabin(centeredUV);

    // === Volumetric light rays from star ===
    col += starLightRays(centeredUV + vec2(0.0, 0.1));

    // === Christmas tree ===
    vec2 treeUV = centeredUV + vec2(0.0, 0.1);
    float treeGrad;
    float tree = christmasTree(treeUV, treeGrad);

    // Tree with richer green gradient and lighting
    vec3 treeCol = mix(treeGreen * 0.5, treeGreen * 1.3, treeGrad);
    treeCol += vec3(0.0, 0.15, 0.08) * (1.0 - treeGrad); // Lighter at top

    // Add subtle lighting from the star above
    float starLight = smoothstep(0.5, -0.2, centeredUV.y + 0.1) * 0.3;
    treeCol += warmGlow * starLight * 0.25;

    col = mix(col, treeCol, tree);

    // === Snow/frost on tree edges ===
    float frost = treeFrost(treeUV, tree);
    col += frostColor * frost * 0.5;

    // === Tree decorations (enhanced glass ornaments) ===
    col += enhancedOrnaments(treeUV, tree);
    col += stringLights(treeUV, tree);

    // === Glowing star on top ===
    col += topStar(centeredUV + vec2(0.0, 0.1));

    // === Lens flare from star ===
    col += lensFlare(centeredUV + vec2(0.0, 0.1));

    // === Snow ground ===
    float ground = snowGround(centeredUV);
    vec3 groundCol = mix(snowWhite * 0.9, color5, 0.12);
    groundCol += fbm(centeredUV * 12.0) * 0.06; // Subtle texture

    // Add blue shadows in snow
    float shadowArea = smoothstep(0.2, -0.3, centeredUV.x - centeredUV.y * 0.3);
    groundCol = mix(groundCol, groundCol * vec3(0.82, 0.86, 1.0), shadowArea * 0.35);

    col = mix(col, groundCol, ground);

    // === Snow reflection of tree and star ===
    col += snowReflection(centeredUV, ground);

    // === Gift boxes under tree ===
    vec3 gifts = giftBoxes(centeredUV + vec2(0.0, 0.1));
    if (length(gifts) > 0.01) {
        col = gifts;
    }

    // === Ground sparkles (snow glitter) ===
    col += snowWhite * groundSparkles(centeredUV, ground) * 0.9;

    // === Magical floating particles ===
    col += magicParticles(centeredUV);

    // === Falling snow - very sparse and gentle ===
    float snow1 = snowLayer(centeredUV, 0.06, 0.02, 1.8);   // Very few, slow
    float snow2 = snowLayer(centeredUV + 10.0, 0.04, 0.012, 2.5) * 0.3;

    col += snowWhite * snow1 * 0.4;
    col += snowWhite * snow2 * 0.25;

    // === Soft vignette ===
    float vig = 1.0 - pow(length(centeredUV * vec2(0.6, 0.4)) * 0.7, 2.5);
    col *= mix(0.65, 1.0, vig);

    // === Gentle color grading (preserving cool tones) ===
    col.r = pow(col.r, 0.95);
    col.b = pow(col.b, 0.92);

    // Soft bloom effect
    float brightness = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 bloom = col * smoothstep(0.5, 1.0, brightness) * 0.12;
    col += bloom;

    // Gentle saturation and brightness
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.08);
    col = pow(col, vec3(0.9));

    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
