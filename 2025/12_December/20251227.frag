out vec4 fragColor;
uniform float u_time;
uniform vec2  u_resolution;

#define PI 3.14159265359

mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float opOnion(float d, float t) { return abs(d) - t; }

float scene(vec3 p) {
    float t = u_time * 0.35;
    
    // Central hollow sphere cluster
    vec3 q = p;
    q.xy *= rot(t * 0.4);
    q.yz *= rot(t * 0.25);
    
    float sphere = sdSphere(q, 1.8);
    sphere = opOnion(sphere, 0.05); // Hollow shell
    
    // Inner core - pulsing
    float pulse = 0.8 + 0.2 * sin(t * 3.0);
    float core = sdSphere(q, 0.5 * pulse);
    
    // Orbiting rings at different angles
    float rings = 1e10;
    for(int i = 0; i < 4; i++) {
        float fi = float(i);
        vec3 rp = p;
        rp.xy *= rot(fi * PI * 0.25 + t * 0.3);
        rp.yz *= rot(fi * PI * 0.33);
        float ringSize = 2.5 + fi * 0.3;
        float thickness = 0.03 + 0.02 * sin(t + fi);
        rings = min(rings, sdTorus(rp, vec2(ringSize, thickness)));
    }
    
    // Floating monoliths
    float monoliths = 1e10;
    for(int i = 0; i < 8; i++) {
        float fi = float(i);
        float angle = fi * PI * 0.25 + t * 0.15;
        float radius = 4.5 + sin(t * 0.5 + fi) * 0.8;
        float height = sin(t * 0.7 + fi * 1.5) * 2.0;
        
        vec3 mp = p - vec3(cos(angle) * radius, height, sin(angle) * radius);
        mp.xy *= rot(t * 0.5 + fi);
        mp.yz *= rot(t * 0.3 + fi * 0.7);
        
        // Tall thin boxes
        vec3 size = vec3(0.08, 0.6 + 0.3 * sin(t + fi), 0.08);
        monoliths = min(monoliths, sdBox(mp, size));
    }
    
    // Connecting beams of light (capsules)
    float beams = 1e10;
    for(int i = 0; i < 6; i++) {
        float fi = float(i);
        float a1 = fi * PI / 3.0 + t * 0.2;
        float a2 = a1 + PI * 0.5;
        
        vec3 p1 = vec3(cos(a1) * 2.0, sin(t + fi) * 0.5, sin(a1) * 2.0);
        vec3 p2 = vec3(cos(a2) * 3.5, sin(t * 0.7 + fi) * 1.5, sin(a2) * 3.5);
        
        beams = min(beams, sdCapsule(p, p1, p2, 0.015));
    }
    
    // Combine with smooth blending
    float shape = smin(sphere, core, 0.2);
    shape = smin(shape, rings, 0.1);
    shape = min(shape, monoliths);
    shape = min(shape, beams);
    
    // Infinite grid floor
    float gridY = -3.5;
    float ground = p.y - gridY;
    
    return min(shape, ground);
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0005, 0.0);
    return normalize(vec3(
        scene(p + e.xyy) - scene(p - e.xyy),
        scene(p + e.yxy) - scene(p - e.yxy),
        scene(p + e.yyx) - scene(p - e.yyx)
    ));
}

