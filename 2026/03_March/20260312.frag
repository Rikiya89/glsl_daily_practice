uniform float uTime;
uniform vec2  uRes;
uniform float uSpeed;    // [0.3–2.0]  default 1.0
uniform float uGlow;     // [0.0–2.0]  default 1.0
uniform float uPulse;    // [0.0–1.0]  default 0.5
uniform float uFog;      // [0.0–1.0]  default 0.35
out vec4 fragColor;

#define PI      3.14159265
#define TAU     6.28318530

// ── rotation ─────────────────────────────────────────────────────────────
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0,s,0,1,0,-s,0,c);}
mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0,s,c,0,0,0,1);}

// ── noise ────────────────────────────────────────────────────────────────
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash3(i);
    float b = hash3(i + vec3(1,0,0));
    float c = hash3(i + vec3(0,1,0));
    float d = hash3(i + vec3(1,1,0));
    float e = hash3(i + vec3(0,0,1));
    float ff= hash3(i + vec3(1,0,1));
    float g = hash3(i + vec3(0,1,1));
    float h = hash3(i + vec3(1,1,1));
    return mix(
        mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
        mix(mix(e,ff,f.x), mix(g,h,f.x), f.y),
        f.z
    );
}

// 2-octave fbm (was 4 — halved)
float fbm(vec3 p) {
    float v = 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.1);
    return v;
}

// ── smooth booleans ──────────────────────────────────────────────────────
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// ── GGX specular ─────────────────────────────────────────────────────────
float ggx(float NdH, float rough) {
    float a2 = rough * rough;
    a2 *= a2;
    float d = NdH * NdH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d + 0.0001);
}

float schlickFresnel(float VdH) {
    float f = 1.0 - VdH;
    return 0.04 + 0.96 * f * f * f * f * f;
}

// ═══════════════════════════════════════════════════════════════════════════
// Curves with secondary wobble
// ═══════════════════════════════════════════════════════════════════════════
vec3 trefoil(float t, float R, float r, float T) {
    float ct = cos(t), st = sin(t);
    float c2 = cos(2.0*t), s2 = sin(2.0*t);
    vec3 base = vec3(
        (R + r * c2) * ct,
        (R + r * c2) * st,
        r * s2
    ) * 0.6;
    float wobble = sin(t * 5.0 + T * 1.2) * 0.012;
    base.y += wobble;
    base.x += wobble * 0.6 * cos(t * 3.0);
    return base;
}

vec3 trefoil2(float t, float R, float r, float T) {
    return rotZ(PI/6.0) * trefoil(t + TAU/3.0, R, r, T);
}

vec3 cinquefoil(float t, float R, float r, float T) {
    float c2 = cos(2.0*t), s2 = sin(2.0*t);
    float c5 = cos(5.0*t), s5 = sin(5.0*t);
    vec3 base = vec3(
        (R + r * c2) * c5,
        (R + r * c2) * s5,
        r * s2
    ) * 0.35;
    base.z += sin(t * 3.0 + T * 0.9) * 0.008;
    return base;
}

// ── tube SDF — reduced samples: 64/64/48 (was 96/96/80) ─────────────────
float sdCurve(vec3 p, int curveID, float T, float rad, int samples) {
    float md = 1e10;
    float R = 1.0 + 0.05 * sin(T * 0.3);
    float r = 0.45 + 0.03 * sin(T * 0.5);
    for (int i = 0; i < samples; i++) {
        float t = float(i) / float(samples) * TAU;
        vec3 cp;
        if (curveID == 0)      cp = trefoil(t, R, r, T);
        else if (curveID == 1) cp = trefoil2(t, R, r, T);
        else                   cp = cinquefoil(t, R * 1.6, r * 0.8, T);
        float d = length(p - cp) - rad;
        md = min(md, d);
    }
    return md;
}

