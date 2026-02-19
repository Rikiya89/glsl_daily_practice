uniform float uTime;
uniform vec2  uRes;      // TD Vectors1 — e.g. 1280.0  720.0
uniform float uDepth;    // water depth darkness  [0.2–0.8]  default 0.45
uniform float uSpeed;    // animation speed       [0.3–2.0]  default 1.0
uniform float uRayInt;   // god-ray intensity     [0.0–1.5]  default 0.7
uniform float uGlow;     // bioluminescence       [0.0–1.0]  default 0.35
uniform float uHaze;     // water turbidity       [0.0–1.0]  default 0.3
out vec4 fragColor;

// ── palette ───────────────────────────────────────────────────────────────
#define C_DEEP_P   vec3(0.212, 0.176, 0.471)  // #362d78
#define C_MID_P    vec3(0.322, 0.247, 0.639)  // #523fa3
#define C_BRIGHT_P vec3(0.569, 0.424, 0.800)  // #916ccc
#define C_SOFT_P   vec3(0.741, 0.631, 0.898)  // #bda1e5
#define C_PALE     vec3(0.784, 0.753, 0.914)  // #c8c0e9
#define C_SKY      vec3(0.518, 0.729, 0.906)  // #84bae7
#define C_BLUE     vec3(0.318, 0.416, 0.831)  // #516ad4
#define C_DARK_B   vec3(0.200, 0.247, 0.529)  // #333f87
#define C_SHADOW   vec3(0.161, 0.188, 0.224)  // #293039
#define C_REEF     vec3(0.157, 0.212, 0.192)  // #283631

// ── hash / noise — 2D and 3D ──────────────────────────────────────────────
float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),
                          dot(p,vec2(269.5,183.3)))) * 43758.5453);
}
// 3D hash — maps a vec3 domain to a scalar
float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
    return mix(mix(hash21(i),           hash21(i+vec2(1,0)), u.x),
               mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y);
}
// 3D trilinear noise — feeds (x, y, time) for evolving organic patterns
float noise3(vec3 p) {
    vec3 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
    return mix(
        mix(mix(hash31(i),              hash31(i+vec3(1,0,0)), u.x),
            mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), u.x), u.y),
        mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), u.x),
            mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), u.x), u.y),
        u.z);
}
// Orthogonal rotation matrix for fbm3 — breaks axis-aligned banding each octave
const mat3 M3 = mat3( 0.00, 0.80, 0.60,
                     -0.80, 0.36,-0.48,
                     -0.60,-0.48, 0.64);
// 3D FBM — use vec3(uv, T) to get temporally-evolving organic fields
float fbm3(vec3 p) {
    float v=0., a=.5;
    for(int i=0;i<4;i++){ v+=a*noise3(p); p=M3*p*2.+.5; a*=.5; }
    return v;
}
float fbm(vec2 p) {
    float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5; }
    return v;
}
float smin(float a, float b, float k) {
    float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25;
}
// 3D directional light (upper-right, slightly toward viewer)
const vec3 LDIR = normalize(vec3(0.35, 0.75, 0.57));

// ── Voronoi caustics — animated cell pattern ──────────────────────────────
float voronoi(vec2 p, float T) {
    vec2 i=floor(p), f=fract(p); float d=1e9;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
        vec2 n=vec2(x,y), pt=n+.5+.45*sin(T*.5+6.2831*hash22(i+n));
        d=min(d, length(f-pt));
    }
    return d;
}
float caustics(vec2 p, float T) {
    // vec3 domain warp: time is the z-axis, creating organically evolving caustics
    vec3 cq = vec3(p * 4.0, T * 0.13);
    vec2 wp = p + vec2(noise3(cq) - 0.5,
                       noise3(cq + vec3(1.7, 2.3, 0.9)) - 0.5) * 0.07;
    float c = voronoi(wp*3.5,T) + voronoi(wp*6.2+vec2(1.9,2.7),T*1.25)*.5;
    return pow(max(0.,1.-c*.78),3.5);
}

// ── Beer-Lambert absorption (red first, then green, blue persists) ─────────
vec3 absorb(vec3 col, float depth) {
    return col*exp(-vec3(0.28,0.11,0.03)*depth);
}

