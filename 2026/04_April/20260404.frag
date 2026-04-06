// ============================================================
//  QUANTUM LATTICE — 3D Raymarched Sacred Geometry
//  TouchDesigner GLSL TOP  ·  Theme: Deep Space Neon
//  Uniforms: connect Timer CHOP → iTime
// ============================================================

uniform float iTime;
uniform vec2  iResolution;
layout(location = 0) out vec4 fragColor;

// ─── Palette ──────────────────────────────────────────────────
const vec3 cBg1    = vec3(0.039, 0.059, 0.051);
const vec3 cBg2    = vec3(0.051, 0.129, 0.216);
const vec3 cBg3    = vec3(0.102, 0.102, 0.180);
const vec3 cBg4    = vec3(0.051, 0.231, 0.180);
const vec3 cGreen  = vec3(0.000, 1.000, 0.529);
const vec3 cCyan   = vec3(0.000, 0.831, 1.000);
const vec3 cPurple = vec3(0.482, 0.184, 1.000);
const vec3 cPink   = vec3(1.000, 0.176, 0.478);
const vec3 cMint   = vec3(0.690, 1.000, 0.910);
const vec3 cIce    = vec3(0.878, 0.969, 1.000);

#define TAU       6.28318530718
#define PI        3.14159265359
#define PHI       1.61803398875
#define MAX_STEPS 96
#define MAX_DIST  18.0
#define SURF_DIST 0.001

// ─── Math ─────────────────────────────────────────────────────
mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }
mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotZ(float a){ float c=cos(a),s=sin(a); return mat3(c,-s,0, s,c,0, 0,0,1); }

float smin(float a, float b, float k){
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}

// ─── Animation helpers ────────────────────────────────────────
// Smooth sinusoidal oscillator — returns [0, 1]
float osc(float freq, float phase){ return 0.5 + 0.5*sin(iTime*freq + phase); }

// Organic heartbeat: sharp attack, slow decay — returns [0, 1]
float beat(float bpm){
    float x = mod(iTime * bpm / 60.0, 1.0);
    return exp(-9.0*x) + 0.45*exp(-9.0*max(x - 0.18, 0.0));
}

// ─── SDFs ─────────────────────────────────────────────────────
float sdSphere(vec3 p, float r){ return length(p) - r; }