// ═══════════════════════════════════════════════════════════════════════════
// Celtic Weave
// ═══════════════════════════════════════════════════════════════════════════
vec2 celticWeave(vec3 p, float d1, float d2, float d3, float T) {
    float angle = atan(p.y, p.x);
    float wave12 = sin(angle * 3.0 - T * 1.5);
    float wave13 = sin(angle * 5.0 + T * 0.8);
    float cut = 0.035, blend = 0.02;

    float s1 = d1, s2 = d2;
    if (wave12 > 0.0) s2 = smax(d2, -(d1 - cut), blend);
    else              s1 = smax(d1, -(d2 - cut), blend);

    float s3 = d3;
    if (wave13 > 0.0) s3 = smax(d3, -min(d1, d2) + cut * 0.6, blend);

    float d = smin(s1, smin(s2, s3, blend), blend);
    float id = 0.0;
    if (abs(d - s2) < abs(d - s1) && abs(d - s2) < abs(d - s3)) id = 1.0;
    else if (abs(d - s3) < abs(d - s1)) id = 2.0;
    return vec2(d, id);
}

// ═══════════════════════════════════════════════════════════════════════════
// Scene SDF
// ═══════════════════════════════════════════════════════════════════════════
vec2 map(vec3 p, float T) {
    p = rotY(T * 0.18) * rotX(sin(T * 0.12) * 0.35) * p;
    float tubeR = 0.048 + 0.01 * sin(T * 0.7) * uPulse;
    float d1 = sdCurve(p, 0, T, tubeR, 64);
    float d2 = sdCurve(p, 1, T, tubeR, 64);
    float d3 = sdCurve(p, 2, T, tubeR * 0.7, 48);
    return celticWeave(p, d1, d2, d3, T);
}

vec3 calcNormal(vec3 p, float T) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p+e.xyy,T).x - map(p-e.xyy,T).x,
        map(p+e.yxy,T).x - map(p-e.yxy,T).x,
        map(p+e.yyx,T).x - map(p-e.yyx,T).x
    ));
}

// ── AO: 4 steps (was 6) ─────────────────────────────────────────────────
float calcAO(vec3 p, vec3 n, float T) {
    float ao = 0.0, scale = 1.0;
    for (int i = 0; i < 4; i++) {
        float dist = 0.02 + 0.06 * float(i);
        ao += (dist - map(p + n * dist, T).x) * scale;
        scale *= 0.55;
    }
    return clamp(1.0 - ao * 5.0, 0.0, 1.0);
}

