// TURING MOTH | Mathematical Life #01 — standalone single GLSL TOP version
// GLSL TOP pixel shader. 8 s loop = 240 frames @30 fps, target 1080x1920. Host res untouched.
// Input 0 (optional): Gray-Scott state RD_STATE from td_build_turing_moth.py (R=U G=V B=arrival).
// With no input, a procedural Turing-like stand-in is used for preview only (not Gray-Scott).
// Set EXTERNAL_CONTROLS=1 ONLY after binding all CONTROL uniforms on the Vectors pages.
#define EXTERNAL_CONTROLS 0
out vec4 fragColor;
uniform float uTimeSeconds;
#if EXTERNAL_CONTROLS
#define CONTROL(name,value) uniform float name
#else
#define CONTROL(name,value) const float name=value
#endif
CONTROL(uWingSpan,1.0);         // 0.6..1.4
CONTROL(uWingCurvature,1.0);    // 0..2   membrane camber
CONTROL(uWingFold,1.0);         // 0..1.5 dihedral lift
CONTROL(uBodySize,1.0);         // 0.6..1.5
CONTROL(uPatternScale,1.0);     // 0.3..1 Turing wavelength (must match the RD sim)
CONTROL(uPatternContrast,1.0);  // 0.2..3
CONTROL(uSymmetry,.92);         // 0..1   1 = perfect mirror
CONTROL(uFresnel,1.0);          // 0..3
CONTROL(uGlow,1.0);             // 0..3
CONTROL(uPaletteBlend,.5);      // 0..1   blue -> violet
CONTROL(uCameraDistance,1.0);   // 0.6..2
CONTROL(uCameraRotation,-6.);   // degrees
CONTROL(uAnimationSpeed,1.0);   // rounded to an integer harmonic: loop stays exact
CONTROL(uSupersample,1.0);      // 1 preview, 2 final
CONTROL(uExposure,1.0);
// Packed views of the controls (same layout as the multi-TOP build).
vec4 uTime,uWing,uLook,uCam,uQuality;
// 1 = wings read the Gray-Scott state wired into input 0 (set by tools/wire_rd.py).
// 0 = procedural stand-in, no input needed.
#define USE_RD_INPUT 1
#define MAX_STEPS 150
const float PI=3.14159265359,TAU=6.28318530718,LOOP_SECONDS=8.;

// Palette: the ten source HEX values, stored as exact sRGB bytes, decoded once to linear.
const vec3 H_5B8BDF=vec3(91.,139.,223.)/255.,H_3E79C7=vec3(62.,121.,199.)/255.;
const vec3 H_08584F=vec3(8.,88.,79.)/255.,  H_EAD3FF=vec3(234.,211.,255.)/255.;
const vec3 H_102A67=vec3(16.,42.,103.)/255.,H_3C7DD1=vec3(60.,125.,209.)/255.;
const vec3 H_6556BD=vec3(101.,86.,189.)/255.,H_645EBE=vec3(100.,94.,190.)/255.;
const vec3 H_152D91=vec3(21.,45.,145.)/255., H_8AA5F6=vec3(138.,165.,246.)/255.;
vec3 lin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 CORN,STEEL,TEAL,LAV,NAVY,AZURE,VIOLET,IRIS,DEEP,PERI;

