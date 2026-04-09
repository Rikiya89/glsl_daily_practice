
uniform float iTime;
layout(location = 0) out vec4 fragColor;

// ─── Palette ──────────────────────────────────────────────────
const vec3 cBg1    = vec3(0.039, 0.059, 0.051);
const vec3 cBg2    = vec3(0.051, 0.129, 0.216);
const vec3 cBg3    = vec3(0.102, 0.102, 0.180);
const vec3 cGreen  = vec3(0.000, 1.000, 0.529);
const vec3 cCyan   = vec3(0.000, 0.831, 1.000);
const vec3 cPurple = vec3(0.482, 0.184, 1.000);
const vec3 cPink   = vec3(1.000, 0.176, 0.478);
const vec3 cMint   = vec3(0.690, 1.000, 0.910);
const vec3 cIce    = vec3(0.878, 0.969, 1.000);

#define MAX_STEPS 140
#define MAX_DIST  20.0
#define SURF_DIST 0.0008
#define TAU  6.28318530718
#define PI   3.14159265359

mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// ─── Shape library (all parameterized 0..TAU) ─────────────────

// A: (3,5) torus knot — 8-crossing star knot
vec3 shapeA(float phi) {
    float p = 3.0, q = 5.0;
    float r = cos(q*phi) + 2.0;
    return vec3(
        r * cos(p*phi),
        r * sin(p*phi),
        -sin(q*phi)
    ) * 0.26;
}

// B: Triple helix (3 strands braided — Borromean spirit)
vec3 shapeB(float phi) {
    float braid = sin(phi * 3.0) * 0.22;
    float R = 0.55 + braid;
    float lift = cos(phi * 3.0) * 0.28;
    return vec3(R*cos(phi), lift, R*sin(phi));
}

// C: Viviani curve (figure-8 on sphere)
vec3 shapeC(float phi) {
    float s = 0.60;
    return vec3(
        s * (1.0 + cos(phi)) * 0.5 * cos(phi),
        s * sin(phi),
        s * (1.0 + cos(phi)) * 0.5 * sin(phi)
    );
}

// D: (2,7) torus knot — thin elegant 7-crossing
vec3 shapeD(float phi) {
    float p = 2.0, q = 7.0;
    float r = cos(q*phi) + 2.2;
    return vec3(
        r * cos(p*phi),
        r * sin(p*phi),
        -sin(q*phi)
    ) * 0.22;
}

// E: Seifert-inspired surface spine — double helical twist
vec3 shapeE(float phi) {
    float twist = phi * 2.5;
    float R = 0.50 + 0.20 * cos(phi * 4.0);
    return vec3(
        R * cos(phi),
        0.30 * sin(twist),
        R * sin(phi)
    );
}

// F: Lemniscate of Bernoulli extruded in 3D
vec3 shapeF(float phi) {
    float s   = sin(phi);
    float denom = 1.0 + s*s;
    float x   = 0.70 * cos(phi) / denom;
    float y   = 0.70 * cos(phi)*sin(phi) / denom;
    float z   = 0.25 * sin(phi * 3.0);
    return vec3(x, y, z);
}