float sdTorus(vec3 p, vec2 t){
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// Breathing crystal orb — displacement amplitude grows on heartbeat
float sdOrb(vec3 p){
    float amp = 0.065 + 0.035 * beat(72.0);
    float d   = sin(p.x*5.0 + iTime*0.28) * cos(p.y*5.0 + iTime*0.23) * sin(p.z*5.0 + iTime*0.18);
    return length(p) - 0.42 - amp*d;
}

// ─── Material packing ─────────────────────────────────────────
vec2 opU(vec2 a, vec2 b){ return a.x < b.x ? a : b; }

// ─── Scene SDF ────────────────────────────────────────────────
vec2 scene(vec3 p){
    float t  = iTime * 0.25;
    float hb = beat(72.0);                     // heartbeat [0..1], ~72 bpm

    // ── 1. Central crystal orb (mat 1) ───────────────────────
    vec2 res = vec2(sdOrb(p), 1.0);

    // ── 2. Three outer Borromean rings (mats 2/3/4) ──────────
    // Major radius breathes with slow sine, tube fattens on heartbeat
    float R_outer = 0.85 + 0.10 * osc(0.40, 0.00);
    float r_outer = 0.052 + 0.028 * hb;

    vec3 q1 = rotY( t * 0.65) * p;
    res = opU(res, vec2(sdTorus(q1, vec2(R_outer,           r_outer      )), 2.0));

    vec3 q2 = rotX( t * 0.42) * p;
    res = opU(res, vec2(sdTorus(q2, vec2(R_outer,           r_outer      )), 3.0));

    vec3 q3 = rotZ( t * 0.50) * rotX(1.047) * p;
    res = opU(res, vec2(sdTorus(q3, vec2(R_outer,           r_outer      )), 4.0));

    // ── 3. Inner rings — counter-spin, smin-merge with orb ───
    // Tube swells then shrinks (breathing faster than outer rings)
    float R_inner = 0.52 + 0.08 * osc(0.70, PI);
    float r_inner = 0.030 + 0.022 * osc(1.40, 0.5);

    vec3 q4 = rotY(-t * 1.10) * rotX(0.785) * p;
    float d4 = sdTorus(q4, vec2(R_inner, r_inner));
    // Organically merge inner ring into orb when they're close
    res = opU(res, vec2(smin(d4, res.x, 0.08), 3.0));

    vec3 q5 = rotZ(-t * 0.90) * rotY(0.524) * p;
    float d5 = sdTorus(q5, vec2(R_inner, r_inner));
    res = opU(res, vec2(smin(d5, res.x, 0.08), 4.0));

    // ── 4. Fibonacci satellite cage — 13 nodes (mat 5) ───────
    // Cage radius expands on the beat like a shockwave catching up
    float cageR = 1.15 + 0.18 * osc(0.35, 0.0);
    vec3  fp    = rotY(t * 0.28) * rotX(t * 0.18) * p;
    for(int i = 0; i < 13; i++){
        float fi    = float(i);
        float angle = fi * 2.39996323;
        float inc   = acos(1.0 - 2.0*(fi + 0.5) / 13.0);
        vec3  pos   = vec3(sin(inc)*cos(angle), cos(inc), sin(inc)*sin(angle)) * cageR;
        float pulse = 0.038 + 0.016*osc(2.2, fi * 0.9);  // each bead has own phase
        res = opU(res, vec2(sdSphere(fp - pos, pulse), 5.0));
    }

    return res;
}

// ─── Raymarcher ───────────────────────────────────────────────
vec2 rayMarch(vec3 ro, vec3 rd){
    float d = 0.0;
    vec2  m = vec2(0.0);
    for(int i = 0; i < MAX_STEPS; i++){
        vec2 s = scene(ro + rd*d);
        if(s.x < SURF_DIST || d > MAX_DIST){ m = s; break; }
        d += s.x * 0.92;
    }
    return vec2(d, m.y);
}

vec3 getNormal(vec3 p){
    float e = 0.0005;
    return normalize(vec3(
        scene(p+vec3(e,0,0)).x - scene(p-vec3(e,0,0)).x,
        scene(p+vec3(0,e,0)).x - scene(p-vec3(0,e,0)).x,
        scene(p+vec3(0,0,e)).x - scene(p-vec3(0,0,e)).x
    ));
}

// ─── Material → color  (slow hue drift across palette) ────────
vec3 matCol(float id, vec3 n, float t){
    float drift = iTime * 0.04;   // full palette cycle every ~157 s
    if     (id < 1.5) return mix(cCyan,   cMint,   osc(1.3,  n.y*4.0 + drift));
    else if(id < 2.5) return mix(cGreen,  cCyan,   osc(0.9,  n.x*3.0 + drift*1.3));
    else if(id < 3.5) return mix(cPurple, cPink,   osc(0.7,  n.z*3.0 + drift*0.8));
    else if(id < 4.5) return mix(cPink,   cCyan,   osc(1.1,  n.y*5.0 + drift*1.1));
    else              return mix(cMint,   cIce,    osc(1.5,  n.x*6.0 + drift*0.9));
}

// ─── Lighting ─────────────────────────────────────────────────
vec3 shade(vec3 p, vec3 n, vec3 rd, float matID, float t){
    vec3  base = matCol(matID, n, t);
    vec3  V    = -rd;
    float hb   = beat(72.0);

    // Three lights orbit on different axes + radii vary on beat
    float lr = 2.0 + 0.6 * hb;
    vec3 L1 = normalize(vec3( lr*sin(t*0.6),  1.8,        lr*cos(t*0.6)));
    vec3 L2 = normalize(vec3(-1.5*cos(t*0.4), lr*sin(t*0.4), 1.2      ));
    vec3 L3 = normalize(vec3( 0.8,           -lr*sin(t*0.5), lr*cos(t*0.3)));

    vec3 diff = max(dot(n,L1),0.0)*cCyan*0.9
              + max(dot(n,L2),0.0)*cGreen*0.7
              + max(dot(n,L3),0.0)*cPurple*0.5;

    float spec = pow(max(dot(n,normalize(L1+V)),0.0),48.0)
               + pow(max(dot(n,normalize(L2+V)),0.0),32.0)*0.5;

    // Rim flares on heartbeat
    float rim  = pow(1.0 - max(dot(n,V),0.0), 2.5 + 1.5*hb);
    vec3  rimC = mix(cPink, cCyan, osc(0.5, matID*1.3)) * rim * (1.4 + 1.0*hb);

    return base*0.12 + base*diff*0.75 + cIce*spec*0.55 + rimC;
}

// ─── Background ───────────────────────────────────────────────
vec3 background(vec3 rd, float t){
    vec3 col = mix(cBg1, mix(cBg3, cBg2, rd.y*0.5+0.5), 0.7);
    col = mix(col, cBg4, abs(rd.x)*0.3);
    float nb = sin(rd.x*5.0 + iTime*0.12)*cos(rd.y*3.5 + iTime*0.09)*sin(rd.z*4.0);
    col += cPurple * max( nb,0.0)*0.12;
    col += cCyan   * max(-nb,0.0)*0.08;
    col += cCyan  *pow(max(0.0,dot(rd,normalize(vec3( 0.6, 0.4,-1.0)))),20.0)*0.25;
    col += cPurple*pow(max(0.0,dot(rd,normalize(vec3(-0.4, 0.7,-1.0)))),14.0)*0.20;
    return col;
}

// ─── Main ─────────────────────────────────────────────────────
void main(){
    float mn = min(iResolution.x, iResolution.y);
    vec2  uv = (gl_FragCoord.xy - 0.5*iResolution.xy) / mn;
    float t  = iTime * 0.25;

    // ── Camera: Lissajous figure-8 path ──────────────────────
    float ca = t * 0.35;
    float cb = t * 0.19;          // slightly incommensurate → never exactly repeats
    vec3 ro  = vec3(
        4.0*sin(ca) + 0.6*sin(cb*2.0 + 0.5),
        1.5 + 1.1*sin(cb),
        4.0*cos(ca) + 0.6*cos(cb*1.7)
    );
    vec3 fwd   = normalize(-ro);
    vec3 right = normalize(cross(vec3(0,1,0), fwd));
    vec3 up2   = cross(fwd, right);

    // FOV breathes gently — creates slow push-in / pull-out feel
    float fov = 1.38 + 0.12 * osc(0.38, 0.0);
    vec3 rd   = normalize(fwd*fov + uv.x*right + uv.y*up2);

    // ── Primary raymarch ─────────────────────────────────────
    vec2  rm    = rayMarch(ro, rd);
    float d     = rm.x;
    float matID = rm.y;

    vec3 col;
    if(d < MAX_DIST - 0.5){
        vec3 p = ro + rd*d;
        vec3 n = getNormal(p);
        col    = shade(p, n, rd, matID, t);
        float fog = 1.0 - exp(-d*0.07);
        col = mix(col, mix(cBg1, cBg3, 0.5+0.5*sin(iTime*0.1)), fog*0.45);
    } else {
        col = background(rd, t);
    }

    // ── Volumetric glow + periodic shockwave ─────────────────
    // Shockwave: every 6 s an energy ring expands from the origin
    float swPhase = mod(iTime * 0.7, 6.0);
    float swR     = swPhase * 1.35;
    float swFade  = exp(-swPhase * 0.55);
    vec3  swColor = mix(cCyan, cPink, osc(0.25, 0.0));

    float glow = 0.0;
    float sw   = 0.0;
    float gd   = 0.1;
    for(int i = 0; i < 44; i++){
        vec3  gp = ro + rd*gd;
        float gs = scene(gp).x;

        glow += exp(-max(gs,  0.0)*22.0) * 0.030;

        // shockwave sphere intersection along the ray
        float swD = abs(length(gp) - swR);
        sw   += exp(-swD*18.0) * swFade * 0.045;

        gd += max(gs*0.55, 0.025);
        if(gd > MAX_DIST) break;
    }

    col += cCyan   * glow * 0.80;
    col += cGreen  * glow * 0.55;
    col += cPink   * glow * 0.35;
    col += cPurple * glow * 0.25;
    col += swColor * sw   * 1.40;  // shockwave burst — bright & brief

    // ── Screen-edge pulse vignette (flares on heartbeat) ──────
    float vig  = 1.0 - smoothstep(0.50, 1.10, length(uv));
    float hb   = beat(72.0);
    col *= vig * (0.92 + 0.08*hb);
    // Faint pink corona at screen edge on beat
    col += cPink * (1.0 - vig) * hb * 0.18;

    // ── ACES tonemap + gamma ──────────────────────────────────
    col  = (col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
    col  = pow(max(col, vec3(0.0)), vec3(1.0/1.08));

    fragColor = vec4(col, 1.0);
}
