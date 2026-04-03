// ============================================================
// Babylonian Fibonacci — Sacred Geometry + Pink Dots Edition
// TouchDesigner GLSL TOP
// ============================================================

uniform float iTime;
uniform vec2  iResolution;

layout(location = 0) out vec4 fragColor;

// --- Color Palette (mandatory) ---
const vec3 cBg1    = vec3(0.161, 0.188, 0.224);
const vec3 cBg2    = vec3(0.157, 0.212, 0.192);
const vec3 cDeep1  = vec3(0.051, 0.122, 0.176);
const vec3 cDeep2  = vec3(0.039, 0.239, 0.180);
const vec3 cGreen  = vec3(0.000, 1.000, 0.529);
const vec3 cCyan   = vec3(0.000, 0.831, 1.000);
const vec3 cPurple = vec3(0.482, 0.184, 1.000);
const vec3 cPink   = vec3(1.000, 0.176, 0.478);
const vec3 cMint   = vec3(0.690, 1.000, 0.910);
const vec3 cIce    = vec3(0.769, 0.941, 1.000);

const float PI           = 3.14159265359;
const float TAU          = 6.28318530718;
const float PHI          = 1.61803398875;
const float GOLDEN_ANGLE = 2.39996323;

// ─────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

vec3 pal(float t) {
    t = fract(t);
    if (t < 0.2) return mix(cCyan,   cGreen,  t / 0.2);
    if (t < 0.4) return mix(cGreen,  cMint,  (t - 0.2) / 0.2);
    if (t < 0.6) return mix(cMint,   cIce,   (t - 0.4) / 0.2);
    if (t < 0.8) return mix(cIce,    cPurple,(t - 0.6) / 0.2);
                 return mix(cPurple, cPink,  (t - 0.8) / 0.2);
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa=p-a, ba=b-a;
    return length(pa - ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0));
}
float sdRing(vec2 p, vec2 c, float r) { return abs(length(p-c)-r); }
float glow(float d, float w, float bloom) {
    return smoothstep(w, 0.0, d) + bloom*exp(-d*d*180.0);
}

// Deterministic hash for sparkles
float hash(float n) { return fract(sin(n*127.1+311.7)*43758.5453); }

// ─────────────────────────────────────────────
//  Sacred Geometry Primitives
// ─────────────────────────────────────────────

float flowerOfLife(vec2 uv, float R, float w) {
    float d = sdRing(uv, vec2(0.0), R);
    for (int i = 0; i < 6; i++) {
        float a = float(i)*TAU/6.0;
        d = min(d, sdRing(uv, vec2(cos(a),sin(a))*R, R));
    }
    return glow(d, w, 0.35);
}

float sdPolyLine(vec2 uv, int n, float r, float angle, float w) {
    float d = 1e9;
    for (int i = 0; i < n; i++) {
        float a0 = float(i)  *TAU/float(n) + angle;
        float a1 = float(i+1)*TAU/float(n) + angle;
        d = min(d, sdSeg(uv, vec2(cos(a0),sin(a0))*r, vec2(cos(a1),sin(a1))*r));
    }
    return glow(d, w, 0.20);
}

float hexagram(vec2 uv, float r, float angle, float w) {
    float d1=1e9, d2=1e9;
    for (int i = 0; i < 3; i++) {
        float a0=float(i)*TAU/3.0+angle, a1=float(i+1)*TAU/3.0+angle;
        d1 = min(d1, sdSeg(uv, vec2(cos(a0),sin(a0))*r, vec2(cos(a1),sin(a1))*r));
        float b0=a0+TAU/6.0, b1=a1+TAU/6.0;
        d2 = min(d2, sdSeg(uv, vec2(cos(b0),sin(b0))*r, vec2(cos(b1),sin(b1))*r));
    }
    return glow(min(d1,d2), w, 0.28);
}

