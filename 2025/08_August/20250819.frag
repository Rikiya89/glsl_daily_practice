// ✴︎ MANDALA QUASICRYSTAL — SMOOTH SEGMENT MORPH (no "watch tick")
// Uniforms: uTime (float), uResolution (vec2), uAudio (optional 0..1)

uniform float uTime;
uniform vec2  uResolution;
uniform float uAudio; // optional; if not wired, TD gives 0

out vec4 fragColor;

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ---------- Tunables
#define OCTAVES     5
#define SPEC_POWER  100.0
#define PARALLAX    0.10
#define NORMAL_EPS  1.6
#define EDGE_GLOW   0.22
#define EXPOSURE    2.0
#define GAMMA       (1.0/1.65)
#define SATURATE    1.08
#define PALETTE_FLOW_SPEED 0.07
#define PALETTE_SWAY 0.16
#define CAMERA_ORBIT_SPEED 0.11
#define CAMERA_DOLLY_AMT   0.10
#define SWIRL_STRENGTH     0.20
#define SWIRL_BREATH       0.10
#define RING_FREQ          46.0

// ---------- Utils
mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
float clamp01(float x){ return clamp(x,0.0,1.0); }
float easeInOutCubic(float x){ x=clamp01(x); return x<0.5 ? 4.0*x*x*x : 1.0-pow(-2.0*x+2.0,3.0)/2.0; }

float hash21(vec2 p){
    p = fract(p*vec2(123.34, 345.45));
    p += dot(p, p+34.345);
    return fract(p.x*p.y);
}
float noise(vec2 x){
    vec2 i = floor(x), f = fract(x);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i);
    float b = hash21(i+vec2(1,0));
    float c = hash21(i+vec2(0,1));
    float d = hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 x){
    float v=0.0, a=0.5;
    for(int i=0;i<OCTAVES;i++){ v+=a*noise(x); x*=2.0; a*=0.5; }
    return v;
}
float lineAA(float d, float w){ return smoothstep(w, 0.0, abs(d)); }

// ---------- Building blocks
vec2 kaleid(vec2 p, float seg){
    // supports non-integer seg, but we will still blend two integer folds for continuity
    float a = atan(p.y,p.x), r=length(p), w = TAU/seg;
    a = mod(a, w); a = abs(a - w*0.5);
    return vec2(cos(a), sin(a))*r;
}
float quasicrystal(vec2 p, float k){
    float s=0.0;
    for(int i=0;i<5;i++){
        float a = float(i)*PI/5.0;
        s += cos(dot(p, vec2(cos(a),sin(a)))*k);
    }
    return s/5.0;
}
float superR(vec2 p, float m, float n1, float n2, float n3){
    float th = atan(p.y, p.x);
    float r = length(p)+1e-6;
    float t = (abs(cos(m*th))+1e-6);
    float u = (abs(sin(m*th))+1e-6);
    float rr = pow(pow(t, n2)+pow(u, n3), -1.0/n1);
    return 1.0 - smoothstep(rr*0.9, rr, r);
}
float hexWire(vec2 p, float s){
    vec2 q = vec2(p.x*2.0, p.y*1.73205);
    vec2 r = vec2(q.x+q.y, q.y-q.x)*0.5;
    return lineAA(length(fract(r*s)-0.5), 0.14);
}
float spokes(vec2 p, float seg){
    float th = atan(p.y,p.x);
    float r  = length(p);
    return lineAA(sin(th*seg), 0.07)*smoothstep(1.2,0.0,r);
}
vec2 swirl(vec2 p, float strength, float time){
    float r = length(p) + 1e-4;
    float a = atan(p.y, p.x);
    float off = strength * (1.0 - exp(-r*2.2)) * (0.8 + 0.2*sin(time*0.6));
    a += off * r;
    return vec2(cos(a), sin(a))*r;
}

