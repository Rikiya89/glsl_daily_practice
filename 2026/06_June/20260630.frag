// ===============================================================
// LEANCHOILIA SUPERLATA - NEON GREAT-APPENDAGE HUNTER
// TouchDesigner GLSL TOP fragment shader
// Flattened segmented arthropod + cephalic shield + paired great
// appendages + lateral limbs + serrated margins + triangular telson.
// Original neon palette preserved.
// ===============================================================

out vec4 fragColor;
uniform float iTime;

#define MAX_STEPS 152
#define MAX_DIST  15.0
#define SURF_DIST 0.0010
#define PI        3.14159265359
#define TAU       6.28318530718

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

// ---------------------------------------------------------------
// SDF PRIMITIVES
// ---------------------------------------------------------------
float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}

float sdTaperedCapsule(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - mix(ra, rb, h);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// Triangular plate whose broad root is at local y=0 and tip at y=len.
float sdTriPlate(vec3 p, float halfW, float len, float thick) {
  float slope = halfW / len;
  float side = (abs(p.x) + slope*p.y - halfW) / sqrt(1.0+slope*slope);
  float tri = max(side, max(-p.y, p.y-len));
  vec2 w = vec2(tri, abs(p.z)-thick);
  return min(max(w.x,w.y),0.0) + length(max(w,0.0));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

// ---------------------------------------------------------------
// HIT STRUCT
// ---------------------------------------------------------------
struct Hit { float d; float m; };

Hit opUnion(Hit a, Hit b) { return a.d < b.d ? a : b; }

Hit opSmoothUnion(Hit a, Hit b, float k) {
  float d = smin(a.d, b.d, k);
  float h = smoothstep(-k, k, b.d - a.d);
  return Hit(d, mix(b.m, a.m, h));
}

// ---------------------------------------------------------------
// POSE / UNPOSE
// Local anatomy: body along +Y, head at -Y, dorsal surface at +Z.
// ---------------------------------------------------------------
vec3 leanPose(vec3 p, float t) {
  p.y -= 0.050*sin(t*0.19);
  p.x -= 0.030*sin(t*0.13+0.8);
  p.z -= 0.022*sin(t*0.17+1.7);
  p.xz *= rot(0.025*sin(t*0.27));
  p.yz *= rot(0.035+0.018*sin(t*0.16));
  return p;
}

vec3 leanUnpose(vec3 q, float t) {
  q.yz *= rot(-(0.035+0.018*sin(t*0.16)));
  q.xz *= rot(-0.025*sin(t*0.27));
  q.z += 0.022*sin(t*0.17+1.7);
  q.x += 0.030*sin(t*0.13+0.8);
  q.y += 0.050*sin(t*0.19);
  return q;
}

float leanBodyU(float y) {
  return clamp((y+0.90)/1.88, 0.0, 1.0);
}

float leanBodyRadius(float y) {
  float u = leanBodyU(y);
  float ends = smoothstep(0.0,0.10,u)*(1.0-smoothstep(0.90,1.0,u));
  float posterior = mix(0.205,0.305,smoothstep(0.05,0.68,u));
  return posterior*(0.68+0.32*ends);
}

float leanBodyHeight(float y) {
  float u = leanBodyU(y);
  return mix(0.090,0.125,sin(u*PI))*mix(0.82,1.0,smoothstep(0.0,0.35,u));
}

vec3 leanSegC(float y, float t) {
  float u = leanBodyU(y);
  float sway = 0.050*sin(y*2.15-t*0.32)+0.012*sin(y*5.0+t*0.18);
  return vec3(sway*(0.45+0.55*u), y,
              0.016*cos(y*2.4-t*0.20));
}

// ---------------------------------------------------------------
// 1. FLATTENED SEGMENTED TRUNK + DORSAL DOUBLE CARINA
// ---------------------------------------------------------------
float leanBodySDF(vec3 q, float t) {
  float d = 20.0;
  for (int i=0; i<17; i++) {
    float fi = float(i);
    float u = fi/16.0;
    float y = mix(-0.90,0.98,u);
    vec3 c = leanSegC(y,t);
    float pulse = 1.0+0.025*sin(t*0.70+fi*0.72);
    float w = leanBodyRadius(y)*pulse;
    float h = leanBodyHeight(y);
    float plate = sdEllipsoid(q-c,vec3(w,0.085,h));
    d = smin(d,plate,0.034);
  }

  // Low internal keel keeps the overlapping plates a continuous fossil.
  d = smin(d,sdTaperedCapsule(q,leanSegC(-0.86,t),leanSegC(0.95,t),
                              0.100,0.135),0.045);

  // Paired, low dorsal carinae keep the trunk profile broad and shield-like.
  for (int sideI=0; sideI<2; sideI++) {
    float side = sideI==0 ? -1.0 : 1.0;
    for (int i=0; i<12; i++) {
      float u0=float(i)/12.0, u1=float(i+1)/12.0;
      float y0=mix(-0.78,0.90,u0), y1=mix(-0.78,0.90,u1);
      vec3 a=leanSegC(y0,t)+vec3(side*0.043,0.0,leanBodyHeight(y0)*0.86);
      vec3 b=leanSegC(y1,t)+vec3(side*0.043,0.0,leanBodyHeight(y1)*0.86);
      d=smin(d,sdTaperedCapsule(q,a,b,0.014,0.013),0.007);
    }
  }

  // Narrow segment grooves preserve the plate rhythm.
  for (int i=0; i<16; i++) {
    float y=mix(-0.84,0.92,(float(i)+0.5)/16.0);
    vec3 c=leanSegC(y,t);
    vec3 g=q-c;
    float groove=sdEllipsoid(g,vec3(leanBodyRadius(y)*1.03,0.010,
                                    leanBodyHeight(y)*0.84));
    d=max(d,-groove*0.42);
  }
  return d;
}

// ---------------------------------------------------------------
// 2. BROAD CEPHALIC SHIELD, POINTED SNOUT, AND TWO EYE PAIRS
// ---------------------------------------------------------------
float leanHeadShieldSDF(vec3 q, float t) {
  vec3 hc=leanSegC(-0.96,t)+vec3(0.0,-0.135,0.012);
  vec3 hp=q-hc;
  hp.yz*=rot(-0.08);
  float d=sdEllipsoid(hp,vec3(0.355,0.245,0.125));

  vec3 beak0=hc+vec3(0.0,-0.155,0.010);
  vec3 beak1=hc+vec3(0.0,-0.390,0.080+0.012*sin(t*0.22));
  d=smin(d,sdTaperedCapsule(q,beak0,beak1,0.105,0.015),0.040);

  // Two pairs of tiny eyes tucked beneath the shield sides.
  for (int pairI=0; pairI<2; pairI++) {
    float py=float(pairI);
    for (int sideI=0; sideI<2; sideI++) {
      float side=sideI==0 ? -1.0 : 1.0;
      vec3 eye=hc+vec3(side*(0.125+py*0.085),-0.135+py*0.050,-0.090);
      d=smin(d,sdSphere(q-eye,0.025-py*0.004),0.006);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 3. PAIRED GREAT APPENDAGES AND FOUR LONG FLAGELLA
// ---------------------------------------------------------------
float leanGreatAppendagesSDF(vec3 q, float t) {
  float d=20.0;
  for (int sideI=0; sideI<2; sideI++) {
    float side=sideI==0 ? -1.0 : 1.0;
    float curl=0.5+0.5*sin(t*0.38+side*0.55);
    vec3 root=leanSegC(-1.00,t)+vec3(side*0.205,-0.105,0.015);
    vec3 elbow=root+vec3(side*(0.245+0.025*curl),-0.215,0.145);
    vec3 claw=elbow+vec3(side*(0.105-0.030*curl),-0.310,0.155+0.035*curl);
    vec3 base=claw+vec3(-side*0.055,-0.245,0.045);

    d=smin(d,sdTaperedCapsule(q,root,elbow,0.055,0.043),0.018);
    d=smin(d,sdTaperedCapsule(q,elbow,claw,0.044,0.029),0.014);
    d=smin(d,sdTaperedCapsule(q,claw,base,0.030,0.016),0.010);
    d=smin(d,sdSphere(q-root,0.062),0.016);
    d=smin(d,sdSphere(q-elbow,0.050),0.012);

    for (int filamentI=0; filamentI<2; filamentI++) {
      float ff=float(filamentI);
      vec3 prev=base+vec3(side*(ff*0.032-0.016),0.0,ff*0.018);
      for (int j=0; j<6; j++) {
        float fj=float(j);
        float u=(fj+1.0)/6.0;
        float wave=sin(t*0.72+u*4.5+side*0.8+ff*1.5);
        vec3 next=base+vec3(
          side*(0.070*u+0.035*wave*u+ff*0.035-0.017),
          -0.720*u+0.055*sin(u*PI)*curl,
          0.185*u+0.055*wave*u+ff*0.045);
        d=smin(d,sdTaperedCapsule(q,prev,next,
                                  mix(0.013,0.0035,u),mix(0.011,0.0020,u)),0.004);
        prev=next;
      }
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 4. DENSE PAIRED LATERAL ARTHROPOD LIMBS
// ---------------------------------------------------------------
float leanLateralLimbsSDF(vec3 q, float t) {
  float d=20.0;
  for (int i=0; i<10; i++) {
    float fi=float(i), u=fi/9.0;
    float y=mix(-0.68,0.82,u);
    vec3 c=leanSegC(y,t);
    float w=leanBodyRadius(y);
    for (int sideI=0; sideI<2; sideI++) {
      float side=sideI==0 ? -1.0 : 1.0;
      float phase=t*0.82-fi*0.78+side*0.65;
      float paddle=sin(phase);
      vec3 root=c+vec3(side*w*0.78,0.0,-leanBodyHeight(y)*0.42);
      vec3 knee=root+vec3(side*(0.115+0.018*paddle),0.025*sin(phase+0.5),-0.090);
      vec3 ankle=knee+vec3(side*(0.100-0.012*paddle),0.045*sin(phase+1.3),-0.075);
      vec3 tip=ankle+vec3(side*0.065,0.035*sin(phase+2.0),0.012);
      d=smin(d,sdTaperedCapsule(q,root,knee,0.026,0.020),0.008);
      d=smin(d,sdTaperedCapsule(q,knee,ankle,0.020,0.013),0.006);
      d=smin(d,sdTaperedCapsule(q,ankle,tip,0.013,0.003),0.004);
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 5. SERRATED SHIELD AND TRUNK MARGINS
// ---------------------------------------------------------------
float leanSerrationsSDF(vec3 q, float t) {
  float d=20.0;
  for (int i=0; i<13; i++) {
    float fi=float(i), u=fi/12.0;
    float y=mix(-0.92,0.90,u);
    vec3 c=leanSegC(y,t);
    float w=leanBodyRadius(y);
    for (int sideI=0; sideI<2; sideI++) {
      float side=sideI==0 ? -1.0 : 1.0;
      vec3 root=c+vec3(side*w*0.86,0.0,0.018);
      vec3 tip=root+vec3(side*(0.060+0.018*sin(fi*1.7)),0.016,0.006);
      d=min(d,sdTaperedCapsule(q,root,tip,0.016,0.0015));
    }
  }

  vec3 hc=leanSegC(-0.96,t)+vec3(0.0,-0.135,0.012);
  for (int i=0; i<4; i++) {
    float fi=float(i);
    for (int sideI=0; sideI<2; sideI++) {
      float side=sideI==0 ? -1.0 : 1.0;
      vec3 root=hc+vec3(side*(0.285+0.015*fi),-0.125+fi*0.070,0.005);
      vec3 tip=root+vec3(side*(0.070-0.008*fi),-0.018,0.008);
      d=min(d,sdTaperedCapsule(q,root,tip,0.015,0.0015));
    }
  }
  return d;
}

// ---------------------------------------------------------------
// 6. TRIANGULAR TELSON WITH RIGID LATERAL SPINES
// ---------------------------------------------------------------
float leanTelsonSDF(vec3 q, float t) {
  vec3 root=leanSegC(0.96,t)+vec3(0.0,0.035,0.0);
  vec3 tp=q-root;
  tp.x += 0.012*sin(t*0.21);
  float d=sdTriPlate(tp,0.230,0.410,0.055);
  for (int sideI=0; sideI<2; sideI++) {
    float side=sideI==0 ? -1.0 : 1.0;
    float vib=0.004*sin(t*1.4+side);
    vec3 base=root+vec3(side*0.150,0.105,0.0);
    vec3 tip=base+vec3(side*(0.250+vib),0.105,0.015);
    d=smin(d,sdTaperedCapsule(q,base,tip,0.024,0.002),0.008);
  }
  return d;
}

// ---------------------------------------------------------------
// SCENE ASSEMBLY
// mat 1=trunk 2=head 3=great appendages 4=limbs 5=serrations 6=telson
// ---------------------------------------------------------------
Hit mapScene(vec3 p, float t) {
  vec3 q=leanPose(p,t);
  Hit res=Hit(20.0,0.0);
  res=opSmoothUnion(res,Hit(leanBodySDF(q,t),1.0),0.030);
  res=opSmoothUnion(res,Hit(leanHeadShieldSDF(q,t),2.0),0.024);
  res=opSmoothUnion(res,Hit(leanGreatAppendagesSDF(q,t),3.0),0.013);
  res=opSmoothUnion(res,Hit(leanLateralLimbsSDF(q,t),4.0),0.009);
  res=opSmoothUnion(res,Hit(leanSerrationsSDF(q,t),5.0),0.006);
  res=opSmoothUnion(res,Hit(leanTelsonSDF(q,t),6.0),0.014);
  res.d+=(fbm(q*7.4+vec3(0.0,t*0.08,0.0))-0.50)*0.0035;
  return res;
}

// ---------------------------------------------------------------
// RAY MARCHER
// ---------------------------------------------------------------
float rayMarch(vec3 ro, vec3 rd, float t, out float glow, out float mat) {
  float d = 0.0;
  glow = 0.0; mat = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    Hit h = mapScene(ro + rd*d, t);
    glow += 0.013 / (0.014 + h.d*h.d*38.0);
    if (h.d < SURF_DIST || d > MAX_DIST) { mat = h.m; break; }
    d += max(h.d * 0.56, 0.0032);
  }
  return d;
}

vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.0018, 0.0);
  return normalize(vec3(
    mapScene(p+e.xyy,t).d - mapScene(p-e.xyy,t).d,
    mapScene(p+e.yxy,t).d - mapScene(p-e.yxy,t).d,
    mapScene(p+e.yyx,t).d - mapScene(p-e.yyx,t).d));
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
    // segmented trunk: translucent CYAN/VIOLET fossil plates
    float plates=0.5+0.5*cos((leanBodyU(leanPose(p,t).y)*16.0)*TAU);
    col=mix(CYAN,VIOLET,0.25+bands*0.24+fres*0.30);
    col+=CYAN*pow(plates,10.0)*0.22;
  } else if (mat < 2.5) {
    // head shield and eyes: ACID/CYAN with a small PINK edge
    col=mix(ACID,CYAN,0.30+fres*0.30);
    col+=PINK*pow(fres,1.2)*0.30;
  } else if (mat < 3.5) {
    // great appendages: PINK/VIOLET, CYAN rim, ACID joint pulses
    float joints=pow(0.5+0.5*cos((p.y+1.02)*17.0),12.0);
    col=mix(PINK,VIOLET,0.30+fres*0.34);
    col+=CYAN*pow(fres,0.72)*0.56;
    col+=ACID*joints*0.34;
  } else if (mat < 4.5) {
    // small lateral limbs: ACID/CYAN with faint PINK tips
    col=mix(ACID,CYAN,0.35+bands*0.18);
    col+=PINK*fres*0.28;
  } else if (mat < 5.5) {
    // serrated margins: sharp CYAN/VIOLET fossil edge
    col=mix(CYAN,VIOLET,0.35+fres*0.38);
    col+=PINK*pow(fres,1.4)*0.20;
  } else {
    // triangular telson: VIOLET/PINK with CYAN rim
    col=mix(VIOLET,PINK,0.34+bands*0.15+fres*0.18);
    col+=CYAN*pow(fres,0.75)*0.48;
  }

  col += mix(CYAN, ACID, 0.45) * fres * 0.62;
  return col;
}

// ---------------------------------------------------------------
// LINE OVERLAY - Leanchoilia neon anatomical diagram
// ---------------------------------------------------------------
float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h);
}

vec2 projectPoint(vec3 p, vec3 ro, vec3 uu, vec3 vv, vec3 ww) {
  vec3 rel = p - ro;
  float z  = max(dot(rel,ww), 0.05);
  return vec2(dot(rel,uu), dot(rel,vv)) / z;
}

vec3 leanLineOverlay(vec2 st, vec3 ro, vec3 uu, vec3 vv, vec3 ww, float t) {
  vec3 col=vec3(0.0);

  // Central body axis.
  for (int i=0; i<16; i++) {
    float u0=float(i)/16.0, u1=float(i+1)/16.0;
    vec3 a=leanUnpose(leanSegC(mix(-0.88,0.98,u0),t),t);
    vec3 b=leanUnpose(leanSegC(mix(-0.88,0.98,u1),t),t);
    float d=distSeg(st,projectPoint(a,ro,uu,vv,ww),projectPoint(b,ro,uu,vv,ww));
    col+=CYAN*(exp(-d*150.0)*0.026+(1.0-smoothstep(0.0,0.0009,d))*0.040);
  }

  // Segment divisions across the shield-like trunk.
  for (int i=0; i<16; i++) {
    float u=(float(i)+0.5)/16.0;
    float y=mix(-0.84,0.92,u);
    vec3 c=leanSegC(y,t);
    float w=leanBodyRadius(y);
    vec3 a=leanUnpose(c+vec3(-w*0.78,0.0,0.010),t);
    vec3 b=leanUnpose(c+vec3( w*0.78,0.0,0.010),t);
    float d=distSeg(st,projectPoint(a,ro,uu,vv,ww),projectPoint(b,ro,uu,vv,ww));
    col+=mix(CYAN,VIOLET,u*0.72)*exp(-d*120.0)*0.019;
  }

  // Paired dorsal carina guide lines.
  for (int sideI=0; sideI<2; sideI++) {
    float side=sideI==0 ? -1.0 : 1.0;
    for (int i=0; i<12; i++) {
      float u0=float(i)/12.0, u1=float(i+1)/12.0;
      float y0=mix(-0.78,0.90,u0), y1=mix(-0.78,0.90,u1);
      vec3 a=leanUnpose(leanSegC(y0,t)+vec3(side*0.043,0.0,leanBodyHeight(y0)),t);
      vec3 b=leanUnpose(leanSegC(y1,t)+vec3(side*0.043,0.0,leanBodyHeight(y1)),t);
      float d=distSeg(st,projectPoint(a,ro,uu,vv,ww),projectPoint(b,ro,uu,vv,ww));
      col+=mix(ACID,CYAN,0.60)*exp(-d*145.0)*0.021;
    }
  }

  // Cephalic shield outline and pointed snout.
  vec3 hc=leanSegC(-0.96,t)+vec3(0.0,-0.135,0.012);
  vec3 prev=hc+vec3(0.0,-0.390,0.080);
  for (int i=0; i<16; i++) {
    float a0=-PI*0.50+TAU*float(i)/16.0;
    float a1=-PI*0.50+TAU*float(i+1)/16.0;
    vec3 p0=hc+vec3(0.355*sin(a0),0.235*cos(a0),0.055);
    vec3 p1=hc+vec3(0.355*sin(a1),0.235*cos(a1),0.055);
    if (i==0) p0=prev;
    if (i==15) p1=prev;
    float d=distSeg(st,projectPoint(leanUnpose(p0,t),ro,uu,vv,ww),
                    projectPoint(leanUnpose(p1,t),ro,uu,vv,ww));
    col+=mix(ACID,CYAN,0.38)*exp(-d*128.0)*0.028;
  }

  // Great appendage joints, guide lines, and two flagella per side.
  for (int sideI=0; sideI<2; sideI++) {
    float side=sideI==0 ? -1.0 : 1.0;
    float curl=0.5+0.5*sin(t*0.38+side*0.55);
    vec3 root=leanSegC(-1.00,t)+vec3(side*0.205,-0.105,0.015);
    vec3 elbow=root+vec3(side*(0.245+0.025*curl),-0.215,0.145);
    vec3 claw=elbow+vec3(side*(0.105-0.030*curl),-0.310,0.155+0.035*curl);
    vec3 base=claw+vec3(-side*0.055,-0.245,0.045);
    vec3 joints[4]=vec3[4](root,elbow,claw,base);
    for (int j=0; j<3; j++) {
      vec3 a=leanUnpose(joints[j],t), b=leanUnpose(joints[j+1],t);
      float d=distSeg(st,projectPoint(a,ro,uu,vv,ww),projectPoint(b,ro,uu,vv,ww));
      float gd=length(st-projectPoint(a,ro,uu,vv,ww));
      col+=mix(PINK,VIOLET,0.38)*exp(-d*115.0)*0.034;
      col+=ACID*exp(-gd*125.0)*0.062;
    }
    for (int filamentI=0; filamentI<2; filamentI++) {
      float ff=float(filamentI);
      vec3 fp=base+vec3(side*(ff*0.032-0.016),0.0,ff*0.018);
      for (int j=0; j<6; j++) {
        float u=float(j+1)/6.0;
        float wave=sin(t*0.72+u*4.5+side*0.8+ff*1.5);
        vec3 fn=base+vec3(side*(0.070*u+0.035*wave*u+ff*0.035-0.017),
                          -0.720*u+0.055*sin(u*PI)*curl,
                          0.185*u+0.055*wave*u+ff*0.045);
        float d=distSeg(st,projectPoint(leanUnpose(fp,t),ro,uu,vv,ww),
                        projectPoint(leanUnpose(fn,t),ro,uu,vv,ww));
        col+=mix(CYAN,PINK,0.42)*exp(-d*150.0)*0.028;
        fp=fn;
      }
    }
  }

  // Lateral limb axes and serrated margin points.
  for (int i=0; i<10; i++) {
    float fi=float(i), u=fi/9.0;
    float y=mix(-0.68,0.82,u);
    vec3 c=leanSegC(y,t);
    float w=leanBodyRadius(y);
    for (int sideI=0; sideI<2; sideI++) {
      float side=sideI==0 ? -1.0 : 1.0;
      float phase=t*0.82-fi*0.78+side*0.65;
      vec3 root=c+vec3(side*w*0.78,0.0,-leanBodyHeight(y)*0.42);
      vec3 tip=root+vec3(side*(0.280+0.010*sin(phase)),0.085*sin(phase+1.0),-0.150);
      float d=distSeg(st,projectPoint(leanUnpose(root,t),ro,uu,vv,ww),
                      projectPoint(leanUnpose(tip,t),ro,uu,vv,ww));
      col+=mix(ACID,CYAN,0.48)*exp(-d*102.0)*0.020;
      vec2 mp=projectPoint(leanUnpose(c+vec3(side*w*0.95,0.0,0.018),t),ro,uu,vv,ww);
      col+=mix(CYAN,VIOLET,0.45)*exp(-length(st-mp)*145.0)*0.052;
    }
  }

  // Triangular telson outline.
  vec3 tr=leanSegC(0.96,t)+vec3(0.0,0.035,0.0);
  vec3 tv[3]=vec3[3](tr+vec3(-0.230,0.0,0.055),
                     tr+vec3( 0.230,0.0,0.055),
                     tr+vec3( 0.000,0.410,0.055));
  for (int i=0; i<3; i++) {
    vec3 a=leanUnpose(tv[i],t), b=leanUnpose(tv[(i+1)%3],t);
    float d=distSeg(st,projectPoint(a,ro,uu,vv,ww),projectPoint(b,ro,uu,vv,ww));
    col+=mix(VIOLET,PINK,0.52)*exp(-d*120.0)*0.032;
  }

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
// CAMERA HELPERS
// ---------------------------------------------------------------

// Quintic ease-in-out: zero first and second derivative at endpoints
float easeQ(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// Map global phase into a local 0 to 1 for one stage [s, e]
float segP(float phase, float s, float e) {
  return easeQ(clamp((phase - s) / (e - s), 0.0, 1.0));
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------
void main() {
  vec2 uv = vUV.st;
  vec2 st = uv * 2.0 - 1.0;
  st.x *= uTDOutputInfo.res.z / uTDOutputInfo.res.w;

  float t = iTime;

  // ---- 30-second seamless camera loop ----
  const float CAMERA_DURATION = 30.0;
  float cp = fract(t / CAMERA_DURATION);        // 0 to 1 camera phase
  float la = TAU * cp;                           // loop angle (one full cycle = 30 s)

  // Anatomical targets follow the floating Leanchoilia pose.
  vec3 headTarget = leanUnpose(leanSegC(-0.96,t)+vec3(0.0,-0.390,0.100),t);
  vec3 midTarget  = leanUnpose(leanSegC( 0.05,t)+vec3(0.0, 0.000,0.100),t);
  vec3 limbTarget = leanUnpose(leanSegC( 0.05,t)+vec3(0.0, 0.000,-0.165),t);
  vec3 tailTarget = leanUnpose(leanSegC( 0.96,t)+vec3(0.0, 0.245,0.090),t);

  // Per-stage transition weights
  // Stage 1: 0.00-0.20   anterior shield, eyes, snout, great appendages
  // Stage 2: 0.20-0.45   full lateral segmented silhouette
  // Stage 3: 0.45-0.65   low view revealing lateral limbs
  // Stage 4: 0.65-0.85   posterior track to triangular telson
  // Stage 5: 0.85-1.00   return to anterior hero
  float t23 = segP(cp, 0.20, 0.45);
  float t34 = segP(cp, 0.45, 0.65);
  float t45 = segP(cp, 0.65, 0.85);
  float t51 = segP(cp, 0.85, 1.00);

  // ---- Stage parameter keyframes ----
  // [orbit, elevation, camDist, lens]
  // Camera frame is rotated 90 degrees (uu/vv swapped below) so the creature's
  // Y-spine reads LEFT-RIGHT across the landscape-like screen.
  // All orbit/elevation values are designed for this rotated frame.
  //
  // S1: anterior portrait holding the shield and great appendage roots
  //   orbit -PI  places camera exactly anterior (facing the head straight-on)
  //   slight left offset (-0.25) for three-quarter face angle
  //   elevation 0.14  slightly above the soft head
  //   dist 2.50  close portrait distance
  //   lens 1.60  telephoto keeps face undistorted
  float s1Orbit = -PI - 0.20,  s1Elev = 0.14,  s1Dist = 2.50,  s1Lens = 1.58;
  // S2: lateral view of the broad, flattened segmented trunk
  float s2Orbit = -1.57,  s2Elev = 0.08,  s2Dist = 4.55,  s2Lens = 1.46;
  // S3: low lateral angle to reveal the dense underslung limbs
  float s3Orbit = -1.57,  s3Elev = -0.48, s3Dist = 4.45,  s3Lens = 1.44;
  // S4: posterior track centered on telson and lateral telson spines
  float s4Orbit = -0.58,  s4Elev = 0.22,  s4Dist = 4.40,  s4Lens = 1.42;
  // S5 loops back to S1
  float s5Orbit = s1Orbit, s5Elev = s1Elev, s5Dist = s1Dist, s5Lens = s1Lens;

  // Blend orbit, elevation, distance, lens through the five stages
  // Each blends from its stage into the next using the transition weight
  float orbit, elevation, camDist, lens;

  if (cp < 0.20) {
    // Stage 1 (static, no incoming blend yet - loop start)
    orbit     = s1Orbit;
    elevation = s1Elev;
    camDist   = s1Dist;
    lens      = s1Lens;
  } else if (cp < 0.45) {
    orbit     = mix(s1Orbit, s2Orbit, t23);
    elevation = mix(s1Elev,  s2Elev,  t23);
    camDist   = mix(s1Dist,  s2Dist,  t23);
    lens      = mix(s1Lens,  s2Lens,  t23);
  } else if (cp < 0.65) {
    orbit     = mix(s2Orbit, s3Orbit, t34);
    elevation = mix(s2Elev,  s3Elev,  t34);
    camDist   = mix(s2Dist,  s3Dist,  t34);
    lens      = mix(s2Lens,  s3Lens,  t34);
  } else if (cp < 0.85) {
    orbit     = mix(s3Orbit, s4Orbit, t45);
    elevation = mix(s3Elev,  s4Elev,  t45);
    camDist   = mix(s3Dist,  s4Dist,  t45);
    lens      = mix(s3Lens,  s4Lens,  t45);
  } else {
    orbit     = mix(s4Orbit, s5Orbit, t51);
    elevation = mix(s4Elev,  s5Elev,  t51);
    camDist   = mix(s4Dist,  s5Dist,  t51);
    lens      = mix(s4Lens,  s5Lens,  t51);
  }

  // ---- Camera target interpolation ----
  vec3 target;
  if (cp < 0.20) {
    // Hold headTarget for the full hero stage - no drift during the hold
    target = headTarget;
  } else if (cp < 0.45) {
    // Transition from headTarget toward midTarget as we swing to lateral
    target = mix(headTarget, midTarget, t23);
  } else if (cp < 0.65) {
    target = mix(midTarget, limbTarget, t34);
  } else if (cp < 0.85) {
    target = mix(limbTarget, mix(midTarget, tailTarget, 0.65), t45);
  } else {
    // Return from tail region back to headTarget for the hero loop
    target = mix(mix(midTarget, tailTarget, 0.65), headTarget, t51);
  }

  // ---- Seamless secondary drift (integer-cycle periods within 30 s) ----
  // All frequencies are multiples of TAU/30 so sin(la*N) loops perfectly
  float driftV  =  0.035 * sin(la * 2.0);          // vertical: 2 cycles / 30 s
  float driftD  =  0.065 * sin(la * 3.0);          // distance: 3 cycles / 30 s
  float driftO  =  0.018 * sin(la * 4.0);          // orbit:    4 cycles / 30 s
  float driftTx =  0.018 * sin(la * 2.0 + 1.1);   // target x: 2 cycles / 30 s
  float driftTy =  0.012 * sin(la * 3.0 + 0.7);   // target y: 3 cycles / 30 s

  orbit     += driftO;
  camDist   += driftD;
  elevation += driftV;
  // Target drift is tiny and loops exactly over the 30-second camera cycle.
  target.x  += driftTx * 0.020;
  target.y  += driftTy * 0.015;

  // ---- Build camera frame ----
  vec3 ro = target + vec3(
    sin(orbit) * camDist,
    elevation,
    cos(orbit) * camDist
  );

  vec3 ww = normalize(target - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = normalize(cross(ww, uu));
  vec3 rd = normalize(uu * st.x * 0.96 + vv * st.y + ww * lens);

  vec3 col = background(st, t);

  float glow, mat;
  float d = rayMarch(ro, rd, t, glow, mat);

  if (d < MAX_DIST) {
    vec3 p = ro + rd*d;
    vec3 n = getNormal(p, t);

    vec3 l1   = normalize(vec3(-0.45,  0.82, -0.25));
    vec3 l2   = normalize(vec3( 0.58, -0.12,  0.72));
    float diff = max(dot(n,l1), 0.0);
    float back = pow(max(dot(l2,rd), 0.0), 2.0);
    float rim  = pow(1.0 - max(dot(n,-rd), 0.0), 2.5);

    vec3 body = materialColor(mat, p, n, rd, t);
    vec3 lit  = body * (0.26 + diff*0.72);
    lit += ACID * back * 0.28;
    lit += mix(VIOLET,PINK,0.48) * rim * 1.10;

    vec3 h    = normalize(l1-rd);
    float spec = pow(max(dot(n,h), 0.0), 68.0);
    lit += mix(CYAN,ACID,0.42) * spec * 1.75;

    float fog = 1.0 - exp(-d*0.16);
    col = mix(lit, col, fog*0.42);
  }

  col += leanLineOverlay(st, ro, uu, vv, ww, t) * (1.04 + 0.07*sin(t));
  col += palette(0.42 + 0.22*sin(t*0.35)) * glow * 0.105;

  // Subtle halo ring + PINK bloom
  vec2 halo = st; halo.y += 0.04;
  float ring = exp(-abs(length(halo) - 0.74) * 26.0);
  col += mix(CYAN,VIOLET,0.50) * ring * 0.042;
  col += PINK * pow(max(0.0, 1.0-length(st*vec2(0.74,1.0))), 4.4) * 0.072;

  col *= 1.76 + 0.12*sin(t*1.0);
  col += pow(max(col,0.0), vec3(1.32)) * 0.33;

  float vignette = 1.0 - 0.20*smoothstep(0.35, 1.60, length(st));
  col *= vignette;

  col  = col / (0.82 + col);
  col  = pow(max(col, 0.0), vec3(0.94));

  float grain = (hash11(uv.x*1234.5 + uv.y*987.6 + t) - 0.5) * 0.014;
  col += grain;

  fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
