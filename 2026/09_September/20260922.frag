// [SHADER] OPABINIA — VORONOI FORM
// Procedural artistic interpretation. TouchDesigner GLSL TOP, no inputs.
// 2.5D relief anatomy + moving planar Voronoi fragments, not a mesh/raymarcher.
// Keep 0 for immediate inline controls; setup_opabinia.py enables uniforms.
#define EXTERNAL_CONTROLS 0
out vec4 fragColor;
uniform float uTimeSeconds;
#if EXTERNAL_CONTROLS
#define CONTROL(name,value) uniform float name
#else
#define CONTROL(name,value) const float name = value
#endif
CONTROL(uVoronoiScale, 8.0);
CONTROL(uVoronoiSpeed, 1.0);
CONTROL(uSeparation, 0.62);
CONTROL(uGlow, 0.85);
CONTROL(uDisplacement, 0.035);
CONTROL(uPulse, 0.22);
CONTROL(uSoftness, 0.0018);
CONTROL(uColorIntensity, 1.0);
CONTROL(uBackground, 0.8);
CONTROL(uBodyWidth, 1.0);
CONTROL(uLobeSize, 1.0);
CONTROL(uExposure, 1.15);
CONTROL(uZoom, 1.0);
// Cinematic camera rig. Orbit and roll are degrees; FOV is vertical degrees.
#define EXTERNAL_CAMERA_CONTROLS 0
#if EXTERNAL_CAMERA_CONTROLS
#define CAMERA_CONTROL(name,value) uniform float name
#else
#define CAMERA_CONTROL(name,value) const float name = value
#endif
CAMERA_CONTROL(uCameraDistance, 3.04);
CAMERA_CONTROL(uLoopSpeed, 1.0);
CAMERA_CONTROL(uDollyAmount, 0.08);
CAMERA_CONTROL(uOrbitAmount, 3.0);
CAMERA_CONTROL(uHeroAngle, 11.0);
CAMERA_CONTROL(uLateralShift, 0.045);
CAMERA_CONTROL(uHeroVerticalShift, 0.055);
CAMERA_CONTROL(uVerticalOffset, 0.0);
CAMERA_CONTROL(uTargetHeight, 0.34);
CAMERA_CONTROL(uHeroPush, 0.10);
CAMERA_CONTROL(uReconstructionPullback, 0.10);
CAMERA_CONTROL(uFov, 42.0);
CAMERA_CONTROL(uRollAmount, 0.65);
CAMERA_CONTROL(uForegroundFragmentAmount, 0.72);
CAMERA_CONTROL(uForegroundFragmentDepth, 0.30);
CAMERA_CONTROL(uMainVoronoiBrightness, 0.64);
CAMERA_CONTROL(uOuterCellBrightness, 1.02);
CAMERA_CONTROL(uDetachedFragmentBrightness, 1.28);
CAMERA_CONTROL(uEyeEmission, 1.18);
CAMERA_CONTROL(uInternalBodyBrightness, 0.78);
CAMERA_CONTROL(uProboscisBaseX, -0.015);
CAMERA_CONTROL(uProboscisBaseY, 0.75);
CAMERA_CONTROL(uProboscisBaseZ, 0.37);
CAMERA_CONTROL(uProboscisForwardOffset, 0.045);
CAMERA_CONTROL(uProboscisCurveAmount, 0.20);
CAMERA_CONTROL(uProboscisSideBend, 0.045);
CAMERA_CONTROL(uProboscisLength, 0.94);
CAMERA_CONTROL(uProboscisTipAngle, 8.0);
CAMERA_CONTROL(uEasingStrength, 1.35);
const float TAU=6.28318530718;
float phase;
mat2 rotation(float a) { float c=cos(a),s=sin(a);return mat2(c,-s,s,c); }
float easeCamera(float x) {
    x=clamp(x,0.,1.);
    float e=x*x*(3.-2.*x);
    float e2=e*e*(3.-2.*e);
    return mix(x,mix(e,e2,clamp(uEasingStrength-1.,0.,1.)),clamp(uEasingStrength,0.,1.));
}
float cameraWindow(float t,float a,float b,float c,float d) {
    return easeCamera((t-a)/max(b-a,.0001))*(1.-easeCamera((t-c)/max(d-c,.0001)));
}
void cinematicCamera(float t,out float cameraScale,out float orbit,out float roll,out vec2 target,out float hero) {
    // Every animated camera component is zero at t=0 and t=1 for a seamless loop.
    float approach=cameraWindow(t,.10,.40,.63,.90);
    hero=cameraWindow(t,.42,.52,.61,.72);
    float reconstruct=cameraWindow(t,.66,.76,.88,.98);
    float action=clamp(.62*approach+hero,0.,1.);
    float lens=tan(radians(42.)*.5)/tan(radians(clamp(uFov,25.,65.))*.5);
    float distance=3.4/max(uCameraDistance,.25);
    float dolly=1.+uDollyAmount*approach+uHeroPush*hero
        -uReconstructionPullback*.18*reconstruct;
    cameraScale=max(.20,uZoom*lens*distance*dolly);
    orbit=radians(clamp(uOrbitAmount,-10.,10.))*approach
        +radians(clamp(uHeroAngle,-18.,18.))*hero;
    roll=radians(clamp(uRollAmount,-4.,4.))*hero*sin(phase);
    float headFocus=.42*approach+.58*hero;
    // Lateral travel and target rise peak at breakup, then converge to the exact opening frame.
    target=vec2(.018*sin(orbit)*action+uLateralShift*hero,
        .18+uVerticalOffset+uTargetHeight*headFocus+uHeroVerticalShift*hero);
}
vec2 hash22(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);
}
float capsule(vec2 p,vec2 a,vec2 b,float r) {
    vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.))-r;
}
// Surface: signed outline, height, material (0 carapace / 1 eye / 2 stalk).
void ellipse(inout vec3 s,vec2 p,vec2 center,vec2 radii,float angle,float z,float depth,float mat) {
    vec2 q=rotation(angle)*(p-center)/radii;
    float d=(length(q)-1.)*min(radii.x,radii.y);
    float h=z+depth*sqrt(max(0.,1.-dot(q,q)));
    s.x=min(s.x,d);
    if(d<0. && h>s.y) {s.y=h;s.z=mat;}
}
void tube(inout vec3 s,vec2 p,vec2 a,vec2 b,float r,float z,float mat) {
    float d=capsule(p,a,b,r);s.x=min(s.x,d);
    float h=z+sqrt(max(0.,r*r-(d+r)*(d+r)));
    if(d<0. && h>s.y) {s.y=h;s.z=mat;}
}
vec2 trunk(float t) {
    // Lower face attachment: forward first, then the original elegant upward curve.
    float curveGate=smoothstep(.06,.42,t);
    float sideCurve=uProboscisCurveAmount*(.18*t*(1.-t)+sin(t*2.4)*curveGate);
    float organic=uProboscisSideBend*sin(phase)*sin(t*3.14159);
    return vec2(uProboscisBaseX-sideCurve+organic,uProboscisBaseY+uProboscisLength*t);
}
float trunkZ(float t) {
    return uProboscisBaseZ+uProboscisForwardOffset*easeCamera(t/.24);
}
vec3 anatomy(vec2 p) {
    vec3 s=vec3(10.,0.,0.);
    p.x-=.025*sin(phase-p.y*3.)*(1.-smoothstep(.45,1.0,p.y));
    // Tail fan behind 15 paired swimming lobes.
    for(int side=-1;side<=1;side+=2) {
        ellipse(s,p,vec2(float(side)*.18,-1.10),vec2(.15,.32),float(side)*.48,.01,.055,0.);
        for(int i=0;i<15;i++) {
            float f=float(i)/14.;float y=mix(-.91,.66,f);
            float w=(.23+.105*sin(f*2.8))*uLobeSize;
            float wave=.085*sin(phase*2.-f*6.);
            vec2 c=vec2(float(side)*(.19+w*.35)*uBodyWidth,y);
            ellipse(s,p,c,vec2(w,.083),float(side)*(-.30+wave),.028,.065,0.);
        }
    }
    ellipse(s,p,vec2(0.,-.13),vec2(.255*uBodyWidth,1.04),0.,.04,.22,0.);
    ellipse(s,p,vec2(0.,.72),vec2(.29,.26),-.08,.08,.23,0.);
    // Proboscis appears in front of the head; smooth piecewise swept tube.
    for(int i=0;i<18;i++) {
        float t=float(i)/18.;
        tube(s,p,trunk(t),trunk(t+1./18.),mix(.052,.027,t),trunkZ(t+.5/18.),2.);
    }
    vec2 tip=trunk(1.);
    float tipZ=trunkZ(1.);
    for(int side=-1;side<=1;side+=2) {
        mat2 tipRotation=rotation(radians(uProboscisTipAngle)*float(side));
        vec2 a=tip+tipRotation*vec2(float(side)*.088,.065);
        vec2 b=tip+tipRotation*vec2(float(side)*.042,.13);
        tube(s,p,tip,a,.018,tipZ,2.);tube(s,p,a,b,.013,tipZ,2.);
    }
    // Five individually spaced stalked eyes. No duplicated hidden eye dots.
    for(int i=0;i<5;i++) {
        float x=float(i)-2.;
        vec2 e=vec2(x*.143,.94+.18*(1.-abs(x)*.5));
        vec2 base=vec2(x*.087,.77);
        tube(s,p,base,e,.022,.39,2.);
        ellipse(s,p,e,vec2(.061,.069),0.,.43,.072,1.);
    }
    return s;
}
vec2 restSeed(vec2 id) {return id+.22+.56*hash22(id);}
vec2 movingSeed(vec2 id,float amount,float cycles) {
    vec2 r=hash22(id+19.);
    float chosen=smoothstep(.74,.82,r.x);
    vec2 drift=vec2(r.x-.5,r.y-.5);
    drift=mix(drift,normalize(drift+vec2(.001)),chosen*amount);
    return restSeed(id)+amount*mix(.07,.31,chosen)*drift
        +amount*.055*vec2(sin(phase*cycles+TAU*r.x),cos(phase*cycles+TAU*r.y));
}
// Exact bisector distance for the local Voronoi neighborhood (not F2-F1).
// Cell density increases toward the head and distorts toward the silhouette.
void cells(vec2 p,float amount,out vec2 source,out float edge,out float random,out float selected,out float depth,out float nearLens) {
    float head=smoothstep(.30,1.32,p.y);
    float edgeZone=smoothstep(.16,.62,abs(p.x));
    float scale=max(uVoronoiScale,2.)*mix(.74,1.42,head)*mix(1.,1.14,edgeZone);
    vec2 warped=p+edgeZone*vec2(.030*sin(p.y*8.3+phase*.17),.018*sin(p.x*11.));
    vec2 q=warped*scale,base=floor(q);
    float cycles=floor(clamp(uVoronoiSpeed,0.,4.)+.5);
    vec2 best=vec2(0.),id=vec2(0.);float md=1e8;
    for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++) {
        vec2 k=base+vec2(x,y),r=movingSeed(k,amount,cycles)-q;
        float d=dot(r,r);if(d<md){md=d;best=r;id=k;}
    }
    edge=10.;
    for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++) {
        vec2 k=base+vec2(x,y),r=movingSeed(k,amount,cycles)-q;
        vec2 d=r-best;if(dot(d,d)>.00001) edge=min(edge,dot(.5*(best+r),normalize(d)));
    }
    edge/=scale;
    vec2 seed=movingSeed(id,amount,cycles)/scale;
    random=hash22(id+4.).x;
    selected=smoothstep(.73,.82,random);
    // Independent sparse class: approximately the nearest 8-10 percent of cells.
    nearLens=smoothstep(.90,.975,hash22(id+83.).x);
    depth=(hash22(id+31.).y-.5)*amount*(.10+.15*selected);
    vec2 away=normalize(vec2(seed.x,seed.y*.32+.12)+vec2(.001));
    float push=mix(-.025,.055,hash22(id+57.).x)*amount;
    vec2 detach=away*(push+selected*amount*.085);
    vec2 local=rotation(amount*mix(.045,.22,selected)*sin(phase+random*TAU))*(p-seed-detach);
    source=restSeed(id)/scale+local/(1.-amount*mix(.035,.12,selected));
}
vec3 film(vec3 x) {return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main() {
    float t=fract(uTimeSeconds*max(uLoopSpeed,0.)/12.);
    phase=t*TAU;
    vec2 res=uTDOutputInfo.res.zw;
    float cameraScale,camOrbit,camRoll,hero;
    vec2 cameraTarget;
    cinematicCamera(t,cameraScale,camOrbit,camRoll,cameraTarget,hero);
    vec2 screen=(vUV.st-.5)*vec2(res.x/res.y,1.)*4.6/cameraScale;
    // Small orbit, target rise, and longitudinal shear create controlled 2.5D parallax.
    vec2 p=rotation(-.24+camOrbit+camRoll)*screen+cameraTarget;
    p.x+=sin(camOrbit)*(.050*p.y+.018*p.x*abs(p.x));
    p.y+=hero*.018*sin(screen.x*1.7);
    float px=4.6/res.y/cameraScale;
    float aa=max(px*.85,max(uSoftness,0.));
    // Breakup travels tail -> body -> head -> proboscis; reconstruction reverses it.
    float order=clamp((p.y+1.28)/3.05,0.,1.);
    float opening=smoothstep(mix(.06,.42,order),mix(.17,.53,order),t);
    float closing=smoothstep(mix(.91,.57,order),mix(.99,.68,order),t);
    float travel=opening*(1.-closing);
    float reveal=smoothstep(.04,.28,travel);
    float split=smoothstep(.16,.58,travel);
    float amount=split*clamp(uSeparation,0.,1.);
    // Preserve the head and eye cluster while allowing stronger peripheral breakup.
    float identityProtect=.48*smoothstep(.58,1.10,p.y);
    float localAmount=amount*(1.-identityProtect*.60);
    vec2 src;float edge,rnd,selected,cellDepth,nearLens;
    cells(p,localAmount,src,edge,rnd,selected,cellDepth,nearLens);
    // Selected hero fragments advance across the lens plane without breaking identity.
    float headExclusion=1.-smoothstep(.48,.88,p.y);
    float foreground=hero*nearLens*localAmount*headExclusion*clamp(uForegroundFragmentAmount,0.,1.5);
    src-=vec2(.16*sin(camOrbit)+.08*(rnd-.5),.10+.06*rnd)*foreground;
    cellDepth+=uForegroundFragmentDepth*foreground;
    src.x+=uDisplacement*reveal*sin(src.y*10.+sin(phase))*sin(phase)*mix(.35,1.,selected);
    // Recognition remains stable: only selected cells receive strong displacement.
    src=mix(src,p,identityProtect*(1.-selected*.55));
    vec3 shape=anatomy(src);
    shape.y+=cellDepth;
    float gap=localAmount*mix(.006,.050,selected)*(1.-identityProtect*.45);
    float inside=1.-smoothstep(-aa,aa,shape.x);
    float cellMask=mix(1.,smoothstep(gap-aa,gap+aa,edge),split*mix(.32,1.,selected));
    float mask=inside*cellMask;
    float pulse=1.+uPulse*sin(phase*2.+rnd*TAU);
    float border=exp(-max(edge-gap,0.)*390.)*reveal*cellMask;
    // Screen-space relief normal: inexpensive shaded volume, no marching loop.
    vec3 n=normalize(vec3(-dFdx(shape.y)/px,-dFdy(shape.y)/px,1.));
    vec3 l=normalize(vec3(-.5,.8,1.3)),v=vec3(0.,0.,1.);
    float diffuse=max(dot(n,l),0.);
    float spec=pow(max(dot(n,normalize(l+v)),0.),42.);
    float rim=pow(1.-max(n.z,0.),2.);
    float band=.5+.5*cos(src.y*55.+1.4*sin(src.x*10.));
    float veins=pow(.5+.5*cos(src.x*96.+src.y*48.),12.);
    vec3 teal=vec3(.007,.040,.050);
    vec3 flesh=teal*(.34+.62*diffuse)*mix(.62,.94,band);
    flesh+=vec3(.020,.095,.115)*spec+vec3(.012,.075,.105)*rim;
    flesh+=vec3(.006,.028,.034)*veins*(1.-smoothstep(.17,.26,abs(src.x)));
    float core=exp(-pow(src.x/(.075+.025*smoothstep(-1.,.5,src.y)),2.));
    core*=smoothstep(-1.08,-.78,src.y)*(1.-smoothstep(.58,.86,src.y));
    flesh*=uInternalBodyBrightness;
    flesh+=vec3(.008,.10,.125)*core*(.28+.72*reveal)*uInternalBodyBrightness;
    float outerCells=max(smoothstep(.16,.58,abs(src.x)),smoothstep(.36,1.05,-src.y));
    float borderHierarchy=mix(uMainVoronoiBrightness,uOuterCellBrightness,outerCells);
    borderHierarchy=mix(borderHierarchy,uDetachedFragmentBrightness,
        selected*localAmount*(.45+.55*hero));
    flesh+=vec3(.025,.50,.68)*border*uGlow*pulse*borderHierarchy;
    flesh+=vec3(.012,.19,.25)*selected*localAmount*uDetachedFragmentBrightness*(.35+.65*diffuse);
    flesh+=vec3(.035,.42,.58)*foreground*uDetachedFragmentBrightness*(.35+.65*rim);
    float eyeCore=0.;
    for(int i=0;i<5;i++) {
        float ex=float(i)-2.;vec2 ep=vec2(ex*.143,.94+.18*(1.-abs(ex)*.5));
        vec2 eq=(src-ep)/vec2(.018,.021);eyeCore=max(eyeCore,exp(-dot(eq,eq)*1.8));
    }
    if(shape.z>.5 && shape.z<1.5) {
        flesh=vec3(.002,.010,.016)+vec3(.025,.12,.16)*spec;
        flesh+=vec3(.012,.10,.15)*rim+vec3(.20,.88,1.05)*eyeCore*uEyeEmission;
    } else if(shape.z>1.5) {flesh=mix(flesh,vec3(.010,.065,.078)*(.28+diffuse)+spec*.10,.72);}
    // Restrained ocean atmosphere, deterministic and periodic. No feedback history.
    float halo=exp(-dot(screen*vec2(1.15,.56),screen*vec2(1.15,.56))*1.8);
    vec3 bg=(vec3(.0015,.0035,.009)+halo*vec3(.006,.024,.034))*uBackground;
    bg+=vec3(.011,.006,.022)*exp(-length(screen-vec2(.55,-.55))*2.)*uBackground;
    float outer=exp(-abs(shape.x)*95.)*.024*uGlow;
    vec3 col=mix(bg,flesh*uColorIntensity,mask)+vec3(.018,.30,.43)*outer;
    // Thin anatomical edge light keeps the lobes readable on a phone.
    col+=vec3(.025,.31,.40)*exp(-abs(shape.x)*250.)*.14*cellMask;
    col*=1.-.18*smoothstep(.35,2.5,length(screen));
    col=pow(film(max(col,0.)*max(uExposure,0.)),vec3(1./2.2));
    fragColor=TDOutputSwizzle(vec4(col,1.));
}
