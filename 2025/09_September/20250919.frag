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
// Your palette
// ------------------------------
const int PALETTE_COUNT = 10;
const vec3 PALETTE[PALETTE_COUNT] = vec3[PALETTE_COUNT](
    vec3(0.3568627, 0.5450980, 0.8745098), // #5b8bdf
    vec3(0.2431373, 0.4745098, 0.7803922), // #3e79c7
    vec3(0.0313725, 0.3450980, 0.3098039), // #08584f
    vec3(0.9176471, 0.8274510, 1.0000000), // #ead3ff
    vec3(0.0627451, 0.1647059, 0.4039216), // #102a67
    vec3(0.2352941, 0.4901961, 0.8196078), // #3c7dd1
    vec3(0.3960784, 0.3372549, 0.7411765), // #6556bd
    vec3(0.3921569, 0.3686275, 0.7450980), // #645ebe
    vec3(0.0823529, 0.1764706, 0.5686275), // #152d91
    vec3(0.5411765, 0.6470588, 0.9647059)  // #8aa5f6
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

float smin(float a, float b, float k){
    float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0 - h);
}

float mapScene(vec3 p, out vec3 albedo, out float glow){
    float t = u_time * 0.3;

    vec3 q = p;
    q = rotY(t*0.4 + sin(t*0.2)*0.5) * q;
    q = rotX(sin(t*0.3)*0.3) * q;
    q.xy = rot(0.3*sin(t*0.8) + 0.4*sin(q.z*0.5 + t)) * q.xy;

    vec3 q1 = q + vec3(sin(t*0.7)*1.2, 0.8*sin(t*0.9 + 1.0), cos(t*0.6)*0.8);
    float sphere1 = sdSphere(q1, 1.0 + 0.2*sin(t*1.1 + q1.x*0.5) + 0.1*cos(t*1.7));

    vec3 q2 = rotZ(t*0.5) * q;
    float pulse = 0.5 + 0.5*sin(t*2.0);
    float torus = sdTorus(q2, vec2(1.4 + 0.4*sin(t*0.6), 0.3 + 0.1*pulse));

    vec3 orbit1 = vec3(2.5*sin(t*0.8), 1.5*cos(t*0.5), 2.0*sin(t*0.6 + 1.57));
    vec3 q3 = rotX(t*0.7) * rotY(t*0.9) * (q - orbit1);
    float sphere2 = sdSphere(q3, 0.6 + 0.1*sin(t*2.3));

    vec3 orbit2 = vec3(cos(t*0.4)*2.0, sin(t*0.3)*1.0, sin(t*0.4)*2.0);
    vec3 q4 = rotY(t*1.2) * (q - orbit2);
    float box = sdBox(q4, vec3(0.7, 0.3 + 0.2*abs(sin(t*1.5)), 0.7));

    vec3 orbit3 = vec3(0.0, 2.0*sin(t*0.4), 0.0);
    vec3 q5 = rotY(t*1.1) * rotX(t*0.8) * (q - orbit3);
    float octa = sdOctahedron(q5, 0.5 + 0.15*sin(t*1.8));

    vec3 orbit4 = vec3(1.8*cos(t*0.9 + 3.14), 0.5, 1.8*sin(t*0.9 + 3.14));
    vec3 q6 = rotZ(t*1.3) * (q - orbit4);
    float sphere3 = sdSphere(q6, 0.4 + 0.1*cos(t*2.7));

    float blend1 = 0.4 + 0.2*sin(t*0.7);
    float blend2 = 0.3 + 0.15*cos(t*0.9);
    float blend3 = 0.5 + 0.2*sin(t*1.1);

    float d1 = smin(sphere1, torus, blend1);
    float d2 = smin(d1, sphere2, blend2);
    float d3 = smin(d2, box, 0.4);
    float d4 = smin(d3, octa, blend3);
    float d = smin(d4, sphere3, 0.35);

    float colorShift = t*0.1 + length(p)*0.03;
    float key = 0.3 + 0.4*sin(colorShift + p.x*0.8) + 0.3*sin(p.y*1.1 - t*0.7) + 0.2*cos(p.z*0.9 + t*0.5);
    albedo = palette(fract(key));

    float energy = 0.0;
    energy += exp(-abs(sphere1 - torus)*3.0) * (0.4 + 0.3*sin(t*2.1));
    energy += exp(-abs(sphere2 - octa)*4.0) * (0.3 + 0.2*cos(t*1.9));
    energy += exp(-abs(box - sphere3)*5.0) * (0.2 + 0.2*sin(t*2.5));
    energy += exp(-abs(torus - sphere3)*6.0) * (0.3 + 0.2*cos(t*1.6));
    
    glow = 0.2 + energy + 0.1*sin(t*3.0 + length(p));

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

vec3 postProcess(vec3 color, vec2 uv){
    float r = length(uv);
    float vig = 1.0 - smoothstep(0.3, 1.2, r);
    color *= mix(0.7, 1.1, vig);

    vec2 chromaOffset = normalize(uv) * r * r * 0.003;
    float chromaR = length(color);
    float chromaG = length(color * vec3(0.7, 1.0, 0.7));
    float chromaB = length(color * vec3(0.7, 0.7, 1.0));
    
    color.r = mix(color.r, chromaR, abs(chromaOffset.x));
    color.g = mix(color.g, chromaG, abs(chromaOffset.y) * 0.5);
    color.b = mix(color.b, chromaB, abs(chromaOffset.x) * 0.7);

    float grain = (hash12(uv * u_resolution + vec2(u_time*0.11, u_time*0.07)) - 0.5) * 0.008;
    color += grain;

    color *= 1.0 + 0.05*sin(uv.y * u_resolution.y * 2.0);

    color = toneMapFilmic(color * 1.2);
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
    
    vec3 stars = vec3(0.0);
    for(int i = 0; i < 3; i++){
        float layer = 20.0 + float(i)*15.0;
        vec2 grid = floor(rd.xz * layer);
        vec2 id = grid + vec2(float(i)*13.7, float(i)*7.3);
        float star = hash12(id);
        if(star > 0.995){
            vec2 gv = fract(rd.xz * layer) - 0.5;
            float d = length(gv);
            float twinkle = 0.7 + 0.3*sin(t*3.0 + star*31.4 + float(i)*2.1);
            float brightness = smoothstep(0.15, 0.0, d) * (star - 0.995) * 100.0 * twinkle;
            vec3 starColor = palette(fract(star*4.7 + t*0.05 + float(i)*0.33));
            stars += brightness * starColor;
        }
    }
    
    float gradientShift = t*0.03 + sin(t*0.08)*0.5;
    float waveA = 0.12 + 0.25*sin(gradientShift);
    float waveB = 0.62 + 0.30*sin(gradientShift + 3.14 + rd.x*2.0);
    
    vec3 a = palette(fract(waveA));
    vec3 b = palette(fract(waveB));
    vec3 c = palette(fract(waveA + 0.33));
    
    float blend1 = smoothstep(0.0, 0.7, h);
    float blend2 = smoothstep(0.3, 1.0, h);
    float radialMod = 0.5 + 0.5*sin(r*3.0 + t*0.2);
    
    vec3 gradient = mix(a, b, blend1);
    gradient = mix(gradient, c, blend2 * 0.3);
    gradient *= 0.8 + 0.4*radialMod;
    
    float aurora = abs(sin(rd.y*8.0 + rd.x*5.0 + t*0.7)) * 
                   abs(cos(rd.y*6.0 - rd.z*4.0 + t*0.5));
    aurora = pow(aurora, 3.0) * 0.3;
    vec3 auroraColor = palette(fract(0.8 + t*0.08 + aurora*2.0));
    
    return gradient * 0.7 + stars + aurora * auroraColor;
}

vec3 render(vec2 fragCoord){
    vec2 uv = (fragCoord - 0.5 * u_resolution) / u_resolution.y;

    float t = u_time * 0.3;

    float rad = 4.5 + 0.8*sin(t*0.5) + 0.3*cos(t*0.3);
    float height = 2.0 + 1.2*sin(t*0.4) + 0.5*cos(t*0.8);
    float camOrbit = t*0.25 + 0.3*sin(t*0.15);
    
    vec3 ro = vec3(rad * sin(camOrbit), height, rad * cos(camOrbit));
    vec3 ta = vec3(0.5*sin(t*0.3), 0.3*sin(t*0.7), 0.5*cos(t*0.4));

    vec3 rd = camRay(ro, ta, uv);

    float travel = 0.0;
    for(int i = 0; i < MAX_STEPS; ++i){
        vec3 pos = ro + rd * travel;

        vec3 albedo;
        float glow;
        float d = mapScene(pos, albedo, glow);

        if(d < SURF_DIST){
            vec3 n = calcNormal(pos);
            
            vec3 lp1 = vec3(3.0*sin(t*1.2 + 0.5), 2.5 + 1.5*sin(t*0.8), 3.0*cos(t*1.2 + 0.5));
            vec3 lp2 = vec3(-2.0*cos(t*0.9 + 2.1), 2.0*sin(t*0.6), 2.5*sin(t*0.9 + 2.1));
            vec3 lp3 = vec3(2.2*sin(t*0.7 + 4.2), -1.5 + 0.8*cos(t*0.5), 2.2*cos(t*0.7 + 4.2));
            
            vec3 l1 = normalize(lp1 - pos);
            vec3 l2 = normalize(lp2 - pos);
            vec3 l3 = normalize(lp3 - pos);

            float diff1 = max(dot(n, l1), 0.0);
            float diff2 = max(dot(n, l2), 0.0) * 0.6;
            float diff3 = max(dot(n, l3), 0.0) * 0.4;
            
            float rim = pow(1.0 - max(dot(n, -rd), 0.0), 1.8);
            float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
            
            vec3 ltCol1 = palette(fract(0.08 + t*0.1 + sin(t*1.5)*0.1));
            vec3 ltCol2 = palette(fract(0.45 + t*0.08 + cos(t*1.2)*0.1));
            vec3 ltCol3 = palette(fract(0.78 + t*0.12 + sin(t*0.9)*0.1));

            vec3 col = vec3(0.0);
            col += albedo * (0.15 + 0.8 * diff1);
            col += albedo * ltCol2 * diff2 * 0.4;
            col += albedo * ltCol3 * diff3 * 0.3;
            col += ltCol1 * rim * 0.5;
            col += albedo * glow * (0.3 + 0.4*sin(t*2.0 + pos.x*3.0));
            col += fresnel * palette(fract(glow + t*0.1)) * 0.2;

            float fog = exp(-travel * 0.08);
            vec3 fogColor = palette(fract(0.9 + t*0.02)) * 0.1;
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