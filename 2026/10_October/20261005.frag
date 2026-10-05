// ============================================================
// KLEIN BOTTLE JELLYFISH — IMPOSSIBLE ANATOMY
// ============================================================
//
// A procedural jellyfish whose bell is derived from a
// figure-eight immersion of a Klein bottle.
//
// Topological seam:
//     P(2π, v) = P(0, -v)
//
// The self-intersection is intentional and is part of the
// Klein-bottle-inspired anatomy.
//
// Designed for:
// - TouchDesigner GLSL TOP
// - Portrait Instagram Reel rendering
// - 10-second seamless loop
// - Optional external uniform control
//
// Existing render resolution / output / recording chain retained.
// ============================================================


// ============================================================
// EXTERNAL CONTROL MODE
// ============================================================
//
// 0:
//     Parameters below are compile-time constants.
//     Useful while developing directly inside the GLSL TOP.
//
// 1:
//     Parameters become uniforms.
//     Enable only after matching host-side bindings exist.
// ============================================================

#define EXTERNAL_CONTROLS 0

out vec4 fragColor;

uniform float uTimeSeconds;

#if EXTERNAL_CONTROLS
    #define CONTROL(name, value) uniform float name
#else
    #define CONTROL(name, value) const float name = value
#endif


// ============================================================
// CREATURE CONTROLS
// ============================================================

// Bell / body
CONTROL(uBodyScale,            1.0);
CONTROL(uBodyRadius,           .85);
CONTROL(uTubeRadius,           .60);
CONTROL(uVerticalElongation,   1.60);
CONTROL(uTopologyDistortion,   .10);
CONTROL(uOrganicDeformation,   .025);

// Surface appearance
CONTROL(uMembraneOpacity,      .42);
CONTROL(uFresnelStrength,      1.0);
CONTROL(uRefractionAmount,     .018);
CONTROL(uEmissionStrength,     1.0);

// Surface flow
CONTROL(uFlowSpeed,            1.0);
CONTROL(uFlowFrequency,        3.0);

// Breathing
CONTROL(uBreathingAmount,      .025);
CONTROL(uBreathingSpeed,       1.0);

// Tentacles
CONTROL(uTentacleCount,        12.0);
CONTROL(uTentacleLength,       2.15);
CONTROL(uTentacleCurl,         1.0);
CONTROL(uTentacleMotion,       1.0);
CONTROL(uTentacleSpeed,        1.0);

// Camera
CONTROL(uCameraOrbit,          28.0);
CONTROL(uCameraDistance,       1.0);

// Loop / presentation
CONTROL(uLoopSpeed,            1.0);
CONTROL(uBloomStrength,        .8);
CONTROL(uBackground,           1.0);
CONTROL(uExposure,             1.25);

// Jellyfish swim pulse
CONTROL(uPulseAmount,          1.0);
CONTROL(uPulsesPerLoop,        2.0);


// ============================================================
// RENDER LIMITS
// ============================================================

#define MAX_STEPS          160
#define MAX_LAYERS         8
#define SURFACE_ITERATIONS 6
#define MAX_TENTACLES      16


// ============================================================
// CONSTANTS
// ============================================================

const float PI           = 3.14159265359;
const float TAU          = 6.28318530718;
const float LOOP_SECONDS = 10.0;

// Creature world-space center.
const vec3 CENTER = vec3(-.12, -.42, 0.0);


// ============================================================
// SHARED RAYMARCH STATE
// ============================================================
//
// map() updates these values so the shading stage can recover
// material and surface-coordinate information from the most
// recent distance evaluation.
//
// This avoids carrying a larger custom return structure through
// every SDF function.
// ============================================================

float phase;

float gMat;
float gU;
float gV;
float gTip;

float gPulse;
float gRise;

vec3 gRoots[MAX_TENTACLES];


// ============================================================
// BASIC UTILITIES
// ============================================================

mat2 rotation(float angle)
{
    float c = cos(angle);
    float s = sin(angle);

    return mat2(
         c, -s,
         s,  c
    );
}


// Pseudo-random 2D hash.
//
// Used only for visual particle distribution and dithering;
// deterministic output is required for stable animation.
vec2 hash22(vec2 p)
{
    vec3 q = fract(
        vec3(p.xyx) *
        vec3(.1031, .1030, .0973)
    );

    q += dot(q, q.yzx + 33.33);

    return fract(
        (q.xx + q.yz) * q.zy
    );
}


// Quantize a parameter to the nearest whole harmonic.
//
// Integer cycle counts are important because the animation must
// return to exactly the same phase after one 10-second loop.
float harmonic(float x)
{
    return max(0.0, floor(x + .5));
}


// ============================================================
// LOOP / SWIMMING ANIMATION
// ============================================================

