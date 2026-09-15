// [SHADER] ANOMALOCARIS — GYROID FORM
// [シェーダー] アノマロカリス — ジャイロイド形状

// Procedural anatomical interpretation, not a scientific reconstruction.
// 科学的復元ではなく、プロシージャルな解剖学的解釈として構成。

// TouchDesigner GLSL TOP. Existing time binding: uTimeSeconds (seconds).
// TouchDesigner GLSL TOP用。既存の時間バインドは uTimeSeconds（秒）。

// 10 seconds, portrait 1080 x 1920. No imported geometry or input textures.
// 10秒ループ、縦1080 x 1920。外部ジオメトリや入力テクスチャは不使用。

// Inline defaults work immediately. The supplied setup script enables external
// インライン既定値だけで即時動作。付属セットアップスクリプトで外部
// uniforms and binds every CONTROL to a named CHOP channel.
// uniformを有効化し、各CONTROLを名前付きCHOPチャンネルへ接続する。

#define EXTERNAL_CONTROLS 0
#define DEVELOPMENT_STAGE 12

out vec4 fragColor;

uniform float uTimeSeconds;

#if EXTERNAL_CONTROLS
#define CONTROL(name,value) uniform float name
#else
#define CONTROL(name,value) const float name = value
#endif

CONTROL(uBodyLength, 1.0);
CONTROL(uBodyWidth, 1.0);
CONTROL(uHeadScale, 1.0);
CONTROL(uSegmentCount, 11.0);
CONTROL(uLobeSize, 1.0);
CONTROL(uAppendageLength, 1.0);
CONTROL(uTailScale, 1.0);

CONTROL(uGyroidScale, 8.0);
CONTROL(uGyroidThickness, 0.43);
CONTROL(uGyroidThreshold, 0.0);
CONTROL(uGyroidWarp, 0.045);
CONTROL(uGyroidPhase, 0.0);

CONTROL(uSwimAmplitude, 0.48);
CONTROL(uSwimFrequency, 3.0);
CONTROL(uWaveOffset, 0.56);
CONTROL(uAppendageMotion, 0.10);
CONTROL(uBreathingAmount, 0.045);

CONTROL(uEnergyFrequency, 7.0);
CONTROL(uEnergySpeed, 2.0);
CONTROL(uEmissionStrength, 0.85);
CONTROL(uEmissionWidth, 0.16);

CONTROL(uRoughness, 0.34);
CONTROL(uMetallic, 0.62);
CONTROL(uFresnel, 0.65);
CONTROL(uSurfaceVariation, 0.28);

CONTROL(uFogDensity, 0.055);
CONTROL(uParticleDensity, 0.35);

// Bloom is deliberately a separate TOP pass; this uniform is in post shader.
// Bloomは意図的に別TOPパスへ分離。このuniformはポスト処理シェーダー側で使用。

CONTROL(uCameraDistance, 7.5);
CONTROL(uCameraOrbit, 0.32);
CONTROL(uCameraHeight, 0.15);
CONTROL(uFOV, 40.0);

const float PI=3.14159265359, TAU=6.28318530718;
const int MAX_STEPS=144;
const float HIT_EPS=0.0010;

float phase, cycle, anatomyReveal, topologyReveal;
float swimCycles, energyCycles, segments;

mat2 rot(float a) {
    float s=sin(a),c=cos(a);
    return mat2(c,-s,s,c);
}

float smin(float a,float b,float k) {
    float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);
    return mix(b,a,h)-k*h*(1.0-h);
}

float ellipsoid(vec3 p,vec3 r) {
    float k0=length(p/r),k1=length(p/(r*r));
    return k0<0.00001 ? -min(r.x,min(r.y,r.z)) : k0*(k0-1.0)/k1;
}

float capsule(vec3 p,vec3 a,vec3 b,float r) {
    vec3 q=p-a,v=b-a;
    return length(q-v*clamp(dot(q,v)/max(dot(v,v),0.00001),0.0,1.0))-r;
}

float box(vec3 p,vec3 b) {
    vec3 q=abs(p)-b;
    return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}