// ─── Sequential blend (like the version you liked) ────────────
// 6 shapes, 5s each, 1.2s crossfade — clear A→B→C→D→E→F→A
vec3 spine(float phi, float t) {
    float period  = 12.0;   // total cycle
    float perShape= period / 6.0;   // 2s per shape
    float p       = mod(t, period);

    // Which segment and local blend
    float seg  = p / perShape;       // 0..6
    int   i0   = int(floor(seg)) % 6;
    int   i1   = (i0 + 1) % 6;
    float raw  = fract(seg);

    // Ease: flat hold then smooth crossfade in last 0.40 of segment
    float fadeStart = 0.60;
    float blend = smoothstep(fadeStart, 1.0, raw);
    // Quintic ease for extra smoothness
    blend = blend*blend*blend*(blend*(blend*6.0-15.0)+10.0);

    // Evaluate both shapes
    vec3 s0, s1;
    if      (i0==0) s0=shapeA(phi); else if(i0==1) s0=shapeB(phi);
    else if (i0==2) s0=shapeC(phi); else if(i0==3) s0=shapeD(phi);
    else if (i0==4) s0=shapeE(phi); else            s0=shapeF(phi);
    if      (i1==0) s1=shapeA(phi); else if(i1==1) s1=shapeB(phi);
    else if (i1==2) s1=shapeC(phi); else if(i1==3) s1=shapeD(phi);
    else if (i1==4) s1=shapeE(phi); else            s1=shapeF(phi);

    return mix(s0, s1, blend);
}

// Active shape index 0..5 (fractional for color blend)
float shapeIdx(float t) {
    float period  = 12.0;
    float perShape= period / 6.0;
    return mod(t, period) / perShape;  // 0..6
}

// ─── Tube radius breathes independently ───────────────────────
float tubeRadius(float t) {
    return 0.060 + 0.014 * sin(t * 0.8) + 0.007 * sin(t * 2.1);
}

// ─── SDF: dual interlocking tubes ─────────────────────────────
// Two tubes on same spine, offset by PI — they interlock
float sdDualTube(vec3 p, float t) {
    float d   = MAX_DIST;
    int   N   = 110;
    float tr  = tubeRadius(t);

    // Tube A (phi 0..TAU)
    vec3 prevA = spine(0.0,    t);
    // Tube B (phi offset by PI — interlocked)
    vec3 prevB = spine(PI,     t);

    for (int i = 1; i <= N; i++) {
        float phiA = TAU * float(i) / float(N);
        float phiB = phiA + PI;

        vec3 curA = spine(phiA, t);
        vec3 curB = spine(phiB, t);

        // Capsule A
        vec3 paA = p - prevA, baA = curA - prevA;
        float hA = clamp(dot(paA,baA)/dot(baA,baA), 0.0, 1.0);
        d = min(d, length(paA - baA*hA) - tr);

        // Capsule B
        vec3 paB = p - prevB, baB = curB - prevB;
        float hB = clamp(dot(paB,baB)/dot(baB,baB), 0.0, 1.0);
        d = min(d, length(paB - baB*hB) - tr * 0.85);  // slightly thinner

        prevA = curA;
        prevB = curB;
    }
    return d;
}

// ─── Scene ────────────────────────────────────────────────────
float scene(vec3 p) {
    float t = iTime;
    p.xz = rot(t * 0.13) * p.xz;
    p.xy = rot(t * 0.06) * p.xy;
    return sdDualTube(p, t);
}

// ─── Raymarcher ───────────────────────────────────────────────
float rayMarch(vec3 ro, vec3 rd) {
    float d = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        float s = scene(ro + rd * d);
        if (s < SURF_DIST || d > MAX_DIST) break;
        d += s * 0.88;
    }
    return d;
}

vec3 getNormal(vec3 p) {
    float e = 0.001;
    return normalize(vec3(
        scene(p+vec3(e,0,0)) - scene(p-vec3(e,0,0)),
        scene(p+vec3(0,e,0)) - scene(p-vec3(0,e,0)),
        scene(p+vec3(0,0,e)) - scene(p-vec3(0,0,e))
    ));
}

// ─── Color palette per shape ──────────────────────────────────
vec3 paletteForShape(float idx) {
    // 6 distinct hue identities
    vec3 cols[6];
    cols[0] = cGreen;   // A: trefoil-like → green
    cols[1] = cCyan;    // B: triple helix → cyan
    cols[2] = cPurple;  // C: Viviani → purple
    cols[3] = cPink;    // D: 7-knot → pink
    cols[4] = cMint;    // E: Seifert → mint
    cols[5] = cIce;     // F: Lemniscate → ice

    int   i0    = int(floor(idx)) % 6;
    int   i1    = (i0 + 1) % 6;
    float blend = (1.0 - cos(fract(idx) * PI)) * 0.5;
    return mix(cols[i0], cols[i1], blend);
}