// ── soft shadow: 16 steps (was 24) ──────────────────────────────────────
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k, float T) {
    float res = 1.0, t = mint;
    for (int i = 0; i < 16; i++) {
        float h = map(ro + rd * t, T).x;
        res = min(res, k * h / t);
        t += clamp(h, 0.008, 0.15);
        if (t > maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}

float sss(vec3 p, vec3 n, vec3 lightDir, float T) {
    float thickness = map(p - n * 0.08, T).x;
    float scatter = max(0.0, dot(normalize(-n + lightDir * 0.6), lightDir));
    return pow(scatter, 3.0) * exp(-thickness * 12.0) * 0.4;
}

// ═══════════════════════════════════════════════════════════════════════════
// Volumetric god rays — 20 steps (was 40), 6 shadow steps (was 12)
// ═══════════════════════════════════════════════════════════════════════════
vec3 godRayLightPos(float T) {
    return vec3(
        2.5 * sin(T * 0.13 + 0.5),
        1.8 + 0.6 * sin(T * 0.09),
        2.5 * cos(T * 0.13 + 0.5)
    );
}

float volumetricGodRays(vec3 ro, vec3 rd, float maxT, float T) {
    vec3 lightPos = godRayLightPos(T);
    float accum = 0.0;
    int steps = 20;
    float stepSize = min(maxT, 5.0) / float(steps);

    for (int i = 0; i < 20; i++) {
        float tS = (float(i) + 0.5) * stepSize;
        vec3 sp = ro + rd * tS;
        float sceneDist = map(sp, T).x;

        if (sceneDist > 0.01) {
            vec3 toLight = lightPos - sp;
            float lightDist = length(toLight);
            vec3 lightDir = toLight / lightDist;

            // 6-step shadow ray (was 12)
            float shadow = 1.0;
            float tSh = 0.03;
            for (int j = 0; j < 6; j++) {
                float hSh = map(sp + lightDir * tSh, T).x;
                if (hSh < 0.003) { shadow = 0.0; break; }
                shadow = min(shadow, 6.0 * hSh / tSh);
                tSh += clamp(hSh, 0.03, 0.2);
                if (tSh > lightDist) break;
            }
            shadow = clamp(shadow, 0.0, 1.0);

            // 2-octave fbm fog density
            vec3 noisePos = sp * 1.8 + vec3(T * 0.06, T * 0.04, T * -0.03);
            float density = fbm(noisePos);
            density *= exp(-length(sp) * 0.4) * 0.035;

            float atten = 1.0 / (1.0 + lightDist * lightDist * 0.15);

            // Henyey-Greenstein phase
            float cosTheta = dot(rd, lightDir);
            float g = 0.6;
            float phase = (1.0 - g*g) / (4.0 * PI * pow(1.0 + g*g - 2.0*g*cosTheta, 1.5));

            accum += density * shadow * atten * phase * stepSize;
        }
    }
    return accum * uGlow * 8.0;
}

// ── dust motes: 10 (was 20) ─────────────────────────────────────────────
float dustMotes(vec3 ro, vec3 rd, float T) {
    float motes = 0.0;
    for (int i = 0; i < 10; i++) {
        float fi = float(i);
        vec3 motePos = vec3(
            sin(fi * 1.7 + T * 0.12) * 1.5,
            cos(fi * 2.3 + T * 0.08) * 1.0 + sin(fi * 0.7 + T * 0.15) * 0.4,
            sin(fi * 3.1 + T * 0.1) * 1.5
        );
        vec3 toMote = motePos - ro;
        float tProj = dot(toMote, rd);
        if (tProj < 0.0) continue;
        float dist = length(ro + rd * tProj - motePos);
        float brightness = exp(-dist * dist * 800.0) * 0.1;
        brightness *= 0.6 + 0.4 * sin(fi * 4.7 + T * 2.5);
        motes += brightness;
    }
    return motes * uGlow;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════
void main() {
    vec2 uv = vUV.st;
    float asp = uRes.x / uRes.y;
    vec2 screen = (uv - 0.5) * vec2(asp, 1.0);
    float T = uTime * uSpeed * 0.65;

    // ── eased cinematic camera ───────────────────────────────────────────
    float camPhase = T * 0.2;
    float camEase = camPhase + 0.15 * sin(camPhase * 0.7);
    float camDist = 2.5 + 0.5 * sin(T * 0.25) * cos(T * 0.11);
    vec3 camPos = vec3(
        sin(camEase) * camDist,
        sin(T * 0.15) * 0.7 + 0.4 + 0.15 * cos(T * 0.07),
        cos(camEase) * camDist
    );
    vec3 camTarget = vec3(sin(T * 0.05) * 0.08, sin(T * 0.07) * 0.1, cos(T * 0.06) * 0.05);
    vec3 camFwd   = normalize(camTarget - camPos);
    vec3 camRight = normalize(cross(camFwd, vec3(0,1,0)));
    vec3 camUp    = cross(camRight, camFwd);

    float focalLen = 1.6 + 0.08 * sin(T * 0.2);
    vec2 distorted = screen * (1.0 + 0.035 * dot(screen, screen));
    vec3 rd = normalize(distorted.x * camRight + distorted.y * camUp + focalLen * camFwd);

    // ── raymarch: 120 steps (was 150) ────────────────────────────────────
    float t = 0.0;
    float strandID = 0.0;
    bool hit = false;

    for (int i = 0; i < 120; i++) {
        vec3 p = camPos + rd * t;
        vec2 res = map(p, T);
        if (res.x < 0.0004) {
            hit = true;
            strandID = res.y;
            break;
        }
        if (t > 7.0) break;
        t += res.x * 0.78;
    }

    // ── shading ──────────────────────────────────────────────────────────
    vec3 col = vec3(0.0);
    float hitDist = hit ? t : 7.0;

    if (hit) {
        vec3 p = camPos + rd * t;
        vec3 n = calcNormal(p, T);
        vec3 v = -rd;
        float angle = atan(p.z, p.x);

        vec3 L1 = normalize(godRayLightPos(T) - p);
        vec3 L2 = normalize(vec3(-0.5, -0.2, -0.7));

        float NdL1 = max(dot(n, L1), 0.0);
        float NdL2 = max(dot(n, L2), 0.0);

        vec3 H1 = normalize(L1 + v);
        vec3 H2 = normalize(L2 + v);
        float NdH1 = max(dot(n, H1), 0.0);
        float NdH2 = max(dot(n, H2), 0.0);
        float VdH1 = max(dot(v, H1), 0.0);

        float spec1 = ggx(NdH1, 0.18) * schlickFresnel(VdH1);
        float spec2 = ggx(NdH2, 0.27) * 0.4;

        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.5);
        float rim = fresnel * (0.6 + 0.4 * sin(angle * 5.0 - T * 3.5));

        float scatter = sss(p, n, L1, T);
        float shadow  = softShadow(p + n * 0.005, L1, 0.01, 1.8, 14.0, T);
        float ao      = calcAO(p, n, T);

        vec3 refl = reflect(-v, n);
        float envRefl = pow(max(refl.y * 0.5 + 0.5, 0.0), 2.0) * 0.15;
        envRefl += pow(max(dot(refl, L1), 0.0), 16.0) * 0.3;

        float strandBright = strandID > 1.5 ? 0.5 : (strandID > 0.5 ? 0.8 : 1.0);
        float pulse = 0.8 + 0.2 * sin(angle * 3.0 - T * 2.5) * uPulse;
        float hotPulse = pow(max(sin(angle * 3.0 - T * 2.5), 0.0), 8.0) * uPulse * 0.3;

        float lum = 0.0;
        lum += NdL1 * 0.65 * shadow;
        lum += NdL2 * 0.2;
        lum += spec1 * 1.8 * uGlow;
        lum += spec2 * 0.5 * uGlow;
        lum += rim * 0.8 * uGlow;
        lum += scatter * uGlow;
        lum += envRefl * uGlow;
        lum += hotPulse * uGlow;
        lum += 0.05;
        lum *= ao * strandBright * pulse;

        col = vec3(lum);
        col *= exp(-t * t * uFog * 0.07);
    }

    // ── volumetric + motes + atmosphere ──────────────────────────────────
    col += vec3(volumetricGodRays(camPos, rd, hitDist, T));
    col += vec3(dustMotes(camPos, rd, T));
    col += vec3(
        exp(-length(screen) * 2.2) * 0.025 * uGlow +
        exp(-abs(length(screen) - 0.55) * 7.0) * 0.008 * uGlow
    );

    // ── vignette ─────────────────────────────────────────────────────────
    vec2 vigUV = uv - 0.5;
    col *= smoothstep(1.0, 0.25, dot(vigUV * vec2(1.1, 1.4), vigUV * vec2(1.1, 1.4)));

    // ── ACES + S-curve + monochrome ──────────────────────────────────────
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    col = smoothstep(0.0, 1.0, col);
    col = pow(max(col, 0.0), vec3(0.93));
    float mono = dot(col, vec3(0.299, 0.587, 0.114));
    col = vec3(mono);

    // ── grain + bloom ────────────────────────────────────────────────────
    col += (hash(uv * uRes + fract(uTime * 7.3)) - 0.5) * 0.025;
    col += max(mono - 0.65, 0.0) * 0.18 * exp(-length(screen) * 1.2);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}