// Anatomical +Y is forward. In the scene, forward points mostly right,
// 解剖学上の+Yを前方とする。シーン内では前方が主に右方向を向き、
// slightly upward and into depth: a cruising animal, not an upright specimen.
// わずかに上方・奥行き方向へ傾く。直立標本ではなく遊泳中の姿勢を表現。

float reelEase(float a,float b,float t) {
    float x=clamp((t-a)/(b-a),0.0,1.0);
    return x*x*x*(x*(x*6.0-15.0)+10.0);
}

float heroViewWeight() {
    // Ease into the hero shot, hold 7.5–8.8 s, then rejoin the looping orbit.
    // ヒーローショットへ滑らかに移行し、7.5〜8.8秒で保持後、ループ軌道へ戻す。
    return reelEase(0.55,0.75,cycle)*(1.0-reelEase(0.88,0.98,cycle));
}

float swimHeading() {
    // Steepen the hero diagonal while keeping a forward cruising posture.
    // 前進する遊泳姿勢を保ちつつ、ヒーローショット時の対角構図を強める。
    float hero=heroViewWeight();
    return mix(0.91+0.055*sin(phase),0.68+0.018*sin(phase),hero);
}

float swimBank() {
    return 0.48+0.055*sin(phase-0.6);
}

vec3 swimPosition() {
    return anatomyReveal*vec3(
        0.13*sin(phase),
        0.045*sin(phase*2.0),
        0.04*cos(phase)
    );
}

vec3 bodyToWorld(vec3 p) {
    p.yz=rot(swimBank())*p.yz;
    p.xy=rot(swimHeading())*p.xy;
    return p+swimPosition();
}

vec3 bodySpace(vec3 p) {
    // Inverse rigid pose; all eyes, fins, claws and tissue share the same frame.
    // 剛体姿勢を逆変換し、目・ヒレ・爪・組織を同一ローカル座標系で扱う。

    p-=swimPosition();
    p.xy=rot(-swimHeading())*p.xy;
    p.yz=rot(-swimBank())*p.yz;

    p.y/=clamp(uBodyLength,0.75,1.3);
    p.x/=clamp(uBodyWidth,0.75,1.25);

    // One body frame carries all anatomy and tissue through each swimming stroke.
    // 1つのボディ座標系で、各遊泳ストローク中の全解剖要素と組織を統一管理する。

#if DEVELOPMENT_STAGE >= 5
    float strength=clamp(uSwimAmplitude/0.48,0.0,1.45);
    float stroke=phase*swimCycles;

    // Small forward surge and pitch suggest propulsion; the close-up stays stable.
    // 小さな前進とピッチ運動で推進感を出しつつ、クローズアップ時の安定性を維持。

    p.y-=0.040*strength*anatomyReveal*sin(stroke-0.4);
    p.yz=rot(0.025*strength*anatomyReveal*sin(stroke-0.9))*p.yz;

    float tail=1.0-smoothstep(-1.7,0.95,p.y);
    float bodyWave=(0.84-p.y)*(segments-1.0)/2.12*uWaveOffset-stroke;

    p.x-=0.085*strength*tail*tail*sin(bodyWave-0.5);
    p.z-=0.075*strength*tail*sin(bodyWave-0.8);
#endif

    return p;
}

float gyroid(vec3 q) {
    return dot(sin(q),cos(q.yzx));
}

vec3 gyroidSpace(vec3 p) {
#if DEVELOPMENT_STAGE >= 6
    p+=clamp(uGyroidWarp,0.0,0.10)
        *sin(
            p.yzx*1.6+
            vec3(
                sin(phase),
                cos(phase),
                sin(phase+1.3)
            )
        );
#endif

    return p*clamp(uGyroidScale,4.0,13.0)
        +vec3(uGyroidPhase,0.1*sin(phase),0.0);
}

