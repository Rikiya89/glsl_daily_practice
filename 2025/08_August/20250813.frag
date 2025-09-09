// ✴︎ MONO MANDALA QUASICRYSTAL — v2 (ultra clean B/W) ✴︎

uniform float uTime;
uniform vec2  uResolution;

out vec4 fragColor;

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;
const float PHI = 1.61803398875;

// ---------- utils
mat2 rotate2D(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

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
    float v = 0.0, a = 0.5;
    for(int i=0;i<4;i++){ v += a*noise(x); x*=2.0; a*=0.5; }
    return v;
}

// from your sample
vec2 sacredGrid(vec2 p){
    vec2 q = vec2(p.x*2.0, p.y*1.73205);
    vec2 r = vec2(q.x+q.y, q.y-q.x)*0.5;
    return fract(r)-0.5;
}
float mandala(vec2 p, float segments){
    float ang = atan(p.y,p.x), rad = length(p);
    return abs(cos(ang*segments)*0.5+0.5)*smoothstep(0.35,0.0,rad);
}
float smoothBreath(float t){ return 0.5 + 0.5*sin(t); }
float stars(vec2 uv, float time){
    vec2 g = fract(uv*80.0);
    float d = length(g-0.5);
    float tw = sin(dot(uv*120.0, vec2(12.9898,78.233))+time*6.0)*0.5+0.5;
    return smoothstep(0.03,0.005,d)*tw;
}

// kaleidoscope fold
vec2 kaleid(vec2 p, float seg){
    float a = atan(p.y,p.x), r=length(p), w = TAU/seg;
    a = mod(a, w); a = abs(a - w*0.5);
    return vec2(cos(a), sin(a))*r;
}

// AA line helper
float lineAA(float d, float w){ return smoothstep(w, 0.0, abs(d)); }

// 5-fold quasicrystal
float quasicrystal(vec2 p, float t){
    float s=0.0, rot=0.22*sin(t*0.3);
    for(int i=0;i<5;i++){
        float a = float(i)*PI/5.0 + rot;
        s += cos(dot(p, vec2(cos(a),sin(a)))*14.0);
    }
    return s/5.0; // [-1,1]
}

// rose-curve (rosette) field around a target radius
float roseField(float r, float theta, float k, float target){
    // r ≈ cos(k*θ) style petals remapped to line distance
    float ro = abs(cos(theta*k));
    float d  = (r - ro*target);
    return lineAA(d, 0.06);
}

void main(){
    // -------- coords & gentle camera
    vec2 fc = gl_FragCoord.xy;
    vec2 uv = fc / uResolution;
    vec2 asp = vec2(uResolution.x/uResolution.y, 1.0);
    vec2 p  = (uv - 0.5) * asp * 2.0;

    float t = uTime;
    float camBob  = sin(t*0.3)*0.05;
    float camZoom = 1.0 + sin(t*0.2)*0.10;
    p.y += camBob;
    p    = rotate2D(t*0.05)*p;
    p   *= camZoom;

    // -------- symmetry & subtle lens warp
    float seg = mix(10.0, 16.0, 0.5+0.5*sin(t*0.15)); // breathe segment count
    vec2 pk = kaleid(p, seg);

    // soft radial “lens” warp for silky flow
    float r0 = length(pk);
    float lens = 1.0 + 0.12*sin(r0*4.0 - t*0.7);
    pk *= lens;

    // micro displacement for living surface
    vec2 warp = 0.06*vec2(fbm(pk*3.0+t*0.15), fbm(pk*3.0-t*0.12));
    pk += warp;

    float r  = length(pk);
    float th = atan(pk.y, pk.x);

    // -------- core line fields (grayscale components)
    // crisp concentric rings
    float rings = lineAA(sin(r*40.0 - t*1.6), 0.05);

    // petal spokes with falloff
    float spokes = lineAA(sin(th*seg + t*0.6), 0.10) * smoothstep(1.2, 0.0, r);

    // rosette around mid-radius
    float rose  = roseField(r, th, floor(seg*0.5), 0.75);

    // quasicrystal shards
    float qc    = quasicrystal(pk, t);
    float shards= lineAA(qc, 0.11);

    // sacred hex edges
    float hexEdge = lineAA(length(sacredGrid(pk*3.2)), 0.16);

    // mandala mask (soft add)
    float mand  = mandala(pk, seg);

    // -------- composition (luminance)
    float L = 0.0;
    L += rings   * 0.55;
    L += spokes  * 0.35;
    L += rose    * 0.45;
    L += shards  * 0.40;
    L += hexEdge * 0.22;
    L += mand    * 0.35;

    // center bloom & breathing
    float bloom  = exp(-r*1.25)*5.0 + smoothstep(0.25, 0.0, r)*0.5;
    float breath = smoothBreath(t*0.8)*0.5 + 0.5;
    L *= bloom * breath;

    // delicate star sparkle (keep subtle)
    L += stars((p+1.0)*0.5, t) * 0.18;

    // scanline shimmer
    L *= (1.0 - 0.06 * sin(fc.y*3.0 + t*12.0));

    // vignette
    float vignette = smoothstep(1.55, 0.32, r);
    L *= vignette;

    // soft bloom lift on highlights
    float soft = smoothstep(0.55, 0.95, L);
    L += soft*0.28;

    // subpixel dual-sample (cheap AA): average two tiny offsets
    vec2 j  = vec2(0.5, -0.5) / uResolution.y;
    float L2= 0.0;
    {
        vec2 pk2 = kaleid((p+j)*lens, seg);
        pk2 += 0.06*vec2(fbm(pk2*3.0+t*0.15), fbm(pk2*3.0-t*0.12));
        float r2=length(pk2), th2=atan(pk2.y,pk2.x);
        float rings2 = lineAA(sin(r2*40.0 - t*1.6), 0.05);
        float spokes2= lineAA(sin(th2*seg + t*0.6), 0.10)*smoothstep(1.2,0.0,r2);
        float rose2  = roseField(r2, th2, floor(seg*0.5), 0.75);
        float shards2= lineAA(quasicrystal(pk2,t), 0.11);
        float hex2   = lineAA(length(sacredGrid(pk2*3.2)), 0.16);
        float mand2  = mandala(pk2, seg);
        float Ls     = rings2*0.55 + spokes2*0.35 + rose2*0.45 + shards2*0.40 + hex2*0.22 + mand2*0.35;
        float bloom2 = exp(-r2*1.25)*5.0 + smoothstep(0.25,0.0,r2)*0.5;
        L2 = Ls*bloom2*breath;
    }
    L = mix(L, L2, 0.5);

    // paper grain (true mono)
    float grain = (hash21(fc + t*60.0) - 0.5)*0.06;
    L += grain;

    // tone curve for creamy whites / deep blacks
    float exposure = 2.3;
    float mono = 1.0 - exp(-max(L,0.0)*exposure);
    mono = pow(clamp(mono, 0.0, 1.0), 1.0/1.7);

    fragColor = vec4(vec3(mono), 1.0);
}
