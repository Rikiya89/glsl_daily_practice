// HYPERBOLIC SEADRAGON V4 (final polish) -- Living Curvature | GROWN FROM CURVATURE   (single GLSL TOP pixel shader)
// 1080x1920, 12 s loop (720 f @ 60 fps). Every time term is sin/cos(TAU*k*phase + c), k integer => frame 720 == frame 0.
// Body: arc-chain spine with travelling curvature waves; snout + tail are pseudosphere tractrix tapers (K*a^2 = -1 there).
// Membranes grown from the spine, three levels of folding:
//   primary   : each lobe is a hyperbolic paraboloid  z = a(lam/TAU) sin(TAU(fr-.5)) y      -> K = -(z_sy)^2/(..)^2 <= 0
//   secondary : n2 folds per lobe, amplitude rising as v^1.3
//   tertiary  : edge ruffles whose wavenumber follows the hyperbolic circumference ratio
//               C_hyp/C_euc = sinh(r/R)/(r/R)   (metric ds^2 = dr^2 + R^2 sinh^2(r/R) dtheta^2), slope-limited.
// Pointwise K of the full surface is measured by finite differences (mixed sign near the ruffled edge; the saddles are K<=0).
#define EXTERNAL_CONTROLS 0
#define SD_FAST 0   // 0 = full quality (record with Movie File Out, Realtime off) | 1 = preview preset
#if SD_FAST
#define SD_MAX_STEPS 80
#define SD_MAX_LAYERS 3
#define SD_EPSK 1.6
#define SD_IN_STEPS 3
#else
#define SD_MAX_STEPS 140
#define SD_MAX_LAYERS 6
#define SD_EPSK .9
#define SD_IN_STEPS 6
#endif
out vec4 fragColor;
uniform float uTimeSeconds;
#if EXTERNAL_CONTROLS
#define CONTROL(name,value) uniform float name
#else
#define CONTROL(name,value) const float name=value
#endif
CONTROL(uGrowth,1.5);         // 0..2.5   hyperbolic growth (curvature radius of the metric, 1/R)
CONTROL(uPrimaryFold,1.);     // .6..1.6  primary lobes per unit spine length (scale)
CONTROL(uSecondaryFold,2.);   // 1..6     secondary folds per lobe
CONTROL(uMicroRuffle,1.);     // .5..2    tertiary ruffle density
CONTROL(uCurvature,1.);       // 0..2     saddle strength
CONTROL(uAsymmetry,1.);       // 0..2     deterministic organic variation
CONTROL(uBranching,1.);       // 0..2     tail frond branching density
CONTROL(uPulseSpeed,1.);      // 1..4     internal pulses per motion cycle (rounded, synced to body waves)
CONTROL(uSpineEmission,1.);   // 0..2
CONTROL(uBodyGlow,1.2);       // .8..1.5  internal illumination of the body (1.2 = +20% vs V3)
CONTROL(uEdgeComplexity,1.);  // 0..2     outer-edge ruffle complexity (per-fin weighted)
CONTROL(uTranslucency,1.);    // 0..2     membrane + body translucency
CONTROL(uIridescence,1.);     // 0..2
CONTROL(uWaveAmp,1.);         // 0..2     travelling waves along the spine
CONTROL(uWaveFreq,1.);        // .5..2
CONTROL(uAnimSpeed,1.);       // 1..3     motion cycles per loop (rounded)
CONTROL(uCameraRotation,18.); // 0..20    camera sweep (deg) across the loop
CONTROL(uFinScale,1.);        // .6..1.4
CONTROL(uRuffleAmp,.14);      // 0..0.2
CONTROL(uSwayAmp,1.);         // 0..2
CONTROL(uBreathAmp,.0075);    // .005..01
CONTROL(uEmission,1.);        // 0..2
CONTROL(uPalette,0.);         // 0 Living Curvature | 2 Mono
CONTROL(uAnimPhase,0.);       // 0..1
const float SD_PI=3.14159265359,SD_TAU=6.28318530718,SD_LOOP_SECONDS=12.;
const float SD_K_REF=14.42,SD_A_S=.188110,SD_A_T=.263354,SD_G2=1.0359724,SD_RINGS=22.,SD_THICK=.0016;
const vec3 SD_OBSIDIAN=vec3(.031,.035,.043),SD_DEEP=vec3(.035,.169,.259),SD_CYAN=vec3(0.,.851,1.),SD_VIOLET=vec3(.475,.204,.961),SD_ICE=vec3(.831,.969,1.);
const vec3 SD_CP=vec3(-.923,-.414,0.),SD_T0=vec3(-.84,-.76,0.),SD_AX=vec3(-.52929,-.84846,0.);
const float SD_DC=6.40,SD_TAN_HALF=.267949;   // vertical FOV 30 deg