// Gentle global breathing.
//
// Because the oscillator is driven by integer loop harmonics,
// its state is identical at t = 0 and t = LOOP_SECONDS.
float breath()
{
    float amount = clamp(
        uBreathingAmount,
        0.0,
        .06
    );

    return 1.0 +
        amount *
        sin(
            phase *
            harmonic(uBreathingSpeed)
        );
}


// Jellyfish swim-stroke envelope.
//
// The bell contracts relatively quickly during roughly the first
// 22% of the stroke and then relaxes more slowly.
//
// smoothstep on both sides keeps the loop continuous and avoids
// visible popping at the seam.
float pulseShape(float x)
{
    x = fract(x);

    float contract = smoothstep(
        0.0,
        .22,
        x
    );

    float relax = 1.0 - smoothstep(
        .22,
        1.0,
        x
    );

    return contract * relax;
}


// Number of contraction cycles during one complete render loop.
float pulseCount()
{
    return max(
        harmonic(uPulsesPerLoop),
        1.0
    );
}


// Evaluate the swim pulse at an arbitrary phase.
//
// Supplying shifted phase values lets different parts of the
// jellyfish react to the contraction with temporal delay.
float pulseAt(float ph)
{
    return
        clamp(uPulseAmount, 0.0, 2.0) *
        pulseShape(
            ph *
            pulseCount() /
            TAU
        );
}


// Bell contraction:
//
// - X/Z contract radially.
// - Y stretches slightly.
//
// The opposing deformation gives the body a more organic swim
// stroke instead of simply scaling the entire creature.
vec2 squeeze()
{
    return vec2(
        1.0 - .09 * gPulse,
        1.0 + .06 * gPulse
    );
}


// Convert a world-space point into the jellyfish's animated
// local coordinate system.
//
// Keeping the animation transformation here allows the actual
// Klein topology to remain stable while the whole creature
// breathes, squeezes, rises and subtly rotates.
vec3 creatureSpace(vec3 p)
{
    // Slight vertical drift plus delayed rise after contraction.
    p.y -=
        .035 * sin(phase) +
        .12  * gRise;

    // Small body rotation avoids perfectly mechanical motion.
    p.xz =
        rotation(
            .025 * sin(phase)
        ) *
        p.xz;

    // Global scale + breathing.
    p /=
        max(uBodyScale, .1) *
        breath();

    // Swim-stroke deformation.
    vec2 s = squeeze();

    p.xz /= s.x;
    p.y  /= s.y;

    return p;
}


// ============================================================
// KLEIN BOTTLE GEOMETRY
// ============================================================

// Tube thickness around the Klein bottle.
//
// A second harmonic creates controlled topology distortion while
// remaining periodic around the complete azimuth.
float tubeRadius(float u)
{
    float radius = clamp(
        uTubeRadius,
        .2,
        .7
    );

    float distortion = clamp(
        uTopologyDistortion,
        0.0,
        .2
    );

    return radius *
        (
            1.0 +
            distortion *
            cos(2.0 * u)
        );
}


// Figure-eight cross-section.
//
// This section is twisted by half the azimuth angle inside
// kleinPoint(), producing the required orientation reversal.
vec2 sectionPoint(float v)
{
    return vec2(
        sin(v),
        .5 * sin(2.0 * v)
    );
}


// Modify radial width according to vertical position.
//
// Without this taper the body tends to read as a cylindrical
// tube from the side. The linear + quadratic profile creates
// the dome-like jellyfish bell silhouette.
float bellTaper(float y)
{
    return
        .20 * y +
        .10 *
        max(y, 0.0) *
        max(y, 0.0);
}


// Parametric Klein-bottle-inspired surface.
//
// u:
//     azimuth around the body.
//
// v:
//     position around the twisted figure-eight section.
//
// The -u/2 rotation introduces the half twist responsible for
// the orientation reversal:
//
//     P(2π, v) = P(0, -v)
//
vec3 kleinPoint(float u, float v)
{
    vec2 q =
        rotation(-.5 * u) *
        sectionPoint(v) *
        tubeRadius(u);

    float vertical =
        q.y *
        max(uVerticalElongation, .5);

    float radius =
        max(uBodyRadius, .8) -
        bellTaper(vertical) +
        q.x;

    return vec3(
        radius * cos(u),
        vertical,
        radius * sin(u)
    );
}


// ============================================================
// KLEIN MEMBRANE DISTANCE ESTIMATE
// ============================================================
//
// This is not an exact signed-distance field.
//
// Instead:
//
// 1. Recover the azimuth u from the query point.
// 2. Undo the half twist.
// 3. Estimate the nearest position on the figure-eight section.
// 4. Iteratively minimize the section distance.
//
// The result is conservative enough for raymarching while being
// significantly cheaper than a complete parametric closest-point
// solver.
// ============================================================