vec3 clawPoint(float t,float side) {
    float motion=0.0;

#if DEVELOPMENT_STAGE >= 5
    // Slow grasping layered with a small response to the swimming stroke.
    // ゆっくりした把持動作に、遊泳ストロークへの微小な反応を重ねる。

    motion=clamp(uAppendageMotion,0.0,0.18)
        *(0.75*sin(phase)
        +0.25*sin(phase*swimCycles-0.6));
#endif

    float a=t*1.85;

    return vec3(
        side*(0.36+0.24*sin(a)-0.43*t*t+motion*t*t),
        1.55+clamp(uAppendageLength,0.7,1.3)*(0.86*sin(a)),
        0.08+0.38*t+0.06*sin(a)
    );
}

// Returns anatomical fields separately, keeping eyes/claws readable when porous.
// 解剖学的フィールドを分離して返し、多孔質化しても目や爪の視認性を維持する。

// x = head/trunk volume; y = fins/stalks/claws/tail; z = eyes; w = mouth rim.
// x=頭部/胴体、y=ヒレ/眼柄/爪/尾、z=目、w=口縁。

vec4 anatomy(vec3 p) {
    float yn=clamp((0.9-p.y)/2.25,0.0,1.0);

    float rib=0.0;

#if DEVELOPMENT_STAGE >= 5
    rib=0.020*
        (0.5+0.5*cos((0.9-p.y)*TAU*(segments-1.0)/2.15));
#endif

    float body=ellipsoid(
        p-vec3(0.0,-0.10,0.0),
        vec3(0.49-rib,1.35,0.32-rib*0.5)
    );

    float head=ellipsoid(
        p-vec3(0.0,1.19,0.015),
        vec3(0.59,0.49,0.37)*clamp(uHeadScale,0.85,1.18)
    );

    body=smin(body,head,0.14);

    float detail=10.0;
    float eyes=10.0;
    float mouth=10.0;

    // Five neighboring pairs accommodate the swept fin tips throughout a stroke.
    // ストローク中に移動するヒレ先端を拾うため、近傍5ペアを評価する。

    float spacing=2.12/(segments-1.0);
    float nearIndex=floor((0.84-p.y)/spacing+0.5);

    for(int k=-2;k<=2;k++) {
        float i=nearIndex+float(k);

        if(i<0.0 || i>=segments) continue;

        float u=i/(segments-1.0);
        float y=0.84-i*spacing;

        float rootX=mix(0.43,0.19,u*u);
        float span=clamp(uLobeSize,0.65,1.3)*mix(0.47,0.25,u);

        float wave=0.0;
        float sweep=0.0;
        float flex=0.0;

#if DEVELOPMENT_STAGE >= 5
        // Bilateral metachronal wave: each lobe trails the pair ahead of it.
        // 左右対称のメタクローナル波。各ローブは前方ペアより位相遅延して動く。

        float stroke=i*uWaveOffset-phase*swimCycles;
        float amplitude=clamp(uSwimAmplitude,0.0,0.70);

        // A second harmonic gives the power/recovery strokes different timing.
        // 第2高調波を加え、パワーストロークとリカバリーストロークのタイミング差を作る。

        wave=amplitude*
            (sin(stroke)+0.18*sin(2.0*stroke-0.4));

        // Fore/aft sweep makes propulsion readable even from the dorsal camera.
        // 前後スイープを加え、背面カメラからでも推進運動を読み取りやすくする。

        sweep=0.46*amplitude*cos(stroke-0.35);
        flex=0.16*amplitude*sin(stroke-0.85);
#endif

        vec3 q=vec3(
            abs(p.x)-rootX,
            p.y-y,
            p.z+0.015
        );

        // Rotation and flex are rooted at the body; the outer membrane lags.
        // 回転と屈曲は胴体側を基点とし、外側の膜ほど遅れて追従する。

        q.xz=rot(wave)*q.xz;
        q.xy=rot(0.34+sweep)*q.xy;

        float tip=clamp(
            max(q.x,0.0)/(span*1.15),
            0.0,
            1.0
        );

        q.z-=flex*tip*tip;
        q.x-=span*0.46;

        float fin=ellipsoid(
            q,
            vec3(
                span*0.73,
                spacing*0.65,
                0.042+0.008*(1.0-u)
            )
        );

        detail=min(detail,fin);
    }

    if(p.y>0.75) {
        for(int sideI=0;sideI<2;sideI++) {
            float side=sideI==0 ? -1.0:1.0;

            vec3 eye=vec3(
                side*0.73,
                1.43,
                0.25
            );

            detail=min(
                detail,
                capsule(
                    p,
                    vec3(side*0.44,1.29,0.11),
                    eye,
                    0.044
                )
            );

            eyes=min(
                eyes,
                ellipsoid(
                    p-eye,
                    vec3(0.15,0.115,0.125)
                )
            );

            for(int j=0;j<7;j++) {
                float t=float(j)/7.0;

                vec3 a=clawPoint(t,side);
                vec3 b=clawPoint(t+1.0/7.0,side);

                float r=mix(0.091,0.035,t);

                detail=min(
                    detail,
                    capsule(p,a,b,r)
                );

                // Large paired endites (grasping spines), attached to each joint.
                // 各関節に大きな対の内肢突起（把持棘）を付加する。

                if(j>0 && j<6) {
                    vec3 tooth=a+vec3(
                        -side*(0.16-0.05*t),
                        -0.085,
                        0.065
                    );

                    detail=min(
                        detail,
                        capsule(
                            p,
                            a,
                            tooth,
                            0.021*(1.0-0.4*t)
                        )
                    );
                }
            }
        }

        // Radial oral cone on the forward/visible underside, with dark aperture.
        // 前方かつ視認可能な腹側に放射状の口円錐を配置し、開口部を暗くする。

        vec3 q=p-vec3(0.0,1.46,0.30);

        mouth=length(
            vec2(
                length(q.xy)-0.19,
                q.z
            )
        )-0.046;

        float a=atan(q.y,q.x);
        float r=length(q.xy);

        float plates=
            0.5+0.5*cos(a*12.0);

        mouth=min(
            mouth,
            max(
                abs(q.z)-0.025,
                max(
                    0.115-r,
                    r-(0.166+0.017*plates)
                )
            )
        );

        // Clear the central aperture through the head envelope.
        // 頭部ボリュームを貫通させ、口の中央開口部を確保する。

        body=max(
            body,
            -capsule(
                p,
                vec3(0,1.46,0.15),
                vec3(0,1.46,0.7),
                0.12
            )
        );
    }

    if(p.y<-1.15) {
        vec3 q=
            p-vec3(0.0,-1.43,0.0);

        q/=clamp(
            uTailScale,
            0.75,
            1.25
        );

#if DEVELOPMENT_STAGE >= 5
        // Tail fan follows the final lobe with a short phase delay.
        // 尾扇は最後尾ローブより少し遅れた位相で追従する。

        float tailStroke=
            (segments-1.0)*uWaveOffset
            -phase*swimCycles
            -0.55;

        float tailTip=
            clamp(-q.y/0.65,0.0,1.0);

        float tailStrength=
            clamp(uSwimAmplitude/0.48,0.0,1.45);

        q.x-=0.070
            *tailStrength
            *tailTip
            *tailTip
            *sin(tailStroke);

        q.z-=0.055
            *tailStrength
            *tailTip
            *tailTip
            *sin(tailStroke-0.45);
#endif

        float tail=
            ellipsoid(
                q-vec3(0,-0.28,0),
                vec3(0.13,0.44,0.07)
            );

        for(int i=0;i<2;i++) {
            vec3 f=q;

            f.x=abs(f.x);

            f.xy=
                rot(-0.45-float(i)*0.2)
                *f.xy;

            tail=min(
                tail,
                ellipsoid(
                    f-vec3(
                        0.13+float(i)*0.08,
                        -0.27,
                        0
                    ),
                    vec3(
                        0.10,
                        0.42-float(i)*0.06,
                        0.045
                    )
                )
            );
        }

        detail=min(
            detail,
            tail*clamp(
                uTailScale,
                0.75,
                1.25
            )
        );
    }

    return vec4(
        body,
        detail,
        eyes,
        mouth
    );
}