// ---------- per-frame state ----------
float sdPhase,sdLoop,sdPitch,sdRoll,sdYaw;vec3 sdDrift;
const float sdaL[5]=float[5](.55,.55,.90,.70,.50);
const float sdaReach[5]=float[5](.33,.64,.64,.50,.30);
float sdaK[5],sdaTh[5],sdaS[5];vec2 sdaP[5];vec3 sdaB[5];

// ---------- helpers ----------
float sdH(float x){return fract(sin(x*12.9898+4.1)*43758.5453);}
float sdSech(float x){return 2./(exp(x)+exp(-x));}
vec3 sdC(int t){   // 1 cyan, 2 violet, 3 ice
    if(int(uPalette+.5)==2)return vec3(.92,.94,.96);
    return t==1?SD_CYAN:(t==2?SD_VIOLET:SD_ICE);
}
vec3 sdIrid(float x){return mix(sdC(1),sdC(2),.5+.5*cos(SD_TAU*x));}
vec3 sdRotZ(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
vec3 sdRotY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
vec3 sdRotA(vec3 v,vec3 k,float a){float c=cos(a),s=sin(a);return v*c+cross(k,v)*s+k*dot(k,v)*(1.-c);}
vec3 sdLocalDir(vec3 d){return sdRotA(sdRotZ(sdRotY(d,-sdYaw),-sdPitch),SD_AX,-sdRoll);}
vec3 sdLocalPos(vec3 p){return sdLocalDir(p-SD_CP-sdDrift)+SD_CP;}
bool sdRaySphere(vec3 ro,vec3 rd,vec3 c,float r,out float t0,out float t1){
    vec3 oc=ro-c;float b=dot(oc,rd),h=b*b-dot(oc,oc)+r*r;
    t0=0.;t1=-1.;if(h<0.)return false;h=sqrt(h);t0=-b-h;t1=-b+h;return t1>0.;
}
float sdPulse(float s,float lag){   // travelling bioluminescent pulse, integer pulses per loop
    float P=max(floor(uPulseSpeed+.5),1.);
    return pow(.5+.5*cos(SD_TAU*(1.6*s/3.2-P*sdPhase)-lag),18.);
}

// ---------- spine: arc chain carrying travelling curvature waves (exact arc length, exact SDF) ----------
void sdSetupSpine(){
    float w=uWaveAmp,f=uWaveFreq,ph=SD_TAU*sdPhase;
    sdaK[0]=0.;
    sdaK[1]=3.17333*(1.+.04*w*sin(ph));
    sdaK[2]=-.6+.20*w*sin(ph-1.1*f);
    sdaK[3]=1.+.26*w*sin(ph-2.2*f);
    sdaK[4]=7.*(1.+.08*w*sin(ph-3.3*f));                     // gentle tail curl
    vec2 p=vec2(0.);float th=2.96706,s=0.;
    for(int i=0;i<5;i++){
        sdaP[i]=p;sdaTh[i]=th;sdaS[i]=s;
        float k=sdaK[i],L=sdaL[i];
        if(abs(k)<1e-6)p+=L*vec2(cos(th),sin(th));
        else p+=vec2(sin(th+k*L)-sin(th),cos(th)-cos(th+k*L))/k;
        th+=k*L;s+=L;
    }
}
vec2 sdArcPos(int i,float l){
    float k=sdaK[i],th=sdaTh[i];
    if(abs(k)<1e-6)return sdaP[i]+l*vec2(cos(th),sin(th));
    return sdaP[i]+vec2(sin(th+k*l)-sin(th),cos(th)-cos(th+k*l))/k;
}
void sdSetupBounds(){for(int i=0;i<5;i++)sdaB[i]=vec3(sdArcPos(i,.5*sdaL[i]),.5*sdaL[i]+sdaReach[i]*max(uFinScale,.4)*1.15);}
float sdCreatureBound(vec3 p){
    float d=1e9;
    for(int i=0;i<5;i++)d=min(d,length(vec3(p.xy-sdaB[i].xy,p.z))-sdaB[i].z);
    return d;
}
float sdZWave(float s){return .045*uWaveAmp*sin(SD_TAU*(1.1*uWaveFreq*s/3.2)-SD_TAU*sdPhase)*smoothstep(.45,1.2,s);}
void sdSpineAt(float s,out vec3 C,out vec3 T,out vec3 D){
    s=clamp(s,0.,3.2);int i=0;
    for(int j=1;j<5;j++)if(s>=sdaS[j])i=j;
    float l=s-sdaS[i],th=sdaTh[i]+sdaK[i]*l;
    C=vec3(sdArcPos(i,l),sdZWave(s));T=vec3(cos(th),sin(th),0.);D=vec3(sin(th),-cos(th),0.);
}
float sdSpineClosest(vec2 q,out float sOut){
    float best=1e9;sOut=0.;
    for(int i=0;i<5;i++){
        float k=sdaK[i],L=sdaL[i],th=sdaTh[i],l;vec2 P0=sdaP[i],T=vec2(cos(th),sin(th));
        if(abs(k)<1e-6)l=clamp(dot(q-P0,T),0.,L);
        else{
            vec2 c=P0+vec2(-T.y,T.x)/k,a0=P0-c,aq=q-c;
            float ang=atan(a0.x*aq.y-a0.y*aq.x,dot(a0,aq));
            l=mod(ang*sign(k),SD_TAU)/abs(k);
            if(l>L)l=length(q-sdArcPos(i,L))<length(q-P0)?L:0.;
        }
        float d=length(q-sdArcPos(i,l));
        if(d<best){best=d;sOut=sdaS[i]+l;}
    }
    return best;
}

// ---------- body radius: pseudosphere tapers + monotone Hermite middle ----------
float sdTractrixT(float d,float a){
    float c=d/a+SD_G2,t=c+1.;
    for(int i=0;i<4;i++){float th=tanh(t);t-=(t-th-c)/max(th*th,1e-4);}
    return clamp(t,2.,12.);
}
float sdHermite(float s,float s0,float r0,float m0,float s1,float r1,float m1){
    float h=s1-s0,u=clamp((s-s0)/h,0.,1.),u2=u*u,u3=u2*u;
    return (2.*u3-3.*u2+1.)*r0+(u3-2.*u2+u)*h*m0+(-2.*u3+3.*u2)*r1+(u3-u2)*h*m1;
}
float sdTailFloor(float s){return mix(.007,.0025,smoothstep(2.6,3.2,s));}
float sdBodyR(float s){
    float R;
    if(s<.30)R=max(SD_A_S*sdSech(sdTractrixT(.30-s,SD_A_S)),.017);
    else if(s<.42)R=sdHermite(s,.30,.050,.275721,.42,.092,0.);
    else if(s<.58)R=sdHermite(s,.42,.092,0.,.58,.060,0.);
    else if(s<1.0)R=sdHermite(s,.58,.060,0.,1.00,.075,.04);
    else if(s<1.45)R=sdHermite(s,1.00,.075,.04,1.45,.125,0.);
    else if(s<2.0)R=sdHermite(s,1.45,.125,0.,2.00,.070,-.275721);
    else R=max(SD_A_T*sdSech(sdTractrixT(s-2.,SD_A_T)),sdTailFloor(s));
    if(s<.012)R*=sqrt(max(1.-pow((.012-s)/.012,2.),0.));
    if(s>3.188)R*=sqrt(max(1.-pow((s-3.188)/.012,2.),0.));
    return R;
}
float sdWBony(float s){return smoothstep(.50,.62,s)*(1.-smoothstep(2.55,2.70,s));}
float sdRingC(float s){return SD_RINGS*(s-.55)/(2.60-.55);}
float sdBodyRadius(float s,float al){
    float wb=sdWBony(s),rid=pow(sin(SD_PI*fract(sdRingC(s))),6.);
    float trunk=smoothstep(.55,.80,s)*(1.-smoothstep(1.90,2.10,s));
    return sdBodyR(s)*(1.+.035*wb*cos(6.*al))*(1.+.02*wb*rid)*(1.+uBreathAmp*sin(SD_TAU*2.*sdPhase-2.*s)*trunk);
}

// ---------- hyperbolic membranes grown from the spine ----------
// hierarchy: large dorsal > medium laterals > delicate neck > progressively smaller tail fronds.  kind 0 frill, 1 pectoral, 2 frond
#define SD_NF 11
const float SD_FS0[SD_NF]  =float[SD_NF](.60, .98, .62, .66,1.08,1.16, .34,2.22,2.32, .57, .57);
const float SD_FS1[SD_NF]  =float[SD_NF](2.34,2.02,1.02,1.00,1.80,1.74, .55,2.86,2.64, .67, .67);
const float SD_FA[SD_NF]   =float[SD_NF](0.,3.26,2.50,-2.38,.70,-.60,.05,.10,3.04,1.5708,-1.5708);
const float SD_FL[SD_NF]   =float[SD_NF](.50, .24, .15, .13, .27, .22, .15, .19, .12, .07, .07);
const float SD_FLAM[SD_NF] =float[SD_NF](.20, .16, .11, .10, .17, .15, .09, .09, .08, .10, .10);
const float SD_FNOTCH[SD_NF]=float[SD_NF](.36, .32, .28, .30, .30, .32, .42, 0., 0., .6,  .6);
const float SD_FSEC[SD_NF] =float[SD_NF](1.,  .55, .30, .45, .95, .70, .80, .50, .40, 0., 0.);   // secondary folds on selected membranes
const float SD_FEDGE[SD_NF]=float[SD_NF](1.15,.85, .45, .55, 1.0, .80, .70, .60, .50, 0., 0.);   // outer-edge complexity
const float SD_FKIND[SD_NF]=float[SD_NF](0.,  0.,  0.,  0.,  0.,  0.,  0.,  2., 2.,  1.,  1.);
float sdLam(int f){return SD_FLAM[f]/max(uPrimaryFold,.2);}
// irregular lobe spacing (monotone): lobe coordinate q(s)
float sdLobeQ(int f,float s){
    float lam=sdLam(f),fi=float(f),x=(s-SD_FS0[f])/lam;
    return x+.28*uAsymmetry*sin(1.3*x+fi*2.9)/1.3;                    // irregular attachment spacing (still monotone)
}
float sdFinAngle(int f,float s){
    float q=sdLobeQ(f,s),lid=floor(q),p=sin(SD_PI*(q-lid)),fi=float(f);
    float tw=SD_FKIND[f]==1.?0.:.14*sin(2.1*s+fi*1.7);
    return SD_FA[f]+tw+uAsymmetry*.20*(2.*sdH(lid+fi*3.1)-1.)*p;          // per-lobe growth direction (0 at joins)
}
float sdFinLen(int f,float s){
    float u=clamp((s-SD_FS0[f])/(SD_FS1[f]-SD_FS0[f]),0.,1.);
    float q=sdLobeQ(f,s),lid=floor(q),fr=q-lid,p=pow(sin(SD_PI*fr),.6),fi=float(f);
    float taper,lob;
    if(SD_FKIND[f]==2.){
        taper=pow(sin(SD_PI*u),.5)*mix(1.,.40,u);                          // progressively smaller toward the tail
        float nb=2.+floor(uBranching*1.5*sdH(lid+fi*5.3)+.5);              // 2..4 branch tips per frond
        lob=p*p*(.45+.55*pow(abs(sin(SD_PI*nb*fr)),.7));
    }else{
        taper=pow(u,.45)*pow(1.-u,.75)*2.21;                               // swells early, long taper toward the tail
        lob=mix(SD_FNOTCH[f],1.+uAsymmetry*.50*(2.*sdH(lid+fi*7.7)-1.),p);  // per-lobe size, joins stay continuous
    }
    float asym=1.+.14*uAsymmetry*sin(2.3*s+fi*2.1);
    float br=1.+4.*uBreathAmp*sin(SD_TAU*2.*sdPhase-2.*s-.5*fi);
    return max(SD_FL[f]*uFinScale*taper*lob*asym*br,.004);
}
// hyperbolic circumference ratio sinh(kv)/(kv) and its derivative
float sdHyp(float x){return x<1e-3?1.:sinh(x)/x;}
float sdHypD(float x){return x<1e-3?0.:(x*cosh(x)-sinh(x))/(x*x);}
// normal displacement at (s,v) + gradient (d/ds, d/dy). No sway here (sway is a near-isometric bend: K unchanged).
float sdFinZ(int f,float s,float v,float L,out vec2 g){
    v=clamp(v,0.,1.);                                                        // stencil samples v-hv<0 at the root: pow(neg) = NaN
    float lam=sdLam(f),q=sdLobeQ(f,s),lid=floor(q),fr=q-lid,y=v*L,fi=float(f);
    if(SD_FKIND[f]==1.){                                                     // pectoral: 9 Hz travelling ray wave (k=108)
        float th=SD_TAU*3.*fr-SD_TAU*108.*sdLoop;
        g=vec2(.010*v*cos(th)*SD_TAU*3./lam,.010*sin(th)/L);
        return .010*v*sin(th);
    }
    float hA=sdH(lid+fi*11.3),win=pow(sin(SD_PI*fr),.5),sl=(fr-.5)*lam;
    // primary: hyperbolic paraboloid lobe
    float a=3.*uCurvature*(SD_FKIND[f]==2.?.6:1.)*(1.+.3*uAsymmetry*(hA-.5));
    float sn=sin(SD_TAU*(fr-.5)),cs=cos(SD_TAU*(fr-.5));
    float z=a*(lam/SD_TAU)*sn*y;
    g=vec2(a*cs*y,a*(lam/SD_TAU)*sn);
    // secondary folds distributed along the lobe
    float n2=max(floor(uSecondaryFold*(.75+.5*hA)+.5),1.);
    float k2=SD_TAU*n2/lam,ph2=SD_TAU*hA+.8*sin(SD_TAU*sdPhase-2.*s-fi);
    float c2=.13*SD_FSEC[f];
    float A2=min(c2*L*win,1.5/k2)*pow(v,1.3);
    float t2=k2*sl+ph2;
    z+=A2*sin(t2);
    g+=vec2(A2*k2*cos(t2),min(c2*L*win,1.5/k2)*1.3*pow(max(v,1e-4),.3)*sin(t2)/L);
    // tertiary ruffles: wavenumber follows the hyperbolic circumference ratio, concentrated at the edge, slope-limited
    float kk=2.2*uGrowth,G=sdHyp(kk*v),Gd=sdHypD(kk*v)*kk;
    float ec=SD_FEDGE[f]*uEdgeComplexity,dens=uMicroRuffle*(.75+.5*sdH(lid+fi*17.1));   // per-lobe edge density
    float om=dens*2.*SD_TAU/lam*G,edge=smoothstep(.30,.85,v)*ec;
    float ph3=SD_TAU*sdH(lid+fi*13.)-SD_TAU*sdPhase+.6*sin(SD_TAU*sdPhase+3.*s+fi);
    float amp=1.;
    for(int o=0;o<2;o++){
        float m=o==0?1.:smoothstep(.70,.90,v);
        float A3=min(uRuffleAmp*L*win*amp,2.0/om)*v*v*edge*m;              // slope limit: |dz/ds| <= 2
        float th=om*sl+ph3*(1.+.7*float(o));
        z+=A3*sin(th);
        g+=vec2(A3*om*cos(th),A3*(2./max(v,1e-3)*sin(th)+cos(th)*dens*2.*SD_TAU/lam*Gd*sl*exp2(float(o)))/L);
        om*=2.;amp*=.5;
    }
    return z;
}
float sdFinSway(int f,float s,float v,float L){
    if(SD_FKIND[f]==1.)return 0.;
    float fi=float(f);
    return uSwayAmp*.10*L*pow(v,1.6)*(.65*sin(SD_TAU*sdPhase-1.7*uWaveFreq*s-1.3*v-.9*fi)
        +.35*sin(SD_TAU*2.*sdPhase-2.9*uWaveFreq*s-1.9*v+1.3*fi));
}
float sdFinZMax(int f){
    if(SD_FKIND[f]==1.)return .011;
    float L=SD_FL[f]*uFinScale*1.6;
    return L*(1.6*uCurvature*sdLam(f)/SD_TAU+.13+uRuffleAmp*1.5+uSwayAmp*.10)+SD_THICK+.01;
}

// ---------- shading ----------
vec3 sdShadeFin(int f,float s,float v,float yIn,vec3 T,vec3 F,vec3 N,vec3 rd,float fp){
    float L=sdFinLen(f,s);
    const float hs=.0008,hv=1./320.;
    vec2 g;float sdL0=sdFinLen(f,s-hs),sdL2=sdFinLen(f,s+hs);
    #define SD_FP(ss,vv,LL) vec3(ss,(vv)*(LL),sdFinZ(f,ss,vv,LL,g))
    vec3 P=SD_FP(s,v,L),Ps1=SD_FP(s+hs,v,sdL2),Ps0=SD_FP(s-hs,v,sdL0),Pv1=SD_FP(s,v+hv,L),Pv0=SD_FP(s,v-hv,L);
    vec3 Ppp=SD_FP(s+hs,v+hv,sdL2),Ppm=SD_FP(s+hs,v-hv,sdL2),Pmp=SD_FP(s-hs,v+hv,sdL0),Pmm=SD_FP(s-hs,v-hv,sdL0);
    #undef SD_FP
    vec3 Pu=(Ps1-Ps0)/(2.*hs),Pv=(Pv1-Pv0)/(2.*hv);
    vec3 Puu=(Ps1-2.*P+Ps0)/(hs*hs),Pvv=(Pv1-2.*P+Pv0)/(hv*hv),Puv=(Ppp-Ppm-Pmp+Pmm)/(4.*hs*hv);
    vec3 n=normalize(cross(Pu,Pv));if(n.z<0.)n=-n;
    float E=dot(Pu,Pu),Fm=dot(Pu,Pv),G=dot(Pv,Pv),fm=dot(Puv,n);
    float K=(dot(Puu,n)*dot(Pvv,n)-fm*fm)/max(E*G-Fm*Fm,1e-12);             // Gaussian curvature from parametric derivatives
    float ndv=abs(dot(normalize(n.x*T+n.y*F+n.z*N),rd));
    float thick=.25+.75*(1.-exp(-.28*uTranslucency/max(ndv,.12)));           // thin-membrane translucency
    float cover=smoothstep(0.,1.5*fp,L-yIn);                                 // sub-pixel fade at the boundary (no staircase)
    float pr=sdPulse(s,6.*v)*exp(-5.*v);                                     // energy flowing from the spine into the root
    if(SD_FKIND[f]==1.)return (sdIrid(.2+.6*(1.-ndv))*.20*(.4+.6*v)+sdC(1)*pr*.5*uSpineEmission)*thick*cover*uEmission;
    float kn=clamp(log2(1.+abs(K)/SD_K_REF)/6.,0.,1.);
    float neg=1.-smoothstep(-2.,2.,K);                                        // smooth across K=0 (no blotches)
    vec3 tissue=mix(SD_DEEP,SD_OBSIDIAN,.4)*(.55+.45*ndv);                    // dark membrane body
    vec3 hue=mix(sdC(1),sdC(2),smoothstep(.04,.45,kn));
    hue=mix(hue,sdIrid(1.15*(1.-ndv)+.22*v+.06*s),.35*uIridescence);          // view-dependent iridescence
    float emis=(.18+.82*pow(v,1.5))*(.45+.55*kn*(.35+.65*neg))*uEmission;     // curvature-weighted emission (K<0 strongest)
    float rim=(1.-smoothstep(0.,2.2*fp/max(L,.02),1.-v))*smoothstep(.02,.06,L);
    float bnd=1.-smoothstep(0.,2.*fp,L-yIn);                                  // fine luminous boundary along the whole outline
    float lam=sdLam(f),q=sdLobeQ(f,s);
    float gv=1.-smoothstep(0.,1.2*fp*10./(L*max(ndv,.3)),abs(fract(v*10.-.5)-.5));
    float gs=1.-smoothstep(0.,1.2*fp*4./(lam*max(ndv,.3)),abs(fract(4.*q-.5)-.5));
    float grid=max(gv,gs*.8)*(.25+.75*v)*(.45+.55*neg);                       // AA parametric grid, stronger where K<0
    float graze=.20+.80*smoothstep(.08,.35,ndv);
    vec3 c=tissue*.35+hue*emis*1.55+SD_ICE*(max(rim,bnd)*.45+grid*.17)*graze+sdC(1)*pr*.6*uSpineEmission;
    return c*thick*cover*mix(.45,1.,graze);
}
vec3 sdShadeBody(vec3 p,vec3 n,float s,float al,vec3 rd,vec3 Lk,float fp){
    float ndv=clamp(abs(dot(n,rd)),0.,1.),dif=.5+.5*dot(n,Lk),R=sdBodyR(s),wb=sdWBony(s);
    float fres=pow(1.-ndv,3.);
    vec3 region=mix(mix(SD_DEEP,mix(SD_DEEP,SD_CYAN,.10),smoothstep(.62,.30,s)),mix(SD_DEEP,SD_VIOLET,.22),smoothstep(1.9,2.7,s));
    vec3 skin=mix(SD_OBSIDIAN,region,.32+.35*dif)*(.65+.55*dif)*uBodyGlow;
    // translucent interior: short march into the body -- spinal cord, branching nerve filaments, inner tissue layer
    vec3 C,T,D;sdSpineAt(s,C,T,D);
    float dl=1.8*R/float(SD_IN_STEPS),tr=1.,pc=sdPulse(s,0.);vec3 inner=vec3(0.);
    for(int i=0;i<SD_IN_STEPS;i++){
        vec3 q=p+rd*(dl*(float(i)+.5))-C;
        float rho=length(q),ai=atan(q.z,dot(q,D));
        float cord=exp(-pow(rho/(.09*R+.0015),2.));
        float rc=sdRingC(s)+.15*sin(3.*ai);
        float sec=mod(ai+.35*sin(2.*rc),SD_PI/3.)-SD_PI/6.;                   // six wavy nerve branches per ring
        float df=length(vec2((fract(rc)-.5)*2.05/SD_RINGS,rho*sin(sec)));
        float fil=exp(-pow(df/.0032,2.))*smoothstep(.95*R,.3*R,rho)*wb;
        float lay=exp(-pow((rho-.62*R)/(.045*R),2.))*.10;
        float pf=sdPulse(s,9.*rho/max(R,.01));                                // pulse propagating outward along the filaments
        inner+=tr*dl*(mix(sdC(1),sdC(3),pc)*cord*(.30+1.6*pc)
                      +mix(sdC(1),sdC(2),.45)*fil*(.18+.9*pf)+SD_VIOLET*lay);
        tr*=exp(-9.*dl);
    }
    inner*=7.0/max(R,.02)*uSpineEmission*uBodyGlow;
    float see=.75*uTranslucency*(.45+.55*ndv);
    vec3 col=skin*(1.-.35*see)+inner*see;
    col+=sdIrid(1.2*uIridescence*(1.-ndv)+.15*s+.05*al)*(.06*uIridescence*(1.-ndv)+.42*fres)*uEmission;   // restrained iridescent rim
    float rc=sdRingC(s);
    float ring=(1.-smoothstep(0.,1.4*fp*SD_RINGS/2.05,abs(fract(rc-.5)-.5)))*wb;
    float mf=al*6./SD_PI;
    float mer=(1.-smoothstep(0.,1.4*fp*6./(SD_PI*max(R,.01)),abs(fract(mf-.5)-.5)))*smoothstep(.3,.7,s);
    col+=sdC(1)*(ring*.10+mer*.045)*uEmission*(.35+.65*fres);
    col+=SD_ICE*.16*pow(max(dot(n,normalize(Lk-rd)),0.),48.);
    if(s<.30||s>2.){
        float a=s<.30?SD_A_S:SD_A_T,tt=sdTractrixT(s<.30?.30-s:s-2.,a),th=tanh(tt);
        float ln=1.-smoothstep(0.,1.5*fp/max(a*th*th,1e-3)/.25,abs(fract(tt/.25-.5)-.5));
        float fl=s<.30?.017:sdTailFloor(s);
        col+=sdC(2)*.26*ln*smoothstep(fl,fl*1.3,a*sdSech(tt))*uEmission;
    }
    float da=mod(al-1.22173+SD_PI,SD_TAU)-SD_PI;
    vec2 eo=vec2(s-.40,sdBodyR(.40)*da);float de=length(eo);
    col=mix(col,sdIrid(.15)*.40*(.6+.4*dif),1.-smoothstep(.0145,.0165,de));
    col=mix(col,vec3(.006,.008,.012),1.-smoothstep(.0080,.0095,de));
    col+=SD_ICE*.75*smoothstep(.004,0.,length(eo-vec2(.003,.004)));
    return max(col,SD_OBSIDIAN*1.35+sdC(1)*.05*fres);                     // never darker than the background (fixes black seam)
}
vec3 sdSoftClip(vec3 c){return mix(c,.8+.2*(1.-exp(-(c-.8)/.2)),step(.8,c));}

// ---------- scene query: body + every membrane, sharing one closest-point spine lookup ----------
float sdScene(vec3 p,float eps,int skipF,out int hit,out float hs,out float hv,out float hy,out float bAl,out vec3 fT,out vec3 fF,out vec3 fN,inout float gEdge){
    hit=-2;
    float cb=sdCreatureBound(p);
    if(cb>4.*eps)return cb;
    float s,dpl=sdSpineClosest(p.xy,s);
    vec3 C,T,D;sdSpineAt(s,C,T,D);
    vec3 q=p-C;float al=atan(q.z,dot(q,D));
    float d=(length(vec2(dpl,q.z))-sdBodyRadius(s,al))*.8;
    hit=-1;hs=s;bAl=al;
    float R=sdBodyR(s);
    for(int f=0;f<SD_NF;f++){
        if(f==skipF||(SD_FAST==1&&SD_FKIND[f]==1.))continue;
        float ex=max(max(SD_FS0[f]-s,s-SD_FS1[f]),0.);
        if(ex>d)continue;
        float a=sdFinAngle(f,s);
        vec3 F=cos(a)*D+sin(a)*vec3(0.,0.,1.),N=cross(T,F);
        float y=dot(q,F),z=dot(q,N);
        float sc=clamp(s,SD_FS0[f],SD_FS1[f]),L=sdFinLen(f,sc);
        float ey=max(y-R-L,0.)+max(.85*R-y,0.);
        float lb=length(vec3(ex,ey,max(abs(z)-sdFinZMax(f),0.)));
        if(lb>=d)continue;
        float df;
        if(lb>4.*eps){df=lb;if(SD_FKIND[f]!=1.)gEdge=min(gEdge,lb*1.3);}
        else{
            float v=clamp((y-R)/L,0.,1.);
            vec2 g;float zs=sdFinZ(f,sc,v,L,g)+sdFinSway(f,sc,v,L);
            float th=SD_THICK+.012*pow(1.-v,5.);
            df=(length(vec3(ex,ey,(z-zs)/sqrt(1.+dot(g,g))))-th)*.7;
            if(SD_FKIND[f]!=1.&&v>.6)gEdge=min(gEdge,df);
            if(df<d){hs=sc;hv=v;hy=y-R;fT=T;fF=F;fN=N;}
        }
        if(df<d){d=df;hit=f;}
    }
    return d;
}

void main(){
    float secs=uTimeSeconds;
    if(isnan(secs)||isinf(secs))secs=0.;
    sdLoop=fract(secs/SD_LOOP_SECONDS+uAnimPhase);
#ifdef DEBUG_T
    sdLoop=DEBUG_T;
#endif
    sdPhase=fract(sdLoop*max(floor(uAnimSpeed+.5),1.));
    sdPitch=radians(3.)*sin(SD_TAU*sdPhase+.4);
    sdRoll=radians(5.)*sin(SD_TAU*sdPhase+1.);
    sdYaw=radians(-15.+7.*sin(SD_TAU*sdLoop+.7));                             // restrained 3D turn for depth
    sdDrift=vec3(.035*sin(SD_TAU*sdPhase),.045*sin(SD_TAU*sdPhase+1.3),.03*sin(SD_TAU*2.*sdPhase+.2));
    sdSetupSpine();sdSetupBounds();
    vec2 res=uTDOutputInfo.res.zw;float aspect=res.x/max(res.y,1.),pixAng=2.*SD_TAN_HALF/max(res.y,1.);
    vec2 uv=(vUV.st-.5)*2.*vec2(aspect,1.);
    float az=radians(clamp(uCameraRotation,0.,20.)*.5)*sin(SD_TAU*sdLoop),el=radians(3.+1.8*sin(SD_TAU*sdLoop+2.1));
    float dc=SD_DC*(1.+.025*sin(SD_TAU*sdLoop+1.));                           // slow cinematic dolly
    vec3 cam=SD_T0+dc*vec3(sin(az)*cos(el),sin(el),cos(az)*cos(el));
    vec3 fw=normalize(SD_T0-cam),rt=normalize(cross(fw,vec3(0.,1.,0.))),up=cross(rt,fw);
    vec3 ro=sdLocalPos(cam),rd=sdLocalDir(normalize(fw+(uv.x*rt+uv.y*up)*SD_TAN_HALF));
    vec3 Lk=sdLocalDir(normalize(vec3(-.5,.8,.6)));
    float tMid=dc;

    vec3 col=SD_OBSIDIAN*(1.+.20*(1.-smoothstep(.2,1.4,length(uv*vec2(1.,.7))))),acc=vec3(0.);
    float gEdge=1e3,t0,t1;
    if(sdRaySphere(ro,rd,vec3(-.74,-.80,0.),1.75,t0,t1)){
        float t=max(t0,0.),skipUntil=-1.;int layers=0,skipF=-1;
        for(int st=0;st<SD_MAX_STEPS;st++){
            vec3 p=ro+rd*t;
            float fp=t*pixAng,eps=max(.0004,SD_EPSK*fp),hs,hv,hy,bAl;int hit;vec3 fT,fF,fN;
            float d=sdScene(p,eps,t<skipUntil?skipF:-1,hit,hs,hv,hy,bAl,fT,fF,fN,gEdge);
            if(hit==-1&&d<.5*eps){
                const vec2 k=vec2(1.,-1.);const float e=.0008;float s2,dpl;vec3 C,T,D;
                vec3 n=vec3(0.);
                for(int j=0;j<4;j++){
                    vec3 o=j==0?k.xyy:(j==1?k.yyx:(j==2?k.yxy:k.xxx));
                    vec3 pp=p+o*e;dpl=sdSpineClosest(pp.xy,s2);sdSpineAt(s2,C,T,D);vec3 qq=pp-C;
                    n+=o*(length(vec2(dpl,qq.z))-sdBodyRadius(s2,atan(qq.z,dot(qq,D))));
                }
                col=sdShadeBody(p,normalize(n),hs,bAl,rd,Lk,fp)*(1.-.25*smoothstep(-.3,.5,t-tMid));
                break;
            }
            if(hit>=0&&d<eps){
                float depth=1.-.30*smoothstep(-.4,.6,t-tMid);                    // depth cue: far membranes recede
                acc+=sdShadeFin(hit,hs,hv,hy,fT,fF,fN,rd,fp)*pow(.78,float(layers))*depth;   // separate overlaps
                layers++;if(layers>=SD_MAX_LAYERS)break;
                skipF=hit;skipUntil=t+.02;t+=max(.006,3.*fp);continue;
            }
            t+=max(d,eps*.5);
            if(t>t1)break;
        }
    }
    col+=acc+mix(sdC(1),sdC(2),.5)*uEmission*.035*exp(-40.*max(gEdge,0.));
    fragColor=TDOutputSwizzle(vec4(sdSoftClip(col),1.));
}