float membrane(vec3 p)
{
    // Recover azimuth.
    float u = atan(p.z, p.x);

    if (u < 0.0)
        u += TAU;


    float R = tubeRadius(u);
    float H = max(
        uVerticalElongation,
        .5
    );


    // Transform the point back into the untwisted local
    // cross-section coordinate system.
    vec2 q =
        rotation(.5 * u) *
        vec2(
            length(p.xz) -
                max(uBodyRadius, .8) +
                bellTaper(p.y),

            p.y / H
        ) /
        R;


    // The figure-eight can map to multiple nearby parameter
    // branches, so test both inverse-sine candidates.
    float a = asin(
        clamp(
            q.x,
            -.999,
            .999
        )
    );

    float best = 1e4;
    float bestV = 0.0;


    for (int branch = 0; branch < 2; branch++)
    {
        float v =
            branch == 0
                ? a
                : PI - a;


        // Newton-style closest-point refinement.
        for (
            int j = 0;
            j < SURFACE_ITERATIONS;
            j++
        )
        {
            vec2 c = sectionPoint(v);

            vec2 dv = vec2(
                cos(v),
                cos(2.0 * v)
            );

            float denominator =
                dot(dv, dv);

            v -= clamp(
                dot(c - q, dv) /
                max(
                    abs(denominator),
                    .15
                ),
                -.35,
                .35
            );
        }


        float distanceToSection =
            length(
                sectionPoint(v) - q
            );


        if (distanceToSection < best)
        {
            best  = distanceToSection;
            bestV = v;
        }
    }


    // Save topology coordinates for shading.
    gU = u;
    gV = bestV;


    // Seam-safe organic deformation.
    //
    // cos(4u) * cos(2v) is invariant under:
    //
    //     (u, v) -> (u + 2π, -v)
    //
    // so the displacement cannot tear the Klein seam.
    float organic =
        clamp(
            uOrganicDeformation,
            0.0,
            .04
        ) *
        cos(4.0 * u) *
        cos(2.0 * bestV) *
        sin(phase);


    return
        (
            best * R -
            .012 -
            organic * .15
        ) *
        .48;
}


// ============================================================
// TENTACLE ROOT GENERATION
// ============================================================
//
// Tentacles emerge from the lowest point of each twisted
// cross-section rather than from an unrelated circular skirt.
//
// That makes the appendages visually belong to the immersed
// surface itself.
// ============================================================

vec3 tentacleRoot(
    float index,
    float count
)
{
    float u =
        (index + .5) /
        count *
        TAU +
        .35;

    float bestV = 0.0;
    float bestY = 1e4;


    // Coarse search around the complete section.
    for (int k = 0; k < 24; k++)
    {
        float v =
            float(k) /
            24.0 *
            TAU;

        float y =
            kleinPoint(u, v).y;


        if (y < bestY)
        {
            bestY = y;
            bestV = v;
        }
    }


    // Small local refinement of the minimum.
    for (int k = 0; k < 3; k++)
    {
        float h = TAU / 96.0;

        float yA =
            kleinPoint(
                u,
                bestV - h
            ).y;

        float yB =
            kleinPoint(
                u,
                bestV + h
            ).y;

        float yCenter =
            kleinPoint(
                u,
                bestV
            ).y;


        bestV += clamp(
            .5 * h *
            (yA - yB) /
            max(
                yA +
                yB -
                2.0 * yCenter,
                1e-4
            ),
            -h,
            h
        );
    }


    // Small downward-facing offset prevents the SDFs from
    // fighting directly at the attachment point.
    return
        kleinPoint(
            u,
            bestV
        ) +
        vec3(
            0.0,
            .03,
            0.0
        );
}


// ============================================================
// TENTACLE ANIMATION
// ============================================================

// Procedural lateral displacement along one tentacle.
//
// w:
//     0 = root
//     1 = tip
//
// The w² weighting anchors the root while allowing increasingly
// free motion toward the tip.
vec3 tentacleOffset(
    float w,
    float index
)
{
    float lag =
        phase *
        harmonic(uTentacleSpeed) -
        w * 3.0 +
        index * 1.73;


    return
        clamp(
            uTentacleMotion,
            0.0,
            2.0
        ) *
        w *
        w *
        vec3(
            .14 * sin(lag) +
            .055 *
            uTentacleCurl *
            sin(
                w * 8.0 -
                2.0 * phase +
                index
            ),

            0.0,

            .12 *
            cos(lag + .8) +
            .045 *
            uTentacleCurl *
            sin(
                w * 7.0 +
                phase +
                index
            )
        );
}