vec2 scene(vec3 world) {
    vec3 p=bodySpace(world);

    float bound=box(
        p-vec3(0,0.23,0.1),
        vec3(1.30,2.55,0.86)
    );

    if(bound>0.1)
        return vec2(bound*0.5,1.0);

    vec4 a=anatomy(p);

    float tissue=a.x;

#if DEVELOPMENT_STAGE >= 4
    float g=
        gyroid(gyroidSpace(p))
        -uGyroidThreshold;

    float thickness=
        clamp(
            uGyroidThickness
            -0.18*topologyReveal
            +uBreathingAmount*sin(phase),
            0.18,
            0.65
        );

    float sheet=
        (abs(g)-thickness)
        /(2.6*clamp(
            uGyroidScale,
            4.0,
            13.0
        ));

    tissue=max(tissue,sheet);

    // The thin swimming membranes are retained. Shallow Gyroid relief keeps
    // 薄い遊泳膜は連続形状として保持する。浅いGyroid凹凸により
    // their silhouette continuous; full perforation is reserved for trunk/head.
    // シルエットを崩さず、完全な多孔化は胴体と頭部に限定する。

    a.y+=0.009*
        smoothstep(
            0.1,
            0.9,
            abs(g)
        );
#endif

    vec2 hit=vec2(tissue,1.0);

    if(a.y<hit.x)
        hit=vec2(a.y,2.0);

    if(a.z<hit.x)
        hit=vec2(a.z,3.0);

    if(a.w<hit.x)
        hit=vec2(a.w,4.0);

    // Safety margin for ellipsoid estimates, domain deformation and thin fins.
    // 楕円体距離推定・ドメイン変形・薄いヒレを考慮した安全マージン。

    hit.x*=0.48*
        min(
            clamp(
                uBodyLength,
                0.75,
                1.3
            ),
            clamp(
                uBodyWidth,
                0.75,
                1.25
            )
        );

    return hit;
}