float calcAO(vec3 p, vec3 n) {
    float ao = 0.0;
    for(int i = 1; i <= 6; i++) {
        float dist = 0.08 * float(i);
        ao += (dist - scene(p + n * dist)) / float(i);
    }
    return clamp(1.0 - ao * 2.0, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float k) {
    float res = 1.0;
    float t = 0.05;
    for(int i = 0; i < 48; i++) {
        float h = scene(ro + rd * t);
        res = min(res, k * max(h, 0.0) / t);
        t += clamp(h, 0.01, 0.3);
        if(res < 0.01 || t > 20.0) break;
    }
    return clamp(res, 0.0, 1.0);
}

float gridPattern(vec3 p) {
    vec2 grid = abs(fract(p.xz * 0.5) - 0.5);
    float line = min(grid.x, grid.y);
    return smoothstep(0.0, 0.03, line);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    
    // Cinematic camera - elegant wide shot
    float camT = u_time * 0.12;
    float camR = 22.0 + sin(u_time * 0.08) * 3.0;
    float camH = 6.0 + sin(u_time * 0.15) * 2.0;
    vec3 ro = vec3(sin(camT) * camR, camH, cos(camT) * camR);
    vec3 ta = vec3(0.0, -0.5, 0.0);
    
    // Subtle camera sway
    ro.x += sin(u_time * 0.3) * 0.5;
    ro.z += cos(u_time * 0.25) * 0.5;
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 2.5 * ww);
    
    // Raymarching
    float t = 0.0;
    float d;
    vec3 p;
    int steps = 0;
    
    for(int i = 0; i < 150; i++) {
        p = ro + rd * t;
        d = scene(p);
        if(d < 0.0003 || t > 50.0) break;
        t += d * 0.6;
        steps = i;
    }
    
    // Rich gradient background - pure monochrome
    float bgGrad = uv.y * 0.5 + 0.5;
    bgGrad = pow(bgGrad, 1.5);
    vec3 col = vec3(mix(0.02, 0.85, bgGrad));
    
    // Add subtle radial gradient
    float radial = 1.0 - length(uv) * 0.3;
    col *= radial;
    
    if(d < 0.001) {
        vec3 n = calcNormal(p);
        
        // Primary key light
        vec3 keyLight = normalize(vec3(0.5, 0.9, 0.4));
        float keyDiff = max(dot(n, keyLight), 0.0);
        float keyShadow = softShadow(p + n * 0.01, keyLight, 24.0);
        
        // Fill light (opposite side, softer)
        vec3 fillLight = normalize(vec3(-0.6, 0.4, -0.5));
        float fillDiff = max(dot(n, fillLight), 0.0) * 0.4;
        
        // Rim/back light
        vec3 rimLight = normalize(vec3(0.0, 0.2, -1.0));
        float rim = pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
        float rimDiff = max(dot(n, -rd), 0.0);
        
        // Top light for highlights
        vec3 topLight = vec3(0.0, 1.0, 0.0);
        float topDiff = max(dot(n, topLight), 0.0) * 0.3;
        
        // Specular highlights - multiple
        float spec1 = pow(max(dot(reflect(-keyLight, n), -rd), 0.0), 80.0);
        float spec2 = pow(max(dot(reflect(-fillLight, n), -rd), 0.0), 40.0) * 0.4;
        float spec3 = pow(max(dot(reflect(-topLight, n), -rd), 0.0), 120.0) * 0.6;
        
        // Ambient occlusion
        float ao = calcAO(p, n);
        
        // Ground grid pattern
        float isGround = 1.0 - step(0.01, abs(p.y + 3.5));
        float grid = gridPattern(p);
        
        // Compose tonal values
        float ambient = 0.08;
        float diffuse = keyDiff * keyShadow * 0.5 + fillDiff * 0.3 + topDiff;
        float specular = (spec1 + spec2 + spec3) * 0.7;
        float rimVal = rim * 0.5;
        
        float lum = ambient + diffuse + specular + rimVal;
        lum *= ao;
        
        // Ground treatment - reflective grid
        if(isGround > 0.5) {
            lum = mix(lum * 0.6, lum, grid);
            // Reflection fade
            float reflFade = exp(-abs(p.y + 3.5) * 0.5);
            lum += reflFade * 0.1;
        }
        
        // Glow on thin geometry (beams, rings)
        float glow = float(steps) / 150.0 * 0.15;
        lum += glow;
        
        col = vec3(lum);
        
        // Tonal separation - push blacks and whites
        col = smoothstep(vec3(0.0), vec3(1.0), col);
        
        // Atmospheric depth - fade to mid gray
        float fogAmount = 1.0 - exp(-t * 0.025);
        vec3 fogColor = vec3(0.5 + uv.y * 0.2);
        col = mix(col, fogColor, fogAmount * 0.7);
    }
    
    // Floating light particles
    for(int i = 0; i < 20; i++) {
        float fi = float(i);
        float pt = u_time * 0.4 + fi * 2.1;
        vec3 pp = vec3(
            sin(pt * 0.6 + fi * 0.7) * 6.0,
            sin(pt * 0.4 + fi) * 3.0 + sin(fi) * 2.0,
            cos(pt * 0.5 + fi * 0.5) * 6.0
        );
        
        vec3 toP = pp - ro;
        float proj = dot(toP, rd);
        if(proj > 0.0 && proj < t) {
            float dist = length(ro + rd * proj - pp);
            float intensity = exp(-dist * 12.0) * 0.8;
            float flicker = 0.6 + 0.4 * sin(u_time * 5.0 + fi * 3.0);
            col += intensity * flicker;
        }
    }
    
    // Scan lines (subtle CRT effect)
    float scanline = sin(gl_FragCoord.y * 1.5) * 0.02 + 1.0;
    col *= scanline;
    
    // Vignette - oval, subtle
    vec2 vigUV = uv * vec2(0.8, 1.0);
    float vig = 1.0 - pow(length(vigUV) * 0.7, 2.5);
    col *= mix(0.7, 1.0, vig);
    
    // Final contrast enhancement
    col = pow(col, vec3(1.1));
    col = clamp(col, 0.0, 1.0);
    
    // Subtle noise grain
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
    col += (grain - 0.5) * 0.03;
    
    fragColor = vec4(col, 1.0);
}