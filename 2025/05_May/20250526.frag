// 🌸 Elegant Pastel Mandala Shader
uniform float u_time;
uniform vec2  u_resolution;
out vec4      fragColor;

#define TAU 6.28318530718

//---------------------- Elegant Pastel Palette ----------------------
vec3 palette(float t){
    vec3 a = vec3(0.92, 0.90, 0.89);  // elegant ivory tone
    vec3 b = vec3(0.12, 0.13, 0.14);  // low contrast for subtlety
    vec3 c = vec3(1.0);
    vec3 d = vec3(0.03, 0.20, 0.55);
    return a + b * cos(TAU * (c * t + d));
}

//---------------------- Star Shape SDF ----------------------
float star(vec2 p, float n){
    float angle  = atan(p.y, p.x);
    float radius = length(p);
    float k      = cos(angle * n) * 0.5 + 0.5;
    return abs(radius - 0.25 * (1.0 - k));
}

void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    float zoom = 0.6 + 0.06 * sin(u_time * 0.2);
    uv /= zoom;

    float rot = 0.2 * u_time;
    uv = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * uv;

    float r     = length(uv);
    float theta = atan(uv.y, uv.x);

    //--------- Layer 1: Soft Aura Background ----------
    float aura = exp(-5.0 * pow(r, 2.0));
    vec3  col  = palette(0.15 + 0.12 * sin(u_time * 0.17)) * aura;

    //--------- Layer 2: 8-Point Star Mandala ----------
    float dStar    = star(uv, 8.0);
    float starMask = smoothstep(0.02, 0.0, dStar);
    vec3  starCol  = palette(0.45 + 0.20 * sin(u_time * 0.27 + theta * 2.0));
    col += starCol * starMask * 1.1;

    //--------- Layer 3: 16-Petal Ring ---------------
    float petals = abs(cos(theta * 8.0)) * 0.35 + 0.15;
    float ring   = smoothstep(petals - 0.008, petals, r) *
                  (1.0 - smoothstep(petals, petals + 0.01, r));
    vec3 ringCol = palette(0.75 + 0.18 * cos(u_time * 0.22));
    col += ringCol * ring;

    //--------- Layer 4: Animated 24-Petal Bloom -------
    float baseRad   = 0.14 + 0.02 * sin(u_time * 0.45);
    float petals2 = abs(sin(theta * 10.0)) * 0.35 + baseRad;
    float ring2     = smoothstep(petals2 - 0.006, petals2, r) *
                      (1.0 - smoothstep(petals2, petals2 + 0.008, r));
    vec3  petalCol  = palette(0.58 + 0.22 * sin(u_time * 0.18));
    col += petalCol * ring2 * 0.95;

    //--------- Layer 5: Spiral Glow Accents ----------
    vec2 spiralUV = uv * (1.0 + 0.05 * sin(u_time * 0.2));
    float spiralGlow = abs(sin(8.0 * atan(spiralUV.y, spiralUV.x) + u_time * 0.4)) *
                       exp(-4.0 * length(spiralUV));
    vec3 spiralCol = palette(0.25 + 0.15 * sin(u_time * 0.3));
    col += spiralCol * spiralGlow * 0.35;  // more elegant

    //--------- Outer Halo Fading ----------------------
    float halo = smoothstep(0.7, 0.25, r);
    col *= 1.0 - halo * 0.4;

    //--------- Pastel Glow Blend ----------------------
    col = mix(col, vec3(1.0), 0.35);  // toward elegant white

    //--------- Elegant Vignette ------------------------
    float vignette = smoothstep(0.9, 0.3, r);
    col *= 0.95 + 0.05 * vignette;

    //--------- Final Gamma Tweak ----------------------
    col = pow(col, vec3(0.9));

    fragColor = vec4(col, 1.0);
}