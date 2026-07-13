// ===============================================================
// OPABINIA REGALIS - FIVE-EYED ABYSSAL RELIC
// TouchDesigner GLSL TOP fragment shader
// A procedural raymarched stem-arthropod with five stalked eyes,
// an articulated claw-tipped proboscis, fifteen flexible body segments,
// metachronal swimming lobes, dorsal gill blades, and a broad tail fan.
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

float opabPhase(float t) {
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

float sdTorusY(vec3 p, vec2 r) {
  vec2 q = vec2(length(p.xz)-r.x, p.y);
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
// LOOPING OPABINIA POSE
// Local anatomy: anterior -Y, posterior +Y, dorsal +Z.
// ---------------------------------------------------------------
vec3 opabPose(vec3 p, float t) {
  float ph = opabPhase(t);
  p -= vec3(0.035*sin(ph),0.040*sin(ph*2.0+0.7),0.045*sin(ph+1.4));
  p.xz *= rot(0.045*sin(ph*2.0+0.2));
  p.yz *= rot(-0.055+0.035*sin(ph));
  p.xy *= rot(0.045*sin(ph+0.9));
  return p;
}

vec3 opabUnpose(vec3 q, float t) {
  float ph = opabPhase(t);
  q.xy *= rot(-0.045*sin(ph+0.9));
  q.yz *= rot(0.055-0.035*sin(ph));
  q.xz *= rot(-0.045*sin(ph*2.0+0.2));
  q += vec3(0.035*sin(ph),0.040*sin(ph*2.0+0.7),0.045*sin(ph+1.4));
  return q;
}

float opabBodyU(float y) {
  return clamp((y+0.34)/1.62,0.0,1.0);
}

vec3 opabSegmentCenter(float u, float t) {
  float ph = opabPhase(t);
  float envelope = smoothstep(0.0,0.22,u);
  float wave = sin(ph*2.0-u*TAU*1.12);
  return vec3(0.085*envelope*wave,
              mix(-0.28,1.24,u),
              0.028*sin(ph+u*TAU)-0.018*u);
}

vec3 opabProboscisPoint(float u, float t) {
  float ph = opabPhase(t);
  float curl = sin(ph*2.0+u*PI*1.35);
  return vec3(0.055*sin(ph)+0.155*u*u*curl,
              mix(-0.48,-1.58,u)+0.035*sin(ph+u*TAU),
              mix(-0.055,-0.14,u)+0.105*u*sin(ph+u*PI));
}

// ---------------------------------------------------------------
// ROUNDED HEAD - NO DORSAL SHIELD OR CARAPACE
// ---------------------------------------------------------------
float opabHeadSDF(vec3 q, float t) {
  float ph = opabPhase(t);
  vec3 hp = q-vec3(0.0,-0.405,0.015);
  hp.xz *= rot(0.035*sin(ph*2.0));
  float d = sdEllipsoid(hp,vec3(0.355,0.265,0.205));
  d = smin(d,sdEllipsoid(hp-vec3(0.0,0.185,-0.010),
                          vec3(0.300,0.245,0.175)),0.075);
  return d;
}

// ---------------------------------------------------------------
// FIVE STALKED EYES
// ---------------------------------------------------------------
float opabEyesSDF(vec3 q, float t) {
  float ph = opabPhase(t);
  float d = 20.0;
  for (int i=0; i<5; i++) {
    float fi = float(i);
    float row = i<2 ? 0.0 : (i<4 ? 1.0 : 2.0);
    float side = (i==0 || i==2) ? -1.0 : ((i==1 || i==3) ? 1.0 : 0.0);
    float x = side*(row<0.5 ? 0.235 : 0.145);
    float y = row<0.5 ? -0.485 : (row<1.5 ? -0.345 : -0.405);
    float baseZ = row>1.5 ? 0.165 : 0.135;
    vec3 base = vec3(x,y,baseZ);
    float track = 0.018*sin(ph*3.0+fi*1.73);
    vec3 top = base+vec3(side*(0.025+track),-0.018+track,
                         row>1.5 ? 0.215 : 0.175);
    d = smin(d,sdTaperedCapsule(q,base,top,0.043,0.029),0.012);
    vec3 ep = q-top;
    ep.xy *= rot(side*0.18+track*2.0);
    d = smin(d,sdEllipsoid(ep,vec3(0.072,0.060,0.052)),0.009);
  }
  return d;
}

// ---------------------------------------------------------------
// ARTICULATED PROBOSCIS + OPPOSING TERMINAL CLAW
// ---------------------------------------------------------------
float opabProboscisSDF(vec3 q, float t) {
  float ph = opabPhase(t);
  float d = 20.0;
  for (int i=0; i<10; i++) {
    float u0 = float(i)/10.0;
    float u1 = float(i+1)/10.0;
    vec3 a = opabProboscisPoint(u0,t);
    vec3 b = opabProboscisPoint(u1,t);
    d = smin(d,sdTaperedCapsule(q,a,b,
                                mix(0.068,0.040,u0),
                                mix(0.062,0.036,u1)),0.012);
    if (i<9) {
      d = min(d,sdTorusY(q-b,vec2(mix(0.050,0.032,u1),0.007)));
    }
  }

  vec3 tip = opabProboscisPoint(1.0,t);
  float open = 0.105+0.025*sin(ph*2.0+0.4);
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    vec3 hinge = tip+vec3(side*0.018,-0.020,0.0);
    vec3 jaw = tip+vec3(side*open,-0.165,0.018);
    vec3 hook = tip+vec3(side*0.035,-0.235,0.040);
    d = smin(d,sdTaperedCapsule(q,hinge,jaw,0.032,0.022),0.008);
    d = smin(d,sdTaperedCapsule(q,jaw,hook,0.022,0.003),0.005);
    for (int j=0; j<5; j++) {
      float u = (float(j)+0.65)/5.6;
      vec3 base = mix(hinge,jaw,u);
      vec3 tooth = base+vec3(-side*mix(0.046,0.022,u),-0.018,0.012);
      d = min(d,sdTaperedCapsule(q,base,tooth,0.010,0.0015));
    }
  }
  return d;
}

// ---------------------------------------------------------------
// FIFTEEN-SEGMENT FLEXIBLE TRUNK
// ---------------------------------------------------------------
float opabBodySDF(vec3 q, float t) {
  float d = 20.0;
  for (int i=0; i<15; i++) {
    float u = float(i)/14.0;
    vec3 c = opabSegmentCenter(u,t);
    float w = mix(0.315,0.145,pow(u,1.25));
    float h = mix(0.145,0.080,u);
    d = smin(d,sdEllipsoid(q-c,vec3(w,0.090,h)),0.030);
  }
  return d;
}

// ---------------------------------------------------------------
// SEGMENTAL LATERAL SWIMMING LOBES
// ---------------------------------------------------------------
float opabLobesSDF(vec3 q, float t) {
  float ph = opabPhase(t);
  float d = 20.0;
  for (int i=0; i<15; i++) {
    float fi = float(i);
    float u = fi/14.0;
    vec3 c = opabSegmentCenter(u,t);
    float bodyW = mix(0.300,0.135,pow(u,1.2));
    float lobeW = mix(0.150,0.090,u);
    for (int sideI=0; sideI<2; sideI++) {
      float side = sideI==0 ? -1.0 : 1.0;
      float wave = sin(ph*2.0-fi*0.72+side*0.35);
      vec3 root = c+vec3(side*(bodyW-0.020),0.0,-0.015);
      vec3 tip = root+vec3(side*(0.300+0.035*wave),
                           0.055+0.035*wave,
                           -0.020+0.075*wave);
      d = smin(d,sdPaddle(q,root,tip,lobeW,0.026),0.014);
      d = smin(d,sdTaperedCapsule(q,root,tip,0.025,0.007),0.007);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// DORSAL GILL BLADES AND SEGMENT BANDS
// ---------------------------------------------------------------
float opabGillDetailSDF(vec3 q, float t) {
  float ph = opabPhase(t);
  float d = 20.0;
  for (int i=0; i<12; i++) {
    float fi = float(i);
    float u = (fi+1.0)/14.0;
    vec3 c = opabSegmentCenter(u,t);
    float bodyW = mix(0.295,0.155,u);
    vec3 bandA = c+vec3(-bodyW*0.78,0.0,0.105-0.030*u);
    vec3 bandB = c+vec3( bodyW*0.78,0.0,0.105-0.030*u);
    d = min(d,sdTaperedCapsule(q,bandA,bandB,0.012,0.012));
    for (int sideI=0; sideI<2; sideI++) {
      float side = sideI==0 ? -1.0 : 1.0;
      vec3 root = c+vec3(side*bodyW*0.48,0.012,0.105-0.025*u);
      vec3 tip = root+vec3(side*(0.115+0.025*(1.0-u)),
                           0.040,0.075+0.012*sin(ph-fi*0.5));
      d = min(d,sdTaperedCapsule(q,root,tip,0.016,0.002));
    }
  }
  return d;
}

// ---------------------------------------------------------------
// THREE-PAIR POSTERIOR TAIL FAN + TERMINAL SPINES
// ---------------------------------------------------------------
float opabTailSDF(vec3 q, float t) {
  float ph = opabPhase(t);
  float d = 20.0;
  vec3 rootC = opabSegmentCenter(1.0,t)+vec3(0.0,0.030,0.0);
  for (int pairI=0; pairI<3; pairI++) {
    float fp = float(pairI);
    for (int sideI=0; sideI<2; sideI++) {
      float side = sideI==0 ? -1.0 : 1.0;
      float steer = 0.055*sin(ph+fp*0.8);
      vec3 root = rootC+vec3(side*(0.055+fp*0.025),fp*0.035,fp*0.035);
      vec3 tip = rootC+vec3(side*(0.390-0.075*fp),
                            0.310+0.105*fp,
                            0.150+0.105*fp+steer);
      d = smin(d,sdPaddle(q,root,tip,0.145-0.018*fp,0.030),0.014);
      d = smin(d,sdTaperedCapsule(q,root,tip,0.026,0.005),0.006);
    }
  }
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    vec3 a = rootC+vec3(side*0.035,0.120,0.015);
    vec3 b = rootC+vec3(side*0.075,0.535,0.050);
    d = min(d,sdTaperedCapsule(q,a,b,0.014,0.0015));
  }
  return d;
}

// ---------------------------------------------------------------
// SCENE MAP
// mat 1=head/trunk, 2=eyes, 3=proboscis/claw,
//     4=swimming lobes, 5=gills/segment bands, 6=tail fan.
// ---------------------------------------------------------------
Hit mapScene(vec3 p, float t) {
  vec3 q = opabPose(p,t);
  Hit res = Hit(20.0,0.0);
  res = opSmoothUnion(res,Hit(opabHeadSDF(q,t),1.0),0.028);
  res = opSmoothUnion(res,Hit(opabBodySDF(q,t),1.0),0.025);
  res = opSmoothUnion(res,Hit(opabEyesSDF(q,t),2.0),0.010);
  res = opSmoothUnion(res,Hit(opabProboscisSDF(q,t),3.0),0.009);
  res = opSmoothUnion(res,Hit(opabLobesSDF(q,t),4.0),0.010);
  res = opSmoothUnion(res,Hit(opabGillDetailSDF(q,t),5.0),0.005);
  res = opSmoothUnion(res,Hit(opabTailSDF(q,t),6.0),0.009);
  float ph = opabPhase(t);
  vec3 loopNoise = vec3(0.12*sin(ph),0.12*cos(ph),0.0);
  res.d += (fbm(q*7.4+loopNoise)-0.50)*0.0035;
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
  float ph = opabPhase(t);
  float fres  = pow(1.0 - max(dot(n,-rd),0.0), 2.1);
  float bands = 0.5 + 0.5*sin(p.y*26.0 + p.x*7.0 - ph*2.0);
  vec3 col    = CYAN;

  if (mat < 1.5) {
    // rounded head and segmented trunk: translucent CYAN/VIOLET bands
    float plates=0.5+0.5*cos((opabBodyU(opabPose(p,t).y)*15.0)*TAU);
    col=mix(CYAN,VIOLET,0.25+bands*0.24+fres*0.30);
    col+=CYAN*pow(plates,10.0)*0.22;
  } else if (mat < 2.5) {
    // five stalked eyes: ACID/CYAN with a PINK edge
    col=mix(ACID,CYAN,0.30+fres*0.30);
    col+=PINK*pow(fres,1.2)*0.30;
  } else if (mat < 3.5) {
    // articulated proboscis and terminal claw: PINK/VIOLET joint pulses
    float joints=pow(0.5+0.5*cos((p.y+1.58)*22.0),12.0);
    col=mix(PINK,VIOLET,0.30+fres*0.34);
    col+=CYAN*pow(fres,0.72)*0.56;
    col+=ACID*joints*0.34;
  } else if (mat < 4.5) {
    // metachronal lateral lobes: ACID/CYAN with faint PINK tips
    col=mix(ACID,CYAN,0.35+bands*0.18);
    col+=PINK*fres*0.28;
  } else if (mat < 5.5) {
    // gill blades and segment bands: sharp CYAN/VIOLET scan lines
    col=mix(CYAN,VIOLET,0.35+fres*0.38);
    col+=PINK*pow(fres,1.4)*0.20;
  } else {
    // three-pair tail fan: VIOLET/PINK with CYAN rim
    col=mix(VIOLET,PINK,0.34+bands*0.15+fres*0.18);
    col+=CYAN*pow(fres,0.75)*0.48;
  }

  col += mix(CYAN, ACID, 0.45) * fres * 0.62;
  return col;
}

// ---------------------------------------------------------------
// SUBTLE OPABINIA ANATOMICAL GLOW
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

vec3 opabLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv,
                     vec3 ww, float t) {
  vec3 col = vec3(0.0);

  // Flexible dorsal body axis.
  for (int i=0; i<14; i++) {
    vec3 p0 = opabUnpose(opabSegmentCenter(float(i)/14.0,t)+
                         vec3(0.0,0.0,0.145),t);
    vec3 p1 = opabUnpose(opabSegmentCenter(float(i+1)/14.0,t)+
                         vec3(0.0,0.0,0.135),t);
    float d = distSeg(st,projectPoint(p0,ro,uu,vv,ww),
                         projectPoint(p1,ro,uu,vv,ww));
    col += mix(CYAN,VIOLET,0.38)*exp(-d*136.0)*0.017;
  }

  // Five eye markers make the head identity readable at Reel scale.
  for (int i=0; i<5; i++) {
    float row = i<2 ? 0.0 : (i<4 ? 1.0 : 2.0);
    float side = (i==0 || i==2) ? -1.0 : ((i==1 || i==3) ? 1.0 : 0.0);
    vec3 eyeLocal = vec3(side*(row<0.5 ? 0.260 : 0.165),
                         row<0.5 ? -0.500 : (row<1.5 ? -0.360 : -0.420),
                         row>1.5 ? 0.385 : 0.315);
    vec3 eye = opabUnpose(eyeLocal,t);
    float ed = length(st-projectPoint(eye,ro,uu,vv,ww));
    float eyePulse = 0.027+0.005*sin(opabPhase(t)*2.0+float(i));
    col += ACID*exp(-ed*145.0)*eyePulse;
  }

  // Articulated proboscis chain and terminal claw.
  for (int i=0; i<10; i++) {
    vec3 p0 = opabUnpose(opabProboscisPoint(float(i)/10.0,t),t);
    vec3 p1 = opabUnpose(opabProboscisPoint(float(i+1)/10.0,t),t);
    float pd = distSeg(st,projectPoint(p0,ro,uu,vv,ww),
                         projectPoint(p1,ro,uu,vv,ww));
    col += mix(PINK,VIOLET,0.42)*exp(-pd*132.0)*0.020;
  }

  vec3 claw = opabUnpose(opabProboscisPoint(1.0,t),t);
  float cd = length(st-projectPoint(claw,ro,uu,vv,ww));
  col += PINK*exp(-cd*150.0)*0.032;

  // Outer boundaries of the three-pair tail fan.
  vec3 tailRoot = opabUnpose(opabSegmentCenter(1.0,t),t);
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    vec3 tailTip = opabUnpose(opabSegmentCenter(1.0,t)+
                              vec3(side*0.390,0.520,0.340),t);
    float td = distSeg(st,projectPoint(tailRoot,ro,uu,vv,ww),
                          projectPoint(tailTip,ro,uu,vv,ww));
    col += mix(ACID,CYAN,0.58)*exp(-td*132.0)*0.018;
  }

  return col;
}

// ---------------------------------------------------------------
// BACKGROUND - deep ocean (unchanged visual language)
// ---------------------------------------------------------------
vec3 background(vec2 st, float t) {
  float ph = opabPhase(t);
  vec3 col = mix(vec3(0.002,0.006,0.022), vec3(0.010,0.045,0.095),
                 smoothstep(-1.0, 1.0, st.y));
  float caustic = 0.0;
  vec2 q = st;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    q += 0.20 * vec2(cos(ph+fi), sin(ph*2.0+fi*1.7));
    caustic += sin(q.x*(3.0+fi)+ph) * cos(q.y*(3.6+fi)-ph*2.0);
  }
  col += mix(CYAN,VIOLET,0.38) * pow(0.5+0.5*caustic/5.0, 4.0) * 0.15;

  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec2 p = vec2(hash11(fi*13.7), hash11(fi*41.2)) * 2.0 - 1.0;
    float loops = 1.0+mod(fi,3.0);
    p.y = fract(p.y*0.5+0.5 + (ph/TAU)*loops)*2.2 - 1.1;
    p.x += sin(ph+fi)*0.055;
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

  // Seamless 30-second choreography reveals the five-eyed head,
  // lateral segmented silhouette, proboscis, and posterior tail fan.
  const float CAMERA_DURATION = 30.0;
  float phase = fract(t/CAMERA_DURATION);
  float loopAngle = TAU*phase;
  float orbit = -1.05+loopAngle;
  float radial = 4.00+0.18*sin(loopAngle*3.0+0.6);
  float elevation = 0.62+0.72*sin(loopAngle*2.0+0.45);

  vec3 target = opabUnpose(vec3(0.0,-0.010,0.015),t);
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

  col += opabLineOverlay(st,ro,uu,vv,ww,t)*(1.04+0.07*sin(loopAngle*2.0));
  col += palette(0.42+0.22*sin(loopAngle))*glow*0.105;

  // Subtle halo ring + PINK bloom
  vec2 halo = st; halo.y += 0.04;
  float ring = exp(-abs(length(halo)-0.74)*26.0);
  col += mix(CYAN,VIOLET,0.50)*ring*0.042;
  col += PINK*pow(max(0.0,1.0-length(st*vec2(0.74,1.0))),4.4)*0.072;

  col *= 1.76+0.12*sin(loopAngle*2.0);
  col += pow(max(col,0.0),vec3(1.32))*0.33;

  float vignette = 1.0-0.20*smoothstep(0.35,1.60,length(st));
  col *= vignette;

  col = col/(0.82+col);
  col = pow(max(col,0.0),vec3(0.94));

  float grainPhase = sin(loopAngle)*17.0+cos(loopAngle)*31.0;
  float grain = (hash11(uv.x*1234.5+uv.y*987.6+grainPhase)-0.5)*0.014;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col,1.0));
}