float pentagram(vec2 uv, float r, float angle, float w) {
    vec2 v[5];
    for (int i=0;i<5;i++){float a=float(i)*TAU/5.0+angle; v[i]=vec2(cos(a),sin(a))*r;}
    int ord[5]; ord[0]=0;ord[1]=2;ord[2]=4;ord[3]=1;ord[4]=3;
    float d=1e9;
    for (int i=0;i<5;i++) d=min(d, sdSeg(uv,v[ord[i]],v[ord[(i+1)%5]]));
    return glow(d, w, 0.22);
}

float vesica(vec2 uv, float R, float angle, float w) {
    vec2 c1=rot(angle)*vec2(R*0.5,0.0), c2=rot(angle)*vec2(-R*0.5,0.0);
    return glow(min(sdRing(uv,c1,R),sdRing(uv,c2,R)), w, 0.18);
}

float rays(vec2 uv, int n, float angle, float spread) {
    float a = atan(uv.y,uv.x)+PI;
    float sec = TAU/float(n);
    a = abs(mod(a-angle, sec) - sec*0.5);
    float r = length(uv);
    return smoothstep(spread,0.0,a)*smoothstep(0.88,0.08,r)*smoothstep(0.0,0.05,r);
}

float babylonRing(vec2 uv, float radius, float rotOff) {
    float r=length(uv), a=atan(uv.y,uv.x)+rotOff;
    float ring   = smoothstep(0.006,0.0,abs(r-radius));
    float minorPh= abs(fract(a/TAU*60.0+0.5)-0.5);
    float majorPh= abs(fract(a/TAU*6.0 +0.5)-0.5);
    float minor  = smoothstep(0.010,0.0,minorPh)*step(radius,r)*smoothstep(radius+0.022,radius+0.006,r);
    float major  = smoothstep(0.013,0.0,majorPh)*step(radius,r)*smoothstep(radius+0.042,radius+0.006,r);
    return ring + minor*0.50 + major*0.85;
}

float spiralArm(vec2 uv, float k, float offset, float spread) {
    float r=length(uv);
    if (r<0.001) return 0.0;
    float a=atan(uv.y,uv.x)+offset;
    float phase=fract((log(r)/k - a)/TAU)-0.5;
    return smoothstep(spread,0.0,abs(phase)/(1.0+r*2.2));
}

// ─────────────────────────────────────────────
//  NEW: Pink Comet Beads
//  count beads orbit a ring, each leaving a fading angular trail
// ─────────────────────────────────────────────
float pinkCometBeads(vec2 uv, float radius, int count, float speed, float trailLen) {
    float r       = length(uv);
    float uvAngle = atan(uv.y, uv.x) + PI;   // pixel angle [0, TAU]
    float nearRing= smoothstep(0.028, 0.0, abs(r - radius)); // ring proximity mask

    float result = 0.0;
    for (int i = 0; i < count; i++) {
        float beadAngle = mod(float(i)*TAU/float(count) + speed, TAU);

        // ── Dot core + bloom halo ──
        vec2  pos  = vec2(cos(beadAngle), sin(beadAngle)) * radius;
        float d    = length(uv - pos);
        float sz   = 0.014 + 0.005*sin(speed*2.2 + float(i)*1.1);
        result    += smoothstep(sz, 0.0, d);
        result    += 0.40 * exp(-d*d*380.0);

        // ── Comet tail (angular arc behind bead) ──
        float angDiff = mod(beadAngle - uvAngle + TAU, TAU);
        float tail    = smoothstep(trailLen, 0.0, angDiff)   // fade with distance
                      * pow(1.0 - angDiff/trailLen, 1.8)     // sharper near head
                      * nearRing;                             // only on ring surface
        result += tail * 0.70;
    }
    return clamp(result, 0.0, 1.0);
}