// ---------- One “style” pass for a given segment count
float fieldHeightForSeg(vec2 p, float t, float seg){
    // kaleidoscope + lens + micro-warp
    vec2  pk = kaleid(p, seg);
    float r0 = length(pk);
    pk *= 1.0 + 0.13*sin(r0*4.0 - t*0.7 + 0.6*sin(t*0.21));
    pk += 0.065 * (vec2(fbm(pk*3.0 + t*0.12), fbm(pk*2.6 - t*0.10)) - 0.5);

    // features
    float qc    = quasicrystal(pk*1.55, mix(9.0, 18.0, easeInOutCubic(0.5+0.5*sin(t*0.11))));
    float sf    = superR(pk*1.08, floor(seg*0.5), 0.6, 0.8, 0.3);
    float sp    = spokes(pk, seg);
    float rings = lineAA(sin(length(pk)*RING_FREQ - t*1.55), 0.042);
    float hex   = hexWire(pk*3.0, 1.0);

    // weights (slow phases so they don’t fight the seg morph)
    float s1 = 0.5 + 0.5*sin(t*0.16 + 0.0);
    float s2 = 0.5 + 0.5*sin(t*0.19 + 1.3);
    float s3 = 0.5 + 0.5*sin(t*0.14 + 2.6);
    float sum = s1+s2+s3+1e-4;
    float w1 = s1/sum, w2 = s2/sum, w3 = s3/sum;

    float h = 0.0;
    h += w1 * (0.55*rings + 0.45*hex);
    h += w2 * (0.52*sp    + 0.48*sf);
    h += w3 * (0.58*lineAA(qc,0.10) + 0.30*sf);

    // center bloom + breath
    float r = length(pk);
    float bloom = exp(-r*1.28)*(1.9) + smoothstep(0.30, 0.0, r)*0.55;
    h *= bloom * (0.9 + 0.35*sin(t*0.72));

    // tiny grain
    h += (hash21(p*430.0 + t*36.0)-0.5)*0.045;

    // tone to [0,1]
    h = 1.0 - exp(-max(h,0.0)*2.0);
    return clamp(pow(h, 0.86), 0.0, 1.0);
}

// ---------- Smooth segment morph (key fix for “watch tick”)
float fieldHeightSmooth(vec2 p, float t){
    // continuous target segment (non-integer)
    float target = mix(8.0, 20.0, 0.5 + 0.5*sin(t*0.12));
    float s0 = floor(target);
    float s1 = s0 + 1.0;
    // eased crossfade based on fractional part
    float k  = easeInOutCubic(fract(target));
    // compute both and blend
    float h0 = fieldHeightForSeg(p, t, s0);
    float h1 = fieldHeightForSeg(p, t, s1);
    return mix(h0, h1, k);
}

// ---------- Normals & occlusion using the smooth field
vec3 calcNormal(vec2 p, float t, float e){
    float hC = fieldHeightSmooth(p, t);
    float hX = fieldHeightSmooth(p + vec2(e,0.0), t);
    float hY = fieldHeightSmooth(p + vec2(0.0,e), t);
    return normalize(vec3(-(hX-hC)/e, -(hY-hC)/e, 1.0));
}
float horizonOcc(vec2 p, float t, float e){
    float hC = fieldHeightSmooth(p, t);
    float accum = 0.0;
    const int STEPS = 5;
    for(int i=1;i<=STEPS;i++){
        float d = float(i)*e*2.6;
        float hS = fieldHeightSmooth(p + vec2(d,d), t);
        accum += step(hS, hC - 0.03*float(i));
    }
    return accum/float(STEPS);
}

// ---------- Your 10-color palette
vec3 paletteIndex(int idx){
    if(idx==0) return vec3(0x36,0x2d,0x78)/255.0; // #362d78
    if(idx==1) return vec3(0x52,0x3f,0xa3)/255.0; // #523fa3
    if(idx==2) return vec3(0x91,0x6c,0xcc)/255.0; // #916ccc
    if(idx==3) return vec3(0xbd,0xa1,0xe5)/255.0; // #bda1e5
    if(idx==4) return vec3(0xc8,0xc0,0xe9)/255.0; // #c8c0e9
    if(idx==5) return vec3(0x84,0xba,0xe7)/255.0; // #84bae7
    if(idx==6) return vec3(0x51,0x6a,0xd4)/255.0; // #516ad4
    if(idx==7) return vec3(0x33,0x3f,0x87)/255.0; // #333f87
    if(idx==8) return vec3(0x29,0x30,0x39)/255.0; // #293039
    return          vec3(0x28,0x36,0x31)/255.0;    // #283631
}
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec3 getPalette(float t, float timeShift){
    float shift = timeShift + PALETTE_SWAY * sin(timeShift*2.5);
    float idx = clamp(fract(t + shift)*9.0, 0.0, 9.0);
    int i = int(floor(idx));
    int j = min(i+1, 9);
    float f = fract(idx);
    return mix(paletteIndex(i), paletteIndex(j), f);
}
float bayer4(vec2 p){
    ivec2 ip = ivec2(mod(floor(p), 4.0));
    int m[16] = int[16](
        0,  8,  2, 10,
        12, 4, 14,  6,
        3, 11,  1,  9,
        15, 7, 13,  5
    );
    int v = m[ip.y*4 + ip.x];
    return (float(v)+0.5)/16.0;
}