// ---------------------------------------------------------------- animation state
float phase,theta,spd,reveal,growth,breath,breath2;
float foldF,foldH,curv,span,bodyS,antSwing,sweep;vec3 hover;
mat3 bodyRot;
// material globals written by sceneSDF
float gId,gSide;vec2 gW;
mat2 rotation(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float harmonic(float x){return max(1.,floor(x+.5));}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sdEllipsoid(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/max(k1,1e-5);}
float sdCapsule(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}

// ---------------------------------------------------------------- Gielis superformula
float superformula(float a,float m,float n1,float n2,float n3){
    return pow(pow(abs(cos(m*a*.25)),n2)+pow(abs(sin(m*a*.25)),n3),-1./n1);
}
// 2D wing outline in wing-plane coords w (x = span from the root, y = chord).
// Forewing: m=3 rounded triangle -> root / apex / tornus. Hindwing: softer m=3 fan, scalloped margin.
float wingOutline(vec2 w,bool fore,float side){
    vec2 l;float r,k;
    if(fore){
        l=w-vec2(.70,0.);l.y+=.15*l.x;l/=vec2(1.35,.64);
        float a=atan(l.y,l.x)-.15;
        r=.56*superformula(a,3.,3.5,7.,7.)*(1.+.006*side);
        k=.58;
    }else{
        l=w-vec2(.50,0.);l.y-=.10*l.x;l/=vec2(1.05,.90);
        float a=atan(l.y,l.x);
        r=.41*superformula(a,3.,2.2,3.,3.)*(1.+.014*sin(a*16.)-.008*side);
        k=.90;
    }
    return (length(l)-r)*k*.85;
}
// Procedural venation: radial fan from the root, discal cell loop, sclerotized margin.
float veins(vec2 w,float edge,bool fore){
    float rho=length(w),phi=atan(w.y,w.x);
    float n=fore?9.:8.,lo=fore?-.55:-.95,hi=fore?.42:.75,dph=(hi-lo)/(n-1.);
    float f=(phi-lo-(fore?.10:-.06)*rho)/dph;
    float dist=abs(fract(f+.5)-.5)*dph*rho;
    float v=(1.-smoothstep(.0025,.0065,dist))*smoothstep(.08,.22,rho)*step(lo-.2,phi)*step(phi,hi+.2);
    vec2 c=(w-vec2(fore?.40:.30,fore?.0:-.02))/vec2(fore?.17:.13,fore?.06:.09);
    v=max(v,1.-smoothstep(.0,.25,abs(length(c)-1.)));
    v=max(v,1.-smoothstep(.0,.014,-edge));
    v=max(v,(1.-smoothstep(.0,.05,rho-.06))*.8);
    return clamp(v,0.,1.);
}
// Thin membrane: extrude the 2D outline, cambered by curvature + breathing.
float wingSDF(vec3 q,bool fore,float side,out vec2 w){
    float fold=fore?foldF:foldH;fold+=.025*side;
    q.xz=rotation(fold)*q.xz;
    w=rotation(fore?.40:-.72)*q.xy/span;
    float z=q.z/span;
    float c=curv*(fore?1.:.8);
    z-=c*(.16*w.x*w.x-.05*w.y*w.y)+.035*breath2*w.x*w.x*w.x;
    // Flexible membrane: a bending wave runs root -> tip, so wing tips trail the stroke.
    float ph=2.*theta*spd;
    z-=(fore?.07:.055)*w.x*w.x*sin(ph-1.8*w.x+.45*sin(ph));
    float e=wingOutline(w,fore,side);
    if(e>.05)return length(vec2(e,max(abs(z)-.008,0.)))*span*.80;   // far from the membrane: cheap bound
    float th=.0045+.0035*veins(w,e,fore)*smoothstep(-.02,-.005,-e*0.)*(1.-.5*smoothstep(.3,1.2,length(w)));
    vec2 d=vec2(e,abs(z)-th);
    return (min(max(d.x,d.y),0.)+length(max(d,0.)))*span*.72;
}
// Bipectinate (feathered) antenna: shaft + comb of barbs by domain repetition.
float antenna(vec3 p,vec3 a,vec3 b,float len){
    vec3 ba=b-a,pa=p-a;float L=length(ba);vec3 t=ba/L;
    float h=clamp(dot(pa,t),0.,L);
    vec3 q=pa-t*h;
    float shaft=length(q)-mix(.006,.0025,h/L);
    vec3 nrm=normalize(cross(t,vec3(0.,0.,1.))),bin=cross(nrm,t);
    float c=abs(dot(q,nrm)),e=dot(q,bin);
    float sp=.014,along=dot(pa,t)-c*.55;
    float cell=along-sp*(floor(along/sp)+.5);
    float barbLen=len*(1.-.75*clamp(dot(pa,t)/L,0.,1.))*step(0.,dot(pa,t))*step(dot(pa,t),L);
    float barb=max(max(length(vec2(cell,e))-.0018,c-barbLen),abs(dot(pa,t)-.5*L)-.5*L);
    return min(shaft,barb);
}
float sceneSDF(vec3 world){
    vec3 p=bodyRot*(world-hover);
    float side=p.x<0.?-1.:1.;
    vec3 m=vec3(abs(p.x),p.y,p.z);
    vec3 b=p/bodyS,mb=m/bodyS;
    // Body: head, thorax with fur ridges, nine-segment abdomen with secondary sway.
    float head=sdEllipsoid(b-vec3(0.,.36,.03),vec3(.078,.066,.072));
    float eye=length(mb-vec3(.056,.375,.05))-.040;
    float thorax=sdEllipsoid(b-vec3(0.,.20,.02),vec3(.125,.16,.115));
    thorax+=.006*sin(b.x*95.+b.y*40.)*sin(b.y*85.-b.z*30.);
    float ab=clamp((.08-b.y)/.68,0.,1.);
    vec3 ap=b;ap.x-=.035*sin(theta*spd+1.2)*ab*ab;
    float g=pow(abs(fract(ab*9.)*2.-1.),8.);
    float rad=.112*(1.-.80*ab*ab)*(1.+.25*ab*(1.-ab))*(1.-.07*g);
    float abdomen=(length(vec3(ap.x,ap.y-clamp(ap.y,-.60,.08),ap.z*1.12))-rad)/1.12;
    float body=smin(smin(head,thorax,.035),abdomen,.045);
    // Antennae with secondary motion.
    float sw=antSwing;
    vec3 a0=vec3(.034,.41,.08),a1=vec3(.15+.025*sw,.74,.14+.02*sw),a2=vec3(.38+.035*sw,.98-.025*sw,.10);
    float ant=min(antenna(mb,a0,a1,.055),antenna(mb,a1,a2,.048));
    // Legs: three pairs under the thorax.
    float legs=1e3;
    for(int i=0;i<3;i++){
        float fi=float(i),y=.27-.07*fi;
        vec3 k0=vec3(.05,y,-.03),k1=vec3(.17,y+.06-.10*fi,-.10),k2=vec3(.24,y+.16-.30*fi,-.17);
        legs=min(legs,min(sdCapsule(mb,k0,k1,.011,.008),sdCapsule(mb,k1,k2,.008,.004)));
    }
    float dBody=min(body,eye),dThin=min(ant,legs);
    // Wings (mirror-symmetric frame, per-side imperfection inside wingSDF).
    vec2 wF,wH;
    float fw=wingSDF(m-vec3(.070,.245,.035)*bodyS,true,side,wF);
    float hw=wingSDF(m-vec3(.060,.150,.010)*bodyS,false,side,wH);
    float d=min(dBody*bodyS,dThin*bodyS);
    gSide=side;
    gId=body<eye?(body<dThin?0.:4.):(eye<dThin?3.:4.);
    if(hw<d){d=hw;gId=2.;gW=wH;}
    if(fw<d+.002){d=min(d,fw);gId=1.;gW=wF;}
    return d;
}
vec3 normalAt(vec3 p,float e){
    vec2 k=vec2(1.,-1.);
    return normalize(k.xyy*sceneSDF(p+k.xyy*e)+k.yyx*sceneSDF(p+k.yyx*e)+
                     k.yxy*sceneSDF(p+k.yxy*e)+k.xxx*sceneSDF(p+k.xxx*e));
}
// ---------------------------------------------------------------- reaction-diffusion projection
// Preview stand-in when no RD_STATE is wired: warped three-wave interference at the Turing
// wavelength + concentric eyespots. Connect RD_STATE to input 0 for the real Gray-Scott pattern.
vec4 fallbackRD(vec2 uv){
    float lambda=.025*sqrt(clamp(uPatternScale,.2,1.)/.6),k=TAU/lambda;
    vec2 p=uv*k;
    p+=2.2*vec2(sin(uv.y*31.+sin(uv.x*17.)),cos(uv.x*29.+sin(uv.y*23.)));
    float f=cos(p.x)+cos(dot(p,vec2(.5,.866)))+cos(dot(p,vec2(-.5,.866)));
    float v=.17+.12*clamp(f*.7,-1.,1.);
    float dF=length(uv-vec2(.499,.750)),dH=length(uv-vec2(.338,.238));
    v=mix(v,.17+.12*cos(TAU*dF/lambda),1.-smoothstep(3.2*lambda,3.6*lambda,dF));
    v=mix(v,.17+.12*cos(TAU*dH/lambda),1.-smoothstep(4.2*lambda,4.6*lambda,dH));
    return vec4(1.-v,v,clamp(min(dF,dH)*2.2,0.,.99),1.);
}
// Same layout as rd_seed / rd_step: forewing space in the top half, hindwing in the bottom half.
vec4 rdSample(vec2 w,bool fore,float side){
    vec2 uv=fore?vec2(.05,.75)+w*.68:vec2(.05,.25)+w*.60;
    // Living drift: tiny periodic domain warp, integer harmonics only.
    uv+=.0018*vec2(sin(TAU*uv.y*3.+theta*spd),cos(TAU*uv.x*3.-theta*spd))*(.3+.7*reveal);
    // Symmetry < 1: the left wing reads a smoothly warped copy -> biological imperfection.
    float asym=(1.-clamp(uLook.y,0.,1.))*step(side,0.);
    uv+=asym*.03*vec2(sin(uv.y*23.+1.3),sin(uv.x*19.+.4));
#if USE_RD_INPUT
    return texture(sTD2DInputs[0],uv);
#else
    return fallbackRD(uv);
#endif
}
float pulse(float x){return pow(.5+.5*cos(TAU*x),6.);}
// Palette ramp for iridescence: cornflower -> periwinkle -> violet -> azure (all source HEX).
vec3 irid(float x){
    x=fract(x)*4.;
    vec3 a=x<1.?CORN:x<2.?PERI:x<3.?VIOLET:AZURE,b=x<1.?PERI:x<2.?VIOLET:x<3.?AZURE:CORN;
    return mix(a,b,smoothstep(0.,1.,fract(x)));
}
// ---------------------------------------------------------------- shading
vec3 L1,L2,LB;
vec3 shadeWing(vec3 p,vec3 n,vec3 rd,bool fore,vec2 w,float side,out float emitL){
    vec4 rd4=rdSample(w,fore,side);
    float e=wingOutline(w,fore,side),rho=length(w)/(fore?1.25:.95);
    float vn=veins(w,e,fore);
    float C=max(uLook.x,.05);
    C*=mix(.40,1.,smoothstep(.18,.55,rho));                               // pattern fades into the root dusting
    float mark=smoothstep(.5-.5/C,.5+.5/C,(rd4.g-.17)*9.+.5);           // pigment field
    float rim=1.-abs(2.*mark-1.);                                          // marking boundaries
    float arr=rd4.b<.999?sqrt(rd4.b):1.;
    float front=1.-smoothstep(growth-.08,growth,arr);                      // growth front reveal
    float pb=clamp(uCam.z,0.,1.);
    // Albedo: blue/violet membrane, deep-blue pigment, periwinkle/lavender boundaries.
    vec3 memb=mix(STEEL,CORN,smoothstep(.15,.85,rho));
    memb=mix(memb,mix(VIOLET,IRIS,smoothstep(.2,.8,rd4.r)),pb*(.45+.55*smoothstep(-.25,.25,fore?-w.y:w.x-.35)));
    vec3 alb=mix(memb,DEEP,mark*.85);
    // Eyespots: RD target rings recoloured lavender/periwinkle over a navy-violet iris.
    float lambda=.025*sqrt(clamp(uQuality.y,.2,1.)/.6)/(fore?.68:.60);
    float er=length(w-(fore?vec2(.66,0.):vec2(.48,-.02)))/lambda,eyeZ=1.-smoothstep(fore?3.0:4.0,fore?3.6:4.6,er);
    vec3 eyeCol=mix(mix(NAVY,VIOLET,.35),mix(PERI,LAV,smoothstep(1.5,.3,er)),mark);
    alb=mix(alb,eyeCol,eyeZ);
    alb=mix(alb,PERI,rim*(.25+.35*reveal*front));
    alb=mix(alb,mix(TEAL,NAVY,.5),(1.-smoothstep(.05,.30,rho))*.8);        // structural root dusting
    float me=-e;                                                           // distance in from the margin
    alb=mix(alb,mix(DEEP,NAVY,.5),.65*smoothstep(.02,.035,me)*(1.-smoothstep(.06,.09,me)));   // submarginal band
    alb=mix(alb,mix(PERI,LAV,.3),.45*(1.-smoothstep(.0,.012,abs(me-.11-.012*sin(atan(w.y,w.x)*18.))))); // postmedial line
    alb=mix(alb,NAVY,vn*.65);                                              // veins
    alb=mix(alb,mix(PERI,LAV,.4),(1.-smoothstep(.0,.03,-e))*(1.-vn)*.35);  // scale fringe
    // Lighting: two-sided membrane with transmission through thin tissue.
    float ndv=dot(n,-rd);vec3 nf=ndv<0.?-n:n;ndv=abs(ndv);
    float dif=.5+.5*dot(nf,L1);dif*=dif;
    float trans=max(dot(-nf,LB),0.)*(1.-.75*vn)*(1.-.55*mark);
    float F=pow(1.-ndv,4.);
    vec3 h=normalize(L1-rd);
    float spec=pow(max(dot(nf,h),0.),70.)*(.18+.5*vn);
    vec3 col=alb*(.03+.70*dif);
    col+=mix(alb,CORN,.3)*alb*trans*1.0;                                   // subsurface-like glow
    col+=irid(.25*ndv+.15*breath+.6*rd4.r)*(.10+.45*F)*.35*(1.-.6*vn);    // thin-film iridescence
    col+=PERI*spec+PERI*F*.55*max(uLook.z,0.)*(.6+.4*dot(nf,L2));
    col+=AZURE*max(dot(nf,L2),0.)*.10;                                     // directional rim key
    // Emission: moving RD accents (bright blues), lavender cores, gated by the growth front.
    float travel=pulse(arr*2.5-phase*spd*2.);
    float em=(.10+.90*front)*reveal;
    vec3 emit=mix(AZURE,CORN,rim)*rim*(.18+.80*travel)*em*.9;
    emit+=LAV*smoothstep(.27,.33,rd4.g)*em*(.25+.6*travel);
    emit+=mix(PERI,LAV,.5)*eyeZ*mark*(.08+.6*em*(.5+.5*travel))*smoothstep(4.5,0.,er);
    emit+=CORN*rim*.05;                                                    // faint pattern at rest
    // Iridescent light band sweeping root -> tip once per cycle.
    float band=exp(-pow((rho-sweep)*5.,2.));
    emit+=mix(PERI,LAV,.35)*band*(.10+.35*mark+.25*rim)*(.5+.5*reveal);
    // Eyespot ripples: rings of light expanding outward from each pupil.
    emit+=mix(PERI,LAV,.6)*eyeZ*pulse(er*.22-phase*spd*3.)*(.12+.30*reveal);
    // Scale glitter: sparse wing scales catch the light, each twinkling at an integer rate.
    vec2 gc=floor(w*140.);
    float hh=fract(sin(dot(gc+(fore?0.:31.)+side*7.,vec2(12.9898,78.233)))*43758.5453);
    float tw=pow(max(0.,sin(TAU*(hh*7.+phase*spd*floor(1.+hh*3.)))),24.)*step(.84,hh);
    emit+=LAV*tw*.9*(1.-vn)*smoothstep(0.,.02,-e);
    emit*=(1.-.7*vn)*max(uLook.w,0.);
    emitL=dot(emit,vec3(.3,.5,.2));
    return col+emit;
}
vec3 shadeBody(vec3 p,vec3 n,vec3 rd,float id){
    float ndv=max(dot(n,-rd),0.),dif=max(dot(n,L1),0.),F=pow(1.-ndv,3.);
    vec3 h=normalize(L1-rd);vec3 col;
    if(id<.5){
        vec3 b=bodyRot*p/bodyS;
        float ab=clamp((.08-b.y)/.68,0.,1.),seg=pow(abs(fract(ab*9.)*2.-1.),6.);
        vec3 alb=mix(mix(NAVY,DEEP,.35+.3*dif),TEAL*.8,seg*step(.01,ab)*.6);
        col=alb*(.05+.6*dif)+PERI*pow(1.-ndv,2.)*.35*max(uLook.z,0.);      // velvet fur sheen
        col+=PERI*pow(max(dot(n,h),0.),24.)*.08;
    }else if(id<3.5){
        col=NAVY*.25*(.2+dif)+LAV*pow(max(dot(n,h),0.),120.)*1.4+PERI*F*.5;
    }else{
        col=mix(PERI,CORN,.5)*(.15+.55*dif)+LAV*F*.4;
    }
    col+=AZURE*max(dot(n,L2),0.)*.12+PERI*F*.25*max(uLook.z,0.);
    return col;
}
void setup(){
    CORN=lin(H_5B8BDF);STEEL=lin(H_3E79C7);TEAL=lin(H_08584F);LAV=lin(H_EAD3FF);NAVY=lin(H_102A67);
    AZURE=lin(H_3C7DD1);VIOLET=lin(H_6556BD);IRIS=lin(H_645EBE);DEEP=lin(H_152D91);PERI=lin(H_8AA5F6);
    float seconds=uTimeSeconds;if(isnan(seconds)||isinf(seconds))seconds=0.;
    phase=fract(seconds/LOOP_SECONDS);
#ifdef DEBUG_T
    phase=DEBUG_T;
#endif
    theta=TAU*phase;spd=harmonic(uCam.w);
    // Story: 0-0.5 s full moth, 0.5-2 s markings grow + brighten, 2-6 s living light, 6-8 s settle.
    // reveal is 0 with zero slope at both loop ends; growth only acts through reveal.
    reveal=smoothstep(.0625,.25,phase)*(1.-smoothstep(.75,1.,phase));
    growth=mix(-.1,1.15,smoothstep(.0625,.25,phase));
    breath=sin(theta*spd);breath2=sin(2.*theta*spd+1.);
    float fold=clamp(uWing.z,0.,1.5);
    // Two slow wingbeats per loop with an eased profile: brisk downstroke, long lingering glide.
    float x=2.*theta*spd,strokeF=sin(x+.45*sin(x)),strokeH=sin(x-.55+.45*sin(x-.55));
    foldF=fold*.42+.16*strokeF+.05*breath;
    foldH=fold*.36+.12*strokeH+.04*breath;                                 // hindwing lags
    // Hover: the body lifts just after each downstroke and drifts on a 1:2 Lissajous.
    hover=vec3(.012*sin(theta*spd+.4),.030*sin(x-1.2+.45*sin(x-1.2)),.010*sin(theta*spd+2.));
    sweep=-.60+2.2*fract(phase*spd);                                       // light band, root -> tip
    curv=clamp(uWing.y,0.,2.)*(.85+.15*sin(theta*spd+.7));
    span=max(uWing.x,.3);bodyS=max(uWing.w,.3);
    antSwing=sin(2.*theta*spd+.6)+.5*sin(3.*theta*spd+2.);
    float roll=.07*sin(theta*spd+.3),pitch=-.10+.035*sin(2.*theta*spd+1.7),yaw=.03*sin(theta*spd-1.);
    mat3 Ry=mat3(cos(roll),0.,sin(roll),0.,1.,0.,-sin(roll),0.,cos(roll));
    mat3 Rx=mat3(1.,0.,0.,0.,cos(pitch),-sin(pitch),0.,sin(pitch),cos(pitch));
    mat3 Rz=mat3(cos(yaw),-sin(yaw),0.,sin(yaw),cos(yaw),0.,0.,0.,1.);
    bodyRot=Ry*Rx*Rz;
    float lt=theta*spd;
    L1=normalize(vec3(-.45+.20*sin(lt),.65,.60));                          // key from front-left
    L2=normalize(vec3(.75,.25+.15*cos(lt),-.25));                          // rim from right-behind
    LB=normalize(vec3(.10*sin(lt+1.),.35,-1.));                            // back light for transmission
}
// 9:16 composition: roll the frame so the wingspan runs corner to corner (moth climbing),
// then move in, since a diagonal moth fits a portrait frame at a much larger scale.
const float DIAG_ROLL=-50.,DIAG_ZOOM=.72;
vec4 catmull(vec4 a,vec4 b,vec4 c,vec4 d,float t){
    return .5*(2.*b+(c-a)*t+(2.*a-5.*b+4.*c-d)*t*t+(3.*b-a-3.*c+d)*t*t*t);
}
float D0;
vec4 render(vec2 uv,vec3 ro,vec3 fw,vec3 rt,vec3 up,float tanH,float R){
    vec3 rd=normalize(fw+(uv.x*rt+uv.y*up)*tanH);
    vec3 oc=ro;float b=dot(oc,rd),h=b*b-dot(oc,oc)+R*R;
    float t=0.,hit=0.,glow=0.;
    if(h>=0.){
        t=max(0.,-b-sqrt(h));float stop=-b+sqrt(h);
        for(int i=0;i<MAX_STEPS;i++){
            float d=sceneSDF(ro+rd*t),eps=max(.0004,t*.00035);
            glow+=exp(-max(d,0.)*55.)*exp(-.8*max(t-D0+.8,0.))*.02;        // depth-aware halo
            if(d<eps){hit=1.;break;}
            t+=max(d,eps*.5);if(t>stop)break;
        }
    }
    vec3 bg=mix(NAVY*.004,NAVY*.022,smoothstep(-1.2,1.4,uv.y))+DEEP*.012*exp(-dot(uv,uv)*1.5);
    vec2 bq=uv-vec2(0.,.05);                                               // breathing aura behind the moth
    bg+=mix(DEEP,VIOLET,.5)*.012*exp(-dot(bq,bq)*2.5)*(.6+.4*sin(theta*spd-.5));
    vec3 col=bg;float emitL=0.;
    if(hit>.5){
        vec3 p=ro+rd*t;vec3 n=normalAt(p,max(.0005,t*.0003));
        sceneSDF(p);
        float id=gId,side=gSide;vec2 w=gW;
        if(id>.5&&id<2.5)col=shadeWing(p,n,rd,id<1.5,w,side,emitL);
        else col=shadeBody(p,n,rd,id);
        col=mix(col,bg,1.-exp(-.35*max(t-D0+.6,0.)));                       // atmospheric depth
    }
    col+=mix(AZURE,PERI,.35)*glow*(.25+.5*reveal)*max(uLook.w,0.);
    return vec4(col,emitL+hit*0.);
}
vec3 shoulder(vec3 c,float knee){
    float m=max(c.r,max(c.g,c.b));if(m<=knee)return c;
    float mm=knee+(1.-knee)*(1.-exp(-(m-knee)/(1.-knee)));return c*(mm/m);
}
vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
vec2 hash22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
void main(){
    uWing=vec4(uWingSpan,uWingCurvature,uWingFold,uBodySize);
    uLook=vec4(uPatternContrast,uSymmetry,uFresnel,uGlow);
    uCam=vec4(uCameraDistance,uCameraRotation,uPaletteBlend,uAnimationSpeed);
    uQuality=vec4(uSupersample,uPatternScale,0.,0.);
    setup();
    vec2 res=uTDOutputInfo.res.zw;float aspect=res.x/max(res.y,1.);
    float S=max(span,bodyS);
    // Cinematic camera: periodic Catmull-Rom through 4 keys (one every 2 s). The spline wraps
    // key 3 -> key 0, so position AND velocity are continuous across the loop seam.
    // key = (azimuth deg, elevation deg, distance mult, roll deg) ; tgt = look-at offset
    const vec4 CK[4]=vec4[4](vec4(-18.,-6.,.92,-5.),   // 0 s  hook: low 3/4, wings back-lit, close
                             vec4(-8.,14.,1.00,-1.),    // 2 s  rise to the front as markings ignite
                             vec4(12.,28.,1.03,3.),     // 4 s  high front, full symmetric reveal
                             vec4(4.,8.,.97,2.));      // 6 s  push-in toward the forewing eyespot
    // Screen-space pan per key (x along frame right, y along frame up), keeps the moth centred.
    const vec3 CT[4]=vec3[4](vec3(-0.258,0.462,0.),vec3(-0.208,0.320,0.),vec3(-0.071,-0.077,0.),vec3(-0.323,0.249,0.));
    float kf=phase*4.;int k1=int(floor(kf))%4;float kt=fract(kf);
    int k0=(k1+3)%4,k2=(k1+1)%4,k3=(k1+2)%4;
    vec4 cam=catmull(CK[k0],CK[k1],CK[k2],CK[k3],kt);
    vec3 pan=catmull(vec4(CT[k0],0.),vec4(CT[k1],0.),vec4(CT[k2],0.),vec4(CT[k3],0.),kt).xyz;
    float az=radians(clamp(uCam.y,-90.,90.)+cam.x+1.5*sin(theta*spd)),el=radians(cam.y);
    vec3 eyeDir=vec3(sin(az)*cos(el),sin(el),cos(az)*cos(el));
    vec3 fw=-eyeDir,rt=normalize(cross(fw,vec3(0.,1.,0.))),up=cross(rt,fw);
    float roll=radians(cam.w+DIAG_ROLL);vec3 rt0=rt;
    rt=cos(roll)*rt0+sin(roll)*up;up=-sin(roll)*rt0+cos(roll)*up;
    vec3 target=(vec3(0.,.05,0.)+pan.x*rt+pan.y*up)*S;
    float tanH=tan(radians(28.)*.5);
    float D=max(2.0*S/(tanH*aspect),1.25*S/tanH)*max(uCam.x,.4)*cam.z*DIAG_ZOOM;D0=D;
    vec3 ro=eyeDir*D;
    float R=2.2*S;
    int aa=int(clamp(uQuality.x,1.,2.));
    vec4 acc=vec4(0.);
    for(int j=0;j<aa;j++)for(int i=0;i<aa;i++){
        vec2 o=(vec2(i,j)+.5)/float(aa)-.5;
        vec2 uv=((vUV.st*res+o)/res-.5)*vec2(aspect,1.)*2.;
        acc+=render(uv,ro+target,fw,rt,up,tanH,R);
    }
    acc/=float(aa*aa);
    vec2 uv=(vUV.st-.5)*vec2(aspect,1.)*2.;
    acc.rgb*=1.-.30*smoothstep(.6,1.7,length(uv*vec2(1.,.62)));
    // In-shader grade (no bloom chain here): emission halo, hue-preserving shoulder, sRGB, dither.
    vec3 col=max(acc.rgb,0.)*(1.+.35*acc.a)*max(uExposure,0.);
    col=srgb(clamp(shoulder(col,.8),0.,1.));
    vec2 dh=hash22(gl_FragCoord.xy);col+=(dh.x+dh.y-1.)/255.;
    fragColor=TDOutputSwizzle(vec4(col,1.));
}
