// ===============================================================
// CAMBRORASTER FALCATUS - BURGESS SHALE NIGHT SIFTER
// TouchDesigner GLSL TOP fragment shader
// A procedural raymarched radiodont with a dominant horseshoe-shaped
// dorsal carapace, eye notches, raised eyes, compact underside,
// swimming flaps, hooked frontal appendages, and an oral cone.
// Original neon palette preserved.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS 152
#define MAX_DIST  15.0
#define SURF_DIST 0.0010
#define PI        3.14159265359
#define TAU       6.28318530718

// ---------------------------------------------------------------
// EXISTING PALETTE REUSE - DO NOT ALTER
// ---------------------------------------------------------------
const vec3 ACID   = vec3(0.0,   1.0,   0.624);
const vec3 CYAN   = vec3(0.0,   0.812, 1.0);
const vec3 VIOLET = vec3(0.545, 0.0,   1.0);
const vec3 PINK   = vec3(1.0,   0.0,   0.431);

// ---------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------
mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float hash11(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float noise3(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(p),             hash13(p+vec3(1,0,0)), f.x),
        mix(hash13(p+vec3(0,1,0)), hash13(p+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(p+vec3(0,0,1)), hash13(p+vec3(1,0,1)), f.x),
        mix(hash13(p+vec3(0,1,1)), hash13(p+vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p  = p * 2.04 + vec3(17.3, 9.1, 5.7);
    a *= 0.52;
  }
  return v;
}

float camboPhase(float t) {
  return TAU * fract(t / 30.0);
}

// ---------------------------------------------------------------
// SDF PRIMITIVES
// ---------------------------------------------------------------
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) +
         min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorusZ(vec3 p, vec2 r) {
  vec2 q = vec2(length(p.xy)-r.x, p.z);
  return length(q)-r.y;
}

float sdTriPlate(vec3 p, float halfW, float len, float thick) {
  float slope = halfW / len;
  float side = (abs(p.x) + slope*p.y - halfW) /
               sqrt(1.0+slope*slope);
  float tri = max(side, max(-p.y, p.y-len));
  vec2 w = vec2(tri, abs(p.z)-thick);
  return min(max(w.x,w.y),0.0) + length(max(w,0.0));
}

float sdWingPlate(vec3 p, vec3 root, vec3 tip,
                  float halfW, float thick) {
  vec3 axis = tip-root;
  float len = length(axis.xy);
  vec2 f = axis.xy / max(len,0.0001);
  vec2 s = vec2(-f.y,f.x);
  vec2 rel = p.xy-root.xy;
  vec3 lp = vec3(dot(rel,s),dot(rel,f),p.z-root.z);
  return sdTriPlate(lp,halfW,len,thick);
}

float sdPaddle(vec3 p, vec3 a, vec3 b, float width, float thick) {
  vec3 ba = b-a;
  float len = length(ba);
  vec3 f = ba/max(len,0.0001);
  vec3 up = abs(f.z)<0.90 ? vec3(0.0,0.0,1.0)
                          : vec3(0.0,1.0,0.0);
  vec3 s = normalize(cross(f,up));
  vec3 n = normalize(cross(s,f));
  vec3 c = (a+b)*0.5;
  vec3 lp = vec3(dot(p-c,s),dot(p-c,f),dot(p-c,n));
  return sdEllipsoid(lp,vec3(width,len*0.52,thick));
}

// ---------------------------------------------------------------
// SMOOTH UNION / SUBTRACTION HELPERS
// ---------------------------------------------------------------
float smin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k,0.0,1.0);
  return mix(b,a,h)-k*h*(1.0-h);
}

float smax(float a, float b, float k) {
  float h = clamp(0.5-0.5*(b-a)/k,0.0,1.0);
  return mix(b,a,h)+k*h*(1.0-h);
}

float opSubtract(float base, float cut) {
  return max(base,-cut);
}

struct Hit {
  float d;
  float m;
};

Hit opUnion(Hit a, Hit b) {
  return a.d < b.d ? a : b;
}

Hit opSmoothUnion(Hit a, Hit b, float k) {
  float d = smin(a.d,b.d,k);
  float h = smoothstep(-k,k,b.d-a.d);
  return Hit(d,mix(b.m,a.m,h));
}