// ── 2D SDFs ───────────────────────────────────────────────────────────────
float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa=p-a, ba=b-a;
    return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));
}
float sdCircle(vec2 p, float r) { return length(p)-r; }

// ── coral tree ────────────────────────────────────────────────────────────
float coralTree(vec2 p, vec2 root, float h, float T, float seed) {
    vec2 tip=root+vec2(sin(seed*6.28)*.015,h);
    float d=sdSeg(p,root,tip)-.007;
    d=min(d,sdCircle(p-tip,.013));
    for(int i=0;i<4;i++){
        float fi=float(i);
        vec2  bBase=mix(root,tip,.25+fi*.18);
        float ang=(hash21(vec2(seed,fi))-.5)*2.8;
        float bl=h*(.22+hash21(vec2(fi,seed+1.))*.2);
        vec2  bTip=bBase+vec2(sin(ang)*bl*.6,cos(ang)*bl);
        d=min(d,sdSeg(p,bBase,bTip)-.004);
        d=min(d,sdCircle(p-bTip,.007+hash21(vec2(seed+fi))*.005));
    }
    return d;
}

// ── brain coral — wrinkled circle SDF ────────────────────────────────────
float brainCoral(vec2 p, vec2 center, float r, float seed) {
    vec2  q=p-center;
    float ang=atan(q.y,q.x), dist=length(q);
    float w=sin(ang*9.+seed*3.)*.018+sin(ang*14.+seed*7.)*.009;
    return dist-r-w-noise(q*14.+seed)*.007;
}

// ── organ-pipe pillar coral ───────────────────────────────────────────────
float pillarCoral(vec2 p, vec2 base, float h, float seed) {
    float d=1e9;
    for(int i=0;i<3;i++){
        float fi=float(i), ox=(fi/2.-.5)*.045;
        float ht=h*(.65+hash21(vec2(seed,fi))*.35);
        float r=.011+hash21(vec2(seed+fi,1.))*.007;
        vec2 top=vec2(base.x+ox,base.y+ht);
        d=min(d,sdSeg(p,base+vec2(ox,0.),top)-r);
        d=min(d,sdCircle(p-top,r*1.5));
    }
    return d;
}

// ── gorgonian sea fan ─────────────────────────────────────────────────────
float fanCoral(vec2 p, vec2 center, float r, float T, float seed) {
    float d=1e9;
    for(int i=0;i<11;i++){
        float fi=float(i)/10.;
        float ang=(fi-.5)*2.+sin(T*.35+seed)*.05;
        vec2  dir=vec2(sin(ang),cos(ang));
        float len=r*(.4+.6*hash21(vec2(seed,fi)));
        d=min(d,sdSeg(p,center,center+dir*len)-.003);
        d=min(d,sdCircle(p-(center+dir*len),.007));
    }
    return d;
}

// ── sea urchin — spiky radial SDF ─────────────────────────────────────────
float seaUrchin(vec2 p, vec2 center, float r, float seed) {
    vec2  q=p-center;
    float ang=atan(q.y,q.x);
    float sp=abs(sin(ang*18.+seed))*.38+abs(sin(ang*11.+seed*1.7))*.18;
    return length(q)-r*(1.+sp*.55);
}
// ── table / plate coral — horizontal plate on a stalk ─────────────────────
float tableCoral(vec2 p, vec2 base, float w, float h, float T, float seed) {
    float d=1e9;
    vec2  top=base+vec2(sin(seed)*.01,h*.76);
    d=min(d,sdSeg(p,base,top)-.007);
    vec2  qp=p-(base+vec2(0.,h*.88));
    vec2  bd=abs(qp)-vec2(w,.011);
    d=min(d,length(max(bd,0.))+min(max(bd.x,bd.y),0.));
    return d;
}

// ── seaweed ribbon ────────────────────────────────────────────────────────
float seaweed(vec2 p, vec2 base, float T, float seed) {
    float d=1e9; vec2 prev=base;
    for(int k=1;k<10;k++){
        float fk=float(k)/9.;
        vec2 cur=vec2(base.x+sin(fk*5.+T*1.8+seed*6.28)*.04*fk, base.y+fk*.19);
        d=min(d,sdSeg(p,prev,cur)-.005*(1.-fk*.4)); prev=cur;
    }
    return d;
}