// ─────────────────────────────────────────────
//  NEW: Twinkling sparkle field (fixed positions, oscillating brightness)
// ─────────────────────────────────────────────
float sparkleField(vec2 uv, float t, int count, float spread) {
    float result = 0.0;
    for (int i = 0; i < count; i++) {
        float fi     = float(i);
        float angle  = hash(fi)       * TAU;
        float radius = 0.06 + hash(fi+0.1) * spread;
        vec2  pos    = vec2(cos(angle), sin(angle)) * radius;
        float twinkle= 0.5 + 0.5*sin(t*(1.8+hash(fi+0.5)*2.5) + hash(fi+0.7)*TAU);
        float d      = length(uv - pos);
        float sz     = 0.004 + 0.003*twinkle;
        result      += smoothstep(sz, 0.0, d) * twinkle;
        result      += 0.18 * exp(-d*d*1800.0) * twinkle;
    }
    return clamp(result, 0.0, 1.0);
}

// ─────────────────────────────────────────────
//  NEW: Concentric wave ripples from center
// ─────────────────────────────────────────────
float rippleWaves(vec2 uv, float t) {
    float r = length(uv);
    float w = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        w += sin(r*32.0 - t*(1.3+fi*0.55) - fi*1.4) * exp(-r*(2.2+fi*0.9));
    }
    return w * 0.25;
}

// ─────────────────────────────────────────────
//  NEW: Aurora nebula background bands
// ─────────────────────────────────────────────
float auroraField(vec2 uv, float t) {
    float val = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i) * PHI;
        val += sin(uv.x*(2.0+fi*0.9) + t*(0.22+fi*0.06) + fi*1.2)
             * cos(uv.y*(1.7+fi*0.7) + t*(0.18+fi*0.04) + fi*0.8)
             * (1.0/float(i+1));
    }
    return 0.5 + 0.38*val;
}