// ---------------------------------------------------------------
// LOOPING CREATURE POSE
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z.
// ---------------------------------------------------------------
vec3 camboPose(vec3 p, float t) {
  float ph = camboPhase(t);
  p -= vec3(0.045*sin(ph),
            0.055*sin(ph*2.0+0.8),
            0.050*sin(ph+1.7));
  p.xz *= rot(0.055*sin(ph*2.0+0.3));
  p.yz *= rot(-0.080+0.045*sin(ph));
  p.xy *= rot(0.028*sin(ph*3.0+1.2));
  return p;
}

vec3 camboUnpose(vec3 q, float t) {
  float ph = camboPhase(t);
  q.xy *= rot(-0.028*sin(ph*3.0+1.2));
  q.yz *= rot(0.080-0.045*sin(ph));
  q.xz *= rot(-0.055*sin(ph*2.0+0.3));
  q += vec3(0.045*sin(ph),
            0.055*sin(ph*2.0+0.8),
            0.050*sin(ph+1.7));
  return q;
}

float camboShellU(float y) {
  return clamp((y+0.72)/1.42,0.0,1.0);
}

// Aliases retain the existing material/palette implementation exactly.
vec3 leanPose(vec3 p, float t) {
  return camboPose(p,t);
}

float leanBodyU(float y) {
  return camboShellU(y);
}

// ---------------------------------------------------------------
// HORSESHOE-SHAPED DORSAL CARAPACE
// ---------------------------------------------------------------
float camboCarapaceSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  vec3 c = vec3(0.0,-0.045,0.030);
  vec3 sp = q-c;
  sp.x += 0.010*sin(ph*2.0);
  sp.yz *= rot(0.025*sin(ph));

  // Dominant rounded shield with a low arched dorsal crown.
  float d = sdEllipsoid(sp,vec3(0.835,0.735,0.145));
  d = smin(d,sdRoundBox(sp-vec3(0.0,-0.170,-0.010),
                        vec3(0.665,0.430,0.105),0.220),0.075);

  // Posterior opening transforms the oval into a broad horseshoe.
  vec3 rearCut = sp-vec3(0.0,0.610,-0.015);
  float rearNotch = sdRoundBox(rearCut,vec3(0.285,0.345,0.205),0.145);
  d = opSubtract(d,rearNotch);

  // Deep posterior-side eye notches separate the wings from the center lobe.
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    float asym = side<0.0 ? -0.012 : 0.016;
    vec3 notchC = vec3(side*(0.365+asym),0.465+side*0.008,0.055);
    vec3 np = sp-notchC;
    np.xy *= rot(side*0.12);
    float notch = sdEllipsoid(np,vec3(0.215,0.285,0.225));
    d = opSubtract(d,notch);
  }

  // Rear wing-like projections create the characteristic falcatus plan.
  vec3 leftRoot  = c+vec3(-0.430,0.235,0.020);
  vec3 leftTip   = c+vec3(-0.790,0.790,0.012);
  vec3 rightRoot = c+vec3( 0.430,0.235,0.020);
  vec3 rightTip  = c+vec3( 0.805,0.765,0.018);
  d = smin(d,sdWingPlate(q,leftRoot,leftTip,0.235,0.070),0.040);
  d = smin(d,sdWingPlate(q,rightRoot,rightTip,0.230,0.068),0.040);

  return d;
}

// ---------------------------------------------------------------
// EYE NOTCH AND UPWARD-FACING EYE DETAIL
// ---------------------------------------------------------------
float camboEyesSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  float d = 20.0;

  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    float asym = side<0.0 ? -0.012 : 0.016;
    vec3 socket = vec3(side*(0.365+asym),0.425+side*0.008,0.070);
    vec3 stalkTop = socket+
      vec3(side*0.040,0.018,0.105+0.010*sin(ph*2.0+side));

    d = smin(d,sdTaperedCapsule(q,socket,stalkTop,0.060,0.044),0.018);

    // Elliptical horizontal eyes look upward and slightly outward.
    vec3 ep = q-stalkTop;
    ep.xy *= rot(side*(0.28+0.025*sin(ph+side)));
    d = smin(d,sdEllipsoid(ep,vec3(0.105,0.070,0.034)),0.010);

    // Small posterior eye hood seats each eye deep within its shell notch.
    vec3 hoodA = stalkTop+vec3(-side*0.070,-0.025,-0.020);
    vec3 hoodB = stalkTop+vec3( side*0.050, 0.070,-0.014);
    d = smin(d,sdTaperedCapsule(q,hoodA,hoodB,0.027,0.016),0.007);
  }
  return d;
}

