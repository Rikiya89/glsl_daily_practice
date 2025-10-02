// TouchDesigner GLSL TOP - Pixel Shader
// Enhanced raymarch scene with flowing geometries and ethereal lighting

out vec4 fragColor;

uniform float u_time;
uniform vec2  u_resolution;

// ------------------------------
// Enhanced Quality Settings
// ------------------------------
const int   MAX_STEPS  = 64;
const float MAX_DIST   = 120.0;
const float SURF_DIST  = 0.0005;
const float FOV        = 1.8;

// ------------------------------
// Black & White Palette
// ------------------------------
const int PALETTE_COUNT = 10;
const vec3 PALETTE[PALETTE_COUNT] = vec3[PALETTE_COUNT](
    vec3(0.0, 0.0, 0.0),       // Black
    vec3(0.15, 0.15, 0.15),    // Very dark gray
    vec3(0.28, 0.28, 0.28),    // Dark gray
    vec3(0.42, 0.42, 0.42),    // Medium-dark gray
    vec3(0.55, 0.55, 0.55),    // Medium gray
    vec3(0.68, 0.68, 0.68),    // Medium-light gray
    vec3(0.80, 0.80, 0.80),    // Light gray
    vec3(0.90, 0.90, 0.90),    // Very light gray
    vec3(0.97, 0.97, 0.97),    // Near white
    vec3(1.0, 1.0, 1.0)        // White
);