// Distance estimate for all tentacles.
float tentacles(vec3 p)
{
    float count = clamp(
        floor(
            uTentacleCount + .5
        ),
        8.0,
        16.0
    );

    float best = 1e4;


    for (
        int i = 0;
        i < MAX_TENTACLES;
        i++
    )
    {
        if (float(i) >= count)
            break;


        float index = float(i);

        vec3 root = gRoots[i];


        // Slight deterministic length variation prevents all
        // appendages from terminating on one perfect ring.
        float lengthVariation =
            .82 +
            .18 *
            sin(
                index * 2.17 +
                1.0
            );

        float tentacleLength =
            max(
                uTentacleLength,
                .2
            ) *
            lengthVariation;


        // Approximate longitudinal position according to the
        // point's vertical distance below the root.
        float w = clamp(
            (
                root.y -
                p.y
            ) /
            tentacleLength,
            0.0,
            1.0
        );


        // Radial direction of the attachment point.
        vec2 radial =
            normalize(
                root.xz +
                1e-4
            );


        // Swim contraction propagates down each tentacle with
        // delay so the skirt gathers after the bell contracts.
        float drag =
            .16 *
            w *
            pulseAt(
                phase -
                1.4 * w -
                .1 *
                sin(
                    index * 3.1
                )
            );


        vec3 center =
            root +
            vec3(
                .08 *
                w *
                sin(index),

                -w *
                tentacleLength,

                .08 *
                w *
                cos(index)
            ) +
            tentacleOffset(
                w,
                index
            ) -
            vec3(
                radial.x,
                0.0,
                radial.y
            ) *
            drag;


        // Taper from thicker root to fine tip.
        float radius =
            mix(
                .032,
                .0065,
                w
            );


        float d =
            (
                length(
                    p -
                    center
                ) -
                radius
            ) *
            .60;


        if (d < best)
        {
            best = d;
            gTip = w;
        }
    }


    return best;
}


// ============================================================
// INTERNAL ENERGY FILAMENT
// ============================================================
//
// Secondary emissive structure following the immersed anatomy.
//
// Keeping this attached to kleinPoint() makes it feel like an
// internal biological system rather than a separate particle
// object floating inside the bell.
// ============================================================

float energyCore(vec3 p)
{
    float u =
        atan(
            p.z,
            p.x
        );

    if (u < 0.0)
        u += TAU;


    vec3 center =
        kleinPoint(
            u,
            .60 *
            sin(.5 * u)
        );


    return
        (
            length(
                p -
                center
            ) -
            .014
        ) *
        .45;
}


// ============================================================
// COMPLETE CREATURE DISTANCE FUNCTION
// ============================================================
//
// Material IDs:
//
// 1 = membrane
// 2 = tentacles
// 3 = internal energy filament
// ============================================================

float map(vec3 world)
{
    vec3 p =
        creatureSpace(world);


    vec2 sq =
        squeeze();


    float scale =
        max(
            uBodyScale,
            .1
        ) *
        breath() *
        min(
            sq.x,
            sq.y
        );


    // Cheap conservative bounds.
    //
    // Most rays never intersect the creature. Returning this
    // proxy before evaluating the expensive membrane and
    // tentacle functions substantially reduces render cost.
    float bounds =
        max(
            length(p.xz) -
                1.85,

            max(
                p.y -
                    1.45,

                -3.70 -
                    p.y
            )
        );


    if (bounds > .10)
    {
        gMat = 0.0;

        return
            bounds *
            .45 *
            scale;
    }


    // Default surface: Klein membrane.
    float d = membrane(p);

    gMat = 1.0;


    // Tentacles only exist below the central body.
    if (p.y < .1)
    {
        float tentacleDistance =
            tentacles(p);

        if (tentacleDistance < d)
        {
            d = tentacleDistance;
            gMat = 2.0;
        }
    }


    // Internal emissive filament.
    float energyDistance =
        energyCore(p);

    if (energyDistance < d)
    {
        d = energyDistance;
        gMat = 3.0;
    }


    return d * scale;
}


// ============================================================
// SURFACE NORMAL
// ============================================================
//
// Tetrahedral gradient estimation.
//
// Four samples provide a useful compromise between visual
// stability and the cost of repeatedly evaluating the relatively
// expensive procedural creature SDF.
// ============================================================

vec3 normalAt(
    vec3 p,
    float epsilon
)
{
    vec2 k =
        vec2(
            1.0,
            -1.0
        );


    vec3 n =
        k.xyy *
        map(
            p +
            k.xyy *
            epsilon
        ) +

        k.yyx *
        map(
            p +
            k.yyx *
            epsilon
        ) +

        k.yxy *
        map(
            p +
            k.yxy *
            epsilon
        ) +

        k.xxx *
        map(
            p +
            k.xxx *
            epsilon
        );


    return n /
        max(
            length(n),
            1e-7
        );
}


// ============================================================
// ENVIRONMENT
// ============================================================

// Low-frequency deep-ocean / deep-space environment.
//
// Used both as the visible background and as reflected light on
// the translucent membrane.
vec3 environment(vec3 direction)
{
    vec3 color =
        mix(
            vec3(
                .0012,
                .0025,
                .007
            ),
            vec3(
                .004,
                .017,
                .032
            ),
            smoothstep(
                -.5,
                .9,
                direction.y
            )
        );


    color +=
        vec3(
            .018,
            .065,
            .09
        ) *
        pow(
            max(
                direction.y,
                0.0
            ),
            3.0
        );


    color +=
        vec3(
            .012,
            .004,
            .02
        ) *
        exp(
            -length(
                direction.xz -
                vec2(
                    -.6,
                    -.5
                )
            ) *
            2.0
        );


    return color;
}