// ---------------------------------------------------------------
// COMPACT BODY UNDERSIDE
// ---------------------------------------------------------------
float camboUndersideSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  float d = 20.0;

  for (int i=0; i<8; i++) {
    float fi = float(i);
    float u = fi/7.0;
    float y = mix(-0.300,0.610,u);
    float sway = 0.018*sin(ph*2.0+u*PI*2.0);
    vec3 c = vec3(sway,y,-0.135-0.015*u);
    float w = mix(0.300,0.155,u);
    float h = mix(0.105,0.062,u);
    d = smin(d,sdEllipsoid(q-c,vec3(w,0.095,h)),0.030);
  }

  // Shallow axial box gives the compact body a firm radiodont core.
  vec3 bp = q-vec3(0.0,0.115,-0.145);
  d = smin(d,sdRoundBox(bp,vec3(0.235,0.480,0.065),0.055),0.035);
  return d;
}

// ---------------------------------------------------------------
// REPEATED UNDERSIDE SWIMMING FLAPS
// ---------------------------------------------------------------
float camboFlapsSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  float d = 20.0;

  for (int i=0; i<7; i++) {
    float fi = float(i);
    float u = fi/6.0;
    float y = mix(-0.230,0.575,u);
    float bodyW = mix(0.300,0.155,u);

    for (int sideI=0; sideI<2; sideI++) {
      float side = sideI==0 ? -1.0 : 1.0;
      float asym = side<0.0 ? -0.010 : 0.014;
      float wave = sin(ph*3.0-fi*0.64+side*0.48);
      vec3 root = vec3(side*bodyW,y,-0.145);
      vec3 tip = root+vec3(
        side*(0.315+0.018*wave+asym),
        0.055+0.035*wave,
        -0.025+0.045*wave
      );
      d = smin(d,sdPaddle(q,root,tip,
                          mix(0.105,0.070,u),0.025),0.014);
      d = smin(d,sdTaperedCapsule(q,root,tip,0.030,0.009),0.008);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// SHORT FRONTAL APPENDAGES WITH HOOKED SPINES
// ---------------------------------------------------------------
float camboFrontalAppendagesSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  float d = 20.0;

  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    float flex = 0.5+0.5*sin(ph*2.0+side*0.7);
    float asym = side<0.0 ? -0.012 : 0.014;

    vec3 root = vec3(side*0.225,-0.405,-0.145);
    vec3 joint = vec3(side*(0.315+asym),-0.605,-0.175);
    vec3 rake = vec3(side*(0.330+0.025*flex+asym),-0.825,-0.160);
    vec3 preHook = vec3(side*(0.275+0.018*flex),-0.995,-0.125);
    vec3 hookTip = vec3(side*0.125,-1.035,-0.070);

    d = smin(d,sdTaperedCapsule(q,root,joint,0.062,0.052),0.020);
    d = smin(d,sdTaperedCapsule(q,joint,rake,0.052,0.038),0.015);
    d = smin(d,sdTaperedCapsule(q,rake,preHook,0.039,0.023),0.010);
    d = smin(d,sdTaperedCapsule(q,preHook,hookTip,0.024,0.003),0.006);

    // Short inward-hooked spines create a compact sifting-rake profile.
    for (int spineI=0; spineI<4; spineI++) {
      float f = float(spineI);
      float u = (f+0.65)/4.7;
      vec3 base = mix(joint,preHook,u);
      float len = mix(0.125,0.075,u);
      vec3 tip = base+vec3(
        -side*len,
        -0.025-0.018*u,
        0.040+0.015*sin(f+side)
      );
      d = min(d,sdTaperedCapsule(q,base,tip,0.017,0.0018));
    }
  }
  return d;
}

// ---------------------------------------------------------------
// ORAL CONE / CIRCULAR MOUTH
// ---------------------------------------------------------------
float camboOralConeSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  vec3 c = vec3(0.0,-0.395,-0.225);
  vec3 mp = q-c;
  mp.xy *= rot(0.035*sin(ph*2.0));

  float d = sdTorusZ(mp,vec2(0.128,0.030));
  d = smin(d,sdTorusZ(mp+vec3(0.0,0.0,0.018),
                      vec2(0.080,0.018)),0.010);

  // Radial plates face inward around the oral cone.
  for (int i=0; i<12; i++) {
    float a = TAU*(float(i)+0.5)/12.0;
    vec3 outer = c+vec3(cos(a),sin(a),0.0)*0.145;
    vec3 inner = c+vec3(cos(a),sin(a),0.0)*0.052;
    outer.z -= 0.006;
    inner.z += 0.014;
    d = smin(d,sdTaperedCapsule(q,outer,inner,0.018,0.006),0.005);
  }
  return d;
}