// ── jellyfish bell — scalloped dome, two-harmonic organic pulse ───────────
// Anatomy: only the exumbrella (outer bell surface). Tentacles rendered separately.
float jellyBell(vec2 p, vec2 center, float r, float T, float seed) {
    vec2  q=p-center;
    float phase=T*2.2+seed;
    // Two-harmonic pulse mirrors real jellyfish muscular contraction rhythm
    float pulse=0.07*(sin(phase)*0.65+sin(phase*2.1)*0.35);
    // Squished dome (taller than wide), pulsing horizontally
    float bell=length(q*vec2(1./(r*(1.+pulse)), 1./(r*0.82)))-1.;
    // 8-lobe scalloped bell margin (characteristic of scyphozoa class)
    float mAng=atan(q.x, max(abs(q.y),1e-4));
    float scallop=sin(mAng*8.+seed*2.)*r*.065+sin(mAng*4.+seed)*r*.03;
    return max(bell, -(q.y+r*.04+scallop));
}

// ── sea anemone — column + waving tentacle crown ──────────────────────────
float anemone(vec2 p, vec2 base, float r, float T, float seed) {
    float d=sdSeg(p,base-vec2(0.,.004),base+vec2(0.,r*.18))-r*.16;
    for(int i=0;i<12;i++){
        float fi=float(i);
        // Tentacles span upper 240° with individual sway
        float ang=fi/12.*4.189+seed+.785+ sin(T*1.5+fi*.9+seed)*.28;
        float len=r*(.6+hash21(vec2(seed+fi,1.))*.5);
        vec2  tip=base+vec2(0.,r*.2)+vec2(cos(ang),sin(ang))*len;
        d=min(d,sdSeg(p,base+vec2(0.,r*.2),tip)-.003);
        d=min(d,sdCircle(p-tip,.006));
    }
    return d;
}

// ── rock blob — noise-bumped ellipse ─────────────────────────────────────
float rock(vec2 p, vec2 center, float rx, float ry, float seed) {
    vec2  q=(p-center)/vec2(rx,ry);
    float ang=atan(q.y,q.x);
    return length(q)-(1.+noise(vec2(ang*2.5+seed,.5))*.18);
}

// ── starfish — 5-arm cosine SDF ───────────────────────────────────────────
float starfish(vec2 p, vec2 center, float r, float rot) {
    vec2  q=p-center;
    float arms=cos((atan(q.y,q.x)+rot)*5.)*.5+.5;
    return length(q)-r*(.28+arms*.72);
}

// ── god ray from water surface ────────────────────────────────────────────
float lightRay(vec2 uv, float xPos, float ang, float w) {
    vec2  dir=normalize(vec2(sin(ang),-1.)), d=uv-vec2(xPos,1.);
    float proj=dot(d,dir);
    return smoothstep(w,0.,length(d-proj*dir))*smoothstep(-.05,.58,-proj);
}


// ── rising bubbles ────────────────────────────────────────────────────────
float bubbles(vec2 uv, float T) {
    float b=0.;
    for(int i=0;i<10;i++){
        float fi=float(i);
        vec2  c=vec2(hash21(vec2(fi,1.))+sin(T*.4+fi)*.015,
                     fract(T*(.07+hash21(vec2(fi,0.))*.08)+hash21(vec2(fi,2.)))*.5);
        float r=.006+hash21(vec2(fi,3.))*.007;
        b+=smoothstep(.003,0.,abs(sdCircle(uv-c,r)+r*.15));
    }
    return b;
}

// ── marine snow — slow drifting particles ─────────────────────────────────
float marineSno(vec2 uv, float T, float density) {
    float s=0.;
    for(int i=0;i<20;i++){
        float fi=float(i), spd=.018+hash21(vec2(fi,20.))*.025;
        vec2  sp=vec2(hash21(vec2(fi,21.))+sin(T*.2+fi*2.3)*.012,
                      1.-fract(T*spd+hash21(vec2(fi,22.))));
        float r=.0016+hash21(vec2(fi,23.))*.0024;
        s+=smoothstep(r*2.5,0.,length(uv-sp));
    }
    return s*density;
}