// ============================================================
// BACKGROUND
// ============================================================

vec3 background(
    vec3 rayOrigin,
    vec3 direction
)
{
    vec3 color =
        environment(direction);


    // Very subtle procedural volumetric-looking beam.
    float beam =
        pow(
            .5 +
            .5 *
            sin(
                direction.x * 8.0 +
                sin(
                    direction.z * 5.0 +
                    phase
                ) *
                .9 +
                direction.y * 2.0
            ),
            14.0
        ) *
        smoothstep(
            0.0,
            .9,
            direction.y
        );


    color +=
        vec3(
            .010,
            .035,
            .05
        ) *
        beam;


    // Sparse particles distributed on distant spherical shells.
    //
    // They are anchored in world space behind the creature rather
    // than composited directly over it.
    //
    // Using 3D cells instead of latitude/longitude coordinates
    // avoids particle compression near sphere poles.
    for (int i = 0; i < 3; i++)
    {
        float shellRadius =
            3.4 +
            float(i) *
            1.9;


        vec3 offset =
            rayOrigin -
            CENTER;


        float b =
            dot(
                offset,
                direction
            );


        float c =
            dot(
                offset,
                offset
            ) -
            shellRadius *
            shellRadius;


        float h =
            b * b -
            c;


        if (h < 0.0)
            continue;


        vec3 q =
            normalize(
                offset +
                direction *
                (
                    -b +
                    sqrt(h)
                )
            );


        q.xz =
            rotation(
                .035 *
                sin(
                    phase +
                    float(i) *
                    2.0
                )
            ) *
            q.xz;


        vec3 grid =
            q *
            9.0 *
            (
                1.0 +
                .3 *
                float(i)
            );


        vec3 cellId =
            floor(grid);

        vec3 local =
            fract(grid) -
            .5;


        vec2 hashA =
            hash22(
                cellId.xy +
                cellId.z *
                7.31 +
                float(i) *
                17.0
            );


        vec2 hashB =
            hash22(
                cellId.zx +
                3.7
            );


        vec3 particleOffset =
            local -
            (
                vec3(
                    hashA,
                    hashB.x
                ) -
                .5
            ) *
            .6;


        // Project onto the tangent plane of the shell.
        particleOffset -=
            dot(
                particleOffset,
                q
            ) *
            q;


        float active =
            step(
                .86,
                hashB.y
            );


        color +=
            vec3(
                .25,
                .55,
                .7
            ) *
            active *
            exp(
                -dot(
                    particleOffset,
                    particleOffset
                ) *
                900.0
            ) *
            (
                .25 +
                .75 *
                hashA.y
            ) *
            .26;
    }


    return color * uBackground;
}


// ============================================================
// MEMBRANE ENERGY FLOW
// ============================================================
//
// The phase-dependent light pattern uses topology coordinates
// rather than ordinary world-space UVs.
//
// This preserves continuity across the Klein bottle's orientation
// reversal.
// ============================================================

float flow(
    float u,
    float v
)
{
    float frequency =
        harmonic(
            uFlowFrequency
        );

    float speed =
        harmonic(
            uFlowSpeed
        );


    // Time warp tied to the swim pulse.
    //
    // Energy accelerates during contraction and drifts during
    // relaxation, but the full motion still contains an integer
    // number of cycles per render loop.
    float count =
        pulseCount();

    float theta =
        phase *
        count;


    float warpedPhase =
        (
            theta +
            .85 *
            min(
                uPulseAmount,
                1.0
            ) *
            sin(
                theta -
                .7
            )
        ) /
        count *
        speed;


    float wave =
        cos(
            frequency *
            u +
            1.5 *
            cos(
                2.0 *
                v
            ) -
            warpedPhase
        );


    return pow(
        .5 +
        .5 *
        wave,
        12.0
    );
}


// ============================================================
// MATERIAL SHADING
// ============================================================