// ---------------------------------------------------------------
// SHELL RIDGES + CENTRAL REAR LOBE
// ---------------------------------------------------------------
float camboShellDetailSDF(vec3 q, float t) {
  float ph = camboPhase(t);
  float d = 20.0;
  vec3 shellC = vec3(0.0,-0.045,0.030);

  // Horseshoe rim uses a compressed torus embedded in the shell crown.
  vec3 rp = q-(shellC+vec3(0.0,-0.040,0.105));
  rp.y *= 1.16;
  float rim = sdTorusZ(rp,vec2(0.610,0.022));
  // Remove the rear-center portion of the rim to keep the open horseshoe.
  float rimCut = sdRoundBox(rp-vec3(0.0,0.510,0.0),
                            vec3(0.260,0.245,0.080),0.100);
  d = min(d,opSubtract(rim,rimCut));

  // Low transverse shell bands catch moving specular highlights.
  for (int i=0; i<6; i++) {
    float fi = float(i);
    float u = (fi+1.0)/7.5;
    float y = mix(-0.545,0.345,u);
    float w = 0.700*sqrt(max(0.0,1.0-pow((y+0.045)/0.735,2.0)));
    float asym = 0.008*sin(fi*2.3);
    vec3 a = vec3(-w+0.055,y+asym,0.128);
    vec3 b = vec3( w-0.055,y-asym,0.128);
    d = smin(d,sdTaperedCapsule(q,a,b,0.014,0.014),0.005);
  }

  // Small raised polygonal plates break the crown into armored facets.
  for (int i=0; i<4; i++) {
    float fi = float(i);
    float y = mix(-0.390,0.165,fi/3.0);
    for (int sideI=0; sideI<2; sideI++) {
      float side = sideI==0 ? -1.0 : 1.0;
      vec3 pc = vec3(side*(0.170+0.055*mod(fi,2.0)),y,0.139);
      vec3 pp = q-pc;
      pp.xy *= rot(side*(0.18+fi*0.07));
      d = smin(d,sdRoundBox(pp,vec3(0.082,0.050,0.010),0.018),0.004);
    }
  }

  // Repeated short spines serrate the outer margins of both rear wings.
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    for (int i=0; i<6; i++) {
      float u = (float(i)+0.55)/6.2;
      vec3 base = vec3(
        side*mix(0.515,0.795,u),
        mix(0.285,0.735,u),
        0.072-0.012*u
      );
      vec3 tip = base+vec3(
        side*(0.060+0.020*u),
        0.020+0.018*u,
        0.006
      );
      d = min(d,sdTaperedCapsule(q,base,tip,0.014,0.0015));
    }
  }

  // Bilobate center projection completes the three-part rear silhouette.
  vec3 lobeP = q-vec3(0.0,0.505,0.060);
  lobeP.xz *= rot(0.020*sin(ph));
  float lobeRoot = sdRoundBox(lobeP-vec3(0.0,-0.095,0.0),
                              vec3(0.155,0.190,0.062),0.082);
  float leftLobe = sdEllipsoid(lobeP-vec3(-0.092,0.205,0.0),
                               vec3(0.112,0.235,0.060));
  float rightLobe = sdEllipsoid(lobeP-vec3(0.095,0.198,0.004),
                                vec3(0.114,0.228,0.058));
  float lobe = smin(lobeRoot,smin(leftLobe,rightLobe,0.025),0.030);
  float cleft = sdRoundBox(lobeP-vec3(0.0,0.292,0.020),
                           vec3(0.025,0.135,0.080),0.018);
  lobe = opSubtract(lobe,cleft);
  d = smin(d,lobe,0.020);

  // Short midline keel prevents the central lobe reading as a crab tail.
  d = smin(d,sdTaperedCapsule(q,
                              vec3(0.0,-0.300,0.142),
                              vec3(0.0,0.690,0.105),
                              0.020,0.010),0.007);
  return d;
}

