uniform float uTime;
out vec4 fragColor;

mat2 rot(float a)
{
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float hash21(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float ggxD(float NdotH, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265 * d * d);
}

float fresnelSchlick(float cosTheta, float f0)
{
    return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

float fractalDE(vec3 p, float power)
{
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;

    for (int i = 0; i < 15; i++)
    {
        r = length(z);
        if (r > 2.0)
            break;

        float safeR = max(r, 1e-6);
        float theta = acos(clamp(z.z / safeR, -1.0, 1.0));
        float phi = atan(z.y, z.x);
        dr = power * pow(safeR, power - 1.0) * dr + 1.0;

        float zr = pow(safeR, power);
        theta *= power;
        phi *= power;
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        z += p;
    }

    return 0.5 * log(max(r, 1e-6)) * r / dr;
}

float fractalDETrap(vec3 p, float power, out vec3 trapOut)
{
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;
    float trapDot = 1e10;
    float trapXZ = 1e10;
    float trapY = 1e10;

    for (int i = 0; i < 15; i++)
    {
        r = length(z);
        if (r > 2.0)
            break;

        trapDot = min(trapDot, dot(z, z));
        trapXZ = min(trapXZ, length(z.xz));
        trapY = min(trapY, abs(z.y));

        float safeR = max(r, 1e-6);
        float theta = acos(clamp(z.z / safeR, -1.0, 1.0));
        float phi = atan(z.y, z.x);
        dr = power * pow(safeR, power - 1.0) * dr + 1.0;

        float zr = pow(safeR, power);
        theta *= power;
        phi *= power;
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        z += p;
    }

    trapOut = vec3(trapDot, trapXZ, trapY);
    return 0.5 * log(max(r, 1e-6)) * r / dr;
}

vec3 animateFractalSpace(vec3 p, float t)
{
    vec3 q1 = p;
    vec3 q2 = p;

    // Blend two gentle transform states with an eased phase.
    float phase = 0.5 + 0.5 * sin(t * 0.18);
    float ease = phase * phase * (3.0 - 2.0 * phase);

    q1.xy *= rot(0.08 + 0.14 * sin(t * 0.23));
    q1.xz *= rot(-0.28 + 0.10 * sin(t * 0.19 + 1.0));
    q1.yz *= rot(0.07 * sin(t * 0.21 + 2.2));

    q2.xy *= rot(-0.06 + 0.11 * sin(t * 0.17 + 2.4));
    q2.xz *= rot(-0.24 + 0.12 * sin(t * 0.15 + 4.2));
    q2.yz *= rot(0.09 * sin(t * 0.20 + 0.7));

    vec3 q = mix(q1, q2, ease);

    // Ribbon-like internal motion for a graceful transform feeling.
    float twist = 0.10 * sin(t * 0.36 + q.y * 1.1);
    float curl = 0.04 * sin(t * 0.54 + q.x * 1.3);
    q.xz *= rot(twist);
    q.yz *= rot(curl);

    vec3 flow = vec3(
        sin(q.y * 1.2 + t * 0.42),
        sin(q.z * 1.1 - t * 0.38),
        sin(q.x * 1.3 + t * 0.46)
    );
    q += 0.025 * flow;

    float breathe = 1.0 + 0.022 * sin(t * 0.42) + 0.012 * sin(t * 0.9);
    q *= breathe;
    q.y *= 1.0 + 0.032 * sin(t * 0.31);
    q.xz *= 1.0 - 0.016 * sin(t * 0.31);

    // Extra transformation animation: rotational morph + squash/stretch cycle.
    float transPhase = 0.5 + 0.5 * sin(t * 0.28);
    float transEase = transPhase * transPhase * (3.0 - 2.0 * transPhase);
    vec3 qMorph = q;
    qMorph.xz *= rot(-0.18 + 0.36 * transEase);
    qMorph.y *= mix(0.88, 1.14, transEase);
    qMorph.xz *= mix(1.1, 0.9, transEase);
    qMorph.x += 0.12 * sin(qMorph.y * 1.4 + t * 0.70);
    qMorph.z += 0.10 * cos(qMorph.y * 1.2 - t * 0.62);
    q = mix(q, qMorph, 0.34);

    return q;
}

float mapScene(vec3 p)
{
    float t = uTime * 1.4;
    float powerPhase = 0.5 + 0.5 * sin(t * 0.10);
    float powerEase = powerPhase * powerPhase * (3.0 - 2.0 * powerPhase);
    float powerA = 8.8 + 0.35 * sin(t * 0.13 + 0.25 * sin(t * 0.09));
    float powerB = 8.2 + 0.25 * sin(t * 0.11 + 2.4);
    float power = mix(powerA, powerB, powerEase * 0.6);

    vec3 qA = animateFractalSpace(p, t);
    float dA = fractalDE(qA, power);

    // Secondary transform state — more distinct for visible morphing
    vec3 qB = qA;
    qB.xy *= rot(0.2 * sin(t * 0.14));
    qB.yz *= rot(0.08 * cos(t * 0.18 + 1.3));
    qB.y += 0.12 * sin(qB.x * 1.1 + t * 0.22);
    qB.x += 0.06 * cos(qB.z * 0.9 - t * 0.26);
    float dB = fractalDE(qB, power - 0.08);
    float morph = 0.3 * (0.5 + 0.5 * sin(t * 0.12 + 1.0));

    return mix(dA, dB, morph);
}

vec4 mapSceneDetail(vec3 p)
{
    float t = uTime * 1.4;
    float powerPhase = 0.5 + 0.5 * sin(t * 0.10);
    float powerEase = powerPhase * powerPhase * (3.0 - 2.0 * powerPhase);
    float powerA = 8.8 + 0.35 * sin(t * 0.13 + 0.25 * sin(t * 0.09));
    float powerB = 8.2 + 0.25 * sin(t * 0.11 + 2.4);
    float power = mix(powerA, powerB, powerEase * 0.6);

    vec3 qA = animateFractalSpace(p, t);
    vec3 trapA;
    float dA = fractalDETrap(qA, power, trapA);

    vec3 qB = qA;
    qB.xy *= rot(0.2 * sin(t * 0.14));
    qB.yz *= rot(0.08 * cos(t * 0.18 + 1.3));
    qB.y += 0.12 * sin(qB.x * 1.1 + t * 0.22);
    qB.x += 0.06 * cos(qB.z * 0.9 - t * 0.26);
    vec3 trapB;
    float dB = fractalDETrap(qB, power - 0.08, trapB);
    float morph = 0.3 * (0.5 + 0.5 * sin(t * 0.12 + 1.0));

    float d = mix(dA, dB, morph);
    vec3 trap = mix(trapA, trapB, morph);
    return vec4(d, trap);
}

float rayMarch(vec3 ro, vec3 rd, out int steps)
{
    float t = 0.0;
    const float maxDist = 30.0;
    const float surfEps = 0.0004;

    for (int i = 0; i < 160; i++)
    {
        vec3 p = ro + rd * t;
        float d = mapScene(p);
        if (d < surfEps * (1.0 + t * 0.12))
        {
            steps = i;
            return t;
        }
        t += d * 0.76;
        if (t > maxDist)
            break;
    }

    steps = 160;
    return -1.0;
}

vec3 getNormal(vec3 p, float t)
{
    float eps = 0.001 + t * 0.00008;
    vec2 e = vec2(1.0, -1.0) * eps;
    return normalize(
        e.xyy * mapScene(p + e.xyy) +
        e.yyx * mapScene(p + e.yyx) +
        e.yxy * mapScene(p + e.yxy) +
        e.xxx * mapScene(p + e.xxx)
    );
}

float softShadow(vec3 ro, vec3 rd)
{
    float shade = 1.0;
    float t = 0.012;
    float ph = 1e10;
    for (int i = 0; i < 48; i++)
    {
        float h = mapScene(ro + rd * t);
        float y = h * h / (2.0 * ph);
        float d = sqrt(max(h * h - y * y, 0.0));
        shade = min(shade, 20.0 * d / max(0.0001, t - y));
        ph = h;
        t += clamp(h, 0.012, 0.2);
        if (h < 0.0002 || t > 14.0)
            break;
    }
    return clamp(shade, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n)
{
    float occ = 0.0;
    float scale = 1.0;
    for (int i = 1; i <= 7; i++)
    {
        float h = 0.008 + 0.05 * float(i);
        float d = mapScene(p + n * h);
        occ += (h - d) * scale;
        scale *= 0.6;
    }
    return clamp(1.0 - 2.0 * occ, 0.0, 1.0);
}

void main()
{
    vec2 uv = vUV.xy * 2.0 - 1.0;
    float time = uTime * 0.63;
    uv += 0.003 * vec2(sin(time * 0.43), cos(time * 0.39)) * smoothstep(1.35, 0.0, dot(uv, uv));

    // Slow cinematic orbit with eased altitude
    float orbitAngle = time * 0.09;
    float camDist = 4.6 + 0.5 * sin(time * 0.12);
    float altPhase = 0.5 + 0.5 * sin(time * 0.14);
    float altEase = altPhase * altPhase * (3.0 - 2.0 * altPhase);
    vec3 ro = vec3(
        sin(orbitAngle) * camDist,
        mix(-0.25, 0.4, altEase) + 0.08 * sin(time * 0.31),
        -cos(orbitAngle) * camDist
    );
    ro.x += 0.12 * sin(time * 0.27 + 1.4);
    ro.z += 0.10 * cos(time * 0.22 + 2.8);

    // Gentle target drift
    vec3 ta = vec3(
        sin(time * 0.11 + 0.8) * 0.12,
        sin(time * 0.15 + 1.2) * 0.08,
        cos(time * 0.09) * 0.05
    );
    vec3 ww = normalize(ta - ro);
    // Subtle camera roll
    float roll = 0.06 * sin(time * 0.1 + 1.5);
    vec3 up = vec3(sin(roll), cos(roll), 0.0);
    vec3 uu = normalize(cross(up, ww));
    vec3 vv = cross(ww, uu);
    // Breathing focal length — slow zoom in/out
    float focalPhase = 0.5 + 0.5 * sin(time * 0.08);
    float focalEase = focalPhase * focalPhase * (3.0 - 2.0 * focalPhase);
    float focal = mix(1.7, 2.1, focalEase) + 0.06 * sin(time * 0.31);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + focal * ww);

    int steps = 0;
    float t = rayMarch(ro, rd, steps);

    vec3 col;
    if (t > 0.0)
    {
        vec3 p = ro + rd * t;
        vec3 n = getNormal(p, t);

        // Orbit trap detail at hit point
        vec4 detailed = mapSceneDetail(p);
        vec3 trap = detailed.yzw;
        float trapDetail = clamp(trap.x * 0.5, 0.0, 1.0);
        float trapEdge = clamp(trap.y, 0.0, 1.0);
        float trapCrease = clamp(trap.z * 2.0, 0.0, 1.0);

        // Trap-driven roughness: crevices rougher, smooth areas shinier
        float roughness = mix(0.12, 0.45, trapDetail);

        // Orbiting key light
        float lightAngle = time * 0.14;
        vec3 l = normalize(vec3(
            sin(lightAngle) * 0.7,
            0.65 + 0.12 * sin(time * 0.19),
            -cos(lightAngle) * 0.6
        ));
        // Sweeping back light — counter-orbit
        float backAngle = -time * 0.11 + 1.5;
        vec3 backL = normalize(vec3(
            sin(backAngle) * 0.55,
            0.3 + 0.1 * sin(time * 0.23),
            cos(backAngle) * 0.65
        ));
        // Drifting fill
        vec3 fillDir = normalize(vec3(
            0.35 + 0.2 * sin(time * 0.17),
            0.2,
            0.8 + 0.15 * cos(time * 0.21)
        ));
        vec3 h = normalize(l - rd);

        // Core dot products
        float NdotL = max(dot(n, l), 0.0);
        float NdotH = max(dot(n, h), 0.0);
        float NdotV = max(dot(n, -rd), 0.0);

        // Shadow
        float sh = softShadow(p + n * 0.003, l);

        // GGX specular — dual-lobe with trap-driven roughness
        float F = fresnelSchlick(NdotV, 0.04);
        float spec = ggxD(NdotH, roughness) * F;
        float specFine = ggxD(NdotH, roughness * 0.3) * fresnelSchlick(NdotV, 0.08);

        // Fresnel rim
        float rim = fresnelSchlick(NdotV, 0.02);
        float back = pow(max(dot(n, backL), 0.0), 1.6);
        float fill = max(dot(n, fillDir), 0.0);
        float edge = smoothstep(0.25, 1.0, rim);

        // Ambient occlusion — multi-sample + step-based
        float ao = ambientOcclusion(p, n);
        float stepAO = clamp(1.0 - float(steps) / 160.0, 0.0, 1.0);
        ao *= stepAO;

        // Subsurface scattering approximation
        float sss = pow(clamp(dot(rd, l), 0.0, 1.0), 2.0) * 0.14;
        sss *= clamp(1.0 - trapDetail * 2.0, 0.0, 1.0);
        sss *= (0.8 + 0.2 * trapCrease);

        // Environment reflection
        float envBright = 0.5 + 0.5 * dot(reflect(rd, n), l);
        float envRefl = fresnelSchlick(NdotV, 0.02) * envBright * ao;

        // Compose lighting
        float light = 0.06;
        light += 1.1 * NdotL * sh;
        light += 0.28 * fill * (0.5 + 0.5 * ao);
        light += 0.2 * back * (0.6 + 0.4 * ao);
        light += 0.7 * spec * sh;
        light += 0.3 * specFine * sh;
        light += 0.6 * rim * (0.4 + 0.6 * ao);
        light += sss;
        light += 0.15 * envRefl;
        light *= 0.9 + 0.55 * ao;

        // Surface micro-detail from orbit traps — 3-channel layered
        float detail = 0.92 + 0.08 * sin(trapDetail * 14.0 + time * 0.5);
        detail *= 0.95 + 0.05 * sin(trapEdge * 10.0 - time * 0.3);
        detail *= 0.97 + 0.03 * sin(trapCrease * 18.0 + time * 0.7);
        light *= detail;

        // Edge shimmer
        float beautyPulse = 0.5 + 0.5 * sin(time * 0.55 + t * 0.25);
        float shimmer = edge * (0.7 + 0.3 * beautyPulse);

        light += 0.06 * shimmer;
        light = smoothstep(0.0, 1.05, light);

        // Fog with forward scattering
        float fogDensity = 0.010 + 0.004 * sin(time * 0.15);
        float fog = 1.0 - exp(-fogDensity * t * t);
        float fogGray = 0.22 + 0.04 * (0.5 + 0.5 * sin(time * 0.18));
        float scatter = pow(max(dot(rd, l), 0.0), 6.0) * 0.12;
        fogGray += scatter * (1.0 - fog * 0.5);

        col = vec3(mix(light, fogGray, fog));
    }
    else
    {
        float h = clamp(0.5 + 0.5 * uv.y, 0.0, 1.0);
        col = mix(vec3(0.015), vec3(0.08), h);
        float bgGlow = exp(-3.0 * dot(uv, uv));
        col += vec3(0.04 * bgGlow);
    }

    // Breathing center glow
    float glowBreathe = 0.5 + 0.5 * sin(time * 0.2);
    float centerGlow = exp(-(2.2 + 0.6 * glowBreathe) * dot(uv, uv));
    col += vec3((0.02 + 0.015 * glowBreathe) * centerGlow);

    // Vignette
    float vignette = 0.75 + 0.25 * smoothstep(1.6, 0.0, dot(uv, uv));
    col *= vignette;

    // ACES filmic tone mapping
    col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);

    // Convert to B&W — wider tonal range with S-curve
    float bw = dot(col, vec3(0.299, 0.587, 0.114));
    bw = smoothstep(0.005, 0.99, bw);
    float sCurve = bw * bw * (3.0 - 2.0 * bw);
    bw = mix(bw, sCurve, 0.35);
    bw = clamp(pow(bw, 0.82) * 1.06 + 0.008, 0.0, 1.0);

    // Film grain — luminance-adaptive
    float grain = hash21(uv * 500.0 + fract(time * 13.7)) * 0.035 - 0.0175;
    float grainMask = 1.0 - bw * 0.6;
    bw += grain * grainMask;

    col = vec3(clamp(bw, 0.0, 1.0));
    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