vec3 normalAt(vec3 p) {
    vec2 e=vec2(
        0.0012,
        -0.0012
    );

    return normalize(
        e.xyy*scene(p+e.xyy).x+
        e.yyx*scene(p+e.yyx).x+
        e.yxy*scene(p+e.yxy).x+
        e.xxx*scene(p+e.xxx).x
    );
}

float occlusion(vec3 p,vec3 n) {
    float a=0.0;

    for(int i=1;i<=3;i++) {
        float h=
            0.045*float(i);

        a+=max(
            h-scene(p+n*h).x/0.48,
            0.0
        )/float(i);
    }

    return clamp(
        1.0-3.4*a,
        0.22,
        1.0
    );
}

float softShadow(vec3 p,vec3 l) {
    float t=0.025;
    float sh=1.0;

    for(int i=0;i<14;i++) {
        float d=
            scene(p+l*t).x;

        sh=min(
            sh,
            14.0*d/t
        );

        t+=clamp(
            d,
            0.014,
            0.15
        );

        if(
            d<0.0008 ||
            t>1.6
        ) break;
    }

    return 0.25+
        0.75*clamp(
            sh,
            0.0,
            1.0
        );
}

vec3 shade(
    vec3 p,
    vec3 n,
    vec3 rd,
    float id
) {

#if DEVELOPMENT_STAGE < 8

    return vec3(0.55)*
        (
            0.20+
            0.80*
            max(
                dot(
                    n,
                    normalize(
                        vec3(-0.5,0.8,1)
                    )
                ),
                0.0
            )
        );

#else

    vec3 local=bodySpace(p);
    vec3 q=gyroidSpace(local);

    vec3 key=
        normalize(
            vec3(-0.55,0.7,1.0)
        );

    vec3 rim=
        normalize(
            vec3(0.8,-0.1,-0.7)
        );

    float ao=
        occlusion(p,n);

    float sh=
        softShadow(
            p+n*0.008,
            key
        );

    float diffuse=
        max(
            dot(n,key),
            0.0
        );

    float fres=
        pow(
            1.0-
            max(
                dot(n,-rd),
                0.0
            ),
            4.0
        );

    float variation=
        0.5+
        0.5*
        sin(
            q.y*0.56+
            sin(q.x)
        );

    vec3 base=
        mix(
            vec3(0.075,0.068,0.058),
            vec3(0.17,0.12,0.069),
            variation*
            clamp(
                uSurfaceVariation,
                0.0,
                1.0
            )
        );

    float rough=
        clamp(
            uRoughness,
            0.16,
            0.8
        );

    if(
        id>2.5 &&
        id<3.5
    ) {
        base=
            vec3(
                0.009,
                0.017,
                0.02
            );

        rough=0.15;
    }

    if(id>3.5)
        base=
            vec3(
                0.12,
                0.105,
                0.077
            );

    float spec=
        pow(
            max(
                dot(
                    n,
                    normalize(
                        key-rd
                    )
                ),
                0.0
            ),
            mix(
                150.0,
                13.0,
                rough
            )
        );

    vec3 col=
        base*
        (0.16+1.6*diffuse*sh)*
        ao;

    col+=mix(
        vec3(0.19),
        vec3(0.58,0.52,0.43),
        clamp(
            uMetallic,
            0.0,
            1.0
        )
    )*spec*sh;

    col+=vec3(
        0.035,
        0.14,
        0.19
    )*
    pow(
        max(
            dot(n,rim),
            0.0
        ),
        2.5
    )*
    (0.35+fres)*
    ao;

    col+=vec3(
        0.03,
        0.055,
        0.075
    )*
    fres*
    uFresnel;

#if DEVELOPMENT_STAGE >= 7

    if(id<1.5) {
        float secondary=
            sin(q.x+1.4)*
            cos(q.z-0.7)+
            sin(q.y+0.8);

        float channel=
            1.0-
            smoothstep(
                clamp(
                    uEmissionWidth,
                    0.04,
                    0.4
                ),
                clamp(
                    uEmissionWidth,
                    0.04,
                    0.4
                )+0.18,
                abs(secondary)
            );

        float signal=
            pow(
                0.5+
                0.5*
                sin(
                    -local.y*uEnergyFrequency
                    -phase*energyCycles
                    +0.4*gyroid(q)
                ),
                6.0
            );

        float deep=
            1.0-
            smoothstep(
                -0.17,
                -0.01,
                anatomy(local).x
            );

        col+=vec3(
            0.018,
            0.47,
            0.64
        )*
        channel*
        (0.12+signal)*
        deep*
        uEmissionStrength*
        (1.0+0.4*topologyReveal);
    }

#endif

    return col;

#endif
}