vec4 shade(
    vec3 p,
    vec3 normal,
    vec3 rayDirection,
    float material,
    float u,
    float v,
    float tip
)
{
    // Always orient the shading normal toward the viewer.
    // Important because the immersed surface has no globally
    // consistent inside / outside orientation.
    vec3 facingNormal =
        dot(
            normal,
            rayDirection
        ) > 0.0
            ? -normal
            : normal;


    float facing =
        clamp(
            dot(
                facingNormal,
                -rayDirection
            ),
            0.0,
            1.0
        );


    float fresnel =
        pow(
            1.0 -
            facing,
            2.6
        );


    vec3 lightDirection =
        normalize(
            vec3(
                -.45,
                .85,
                .55
            )
        );


    float diffuse =
        max(
            dot(
                facingNormal,
                lightDirection
            ),
            0.0
        );


    float specular =
        pow(
            max(
                dot(
                    facingNormal,
                    normalize(
                        lightDirection -
                        rayDirection
                    )
                ),
                0.0
            ),
            90.0
        );


    // Original membrane palette retained.
    vec3 pearl =
        vec3(
            .66,
            .68,
            .80
        );

    vec3 dark =
        vec3(
            .005,
            .010,
            .028
        );


    // Cyan ↔ violet energy gradient.
    vec3 glowColor =
        mix(
            vec3(
                .10,
                .75,
                1.0
            ),
            vec3(
                .55,
                .25,
                1.0
            ),
            .5 +
            .5 *
            cos(
                2.0 *
                v
            )
        );


    float veins =
        pow(
            .5 +
            .5 *
            cos(
                12.0 * u +
                3.0 *
                cos(
                    2.0 *
                    v
                ) +
                .3 *
                sin(phase)
            ),
            16.0
        );


    float flowPulse =
        flow(
            u,
            v
        );


    // Contraction also boosts internal bioluminescence.
    float emission =
        uEmissionStrength *
        (
            1.0 +
            .45 *
            gPulse
        );


    // --------------------------------------------------------
    // MEMBRANE MATERIAL
    // --------------------------------------------------------

    vec3 color =
        mix(
            dark,
            pearl * .5,
            .30 +
            .18 *
            cos(
                2.0 *
                v
            )
        ) *
        (
            .10 +
            .85 *
            diffuse
        );


    color +=
        vec3(
            .8,
            .9,
            1.0
        ) *
        specular *
        .65;


    // Environment reflection gives the transparent membrane
    // readable edges against the dark background.
    color +=
        environment(
            reflect(
                rayDirection,
                facingNormal
            )
        ) *
        3.5 *
        fresnel *
        uFresnelStrength;


    // Internal bioluminescent patterns.
    color +=
        glowColor *
        (
            .12 +
            .60 *
            flowPulse +
            .15 *
            veins
        ) *
        emission;


    color +=
        vec3(
            .05,
            .35,
            .45
        ) *
        pow(
            max(
                dot(
                    rayDirection,
                    lightDirection
                ),
                0.0
            ),
            3.0
        ) *
        .55;


    float alpha =
        clamp(
            uMembraneOpacity *
            (
                .55 +
                .8 *
                fresnel
            ) +
            .08 *
            veins,
            .12,
            .82
        );


    // --------------------------------------------------------
    // TENTACLE MATERIAL
    // --------------------------------------------------------

    if (
        material > 1.5 &&
        material < 2.5
    )
    {
        // One luminous packet travels from root to tip during
        // each swim stroke.
        float packetPosition =
            -.35 +
            1.7 *
            fract(
                phase *
                pulseCount() /
                TAU -
                .04
            );


        float packet =
            exp(
                -(
                    tip -
                    packetPosition
                ) *
                (
                    tip -
                    packetPosition
                ) *
                40.0
            );


        color =
            vec3(
                .34,
                .30,
                .40
            ) *
            (
                .25 +
                .6 *
                diffuse
            ) +

            vec3(
                .12,
                .45,
                .6
            ) *
            fresnel *
            1.1 +

            vec3(
                .5,
                .7,
                .9
            ) *
            specular *
            .4;


        color +=
            mix(
                vec3(
                    .1,
                    .8,
                    1.0
                ),
                vec3(
                    .8,
                    .2,
                    .9
                ),
                tip
            ) *
            packet *
            .75 *
            emission;


        // Tentacles fade toward translucent tips.
        alpha =
            mix(
                .80,
                .20,
                tip
            );
    }


    // --------------------------------------------------------
    // ENERGY FILAMENT MATERIAL
    // --------------------------------------------------------

    if (material > 2.5)
    {
        color =
            glowColor *
            (
                .22 +
                .65 *
                flowPulse
            ) *
            emission *
            (
                .6 +
                .5 *
                uBloomStrength
            );

        alpha = .34;
    }


    // Mild distance attenuation.
    color *=
        exp(
            -length(p) *
            .035
        );


    return vec4(
        color,
        alpha
    );
}


// ============================================================
// FILMIC TONEMAPPING
// ============================================================
//
// Compact ACES-inspired curve.
//
// Prevents the cyan / violet emissions from clipping too harshly
// before gamma encoding.
// ============================================================

vec3 film(vec3 color)
{
    return clamp(
        (
            color *
            (
                2.51 *
                color +
                .03
            )
        ) /
        (
            color *
            (
                2.43 *
                color +
                .59
            ) +
            .14
        ),
        0.0,
        1.0
    );
}


// ============================================================
// MAIN
// ============================================================