// ─── Shading ──────────────────────────────────────────────────
vec3 shade(vec3 pos, vec3 nor, vec3 rd) {
    float t      = iTime;
    float NdotV  = max(dot(nor, -rd), 0.0);
    float fresnel= pow(1.0 - NdotV, 3.2);

    float idx    = shapeIdx(t);
    vec3  sigCol = paletteForShape(idx);
    vec3  nxtCol = paletteForShape(idx + 1.2);

    // Color wave flowing along tube
    float ang    = atan(pos.z, pos.x);
    float band   = ang * 2.5 + pos.y * 3.5 + t * 1.5;
    float wave   = sin(band) * 0.5 + 0.5;
    float wave2  = sin(band * 1.7 + 2.3) * 0.5 + 0.5;

    vec3 body    = mix(sigCol, nxtCol, wave * 0.45);
    body         = mix(body, cIce,    wave2 * 0.10);
    vec3 rimCol  = mix(sigCol, cPink,  fresnel * 0.8);
    // Second tube slightly cooler rim
    rimCol       = mix(rimCol, cCyan, wave2 * 0.3);

    vec3 L       = normalize(vec3(1.0, 1.8, -1.2));
    float diff   = max(dot(nor, L), 0.0);
    vec3 h       = normalize(L - rd);
    float spec   = pow(max(dot(nor, h), 0.0), 140.0);
    float rim1   = pow(1.0 - NdotV, 2.6);
    float rim2   = pow(1.0 - NdotV, 7.0);

    return body   * diff * 0.25
         + rimCol * rim1 * 2.5
         + rimCol * rim2 * 1.3
         + body   * 0.28
         + cIce   * spec * 1.1;
}

// ─── Background ───────────────────────────────────────────────
vec3 background(vec3 rd) {
    float y  = rd.y * 0.5 + 0.5;
    vec3  bg = mix(cBg1, mix(cBg2, cBg3, 0.5), y * y);
    bg += cBg3 * pow(max(1.0 - abs(rd.y), 0.0), 4.0) * 0.3;
    vec2 id = floor(rd.xy * 140.0);
    float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5);
    if (h > 0.986) bg += cIce * (h - 0.986) * 55.0;
    return bg;
}

// ─── Main ─────────────────────────────────────────────────────
void main() {
    vec2 uv = vUV.st;
    vec2 st = uv * 2.0 - 1.0;
    st.x   *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

    float t      = iTime;
    float camR   = 2.9;
    float camAng = t * 0.10;
    float camY   = 0.42 * sin(t * 0.13) * cos(t * 0.06);
    vec3  ro     = vec3(sin(camAng)*camR, camY, cos(camAng)*camR);
    vec3  fwd    = normalize(-ro);
    vec3  rgt    = normalize(cross(vec3(0,1,0), fwd));
    vec3  up     = cross(fwd, rgt);
    vec3  rd     = normalize(fwd + st.x*rgt*0.82 + st.y*up*0.82);

    float d   = rayMarch(ro, rd);
    bool  hit = d < MAX_DIST;

    vec3 col;
    if (!hit) {
        col = background(rd);
    } else {
        vec3 pos = ro + rd * d;
        vec3 nor = getNormal(pos);
        col      = shade(pos, nor, rd);
        float fog = 1.0 - exp(-d * 0.08);
        col = mix(col, background(rd), fog * 0.35);
    }

    float vig = 1.0 - dot(st * 0.38, st * 0.38);
    col      *= smoothstep(0.0, 1.0, vig);
    col       = col / (col + 0.55);
    col       = pow(max(col, 0.0), vec3(0.88));

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