float hash(vec2 p) {
    return fract(
        sin(
            dot(
                p,
                vec2(127.1,311.7)
            )
        )*
        43758.5453
    );
}

void main() {
    cycle=
        fract(
            uTimeSeconds/10.0
        );

    phase=
        TAU*cycle;

    swimCycles=
        max(
            1.0,
            floor(
                uSwimFrequency+0.5
            )
        );

    energyCycles=
        max(
            1.0,
            floor(
                uEnergySpeed+0.5
            )
        );

    segments=
        clamp(
            floor(
                uSegmentCount+0.5
            ),
            7.0,
            14.0
        );

    anatomyReveal=
        reelEase(
            0.04,
            0.20,
            cycle
        )*
        (
            1.0-
            reelEase(
                0.88,
                1.0,
                cycle
            )
        );

    topologyReveal=
        reelEase(
            0.50,
            0.68,
            cycle
        )*
        (
            1.0-
            reelEase(
                0.88,
                1.0,
                cycle
            )
        );

    vec2 st=
        vUV.st*2.0-1.0;

    st.x*=
        uTDOutputInfo.res.z/
        uTDOutputInfo.res.w;

    // Full-creature tracking throughout; no surface macro at either loop end.
    // 全ループを通して全身を追跡し、開始/終了付近でも極端な表面マクロへ寄らない。

    // Orbit and crane are phase-offset, creating an elliptical camera path.
    // オービットと上下移動の位相をずらし、楕円状のカメラ軌道を作る。

    float orbit=
        0.20+
        clamp(
            uCameraOrbit,
            0.0,
            0.65
        )*
        (
            1.10*sin(phase-0.55)+
            0.16*sin(2.0*phase+0.3)
        );

    float elevation=
        0.10+
        0.14*cos(phase-0.25)+
        0.10*uCameraHeight;

    vec3 localTarget=
        vec3(
            0.035*sin(phase+0.4),
            0.23+0.065*cos(phase),
            0.02
        );

    vec3 target=
        bodyToWorld(localTarget);

    // Partial follow leaves gentle parallax against the underwater environment.
    // 完全追従ではなく部分追従にし、水中背景との穏やかなパララックスを残す。

    target-=
        0.22*swimPosition();

    vec3 cameraOut=
        vec3(
            sin(orbit)*cos(elevation),
            sin(elevation),
            cos(orbit)*cos(elevation)
        );

    // Approach the body's dorsal normal, retaining a small side angle for depth.
    // 背側法線方向へ寄せつつ、奥行きを残すためわずかな側面角を維持する。

    // Transform a direction, excluding translation, so the camera follows the
    // 平行移動を除外して方向のみ変換し、カメラがバンクした
    // banked anatomy and exposes both lobe rows rather than flattening the body.
    // ボディ姿勢へ追従し、胴体を平坦化せず左右両ローブ列を見せる。

    vec3 dorsalView=
        normalize(
            bodyToWorld(
                vec3(0.16,0.05,1.0)
            )
            -swimPosition()
        );

    cameraOut=
        normalize(
            mix(
                cameraOut,
                dorsalView,
                0.85*heroViewWeight()
            )
        );

    vec3 ww=
        -cameraOut;

    vec3 right=
        normalize(
            cross(
                ww,
                vec3(0,1,0)
            )
        );

    vec3 up=
        cross(
            right,
            ww
        );

    float lens=
        1.0/
        tan(
            radians(
                clamp(
                    uFOV,
                    30.0,
                    55.0
                )
            )*0.5
        );

    float aspect=
        uTDOutputInfo.res.z/
        uTDOutputInfo.res.w;

    // Composition guides, not fixed Instagram UI specifications:
    // 固定のInstagram UI仕様ではなく、構図調整用ガイドとして使用。

    // shift left/up; leave leading space, right-side controls and bottom captions.
    // 左上へ寄せ、進行方向の余白・右側UI・下部キャプション領域を確保する。

    vec2 placement=
        vec2(
            -0.08+
            0.018*sin(phase),
            0.10+
            0.015*sin(phase-0.5)
        );

    float fitDistance=0.0;

    for(int i=0;i<8;i++) {
        vec3 anchor;

        if(i<2)
            anchor=
                vec3(
                    i==0 ? -0.36:0.36,
                    2.52,
                    0.40
                );

        else if(i<4)
            anchor=
                vec3(
                    i==2 ? -0.89:0.89,
                    1.43,
                    0.25
                );

        else if(i<6)
            anchor=
                vec3(
                    i==4 ? -1.15:1.15,
                    0.25,
                    0.05
                );

        else
            anchor=
                vec3(
                    i==6 ? -0.20:0.20,
                    -2.12,
                    0.0
                );

        anchor.x*=
            clamp(
                uBodyWidth,
                0.75,
                1.25
            );

        anchor.y*=
            clamp(
                uBodyLength,
                0.75,
                1.3
            );

        vec3 delta=
            bodyToWorld(anchor)
            -target;

        float x=
            dot(
                delta,
                right
            );

        float y=
            dot(
                delta,
                up
            );

        float z=
            dot(
                delta,
                cameraOut
            );

        float roomX=
            (
                x>0.0
                ? 0.72-placement.x
                : 0.88+placement.x
            )*
            aspect;

        float roomY=
            y>0.0
            ? 0.80-placement.y
            : 0.65+placement.y;

        fitDistance=
            max(
                fitDistance,
                z+
                max(
                    (abs(x)+0.08)
                    *lens/
                    roomX,

                    (abs(y)+0.08)
                    *lens/
                    roomY
                )
            );
    }

    // Gentle periodic dolly, with a 12% closer composition trim requested
    // 緩やかな周期ドリーに加え、ライブスクリーンショット基準で
    // from the live screenshot. Anchor fit is a guide, not a hard crop limit.
    // 約12%寄った構図へ調整。アンカーフィットは目安であり固定クロップではない。

    float requestedDistance=
        clamp(
            uCameraDistance,
            6.5,
            11.0
        );

    // Smooth maximum avoids an abrupt switch between the art control and fit.
    // smooth maximumで、手動距離と自動フィット間の急な切り替えを防ぐ。

    float wideDistance=
        -smin(
            -requestedDistance,
            -fitDistance,
            0.35
        );

    float dolly=
        1.05+
        0.04*cos(phase-0.45);

    float dist=
        wideDistance*
        dolly*
        0.88;

    vec3 ro=
        target+
        cameraOut*dist;

    // Shift the image down by 6% of frame height after the distance fit.
    // 距離フィット後、画面高の6%分だけ映像を下方向へシフトする。

    // Keep the established camera distance, angle and animated drift unchanged.
    // 既存のカメラ距離・角度・アニメーションドリフトは維持する。

    vec2 cameraST=
        st-
        vec2(
            placement.x*aspect,
            placement.y-0.12
        );

    vec3 rd=
        normalize(
            ww*lens+
            right*cameraST.x+
            up*cameraST.y
        );

    vec3 bg=
        vec3(
            0.0015,
            0.0030,
            0.0036
        );

#if DEVELOPMENT_STAGE >= 9

    bg+=vec3(
        0.003,
        0.010,
        0.014
    )*
    exp(
        -1.7*
        dot(
            st-vec2(-0.12,0.3),
            st-vec2(-0.12,0.3)
        )
    );

    bg+=vec3(
        0.001,
        0.0025,
        0.002
    )*
    pow(
        0.5+
        0.5*
        sin(
            st.x*3.0+
            st.y+
            0.08*sin(phase)
        ),
        8.0
    );

    vec2 dust=
        (
            st+
            0.014*
            vec2(
                sin(phase),
                cos(phase)
            )
        )*
        44.0;

    vec2 cell=
        floor(dust);

    vec2 d=
        fract(dust)-0.5;

    bg+=vec3(
        0.018,
        0.025,
        0.025
    )*
    step(
        1.0-
        clamp(
            uParticleDensity,
            0.0,
            1.0
        )*
        0.017,
        hash(cell)
    )*
    exp(
        -130.0*
        dot(d,d)
    );

#endif

    float travel=0.0;
    float id=0.0;
    bool hit=false;

    for(int i=0;i<MAX_STEPS;i++) {
        vec2 h=
            scene(
                ro+
                rd*travel
            );

        if(abs(h.x)<HIT_EPS) {
            id=h.y;
            hit=true;
            break;
        }

        travel+=max(
            abs(h.x),
            0.00045
        );

        if(
            travel>
            max(
                15.0,
                dist+4.0
            )
        ) break;
    }

    vec3 color=bg;

    if(hit) {
        vec3 p=
            ro+
            rd*travel;

        color=
            shade(
                p,
                normalAt(p),
                rd,
                id
            );

#if DEVELOPMENT_STAGE >= 9

        color=
            mix(
                color,
                bg,
                1.0-
                exp(
                    -travel*
                    max(
                        uFogDensity,
                        0.0
                    )
                )
            );

#endif
    }

    // Standalone grade. POST shader adds only restrained highlight bloom.
    // 本体側で基本グレーディングを完結し、POST側は抑えたハイライトBloomのみ追加する。

    color=
        vec3(1.0)-
        exp(
            -color*1.7
        );

    color=
        pow(
            max(
                color,
                0.0
            ),
            vec3(1.0/2.2)
        );

    color*=
        1.0-
        0.12*
        smoothstep(
            0.25,
            1.3,
            length(st)
        );

    color+=
        (
            hash(gl_FragCoord.xy)-0.5
        )*
        0.0018;

    fragColor=
        TDOutputSwizzle(
            vec4(
                max(
                    color,
                    0.0
                ),
                1.0
            )
        );
}