// ---------------------------------------------------------------
// SCENE MAP
// mat 1=carapace, 2=eyes/underside, 3=appendages/oral cone,
//     4=swimming flaps, 5=shell ridges and central rear lobe.
// ---------------------------------------------------------------
Hit mapScene(vec3 p, float t) {
  vec3 q = camboPose(p,t);
  Hit res = Hit(20.0,0.0);
  res = opSmoothUnion(res,Hit(camboCarapaceSDF(q,t),1.0),0.024);
  res = opSmoothUnion(res,Hit(camboEyesSDF(q,t),2.0),0.010);
  res = opSmoothUnion(res,Hit(camboUndersideSDF(q,t),2.0),0.020);
  res = opSmoothUnion(res,Hit(camboFrontalAppendagesSDF(q,t),3.0),0.010);
  res = opSmoothUnion(res,Hit(camboOralConeSDF(q,t),3.0),0.008);
  res = opSmoothUnion(res,Hit(camboFlapsSDF(q,t),4.0),0.010);
  res = opSmoothUnion(res,Hit(camboShellDetailSDF(q,t),5.0),0.006);
  res.d += (fbm(q*7.4+vec3(0.0,t*0.08,0.0))-0.50)*0.0035;
  return res;
}

// ---------------------------------------------------------------
// NORMAL, AMBIENT OCCLUSION, AND RAYMARCH
// ---------------------------------------------------------------
vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.0018,0.0);
  return normalize(vec3(
    mapScene(p+e.xyy,t).d-mapScene(p-e.xyy,t).d,
    mapScene(p+e.yxy,t).d-mapScene(p-e.yxy,t).d,
    mapScene(p+e.yyx,t).d-mapScene(p-e.yyx,t).d));
}

float calcAO(vec3 p, vec3 n, float t) {
  float occ = 0.0;
  float weight = 1.0;
  for (int i=1; i<=5; i++) {
    float h = 0.025*float(i);
    float sd = mapScene(p+n*h,t).d;
    occ += (h-sd)*weight;
    weight *= 0.62;
  }
  return clamp(1.0-occ*3.1,0.28,1.0);
}

float rayMarch(vec3 ro, vec3 rd, float t, out float glow, out float mat) {
  float d = 0.0;
  glow = 0.0;
  mat = 0.0;
  for (int i=0; i<MAX_STEPS; i++) {
    Hit h = mapScene(ro+rd*d,t);
    glow += 0.013/(0.014+h.d*h.d*38.0);
    if (h.d<SURF_DIST || d>MAX_DIST) {
      mat = h.m;
      break;
    }
    d += max(h.d*0.56,0.0032);
  }
  return d;
}

// ---------------------------------------------------------------
// PALETTE + MATERIAL
// ---------------------------------------------------------------
vec3 palette(float x) {
  vec3 a = mix(ACID,   CYAN, smoothstep(0.00, 0.38, x));
  vec3 b = mix(VIOLET, PINK, smoothstep(0.46, 1.00, x));
  return mix(a, b, smoothstep(0.24, 0.94, x));
}

vec3 materialColor(float mat, vec3 p, vec3 n, vec3 rd, float t) {
  float fres  = pow(1.0 - max(dot(n,-rd),0.0), 2.1);
  float bands = 0.5 + 0.5*sin(p.y*26.0 + p.x*7.0 - t*1.05);
  vec3 col    = CYAN;

  if (mat < 1.5) {
    // dorsal carapace: translucent CYAN/VIOLET shell plates
    float plates=0.5+0.5*cos((leanBodyU(leanPose(p,t).y)*16.0)*TAU);
    col=mix(CYAN,VIOLET,0.25+bands*0.24+fres*0.30);
    col+=CYAN*pow(plates,10.0)*0.22;
  } else if (mat < 2.5) {
    // eyes and compact underside: ACID/CYAN with a small PINK edge
    col=mix(ACID,CYAN,0.30+fres*0.30);
    col+=PINK*pow(fres,1.2)*0.30;
  } else if (mat < 3.5) {
    // frontal rakes and oral cone: PINK/VIOLET with joint pulses
    float joints=pow(0.5+0.5*cos((p.y+1.02)*17.0),12.0);
    col=mix(PINK,VIOLET,0.30+fres*0.34);
    col+=CYAN*pow(fres,0.72)*0.56;
    col+=ACID*joints*0.34;
  } else if (mat < 4.5) {
    // swimming flaps: ACID/CYAN with faint PINK tips
    col=mix(ACID,CYAN,0.35+bands*0.18);
    col+=PINK*fres*0.28;
  } else if (mat < 5.5) {
    // shell ridges: sharp CYAN/VIOLET carapace edge
    col=mix(CYAN,VIOLET,0.35+fres*0.38);
    col+=PINK*pow(fres,1.4)*0.20;
  } else {
    // posterior shell detail: VIOLET/PINK with CYAN rim
    col=mix(VIOLET,PINK,0.34+bands*0.15+fres*0.18);
    col+=CYAN*pow(fres,0.75)*0.48;
  }

  col += mix(CYAN, ACID, 0.45) * fres * 0.62;
  return col;
}