void main()
{
    // --------------------------------------------------------
    // LOOP PHASE
    // --------------------------------------------------------

    float t =
        fract(
            uTimeSeconds *
            max(
                uLoopSpeed,
                0.0
            ) /
            LOOP_SECONDS
        );


#ifdef DEBUG_T
    // Freeze animation at a normalized phase for debugging.
    t = DEBUG_T;
#endif


    phase =
        t *
        TAU;


    // Primary contraction and delayed upward response.
    gPulse =
        pulseAt(
            phase
        );

    gRise =
        pulseAt(
            phase -
            .9
        );


    // --------------------------------------------------------
    // PRECOMPUTE TENTACLE ROOTS
    // --------------------------------------------------------

    float tentacleCount =
        clamp(
            floor(
                uTentacleCount +
                .5
            ),
            8.0,
            16.0
        );


    for (
        int i = 0;
        i < MAX_TENTACLES;
        i++
    )
    {
        gRoots[i] =
            float(i) < tentacleCount

                ? tentacleRoot(
                    float(i),
                    tentacleCount
                )

                : vec3(0.0);
    }


    // --------------------------------------------------------
    // CAMERA
    // --------------------------------------------------------

    vec2 resolution =
        uTDOutputInfo.res.zw;


    // Cosine-based orbital motion begins and ends with zero
    // angular velocity, which helps hide the loop seam.
    float orbit =
        radians(
            clamp(
                uCameraOrbit,
                0.0,
                35.0
            )
        ) *
        .5 *
        (
            1.0 -
            cos(phase)
        );


    vec3 target =
        vec3(
            .10,
            -1.05,
            0.0
        );


    // Fit the complete creature inside the narrow portrait width
    // without changing the actual output dimensions.
    float aspect =
        resolution.x /
        resolution.y;


    float tanHalfFov =
        tan(
            radians(34.0) *
            .5
        );


    float cameraDistance =
        max(
            5.0,
            1.95 /
            max(
                aspect *
                tanHalfFov,
                .10
            )
        ) *
        max(
            uCameraDistance,
            .4
        ) *
        (
            1.0 -
            .035 *
            (
                .5 -
                .5 *
                cos(phase)
            )
        );


    vec3 eye =
        target +
        vec3(
            sin(orbit) *
            cameraDistance,

            .20 +
            .04 *
            sin(phase),

            cos(orbit) *
            cameraDistance
        );


    vec3 forward =
        normalize(
            target -
            eye
        );


    vec3 right =
        normalize(
            cross(
                forward,
                vec3(
                    0.0,
                    1.0,
                    0.0
                )
            )
        );


    vec3 up =
        cross(
            right,
            forward
        );


    // Portrait-safe screen coordinates.
    vec2 uv =
        (
            vUV.st -
            .5
        ) *
        vec2(
            aspect,
            1.0
        ) *
        2.0;


    vec3 rayDirection =
        normalize(
            forward +
            (
                uv.x *
                right +
                uv.y *
                up
            ) *
            tanHalfFov
        );


    // --------------------------------------------------------
    // MULTI-LAYER RAYMARCHING
    // --------------------------------------------------------

    vec3 accumulatedColor =
        vec3(0.0);


    vec3 rayOrigin =
        eye;


    vec3 direction =
        rayDirection;


    // Remaining transmittance.
    float transmittance =
        1.0;


    // Distance from current ray origin.
    float rayTravel =
        0.0;


    // Total travel accumulated across refracted layers.
    float totalTravel =
        0.0;


    float hitMask =
        0.0;


    // Tracks closest non-background approach for cheap bloom.
    float minimumDistance =
        1e4;


    int layers =
        0;


    bool outside =
        true;


    for (
        int i = 0;
        i < MAX_STEPS;
        i++
    )
    {
        vec3 p =
            rayOrigin +
            direction *
            rayTravel;


        float distanceToSurface =
            map(p);


        float totalDistance =
            totalTravel +
            rayTravel;


        // Increase epsilon slightly with distance to reduce
        // unnecessary far-field precision.
        float epsilon =
            max(
                .0003,
                .00015 *
                totalDistance
            );


        // ----------------------------------------------------
        // SURFACE HIT
        // ----------------------------------------------------

        if (
            outside &&
            distanceToSurface <
            epsilon
        )
        {
            // Preserve material metadata before normalAt()
            // calls map() several more times.
            float material =
                gMat;

            float surfaceU =
                gU;

            float surfaceV =
                gV;

            float tentacleTip =
                gTip;


            vec3 normal =
                normalAt(
                    p,
                    .0008
                );


            vec4 surface =
                shade(
                    p,
                    normal,
                    direction,
                    material,
                    surfaceU,
                    surfaceV,
                    tentacleTip
                );


            hitMask =
                max(
                    hitMask,
                    step(
                        .05,
                        surface.a
                    )
                );


            // Depth-dependent environmental haze.
            surface.rgb =
                mix(
                    surface.rgb,
                    environment(direction) *
                    uBackground,
                    1.0 -
                    exp(
                        -totalDistance *
                        .035
                    )
                );


            // Front-to-back alpha compositing.
            accumulatedColor +=
                transmittance *
                surface.a *
                surface.rgb;


            transmittance *=
                1.0 -
                surface.a;


            layers++;


            // Stop once additional transparent layers can no
            // longer contribute meaningfully.
            if (
                transmittance < .02 ||
                layers >= MAX_LAYERS
            )
            {
                break;
            }


            // Orient normal toward incoming ray before applying
            // refraction.
            vec3 facingNormal =
                dot(
                    normal,
                    direction
                ) > 0.0
                    ? -normal
                    : normal;


            vec3 refracted =
                normalize(
                    mix(
                        direction,
                        refract(
                            direction,
                            facingNormal,
                            .9
                        ),
                        clamp(
                            uRefractionAmount,
                            0.0,
                            .05
                        )
                    )
                );


            totalTravel +=
                rayTravel;


            rayOrigin =
                p;


            direction =
                refracted;


            // Push the new ray slightly beyond the surface to
            // prevent immediately hitting the same layer again.
            rayTravel =
                .025;


            outside =
                false;


            continue;
        }


        // Once sufficiently far from a previous surface, allow
        // another entry intersection.
        if (
            distanceToSurface >
            epsilon * 2.0
        )
        {
            outside =
                true;
        }


        // Before the first actual layer hit, use closest approach
        // to generate a soft in-shader glow around the creature.
        //
        // The coarse bounding proxy is ignored by requiring a
        // valid creature material.
        if (
            layers == 0 &&
            gMat > .5
        )
        {
            float haloDistance =
                max(
                    distanceToSurface,
                    0.0
                );


            // Thin tentacle tips would otherwise generate halos
            // as strongly as the much larger membrane.
            if (
                gMat > 1.5 &&
                gMat < 2.5
            )
            {
                haloDistance *=
                    mix(
                        2.0,
                        8.0,
                        gTip
                    );
            }


            minimumDistance =
                min(
                    minimumDistance,
                    haloDistance
                );
        }


        // Conservative marching because membrane() is an
        // approximate distance estimator rather than an exact SDF.
        rayTravel +=
            max(
                abs(
                    distanceToSurface
                ),
                epsilon *
                .8
            );


        // Far clipping.
        if (
            totalTravel +
            rayTravel >
            cameraDistance +
            6.0
        )
        {
            break;
        }
    }


    // --------------------------------------------------------
    // BACKGROUND COMPOSITION
    // --------------------------------------------------------

    accumulatedColor +=
        transmittance *
        background(
            rayOrigin,
            direction
        );


    // Cheap bloom-like halo.
    //
    // Keeping this in-shader means the artwork remains usable
    // even when no dedicated post-processing bloom stage exists.
    accumulatedColor +=
        mix(
            vec3(
                .10,
                .75,
                1.0
            ),
            vec3(
                .55,
                .25,
                1.0
            ),
            .5
        ) *
        transmittance *
        (
            .085 *
            exp(
                -minimumDistance *
                24.0
            ) +

            .018 *
            exp(
                -minimumDistance *
                7.0
            )
        ) *
        uBloomStrength;


    vec3 color =
        accumulatedColor;


    // --------------------------------------------------------
    // VIGNETTE
    // --------------------------------------------------------

    color *=
        1.0 -
        .22 *
        smoothstep(
            .6,
            1.6,
            length(
                uv *
                vec2(
                    1.0,
                    .8
                )
            )
        );


#ifdef DEBUG_MASK
    // Binary creature hit visualization.
    fragColor =
        TDOutputSwizzle(
            vec4(
                vec3(hitMask),
                1.0
            )
        );

    return;
#endif


    // --------------------------------------------------------
    // TONEMAP + GAMMA
    // --------------------------------------------------------

    color =
        pow(
            film(
                max(
                    color,
                    0.0
                ) *
                max(
                    uExposure,
                    0.0
                )
            ),
            vec3(
                1.0 /
                2.2
            )
        );


    // --------------------------------------------------------
    // OUTPUT DITHER
    // --------------------------------------------------------
    //
    // Small triangular dither reduces visible 8-bit banding in
    // the dark gradients before Instagram's H.264 re-encode.
    //
    // This is particularly useful for the nearly-black cyan
    // background used by this artwork.
    // --------------------------------------------------------

    vec2 ditherHash =
        hash22(
            gl_FragCoord.xy
        );


    color +=
        (
            ditherHash.x +
            ditherHash.y -
            1.0
        ) /
        255.0;


    // TouchDesigner-safe final output.
    fragColor =
        TDOutputSwizzle(
            vec4(
                color,
                1.0
            )
        );
}