// ---------- Main
void main(){
    vec2 fc = gl_FragCoord.xy;
    vec2 uv = fc / uResolution;
    vec2 asp = vec2(uResolution.x/uResolution.y, 1.0);

    float t = uTime;
    float beat = clamp(uAudio, 0.0, 1.0);

    // Camera: orbit + gentle dolly, both slightly low-passed by nested sines
    float orbit = t*CAMERA_ORBIT_SPEED;
    float dolly = 1.0 + CAMERA_DOLLY_AMT * sin(t*0.30 + 0.4*sin(t*0.12));
    vec2 p = (uv - 0.5)*asp*2.0;
    p = rot(orbit)*p;
    p *= dolly;

    // Tilt (squash) with mild breathing
    float tilt = 0.32 + 0.14*sin(t*0.38 + 0.6*cos(t*0.19));
    p.y *= mix(1.0, 0.56, tilt);

    // Smooth swirl (also low-passed)
    float swirlAmt = SWIRL_STRENGTH + SWIRL_BREATH*sin(t*0.33);
    p = swirl(p, swirlAmt, t);

    // Parallax
    vec2 pPar = p + PARALLAX * p * length(p);

    // Height (SMOOTH morph) & lighting
    float h     = fieldHeightSmooth(pPar, t);
    float z     = mix(-0.65, 0.65, h);
    float e     = NORMAL_EPS / uResolution.y;
    vec3 normal = calcNormal(pPar, t, e);

    vec3 Ldir = normalize(vec3(0.55, 0.35, 0.76));
    float diff = max(dot(normal, Ldir), 0.0);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 H = normalize(Ldir + V);
    float spec = pow(max(dot(normal, H), 0.0), SPEC_POWER) * (0.55 + 0.20*beat);
    float rim  = pow(1.0 - max(dot(normal, V), 0.0), 2.0);

    float hx = fieldHeightSmooth(pPar + vec2(e,0.0), t) - h;
    float hy = fieldHeightSmooth(pPar + vec2(0.0,e), t) - h;
    float edge = smoothstep(0.05, 0.25, sqrt(hx*hx + hy*hy)) * EDGE_GLOW;

    float occ = horizonOcc(pPar, t, e) * 0.34;

    float base = 0.18 + 0.82*diff + 0.28*spec + 0.32*rim + edge;
    base *= (0.76 + 0.24*occ);

    // Depth fog (slow modulation)
    float r = length(p);
    float fog = smoothstep(0.9, 0.2, 0.45*z + 0.55*(1.0 - r) + 0.06*sin(t*0.22));
    float Lmono = mix(0.0, base, fog);

    // Tone
    float L = 1.0 - exp(-max(Lmono,0.0)*EXPOSURE);
    L = pow(L, GAMMA);
    L = clamp(L, 0.0, 1.0);

    // Palette (depth-aware) with slow flow
    float bias = clamp(0.5 + 0.35*(z) + 0.12*(diff - rim), 0.0, 1.0);
    float grad = clamp(L*0.84 + 0.16*bias, 0.0, 1.0);
    float timeShift = t * PALETTE_FLOW_SPEED;
    vec3 col = getPalette(grad, timeShift);

    // Subtle saturation, shimmer, dither, vignette
    float g = luma(col);
    col = mix(vec3(g), col, SATURATE);
    col *= (1.0 - 0.030 * sin(fc.y*3.0 + t*10.0));
    col += (bayer4(fc) - 0.5) * 0.004;
    float vig = smoothstep(1.55, 0.35, r);
    col *= vig;

    fragColor = vec4(col, 1.0);
}