// ---------------------------------------------------------------
// SUBTLE ANATOMICAL SHELL GLOW
// ---------------------------------------------------------------
float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h);
}

vec2 projectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p-ro;
  float z = max(dot(rel,ww),0.05);
  return vec2(dot(rel,uu),dot(rel,vv))/z;
}

vec3 camboLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv,
                      vec3 ww, float t) {
  vec3 col = vec3(0.0);

  // Rounded anterior rim.
  for (int i=0; i<18; i++) {
    float a0 = mix(PI*0.10,PI*0.90,float(i)/18.0);
    float a1 = mix(PI*0.10,PI*0.90,float(i+1)/18.0);
    vec3 p0 = vec3(0.745*cos(a0),-0.045-0.650*sin(a0),0.145);
    vec3 p1 = vec3(0.745*cos(a1),-0.045-0.650*sin(a1),0.145);
    p0 = camboUnpose(p0,t);
    p1 = camboUnpose(p1,t);
    float d = distSeg(st,projectPoint(p0,ro,uu,vv,ww),
                         projectPoint(p1,ro,uu,vv,ww));
    col += mix(CYAN,VIOLET,0.38)*exp(-d*132.0)*0.020;
  }

  // Eye markers sit in the rear notches between wing and center lobe.
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    vec3 eye = camboUnpose(
      vec3(side*0.405,0.443,0.175),t);
    float ed = length(st-projectPoint(eye,ro,uu,vv,ww));
    float eyePulse = 0.034+0.006*sin(camboPhase(t)*2.0+side);
    col += ACID*exp(-ed*145.0)*eyePulse;
  }

  // Paired posterior wings and central rear lobe.
  vec3 wingRootL = camboUnpose(vec3(-0.430,0.190,0.115),t);
  vec3 wingTipL  = camboUnpose(vec3(-0.790,0.745,0.085),t);
  vec3 wingRootR = camboUnpose(vec3( 0.430,0.190,0.115),t);
  vec3 wingTipR  = camboUnpose(vec3( 0.805,0.720,0.090),t);
  float wl = distSeg(st,projectPoint(wingRootL,ro,uu,vv,ww),
                        projectPoint(wingTipL,ro,uu,vv,ww));
  float wr = distSeg(st,projectPoint(wingRootR,ro,uu,vv,ww),
                        projectPoint(wingTipR,ro,uu,vv,ww));
  col += mix(VIOLET,PINK,0.52)*(exp(-wl*128.0)+exp(-wr*128.0))*0.018;

  vec3 lobeA = camboUnpose(vec3(0.0,0.270,0.130),t);
  vec3 lobeB = camboUnpose(vec3(0.0,0.800,0.105),t);
  float ld = distSeg(st,projectPoint(lobeA,ro,uu,vv,ww),
                        projectPoint(lobeB,ro,uu,vv,ww));
  col += mix(ACID,CYAN,0.60)*exp(-ld*138.0)*0.018;

  return col;
}

// ---------------------------------------------------------------
// BACKGROUND - deep ocean (unchanged visual language)
// ---------------------------------------------------------------
vec3 background(vec2 st, float t) {
  vec3 col = mix(vec3(0.002,0.006,0.022), vec3(0.010,0.045,0.095),
                 smoothstep(-1.0, 1.0, st.y));
  float caustic = 0.0;
  vec2 q = st;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    q += 0.20 * vec2(cos(t*0.16+fi), sin(t*0.12+fi*1.7));
    caustic += sin(q.x*(3.0+fi)+t*0.33) * cos(q.y*(3.6+fi)-t*0.26);
  }
  col += mix(CYAN,VIOLET,0.38) * pow(0.5+0.5*caustic/5.0, 4.0) * 0.15;

  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec2 p = vec2(hash11(fi*13.7), hash11(fi*41.2)) * 2.0 - 1.0;
    p.y = fract(p.y*0.5+0.5 + t*(0.012+hash11(fi)*0.025))*2.2 - 1.1;
    p.x += sin(t*0.10+fi)*0.055;
    float d = length(st-p);
    col += palette(hash11(fi*4.9)) * exp(-d*90.0) * (0.014+0.032*hash11(fi*2.1));
  }
  return col;
}