// ─────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────
void main() {
    float mn = min(iResolution.x, iResolution.y);
    vec2  uv = (gl_FragCoord.xy - 0.5*iResolution.xy) / mn;
    float t  = iTime * 0.18;

    // Breathing UV warp — the whole field pulses slowly
    float breathAmt = 0.013*sin(t*1.55);
    vec2  wuv = uv + breathAmt*vec2(sin(uv.y*5.2+t*1.0), cos(uv.x*5.2+t*0.85));

    // ── 1. Background ─────────────────────────────────────
    float bgPulse = 0.5+0.5*sin(length(uv)*3.8 - t*1.8);
    vec3  col     = mix(cDeep1, cDeep2, bgPulse);
    col           = mix(col, mix(cBg1,cBg2,bgPulse), 0.50);

    // Aurora color wash (slow, subtle)
    float aur1 = auroraField(uv*0.9,  t);
    float aur2 = auroraField(uv*1.2, -t*0.7 + 3.14);
    col = mix(col, cPurple*0.35, aur1*0.18);
    col = mix(col, cPink  *0.25, aur2*0.14);

    // Clay tablet micro-grid
    float gx=abs(fract(uv.x*22.0+0.5)-0.5), gy=abs(fract(uv.y*22.0+0.5)-0.5);
    col += cDeep2*smoothstep(0.48,0.43,max(gx,gy))*0.055;

    // Concentric ripple waves
    float rip = rippleWaves(uv, iTime);
    col += cCyan * rip * 0.055;
    col += cPink * rip * 0.038;

    // ── 2. Radial rays ────────────────────────────────────
    float rr = rays(uv,24, t*0.55, 0.016)*0.5 + rays(uv,8, t*0.18, 0.028)*0.4;
    col = mix(col, cGreen, clamp(rr,0.0,1.0)*0.18);

    // ── 3. Vesica Piscis ──────────────────────────────────
    col = mix(col, cDeep2+cCyan*0.4, clamp(vesica(uv,0.72,t*0.06,0.005),0.0,1.0)*0.35);

    // ── 4. Nested spinning polygons (breathing scale) ─────
    float breath = 1.0 + 0.04*sin(t*TAU*0.52);
    col = mix(col, cIce   *1.2, clamp(sdPolyLine(uv,7,0.68*breath, t*0.055,       0.004),0.0,1.0)*0.32);
    col = mix(col, cMint  *1.2, clamp(sdPolyLine(uv,6,0.56*breath,-t*0.075,       0.004),0.0,1.0)*0.34);
    col = mix(col, cCyan  *1.3, clamp(sdPolyLine(uv,5,0.45*breath, t*0.110+0.30,  0.004),0.0,1.0)*0.36);
    col = mix(col, cPurple*1.3, clamp(sdPolyLine(uv,4,0.36*breath,-t*0.150,       0.004),0.0,1.0)*0.38);
    col = mix(col, cPink  *1.2, clamp(sdPolyLine(uv,3,0.28*breath, t*0.200,       0.004),0.0,1.0)*0.38);

    // ── 5. Flower of Life ─────────────────────────────────
    col = mix(col, cMint*1.5, clamp(flowerOfLife(rot( t*0.07)*uv, 0.160, 0.005),0.0,1.0)*0.50);
    col = mix(col, cCyan*1.3, clamp(flowerOfLife(rot(-t*0.04)*uv, 0.335, 0.004),0.0,1.0)*0.38);

    // ── 6. Hexagram (Star of Ishtar) ─────────────────────
    col = mix(col, cCyan*1.6, clamp(hexagram(uv,0.230, t*0.14,        0.005),0.0,1.0)*0.55);
    col = mix(col, cIce *1.4, clamp(hexagram(uv,0.115,-t*0.19+PI*0.1, 0.004),0.0,1.0)*0.48);

    // ── 7. Pentagram (φ geometry) ─────────────────────────
    col = mix(col, cPurple*1.7, clamp(pentagram(uv,0.190,-t*0.17,        0.005),0.0,1.0)*0.55);
    col = mix(col, cPink  *1.4, clamp(pentagram(uv,0.095, t*0.24+PI*0.2, 0.004),0.0,1.0)*0.45);

    // ── 8. Logarithmic spiral arms 8 + 13 ────────────────
    float k=0.30614, arms8=0.0, arms13=0.0;
    for (int i=0;i<8; i++) arms8  += spiralArm(uv,k,float(i)*TAU/8.0 + t*0.25,0.080);
    for (int i=0;i<13;i++) arms13 += spiralArm(uv,k,float(i)*TAU/13.0- t*0.16,0.062);
    col = mix(col, cPurple*1.2, clamp(arms8, 0.0,1.0)*0.20);
    col = mix(col, cCyan  *1.1, clamp(arms13,0.0,1.0)*0.17);

    // ── 9. Fibonacci phyllotaxis (233 seeds) ──────────────
    float fibLayer=0.0, fibHue=0.0;
    for (int n=1;n<=233;n++) {
        float fn=float(n), angle=fn*GOLDEN_ANGLE+t*0.38, rad=sqrt(fn)*0.058;
        vec2  pos=vec2(cos(angle),sin(angle))*rad;
        float sz=0.0075+0.003*sin(t*1.9+fn*0.38);
        float d=smoothstep(sz,0.0,length(wuv-pos));
        fibLayer+=d; fibHue=mix(fibHue,fn/233.0,d);
    }
    col = mix(col, pal(fibHue+t*0.10), clamp(fibLayer,0.0,1.0));

    // ── 10. Pink secondary phyllotaxis ───────────────────
    //  Same golden angle, offset by π — fills the inter-seed gaps with pink
    float pinkFib = 0.0;
    for (int n=1;n<=144;n++) {
        float fn=float(n), angle=fn*GOLDEN_ANGLE+PI+t*0.50, rad=sqrt(fn)*0.062;
        vec2  pos=vec2(cos(angle),sin(angle))*rad;
        float sz=0.007+0.003*sin(t*2.1+fn*0.52);
        pinkFib += smoothstep(sz, 0.0, length(wuv-pos));
    }
    pinkFib = clamp(pinkFib,0.0,1.0);
    col  = mix(col, cPink*1.6, pinkFib*0.72);
    col += cPink * pinkFib * 0.12;   // additive bloom

    // ── 11. Fibonacci node highlights + orbit trails ──────
    int fibSeq[11];
    fibSeq[0]=1;fibSeq[1]=1;fibSeq[2]=2; fibSeq[3]=3;
    fibSeq[4]=5;fibSeq[5]=8;fibSeq[6]=13;fibSeq[7]=21;
    fibSeq[8]=34;fibSeq[9]=55;fibSeq[10]=89;
    for (int i=0;i<11;i++) {
        float fn=float(fibSeq[i]);
        float angle=fn*GOLDEN_ANGLE+t*0.38, rad=sqrt(fn)*0.058;
        vec2  pos=vec2(cos(angle),sin(angle))*rad;
        float pulse=0.012+0.006*sin(t*3.0+fn*0.9);
        float dist=length(uv-pos);
        float prevA=fn*GOLDEN_ANGLE+(t-0.4)*0.38;
        vec2  prev=vec2(cos(prevA),sin(prevA))*rad;
        col = mix(col, cPink *1.6, exp(-dist*dist*280.0)*0.42);
        col = mix(col, cGreen*1.4, smoothstep(0.018,0.0,sdSeg(uv,pos,prev))*0.30);
        col = mix(col, cIce,       smoothstep(pulse,0.0,dist));
    }

    // ── 12. PINK COMET BEADS orbiting Babylonian rings ───
    //        Bead counts: 12, 8, 5 — all Fibonacci numbers
    //        Orbit speeds differ → create clock-hand effect
    float beads1 = pinkCometBeads(uv, 0.210, 12, iTime*0.42, 0.58);
    float beads2 = pinkCometBeads(uv, 0.460,  8, iTime*0.26, 0.48);
    float beads3 = pinkCometBeads(uv, 0.750,  5, iTime*0.15, 0.38);
    col  = mix(col, cPink*2.0, beads1*0.82);
    col  = mix(col, cPink*1.8, beads2*0.72);
    col  = mix(col, cPink*1.6, beads3*0.62);
    col += cPink * beads1 * 0.18;   // extra additive glow on inner ring
    col += cPink * beads2 * 0.12;

    // ── 13. Babylonian base-60 rings (rotating dials) ─────
    col = mix(col, cMint, clamp(babylonRing(uv,0.210, t*0.30),0.0,1.0)*0.65);
    col = mix(col, cCyan, clamp(babylonRing(uv,0.460,-t*0.18),0.0,1.0)*0.52);
    col = mix(col, cIce,  clamp(babylonRing(uv,0.750, t*0.10),0.0,1.0)*0.40);

    // ── 14. Twinkling sparkle field ───────────────────────
    //        Two layers: white stars + pink stars at different radii
    col += cIce  * sparkleField(uv,       iTime,    55, 0.82) * 0.38;
    col += cPink * sparkleField(uv*0.85,  iTime+7.0,30, 0.78) * 0.32;

    // ── 15. Shimmer spokes (21 Fibonacci) ─────────────────
    col = mix(col, cMint*1.3, clamp(rays(uv,21,t*0.08,0.007),0.0,1.0)*0.12);

    // ── 16. Center glow (static) ──────────────────────────
    col += cGreen * exp(-length(uv)*8.5) * 0.55;
    col += cCyan  * exp(-length(uv)*17.0) * 0.30;

    // ── 17. Vignette + ACES tone map + gamma ─────────────
    col *= 1.0 - smoothstep(0.52, 1.05, length(uv));
    col  = (col*(2.51*col+0.03)) / (col*(2.43*col+0.59)+0.14);
    col  = pow(max(col,vec3(0.0)), vec3(1.0/1.08));

    fragColor = vec4(col, 1.0);
}