// ── aurora energy meridian — slow sine-wave ribbon of light ──────────────
float auroraThread(vec2 uv, float yBase, float freq, float amp, float spd, float T) {
    float wave = yBase + sin(uv.x*freq + T*spd)*amp
                       + sin(uv.x*freq*.37 + T*spd*1.4 + 1.3)*amp*.4;
    float d = abs(uv.y - wave);
    return smoothstep(.026, .0, d)
         * smoothstep(0., .12, uv.y)
         * smoothstep(1., .55, uv.y);
}

// ── main ──────────────────────────────────────────────────────────────────
void main() {
    vec2  uv  = vUV.st;
    float asp = uRes.x/uRes.y;
    vec2  p   = vec2(uv.x*asp, uv.y);    // aspect-correct for all SDFs
    float T   = uTime*uSpeed*0.38;

    // ── water column — initial Beer-Lambert pass ──────────────────────────
    vec3 col=mix(
        mix(C_SHADOW, C_DARK_B, smoothstep(0.,.48,uv.y)),
        mix(C_BLUE,   C_PALE,   smoothstep(.5,1.,uv.y)),
        smoothstep(0.,1.,uv.y));
    col=absorb(col,(1.-uv.y)*uDepth*2.8);
    // vec3 double-warp: fbm3 warps its own domain for non-repeating turbulence
    vec3 wI  = vec3(uv*2.5, T*0.08);
    float warp = fbm3(wI + vec3(0.5,1.7,0.3)) - 0.5;
    col += fbm3(wI + warp*0.14) * 0.06 * C_BRIGHT_P;

    // ── Snell's window — bright portal where sky light enters ─────────────
    // Physics: within ~48° of vertical, underwater you see the outside world
    vec2  swVec=(uv-vec2(.5,1.))*vec2(1.,.68);
    float swDst=length(swVec);
    float swRipple=sin(swDst*32.-T*5.5)*noise(vec2(swDst*9.,T*.9))*.014;
    float snell=smoothstep(.36+swRipple,.13,swDst)*smoothstep(0.,.2,1.-uv.y);
    col=mix(col, col+C_SKY*.55+C_PALE*.4, snell*uRayInt*.68);
    // Total internal reflection tint just outside window
    col+=C_BLUE*smoothstep(.45,.37,swDst)*(1.-snell)*.09;
    // ── divine portal ring: pulsing halo at critical angle boundary ───────
    float portalRing=smoothstep(.04,.0,abs(swDst-.245))*(0.5+0.5*sin(T*1.8));
    col+=(C_PALE+C_SKY*.5)*portalRing*uRayInt*.75;
    // Radial spokes of sacred geometry within the window
    float spokes=pow(abs(sin(atan(swVec.y,swVec.x)*6.)),8.);
    col+=C_PALE*spokes*snell*.22;

    // ── god rays with scintillation ───────────────────────────────────────
    float rays=0.;
    for(int i=0;i<7;i++){
        float fi=float(i);
        float xr=.08+fi/6.*.84;
        float ang=(hash21(vec2(fi,9.))-.5)*.7+sin(T*.18+fi)*.09;
        float wr=.018+sin(T*.28+fi*.9)*.007;
        float ri=lightRay(uv,xr,ang,wr)*(.45+.55*sin(T*.5+fi));
        ri*=.65+.35*noise(vec2(uv.x*3.+fi,T*.5));   // flickering particles
        rays+=ri;
    }
    col+=rays*uRayInt*(C_PALE*.28+C_SKY*.16);

    // ── aurora energy meridians — 3 slow sine-wave ribbons of light ─────────
    col+=C_BRIGHT_P*auroraThread(uv,.55,3.1,.04,.18,T)*uGlow*.55;
    col+=C_SKY     *auroraThread(uv,.68,2.3,.05,.14,T)*uGlow*.42;
    col+=C_SOFT_P  *auroraThread(uv,.42,4.2,.03,.22,T)*uGlow*.36;

    // ── mid-water turbidity — vec3(uv, T) gives volumetric particulate feel ─
    float haze=fbm3(vec3(uv*3., T*.015))*uHaze;
    col=mix(col,col*.96+C_DARK_B*.05,haze*smoothstep(.95,.2,uv.y)*.6);

    // ── background reef wall — textured dark rock mass on left/right ────────
    float wallN=fbm3(vec3(uv*2.8, T*.004));
    float wallL=smoothstep(.30+wallN*.06,.10,uv.x)*smoothstep(.10,.40,uv.y);
    float wallR=smoothstep(.70-wallN*.06,.90,uv.x)*smoothstep(.10,.40,uv.y);
    float wall=max(wallL,wallR);
    if(wall>.001){
        vec3 wc=mix(C_SHADOW,mix(C_DARK_B,C_REEF,.28),fbm3(vec3(uv*6.,T*.006+1.)));
        // Encrusting organisms: dim purple algae patches
        wc+=C_DEEP_P*fbm3(vec3(uv*18.,T*.008+2.))*.32;
        col=mix(col,wc,wall*.80);
    }

    // ── reef floor — sand ripples + Voronoi caustics ──────────────────────
    float fNoise=fbm(uv*5.+T*.012);
    float floorY=.19+fNoise*.05;
    floorY+=sin((uv.x+noise(uv*4.+T*.025)*.08)*38.)*.003;
    if(uv.y<floorY){
        // Sand vs rocky zones separated by a slow noise boundary
        float zoneN=fbm3(vec3(uv.x*5., uv.y, T*.004));
        vec3  sandC=mix(C_REEF, mix(C_DARK_B,C_SHADOW,.4), fbm3(vec3(uv*9., T*.018)));
        vec3  rockC=mix(C_SHADOW, C_DARK_B, fbm3(vec3(uv*11.+1.7, T*.009)));
        vec3  fc   =mix(sandC, rockC, smoothstep(.35,.65,zoneN));
        fc=mix(fc,fc+C_SOFT_P*caustics(uv,T)*.22,smoothstep(floorY-.05,floorY,uv.y));
        col=mix(fc,col,smoothstep(floorY-.01,floorY+.01,uv.y));
    }

    // ── rocks — noise-bumped blobs on floor ───────────────────────────────
    for(int ri=0;ri<3;ri++){
        float fi=float(ri), rseed=hash21(vec2(fi*9.1,11.));
        vec2  rc=vec2((.12+fi/2.*.76)*asp, floorY-(.018+rseed*.02)*asp);
        float rd=rock(p,rc,(.048+rseed*.04)*asp,(.03+rseed*.024)*asp,rseed*7.);
        vec3  rcol=mix(C_SHADOW,mix(C_DARK_B,C_REEF,.35),fbm(p*6.+rseed));
        col=mix(col,rcol,smoothstep(.003,-.001,rd));
        // Subtle specular on wet rock surface
        col+=C_BLUE*smoothstep(.008,.003,rd)*smoothstep(-.001,-.006,rd)*.2;
    }

    // ── coral rubble — scattered small broken fragments on floor ─────────────
    for(int rbi=0;rbi<8;rbi++){
        float fi=float(rbi), rseed=hash21(vec2(fi*3.7,13.));
        float r=(.007+rseed*.006)*asp;
        vec2  rc=vec2((.04+fi/7.*.92)*asp, floorY-r*.55);
        vec3  rc2=mix(C_DARK_B,mix(C_REEF,C_MID_P,rseed),.5);
        col=mix(col,rc2,smoothstep(.002,-.001,sdCircle(p-rc,r)));
    }

    // ── corals — 4 types with polyp surface texture ───────────────────────
    for(int ci=0;ci<8;ci++){
        float fi=float(ci), seed=hash21(vec2(fi*7.3,3.));
        float cxUV=.05+fi/7.*.9, ch=.07+seed*.16;
        vec2  root=vec2(cxUV*asp,floorY);
        float d;
        float tp=mod(fi,4.);
        if     (tp<1.) d=coralTree  (p,root,ch,T,seed*10.);
        else if(tp<2.) d=brainCoral (p,root+vec2(0.,ch*.5),ch*.52,seed*10.);
        else if(tp<3.) d=pillarCoral(p,root,ch,seed*10.);
        else           d=tableCoral (p,root,(.04+seed*.05)*asp,ch,T,seed*10.);
        float ht=clamp((uv.y-floorY)/ch,0.,1.);
        vec3  cc=mix(mix(C_DEEP_P,C_MID_P,seed),mix(C_BRIGHT_P,C_SOFT_P,seed),ht);
        // vec3 polyp bump: noise3(vec3(pos, seed)) — unique 3D surface per coral
        float polyp=fbm3(vec3(p*22., seed*4.))*.45+.55;
        cc=mix(cc,cc*polyp,.32);
        // vec3 surface normal estimated from noise3 gradient (central differences)
        float eps3=0.0008;
        float bx=noise3(vec3(p+vec2(eps3,0.), seed*7.3))
                -noise3(vec3(p-vec2(eps3,0.), seed*7.3));
        float by=noise3(vec3(p+vec2(0.,eps3), seed*7.3))
                -noise3(vec3(p-vec2(0.,eps3), seed*7.3));
        vec3  norm=normalize(vec3(bx, by, 0.014));
        // Phong lighting: diffuse + specular using vec3 LDIR
        float diff=max(0., dot(norm, LDIR));
        float spec=pow(max(0., dot(reflect(-LDIR,norm), vec3(0,0,1))), 22.);
        cc *= 0.52+diff*0.48;
        cc += C_PALE*spec*0.45*(0.15+rays*uRayInt);
        float mask=smoothstep(.004,-.001,d);
        float rim =smoothstep(.009,.003,d)*(1.-mask);
        col=mix(col,cc,mask);
        col+=rim*C_PALE*.4;
        // Bioluminescent tips + soft halo
        col+=mix(C_MID_P,C_BRIGHT_P,seed)*pow(ht,3.5)*mask*uGlow*.5;
        col+=mix(C_MID_P,C_BRIGHT_P,seed)*smoothstep(.055,0.,d)*(1.-mask)*uGlow*.12;
    }

    // ── sea fans ──────────────────────────────────────────────────────────
    for(int fi2=0;fi2<4;fi2++){
        float fi=float(fi2), seed=hash21(vec2(fi*11.7,5.));
        vec2  base=vec2((.1+fi/3.*.8)*asp,floorY);
        float d=fanCoral(p,base,.07+seed*.11,T,seed*10.);
        vec3  cc=mix(C_BLUE,C_BRIGHT_P,seed);
        col=mix(col,cc,smoothstep(.003,-.001,d)*.85);
        col+=smoothstep(.009,.003,d)*C_PALE*.3;
    }

    // ── sea anemones — glowing tentacle crowns ────────────────────────────
    for(int ai=0;ai<3;ai++){
        float fi=float(ai), seed=hash21(vec2(fi*13.7,6.));
        vec2  abase=vec2((.15+fi/2.*.7)*asp,floorY);
        float r=(.04+seed*.04)*asp;
        float d=anemone(p,abase,r,T,seed*10.);
        vec3  ac=mix(C_BRIGHT_P,C_SOFT_P,seed);
        float mask=smoothstep(.004,-.001,d);
        col=mix(col,ac,mask);
        col+=C_PALE*smoothstep(.01,.004,d)*(1.-mask)*.5;
        // Pulse bioluminescence on tips
        col+=ac*uGlow*pow(mask,2.)*(.3+.3*sin(T*2.+seed*4.));
    }

    // ── seaweed ───────────────────────────────────────────────────────────
    for(int si=0;si<6;si++){
        float fi=float(si), seed=hash21(vec2(fi*5.1,7.));
        vec2  base=vec2((.07+fi/5.*.86)*asp,floorY);
        col=mix(col,mix(C_DARK_B,C_MID_P,seed),
                smoothstep(.003,-.001,seaweed(p,base,T+seed*6.28,seed)));
    }

    // ── starfish — slowly rotating on the reef floor ──────────────────────
    for(int sfi=0;sfi<2;sfi++){
        float fi=float(sfi), seed=hash21(vec2(fi*17.3,8.));
        float sfr=(.022+seed*.012)*asp;
        vec2  sfc=vec2((.2+fi*.55)*asp, floorY+sfr*.6);
        float d=starfish(p,sfc,sfr,T*.07+seed*6.28);
        vec3  sc=mix(C_BRIGHT_P,C_SOFT_P,seed);
        col=mix(col,sc,smoothstep(.004,-.001,d));
        col+=C_PALE*smoothstep(.008,.004,d)*smoothstep(-.001,-.005,d)*.4;
    }

    // ── sea urchins — 3 spiky echinoderm silhouettes on floor ────────────────
    for(int ui=0;ui<3;ui++){
        float fi=float(ui), useed=hash21(vec2(fi*19.3,9.));
        float ur=(.018+useed*.012)*asp;
        vec2  uc=vec2((.08+fi/2.*.84)*asp, floorY-ur*.5);
        float d=seaUrchin(p,uc,ur,useed*6.28);
        vec3  uc2=mix(C_SHADOW,C_DEEP_P,useed*.4);
        col=mix(col,uc2,smoothstep(.003,-.001,d));
        // Subtle spine glow from bioluminescence
        col+=C_BRIGHT_P*smoothstep(.008,.002,d)*(1.-smoothstep(-.001,-.004,d))*uGlow*.28;
    }


    // ── jellyfish — 5-layer rendering: fill / rim / veins / rings / tentacles
    for(int ji=0;ji<2;ji++){
        float fi=float(ji), seed=hash21(vec2(fi*19.1,4.));
        float jT=T+seed*6.28;
        float r=(.046+seed*.03)*asp;
        vec2  jPos=vec2((.18+fi*.62)*asp,
                         .50+seed*.18+sin(jT*.22+seed)*.065);
        jPos.x+=sin(jT*.11+seed)*.09*asp;
        // Slow iridescent hue cycle: purple → sky-blue → soft-lavender
        float hueT=T*.12+seed*3.14;
        vec3  jc=mix(mix(C_BRIGHT_P,C_SKY,sin(hueT)*.5+.5),
                     C_SOFT_P, cos(hueT*.7)*.5+.5);
        jc=mix(jc,C_PALE,seed*.3);

        // Layer 1 — nearly transparent body fill (25% opacity)
        float bellD=jellyBell(p,jPos,r,jT,seed*8.);
        float bellMask=smoothstep(.003,-.002,bellD);
        float bellOuter=smoothstep(r*.42,0.,bellD)*(1.-bellMask);
        col=mix(col,mix(col,jc*.85,.25),bellMask);

        // Layer 2 — sharp rim glow (the most defining visual feature)
        // Real jellyfish tissue is thickest at edges → bright rim
        float rim=smoothstep(r*.11,0.,abs(bellD));
        col+=jc*1.5*rim+C_PALE*.65*rim;

        // Layer 3 — 8 radial vein channels (gastrovascular canals)
        vec2  qj=p-jPos;
        float veinAng=atan(qj.y,qj.x);
        float veins=pow(abs(sin(veinAng*8.+seed)),4.0);
        float veinFade=smoothstep(r,r*.1,length(qj))*bellMask;
        col+=jc*veins*veinFade*uGlow*.88;

        // Layer 4 — concentric ring texture (mesoglea bell layers)
        float radD=length(qj)/r;
        float rings=pow(sin(radD*15.-jT*.28)*0.5+0.5, 2.5);
        col+=mix(jc,C_PALE,.4)*rings*bellMask*0.28*uGlow;

        // SSS outer halo
        col+=jc*bellOuter*.30+C_PALE*bellOuter*.12;
        // vec3 iridescent shimmer: fbm3(vec3(bell-space pos, time)) animates color
        float shimmer=fbm3(vec3(qj*18., jT*.4+seed));
        col+=mix(C_SKY,C_SOFT_P,shimmer)*bellMask*.10;

        // Layer 5a — oral arms (4 thick frilly structures below bell center)
        for(int ai=0;ai<4;ai++){
            float fa=float(ai), ang=fa/4.*6.2831+seed;
            float w1=sin(jT*1.3+fa*1.57+seed)*r*.12;
            float w2=sin(jT*.9+fa*2.1+seed*2.)*r*.07;
            vec2  a0=jPos+vec2(sin(ang)*r*.07,-r*.08);
            vec2  a1=jPos+vec2(sin(ang)*r*.22+w1,-r*.55);
            vec2  a2=jPos+vec2(sin(ang)*r*.28+w1+w2,-r*1.05);
            float aD=min(sdSeg(p,a0,a1)-.0046, sdSeg(p,a1,a2)-.0036);
            float aMask=smoothstep(.003,-.001,aD);
            col=mix(col,mix(col,jc*.9,.52),aMask);
            col+=jc*aMask*uGlow*.38;
        }

        // Layer 5b — 12 tentacles: 8 inner short + 4 outer long graceful
        for(int ti=0;ti<12;ti++){
            float ft=float(ti);
            float isOut=(ft>=8.)?1.:0.;
            float n=isOut>.5?ft-8.:ft, cnt=isOut>.5?4.:8.;
            float ang2=n/cnt*6.2831+seed+isOut*.39;
            float ox=sin(ang2)*r*(isOut>.5?.87:.52);
            float tLen=r*(isOut>.5?2.9+hash21(vec2(ft,seed)):1.7+hash21(vec2(ft,seed))*.7);
            float thick=isOut>.5?.0014:.002;
            // Two-harmonic curl for organic tentacle motion
            float curl=sin(jT*1.7+ft*1.1+seed)*r*.30;
            float drft=sin(jT*.75+ft*.8+seed*2.)*r*.16;
            vec2  t0=jPos+vec2(ox,-r*.06);
            vec2  t1=jPos+vec2(ox+curl*.45,-tLen*.48);
            vec2  t2=jPos+vec2(ox+curl+drft,-tLen);
            // Taper thickness toward tips
            float tD=min(sdSeg(p,t0,t1)-thick, sdSeg(p,t1,t2)-thick*.65);
            float tMask=smoothstep(.001,-.0005,tD);
            col=mix(col,mix(col,jc*.75,.55),tMask);
            col+=jc*smoothstep(.006,0.,tD)*(1.-tMask)*.2;
        }
    }

    // ── marine snow (scales with uHaze) + bubbles ─────────────────────────
    col+=C_PALE*marineSno(uv,T,1.+uHaze*.6)*.5;
    col+=C_PALE*bubbles(uv,T)*.5;

    // ── spirit orbs — ascending will-o'-wisp bioluminescent entities ─────────
    for(int oi=0;oi<7;oi++){
        float fi=float(oi), os=hash21(vec2(fi*7.9,22.));
        float oy=fract(T*(.04+os*.03)+os);           // 0→1 eternal upward drift
        vec2  oc=vec2((.1+os*.8)*asp,
                      oy*.85+.08+sin(T*(.8+os*.6)+fi)*(.03+os*.02)*asp);
        float od=length(p-oc);
        float or2=(.008+os*.006)*asp;
        vec3  oclr=mix(C_BRIGHT_P,C_SKY,os);
        // Soft outer halo + bright core
        col+=oclr*smoothstep(or2*3.5,0.,od)*(.55+.45*sin(T*3.+fi*1.8))*uGlow*1.6;
        col+=C_PALE*smoothstep(or2*.7,0.,od)*uGlow*1.1;
    }

    // ── ambient occlusion near reef floor ────────────────────────────────────
    // Approximate contact shadow: objects near floor receive less scattered light
    float ao   = smoothstep(0., .22, uv.y-floorY);      // 1 = far from floor
    float aoW  = smoothstep(.35, .0, uv.y-floorY);      // weight band above floor
    col *= 1.0 - aoW*(1.-ao)*0.40;

    // ── depth fog — final Beer-Lambert + shadow falloff ───────────────────
    col=absorb(col,(1.-uv.y)*uDepth*1.8);
    col=mix(col,C_SHADOW,(1.-uv.y)*.28);

    // ── vignette — deep purple fringe at corners for mystical depth ──────────
    float vig=dot(uv-.5,uv-.5);
    col*=1.-vig*1.7;
    col+=C_DEEP_P*vig*vig*1.4;        // deep purple bleeds inward from corners

    // ── two-layer spiritual bloom: wide scatter + tight core ─────────────────
    float lum=dot(col,vec3(.2126,.7152,.0722));
    col+=C_BRIGHT_P*max(0.,lum-.60)*.75;   // wide ambient scatter
    col+=C_PALE    *max(0.,lum-.82)*.45;   // tight bright core bloom

    // ── Reinhard tone map + gamma ─────────────────────────────────────────
    col=col/(col+.3)*1.3;
    col=pow(max(col,0.),vec3(.84));

    fragColor=vec4(col,1.);
}