mat2 rot(float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

mat3 rotX(float a){
    float s = sin(a), c = cos(a);
    return mat3(1,0,0, 0,c,-s, 0,s,c);
}

mat3 rotY(float a){
    float s = sin(a), c = cos(a);
    return mat3(c,0,s, 0,1,0, -s,0,c);
}

mat3 rotZ(float a){
    float s = sin(a), c = cos(a);
    return mat3(c,-s,0, s,c,0, 0,0,1);
}

// 4D rotation matrices for Tesseract
vec4 rotXW(vec4 p, float a){
    float s = sin(a), c = cos(a);
    return vec4(c*p.x - s*p.w, p.y, p.z, s*p.x + c*p.w);
}

vec4 rotYW(vec4 p, float a){
    float s = sin(a), c = cos(a);
    return vec4(p.x, c*p.y - s*p.w, p.z, s*p.y + c*p.w);
}

vec4 rotZW(vec4 p, float a){
    float s = sin(a), c = cos(a);
    return vec4(p.x, p.y, c*p.z - s*p.w, s*p.z + c*p.w);
}

vec4 rotXY4D(vec4 p, float a){
    float s = sin(a), c = cos(a);
    return vec4(c*p.x - s*p.y, s*p.x + c*p.y, p.z, p.w);
}

// Project 4D point to 3D
vec3 project4D(vec4 p){
    float w = 2.0; // Distance from 4D to 3D projection plane
    float scale = w / (w + p.w);
    return p.xyz * scale;
}

vec3 palette(float t){
    t = clamp(t, 0.0, 0.9999);
    float scaled = t * float(PALETTE_COUNT - 1);
    int idx = int(floor(scaled));
    int nextIdx = min(idx + 1, PALETTE_COUNT - 1);
    float f = fract(scaled);
    return mix(PALETTE[idx], PALETTE[nextIdx], smoothstep(0.0, 1.0, f));
}

float hash12(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p){
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p){
    p = fract(p * vec3(.1031, .1030, .0973));
    p += dot(p, p.yxz+33.33);
    return fract((p.xxy + p.yxx)*p.zyx);
}

vec3 toneMapFilmic(vec3 x){
    x = max(vec3(0.0), x - 0.004);
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

float sdSphere(vec3 p, float r){
    return length(p) - r;
}

float sdTorus(vec3 p, vec2 t){
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdBox(vec3 p, vec3 b){
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdOctahedron(vec3 p, float s){
    p = abs(p);
    return (p.x+p.y+p.z-s)*0.57735027;
}

float displace(vec3 p, float t){
    return sin(p.x*2.0 + t)*sin(p.y*2.0 + t)*sin(p.z*2.0 + t)*0.1;
}

// Space repetition for infinite patterns
vec3 opRep(vec3 p, vec3 c){
    return mod(p + 0.5*c, c) - 0.5*c;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r){
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h) - r;
}

// Menger sponge iteration for fractal detail
float sdMenger(vec3 p, float scale){
    float d = sdBox(p, vec3(1.0)) * scale;
    vec3 q = p;
    float s = 1.0;
    for(int i = 0; i < 3; i++){
        vec3 a = mod(q * s, 2.0) - 1.0;
        s *= 3.0;
        vec3 r = abs(1.0 - 3.0 * abs(a));
        float da = max(r.x, r.y);
        float db = max(r.y, r.z);
        float dc = max(r.z, r.x);
        float c = (min(da, min(db, dc)) - 1.0) / s;
        d = max(d, c);
    }
    return d;
}

float smin(float a, float b, float k){
    float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0 - h);
}

float mapScene(vec3 p, out vec3 albedo, out float glow){
    float t = u_time * 0.3;

    // Central rotating structure
    vec3 q = p;
    q = rotY(t*0.4) * rotZ(t*0.15) * q;

    // Fractal Menger sponge centerpiece
    vec3 qMenger = rotX(t*0.6) * rotY(t*0.5) * q;
    float menger = sdMenger(qMenger * 0.7, 1.4);

    // Create delicate repeating lattice structure
    vec3 qRep = opRep(q, vec3(4.2, 4.2, 4.2));
    float lattice = sdBox(qRep, vec3(1.6, 0.03, 0.03));
    lattice = min(lattice, sdBox(qRep, vec3(0.03, 1.6, 0.03)));
    lattice = min(lattice, sdBox(qRep, vec3(0.03, 0.03, 1.6)));

    // Add spheres at lattice intersections
    vec3 qLatticeCorner = opRep(q, vec3(4.2, 4.2, 4.2));
    float latticeSpheres = sdSphere(qLatticeCorner, 0.12);

    // Elegant twisted torus with flowing deformation
    vec3 q2 = rotZ(t*0.3) * rotX(sin(t*0.25)*0.6) * q;
    q2.xy = rot(q2.z*0.4 + t*0.5) * q2.xy;
    float mainTorus = sdTorus(q2, vec2(2.2, 0.18 + 0.12*sin(t*1.8)));

    // Multiple orbiting elements with trails
    vec3 orbit1 = vec3(2.8*sin(t*0.7), 0.8*sin(t*1.1), 2.8*cos(t*0.7));
    float orb1 = sdSphere(q - orbit1, 0.25);
    vec3 trailA = rotY(t*0.7) * vec3(2.8, 0.8*sin(t*1.1), 0.0);
    vec3 trailB = rotY(t*0.7 - 0.4) * vec3(2.8, 0.8*sin(t*1.1 - 0.4), 0.0);
    float trail1 = sdCapsule(q, trailA, trailB, 0.06);

    // Second orbit on different axis
    vec3 orbit2 = vec3(1.8*cos(t*0.9), 2.2*cos(t*0.5), 1.8*sin(t*0.9));
    float orb2 = sdSphere(q - orbit2, 0.2);

    // Inner rotating multi-layer octahedron
    vec3 q3 = rotY(t*1.0) * rotX(t*0.8) * q;
    float innerOcta = sdOctahedron(q3, 0.9 + 0.15*sin(t*1.3));
    vec3 q3b = rotY(t*1.5 + 1.57) * rotZ(t*0.7) * q;
    float innerOcta2 = sdOctahedron(q3b, 0.75);

    // Intricate surface detail
    float detail = sin(q.x*8.0 + t*0.5)*sin(q.y*8.0 - t*0.3)*sin(q.z*8.0 + t*0.7)*0.04;
    float microDetail = sin(q.x*20.0)*sin(q.y*20.0)*sin(q.z*20.0)*0.015;

    // Combine shapes with artistic blending
    float d = smin(lattice, latticeSpheres, 0.15);
    d = smin(d, mainTorus, 0.35);
    d = smin(d, menger, 0.28);
    d = smin(d, orb1, 0.22);
    d = min(d, trail1);
    d = smin(d, orb2, 0.2);
    d = smin(d, innerOcta, 0.38);
    d = smin(d, innerOcta2, 0.32);
    d += detail + microDetail;

    // Sophisticated color gradient mapping
    float contrast = 0.5 + 0.25*sin(length(q)*1.8 + t*0.6);
    contrast += 0.18*cos(q.y*2.5 - t*0.4);
    contrast += 0.12*sin(q.x*3.0)*sin(q.z*3.0);
    contrast += 0.08*sin(length(q.xz)*4.0 + t);
    // Add fractal-like variation
    contrast += 0.1*sin(q.x*12.0 + q.y*8.0)*cos(q.z*10.0);
    albedo = palette(fract(contrast));

    // Enhanced glow at intersections
    float energy = 0.0;
    energy += exp(-abs(lattice - mainTorus)*5.0) * 0.7;
    energy += exp(-abs(menger - mainTorus)*4.0) * 0.6;
    energy += exp(-abs(innerOcta - innerOcta2)*6.0) * 0.55;
    energy += exp(-abs(orb1 - mainTorus)*5.0) * 0.5;
    energy += exp(-abs(menger - innerOcta)*4.5) * 0.6;
    energy += smoothstep(0.12, 0.0, trail1) * 0.4;

    glow = 0.25 + energy + 0.15*sin(t*1.8 + length(p)*0.6);

    return d;
}

float mapDist(vec3 p){
    vec3 c; float g;
    return mapScene(p, c, g);
}

vec3 calcNormal(vec3 p){
    const vec2 e = vec2(1e-3, 0.0);
    return normalize(vec3(
        mapDist(p + vec3(e.x, e.y, e.y)) - mapDist(p - vec3(e.x, e.y, e.y)),
        mapDist(p + vec3(e.y, e.x, e.y)) - mapDist(p - vec3(e.y, e.x, e.y)),
        mapDist(p + vec3(e.y, e.y, e.x)) - mapDist(p - vec3(e.y, e.y, e.x))
    ));
}

// Ambient occlusion for depth perception
float calcAO(vec3 p, vec3 n){
    float ao = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++){
        float hr = 0.01 + 0.12 * float(i) / 4.0;
        vec3 aopos = n * hr + p;
        float dd = mapDist(aopos);
        ao += -(dd - hr) * sca;
        sca *= 0.85;
    }
    return clamp(1.0 - 2.5 * ao, 0.0, 1.0);
}

vec3 postProcess(vec3 color, vec2 uv){
    float r = length(uv);

    // Enhanced vignette for dramatic framing
    float vig = 1.0 - smoothstep(0.25, 1.35, r);
    vig = pow(vig, 0.8);
    color *= mix(0.5, 1.15, vig);

    // Subtle lens distortion for organic feel
    vec2 distUV = uv * (1.0 + 0.08 * r * r);

    // Refined film grain (animated)
    float grain = (hash12(uv * u_resolution + vec2(u_time*0.13, u_time*0.09)) - 0.5);
    grain *= 0.012;
    color += grain;

    // Subtle scanlines for texture
    float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.02;
    color *= 1.0 + scanline * (0.5 + 0.5*sin(u_time*0.3));

    // Contrast boost for B&W drama
    color = (color - 0.5) * 1.18 + 0.5;

    // S-curve for filmic response
    color = color * color * (3.0 - 2.0 * color);

    // Tone mapping with enhanced contrast
    color = toneMapFilmic(color * 1.35);

    // Subtle edge glow/bloom
    float edgeGlow = smoothstep(0.9, 1.0, max(max(color.r, color.g), color.b));
    color += edgeGlow * 0.15;

    return clamp(color, 0.0, 1.0);
}

vec3 camRay(vec3 ro, vec3 ta, vec2 uv){
    vec3 fw = normalize(ta - ro);
    vec3 rt = normalize(cross(vec3(0.0,1.0,0.0), fw));
    vec3 up = cross(fw, rt);
    return normalize(uv.x * rt * FOV + uv.y * up * FOV + fw);
}

vec3 background(vec3 rd, float t){
    float h = clamp(0.5 + 0.5*rd.y, 0.0, 1.0);
    float r = length(rd.xz);

    // Colorful starfield with depth layers
    vec3 stars = vec3(0.0);
    for(int i = 0; i < 5; i++){
        float layer = 30.0 + float(i)*25.0;
        vec2 grid = floor(rd.xz * layer);
        vec2 id = grid + vec2(float(i)*13.7, float(i)*7.3);
        float star = hash12(id);
        if(star > 0.992){
            vec2 gv = fract(rd.xz * layer) - 0.5;
            float d = length(gv);
            float twinkle = 0.5 + 0.5*sin(t*2.5 + star*31.4 + float(i)*2.1);
            float brightness = smoothstep(0.1, 0.0, d) * (star - 0.992) * 70.0 * twinkle;
            float size = 0.7 + 0.6*hash12(id + vec2(7.13, 3.71));
            vec3 starColor = palette(fract(star*4.7 + t*0.05 + float(i)*0.33));
            stars += brightness * size * starColor;
        }
    }

    // Vibrant color gradient with shifting hues
    float gradientShift = t*0.03 + sin(t*0.08)*0.5;
    float waveA = 0.12 + 0.25*sin(gradientShift);
    float waveB = 0.62 + 0.30*sin(gradientShift + 3.14 + rd.x*2.0);

    vec3 colorA = palette(fract(waveA));
    vec3 colorB = palette(fract(waveB));
    vec3 colorC = palette(fract(waveA + 0.33));

    float blend1 = smoothstep(0.0, 0.7, h);
    float blend2 = smoothstep(0.3, 1.0, h);
    float radialMod = 0.5 + 0.5*sin(r*3.0 + t*0.2);

    vec3 gradient = mix(colorA, colorB, blend1);
    gradient = mix(gradient, colorC, blend2 * 0.3);
    gradient *= 0.7 + 0.4*radialMod;

    // Colorful volumetric rays
    float rays = abs(sin(rd.x*10.0 + rd.y*4.0 + t*0.25));
    rays *= abs(cos(rd.z*7.0 - rd.x*3.0 - t*0.35));
    rays = pow(rays, 6.0) * 0.3;
    rays *= smoothstep(0.0, 0.4, h);
    vec3 rayColor = palette(fract(0.7 + t*0.06));

    // Aurora-like effect
    float aurora = abs(sin(rd.y*8.0 + rd.x*5.0 + t*0.7)) *
                   abs(cos(rd.y*6.0 - rd.z*4.0 + t*0.5));
    aurora = pow(aurora, 3.0) * 0.25;
    vec3 auroraColor = palette(fract(0.8 + t*0.08 + aurora*2.0));

    vec3 bg = gradient * 0.6 + stars + rays * rayColor + aurora * auroraColor;

    return bg;
}

vec3 render(vec2 fragCoord){
    vec2 uv = (fragCoord - 0.5 * u_resolution) / u_resolution.y;

    float t = u_time * 0.3;

    // Cinematic camera movement with smooth easing
    float rad = 5.5 + 1.2*sin(t*0.4) + 0.6*cos(t*0.25);
    float height = 2.5 + 1.8*sin(t*0.35) + 0.8*cos(t*0.6);
    float camOrbit = t*0.2 + 0.5*sin(t*0.12);

    // Add subtle up/down swooping motion
    float swoop = 0.6*sin(t*0.28);

    vec3 ro = vec3(rad * sin(camOrbit), height + swoop, rad * cos(camOrbit));

    // Dynamic look-at target with gentle drift
    vec3 ta = vec3(
        0.8*sin(t*0.25),
        0.5*sin(t*0.5) + 0.3*cos(t*0.35),
        0.8*cos(t*0.22)
    );

    vec3 rd = camRay(ro, ta, uv);

    float travel = 0.0;
    for(int i = 0; i < MAX_STEPS; ++i){
        vec3 pos = ro + rd * travel;

        vec3 albedo;
        float glow;
        float d = mapScene(pos, albedo, glow);

        if(d < SURF_DIST){
            vec3 n = calcNormal(pos);
            float ao = calcAO(pos, n);

            // Colorful key light
            vec3 lp1 = vec3(4.5*sin(t*0.75), 4.0, 4.5*cos(t*0.75));
            vec3 l1 = normalize(lp1 - pos);
            float diff1 = max(dot(n, l1), 0.0);
            vec3 ltCol1 = palette(fract(0.08 + t*0.1 + sin(t*1.5)*0.1));

            // Colorful fill light
            vec3 lp2 = vec3(-2.5*sin(t*0.45), -1.2, -2.5*cos(t*0.45));
            vec3 l2 = normalize(lp2 - pos);
            float diff2 = max(dot(n, l2), 0.0) * 0.4;
            vec3 ltCol2 = palette(fract(0.45 + t*0.08 + cos(t*1.2)*0.1));

            // Accent back light
            vec3 lp3 = vec3(sin(t*0.6)*2.0, 0.0, cos(t*0.6)*2.0);
            vec3 l3 = normalize(lp3 - pos);
            float diff3 = max(dot(n, l3), 0.0) * 0.3;
            vec3 ltCol3 = palette(fract(0.78 + t*0.12 + sin(t*0.9)*0.1));

            // Colorful rim lighting
            float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
            float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);

            // Multiple specular highlights
            vec3 h1 = normalize(l1 - rd);
            float spec1 = pow(max(dot(n, h1), 0.0), 40.0);
            vec3 h2 = normalize(l2 - rd);
            float spec2 = pow(max(dot(n, h2), 0.0), 20.0);

            vec3 col = vec3(0.0);

            // Colored diffuse lighting with AO
            col += albedo * (0.1 + 1.2 * diff1) * ao;
            col += albedo * ltCol2 * diff2 * 0.45 * ao;
            col += albedo * ltCol3 * diff3 * 0.35;

            // Colored rim lighting
            col += ltCol1 * rim * 0.7 * ao;

            // Bright specular highlights
            col += ltCol1 * spec1 * 0.8;
            col += ltCol2 * spec2 * 0.5;

            // Enhanced colorful glow at intersections
            vec3 glowColor = palette(fract(glow*0.5 + t*0.1));
            col += albedo * glow * (0.4 + 0.4*sin(t*2.0 + pos.x*3.0));
            col += fresnel * glowColor * 0.3;

            // Apply AO darkening for crevices
            col *= 0.35 + 0.65 * ao;

            // Colorful atmospheric fog
            float fog = exp(-travel * 0.09);
            vec3 fogColor = palette(fract(0.9 + t*0.02)) * 0.12;
            col = mix(fogColor, col, fog);

            return postProcess(col, uv);
        }

        travel += d;
        if(travel > MAX_DIST) break;
    }

    vec3 bg = background(rd, t);
    return postProcess(bg, uv);
}

void main(){
    vec3 color = render(gl_FragCoord.xy);
    color = pow(clamp(color, 0.0, 1.0), vec3(0.45454545));
    fragColor = vec4(color, 1.0);
}