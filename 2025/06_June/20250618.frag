// TouchDesigner GLSL TOP (GLSL 3.30)
// “Rose-Nebula💎DIVINE BLOOM” – The peak of sacred spiritual visual geometry

uniform float time;
uniform vec2 resolution;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c){
    vec3 p = abs(fract(c.x + vec3(0.0,2./3.,1./3.))*6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

float hash21(vec2 p){ return fract(sin(dot(p, vec2(27.619, 57.583))) * 43758.5453); }
float noise(vec2 p){
    vec2 i = floor(p), f = fract(p), u = f*f*(3.0 - 2.0*f);
    return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
               mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// Sacred geometry
vec2 swirl(vec2 uv, float k){
    float r = length(uv), a = atan(uv.y, uv.x) + k * r;
    return vec2(cos(a), sin(a)) * r;
}
vec2 rose(vec2 uv, float petals, float freq){
    float r = length(uv), a = atan(uv.y, uv.x);
    float shape = cos(petals * a + 0.15 * sin(freq * a + time * 0.6));
    return uv * mix(0.3, 1.0, shape) * r * 0.85;
}
vec2 kaleido(vec2 uv, float seg){
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    a = mod(a + time * 0.05, 6.28318 / seg);
    return vec2(cos(a), sin(a)) * r;
}

// Radiant pulse
float burstLayer(float a, float len, float speed, float spokes){
    float ray = abs(sin(a * spokes - time * speed + sin(len * 9.)));
    return smoothstep(.1, .3, ray) * (1.0 - len);
}

// Flower-of-life interference pattern
float sacredCircle(vec2 uv){
    float sum = 0.0;
    for(int i = 0; i < 6; i++){
        float angle = 3.1415 / 3.0 * float(i);
        vec2 offset = vec2(cos(angle), sin(angle)) * 0.3;
        sum += smoothstep(0.15, 0.01, length(fract(uv + offset) - 0.5));
    }
    return sum / 6.0;
}

// MAIN
void main(){
    float scale = min(resolution.x, resolution.y);
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / scale;

    // Zooming breath + sacred rotation
    float zoom = 1.0 + 0.06 * sin(time * 0.3);
    uv *= zoom;

    vec2 baseUV = uv;
    uv = kaleido(uv, 8.0);
    uv = rose(uv, 6.0 + sin(time * 0.2), 12.0);
    uv = swirl(uv, 1.2 + 0.05 * sin(time * 0.5));

    float len = length(uv);
    float ang = atan(uv.y, uv.x);

    // Living fog
    float fog = fbm(uv * 3.0 + time * 0.02) * 0.5 +
                fbm(uv * 1.0 - time * 0.01) * 0.3 +
                fbm(uv * 0.6 + time * 0.005) * 0.2;

    // Additional sacred layers
    float burst = burstLayer(ang, len, 2.2, 14.0);
    float rings = smoothstep(0.015, 0.0, abs(sin(len * 34.0 - time * 4.0)));
    float ripple = smoothstep(0.02, 0.0, abs(sin(len * 48.0 - time * 5.0)));
    float glow = exp(-pow(len * 5.5, 2.0)) * 0.95;
    float flowerGrid = sacredCircle(baseUV * 2.2) * 0.5;

    // Radiant gradient
    float t = smoothstep(0.0, 1.0, len * 1.3);
    vec3 grad = mix(hsv2rgb(vec3(0.04, 0.18, 0.96)),
                    hsv2rgb(vec3(0.65, 0.2, 0.85)), t);

    float h = fract(time * 0.03);
    vec3 colFog   = hsv2rgb(vec3(h + 0.4, 0.15, 0.75)) * fog;
    vec3 colBurst = hsv2rgb(vec3(h + 0.1, 0.15, 1.0)) * burst * 1.2;
    vec3 colRings = hsv2rgb(vec3(h + 0.08, 0.3, 1.0)) * rings;
    vec3 colRipple = hsv2rgb(vec3(h + 0.25, 0.4, 0.95)) * ripple;
    vec3 colGlow  = vec3(1.0, 0.96, 0.92) * glow;
    vec3 colSacred = vec3(0.9, 0.98, 1.0) * flowerGrid;

    vec3 color = grad + colFog + colRings + colRipple + colBurst + colGlow + colSacred;

    // Sparkling dust
    color += (hash21(gl_FragCoord.xy + time * 20.0) * 0.04 - 0.02);

    // Vignette & softness
    color *= smoothstep(0.95, 0.2, len);
    color = pow(color, vec3(0.85));

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}