// ---------------------------------------------------------------
// CAMERA + MAIN RENDER
// ---------------------------------------------------------------
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv*2.0-1.0;
  st.x *= uTDOutputInfo.res.z/uTDOutputInfo.res.w;

  float t = iTime;

  // Seamless 30-second orbit alternates between dorsal shell and
  // low underside views without ever abandoning the hero silhouette.
  const float CAMERA_DURATION = 30.0;
  float phase = fract(t/CAMERA_DURATION);
  float loopAngle = TAU*phase;
  float orbit = -0.70+loopAngle;
  float radial = 3.65+0.16*sin(loopAngle*3.0+0.6);
  float elevation = 0.85+1.25*sin(loopAngle*2.0+0.45);

  vec3 target = camboUnpose(vec3(0.0,-0.020,-0.010),t);
  target.x += 0.018*sin(loopAngle*2.0+1.1);
  target.z += 0.014*sin(loopAngle*3.0+0.7);

  vec3 ro = target+vec3(
    sin(orbit)*radial,
    cos(orbit)*radial,
    elevation
  );

  vec3 ww = normalize(target-ro);
  vec3 up = abs(ww.z)>0.96 ? vec3(0.0,1.0,0.0)
                           : vec3(0.0,0.0,1.0);
  vec3 uu = normalize(cross(up,ww));
  vec3 vv = normalize(cross(ww,uu));
  vec3 rd = normalize(uu*st.x+vv*st.y+ww*1.62);

  vec3 col = background(st,t);

  float glow, mat;
  float d = rayMarch(ro,rd,t,glow,mat);

  if (d<MAX_DIST) {
    vec3 p = ro+rd*d;
    vec3 n = getNormal(p,t);

    vec3 l1 = normalize(vec3(-0.45,0.82,-0.25));
    vec3 l2 = normalize(vec3(0.58,-0.12,0.72));
    vec3 fillDir = normalize(vec3(0.15,-0.35,-0.92));
    float diff = max(dot(n,l1),0.0);
    float back = pow(max(dot(l2,rd),0.0),2.0);
    float fill = max(dot(n,fillDir),0.0);
    float rim = pow(1.0-max(dot(n,-rd),0.0),2.5);
    float ao = calcAO(p,n,t);

    vec3 body = materialColor(mat,p,n,rd,t);
    vec3 lit = body*(0.26+diff*0.72)*ao;
    lit += body*fill*0.14*ao;
    lit += ACID*back*0.28;
    lit += mix(VIOLET,PINK,0.48)*rim*1.10;

    vec3 h = normalize(l1-rd);
    float spec = pow(max(dot(n,h),0.0),68.0);
    lit += mix(CYAN,ACID,0.42)*spec*1.75;

    float fog = 1.0-exp(-d*0.16);
    col = mix(lit,col,fog*0.42);
  }

  col += camboLineOverlay(st,ro,uu,vv,ww,t)*(1.04+0.07*sin(t));
  col += palette(0.42+0.22*sin(t*0.35))*glow*0.105;

  // Subtle halo ring + PINK bloom
  vec2 halo = st; halo.y += 0.04;
  float ring = exp(-abs(length(halo)-0.74)*26.0);
  col += mix(CYAN,VIOLET,0.50)*ring*0.042;
  col += PINK*pow(max(0.0,1.0-length(st*vec2(0.74,1.0))),4.4)*0.072;

  col *= 1.76+0.12*sin(t*1.0);
  col += pow(max(col,0.0),vec3(1.32))*0.33;

  float vignette = 1.0-0.20*smoothstep(0.35,1.60,length(st));
  col *= vignette;

  col = col/(0.82+col);
  col = pow(max(col,0.0),vec3(0.94));

  float grain = (hash11(uv.x*1234.5+uv.y*987.6+t)-0.5)*0.014;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col,1.0));
}
