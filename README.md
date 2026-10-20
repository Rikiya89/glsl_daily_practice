# GLSL Daily Practice

**[English](./README.md) | [日本語](./README.ja.md)**

A collection of real-time **GLSL fragment shader studies for TouchDesigner**, exploring the intersection of mathematics, procedural art, and creative technology.

Maintained by **Rikiya Okawa**. The work progresses from 2D pattern experiments to raymarched 3D forms, procedural organisms, and short loopable animations designed with vertical video in mind.

> **Snapshot — October 20, 2026:** 98 `.frag` studies across 2024–2026. “Daily” describes an ongoing practice, not a promise of daily commits.

## At a Glance

| | |
| --- | --- |
| **Primary tools** | TouchDesigner · GLSL · GLSL TOP |
| **Techniques** | Noise, FBM, domain warping, symmetry, SDFs, raymarching, procedural lighting |
| **Recent direction** | Procedural creatures, mathematical surfaces, seamless animation loops |
| **Formats** | Individual `.frag` shaders and a TouchDesigner `.toe` project |
| **Presentation** | Real-time output; selected 2026 studies are composed for 9:16 Instagram Reels |

These are graphics experiments and source-code studies, not a packaged application. Shader parameters, GPU cost, and supported output resolutions vary by file.

## Featured Recent Studies

| Study | Source | Focus |
| --- | --- | --- |
| **Fractal Blue Dragon** · Oct 20, 2026 | [`20261020.frag`](./2026/10_October/20261020.frag) | Recursive distance-field branches, a blue-dragon-inspired creature, 8-second animation loop |
| **Gyroid Manta Ray** · Oct 13, 2026 | [`20261013.frag`](./2026/10_October/20261013.frag) | Gyroid lattice anatomy, raymarching, 10-second animation loop |
| **Klein Bottle Jellyfish** · Oct 5, 2026 | [`20261005.frag`](./2026/10_October/20261005.frag) | Klein-bottle-inspired topology, procedural jellyfish, 10-second animation loop |
| **Nautilus — Reaction Diffusion** · Sep 29, 2026 | [`20260929.frag`](./2026/09_September/20260929.frag) | Log-spiral shell, procedural reaction–diffusion-like patterns, layered rendering |
| **Mandala Quasicrystal** · Aug 19, 2025 | [`20250819.frag`](./2025/08_August/20250819.frag) | Kaleidoscopic symmetry, smoothly changing segments, procedural shading |

The file headers document each experiment’s controls, animation duration, and intended output. Loop duration and vertical-video framing are **shader-specific**, not repository-wide defaults.

## Repository Structure

```text
.
├── 2024/                      # 14 early studies, sequentially named
├── 2025/                      # 36 studies, organized by month
├── 2026/                      # 48 studies, organized by month
├── toe/
│   └── 20261020.toe          # TouchDesigner project
├── README.md                  # English
├── README.ja.md               # 日本語
└── LICENSE                   # MIT
```

Shader filenames are date-based in the 2025 and 2026 directories; for example, `2026/10_October/20261020.frag`. The 2024 studies use sequential names such as `2024/202401.frag`.

## Getting Started in TouchDesigner

**Requirements:** A TouchDesigner installation with **GLSL TOP** and a compatible GPU/graphics driver. A recent TouchDesigner build is recommended; `.toe` compatibility depends on the version used to save the project. There is no Node.js install or build step for the shader files.

**Option A — Open the project**

Open [`toe/20261020.toe`](./toe/20261020.toe) in TouchDesigner. If the file requires a newer build, or you prefer a minimal setup, use Option B.

**Option B — Load an individual shader**

1. Create a **GLSL TOP** in TouchDesigner.
2. Create a **Text DAT** or **File In DAT** and paste/load a `.frag` file.
3. Set that DAT as the GLSL TOP's **Pixel Shader**.
4. Choose the output resolution on the GLSL TOP's **Common** page.
5. Review the shader's declared uniforms and bind any required values on the **Uniforms** page.
6. Check shader compile errors and the file header before adjusting controls or resolution.

For animated studies, a time uniform can generally be driven with the TouchDesigner expression `absTime.seconds`. The **uniform name must match the source file exactly**:

| In shader | Typical value |
| --- | --- |
| `uTimeSeconds` (many 2026 files) | Float: `absTime.seconds` |
| `uTime` or `u_time` (earlier files) | Float: `absTime.seconds` |
| `uResolution` or `u_resolution` (when declared) | Vec2: GLSL TOP width and height |
| `uAudio` (when declared) | Optional normalized audio signal, typically 0–1 |

For a GLSL TOP named `glsl1`, the corresponding dimension expressions are `op('glsl1').width` and `op('glsl1').height`. Some newer shaders read resolution directly from TouchDesigner's built-in `uTDOutputInfo.res.zw`, so they **do not need** a separate custom resolution uniform.

**Important:** Declaring a uniform in GLSL does not configure its TouchDesigner value for you. Add/bind custom uniforms as required by the shader; an unbound time uniform may leave an animated work static.

### Inline vs. External Controls

Several recent shaders define:

```glsl
#define EXTERNAL_CONTROLS 0
```

With `0`, `CONTROL(...)` values are compile-time constants that can be edited in the shader source. Switch to `1` **only after** you have configured matching TouchDesigner uniforms for every required control. The time uniform (for example, `uTimeSeconds`) still needs its own binding.

Some shaders write `TDOutputSwizzle(vec4(...))`; this is TouchDesigner-specific and needs adaptation when porting to other GLSL hosts. Other files use `gl_FragCoord`, `vUV`, or host-defined output information. Read the individual source instead of assuming a single uniform or coordinate convention.

## Creative and Technical Focus

- **Procedural geometry:** signed-distance fields, raymarching, repeating forms, recursive structures, and mathematical surfaces.
- **Pattern systems:** noise, FBM, domain warping, kaleidoscopes, mandalas, and quasicrystal-inspired symmetry.
- **Appearance:** procedural materials, surface normals, Fresnel lighting, glow, and tone mapping.
- **Motion:** periodic functions, camera movement, and shader-specific seamless loops.
- **Presentation:** selected 2026 shaders target portrait compositions such as 1080 × 1920; actual resolution and frame rate are controlled by the TouchDesigner project, not by these source files.

Complex raymarched shaders can be GPU-intensive. If playback is slow, test at a lower TOP resolution and review the file's iteration or quality constants before changing its visual design.

## Portability

Core GLSL math can be adapted for other environments, including Unity/HLSL, but these files are written primarily for **TouchDesigner GLSL TOP**. A port may require changes to uniforms, screen coordinates, texture inputs, the output function, and GLSL-specific built-ins.

## References

- [TouchDesigner — GLSL TOP](https://docs.derivative.ca/GLSL_TOP)
- [The Book of Shaders](https://thebookofshaders.com/)
- [Khronos — OpenGL Shading Language](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)

## License

Released under the [MIT License](./LICENSE). Original shader studies and visual experiments by **Rikiya Okawa**.
