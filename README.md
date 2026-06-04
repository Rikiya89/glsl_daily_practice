# glsl_daily_practice

Real-time GLSL fragment shader studies for TouchDesigner.

This repository is a collection of standalone `.frag` shaders created as regular GLSL practice. The sketches explore procedural visuals, noise, FBM, domain warping, symmetry, SDF-style fields, shading, and real-time visual effects.

Most shaders are designed for TouchDesigner’s GLSL TOP and can be loaded directly as pixel shaders.

## Recruiter Summary

* **What:** Real-time GLSL fragment shaders for TouchDesigner GLSL TOP
* **Focus:** Procedural visuals, FBM, noise, domain warping, kaleidoscope symmetry, mandala structures, and shader-based lighting
* **Execution:** Standalone `.frag` files, named by date
* **Tools:** TouchDesigner, GLSL TOP, fragment shaders
* **Portability:** Shader logic can be adapted to Unity / HLSL
* **Cadence:** Updated regularly with new date-named shader studies

## Overview

This repository focuses on:

* GLSL fragment shaders
* TouchDesigner GLSL TOP experiments
* Procedural generative visuals
* Noise, FBM, and domain warping
* Kaleidoscope and mandala-like symmetry
* SDF-style visual fields
* Height-field normals and simple lighting
* Real-time graphics studies
* Portable shader logic for Unity / HLSL

## Repository Structure

```txt
.
├── 2024/              # Shader studies from 2024
├── 2025/              # Month-based shader studies from 2025
├── toe/               # TouchDesigner project files
├── README.md
├── LICENSE
└── .gitattributes
```

Example shader path:

```txt
2025/08_August/20250819.frag
```

## Provided TouchDesigner Project

```txt
toe/20251103_2025.31550.toe
```

This project is intended for TouchDesigner 2025.31550 or newer.

If the `.toe` file does not open correctly, create a fresh GLSL TOP and load a `.frag` shader manually.

## Requirements

Recommended environment:

* TouchDesigner 2025.31550 or newer
* GLSL TOP
* GPU with OpenGL 3.3+ support

## Quick Start

1. Create a **GLSL TOP** in TouchDesigner.
2. Create a **Text DAT** or **File In DAT**.
3. Paste or load any `.frag` file from this repository.
4. Assign the DAT to the GLSL TOP’s **Pixel Shader** parameter.
5. Set the output resolution from the GLSL TOP’s **Common** page.
6. Set uniforms if the shader requires them.

Common uniforms:

```txt
u_time / uTime              → absTime.seconds
u_resolution / uResolution  → TOP width and height
uAudio                      → normalized audio value, optional
```

Example resolution setup:

```txt
uResolution.x → op('glsl1').width
uResolution.y → op('glsl1').height
```

## Notes

Some shaders use `u_time` / `u_resolution`, while others use `uTime` / `uResolution`.

Use the uniform names declared inside each `.frag` file. TouchDesigner will expose them automatically on the GLSL TOP’s Uniforms page.

Some shaders output directly to `fragColor`, while others use `TDOutputSwizzle(...)`. Both styles are intended for GLSL TOP usage.

Most shaders use `gl_FragCoord` and resolution-based normalized coordinates, so the visual scale may change depending on the TOP resolution.

## Browsing Suggestions

To compare multiple shaders, duplicate a GLSL TOP + DAT pair for each shader.

For quick testing, reuse one GLSL TOP and swap the DAT file path.

Keeping the TOP resolution consistent makes visual comparison easier.

## Skills Covered

This repository demonstrates practice with:

* Fragment shader composition
* Procedural pattern generation
* FBM and value noise
* Domain warping
* Kaleidoscope folds
* Mandala-like symmetry
* Smooth segment morphing
* Height-field normals
* Rim light and specular effects
* Tone mapping and vignette
* Performance-conscious shader loops

## Porting Notes

Most shader logic can be ported to Unity / HLSL.

General conversion points:

* Replace `gl_FragCoord` with screen UVs.
* Replace GLSL uniforms with Unity shader properties.
* Use `_Time` or a custom time uniform.
* Output with `float4 frag(...) : SV_Target`.
* Check differences between GLSL and HLSL functions such as `mod`, `atan`, `clamp`, and `saturate`.

## References

Useful references for GLSL and TouchDesigner:

* [The Book of Shaders](https://thebookofshaders.com/)
* [TouchDesigner GLSL TOP Documentation](https://docs.derivative.ca/GLSL_TOP)
* [Khronos OpenGL Shading Language](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)

## 日本語概要

TouchDesigner の GLSL TOP 向けに作成した、リアルタイム・フラグメントシェーダの習作集です。

各 `.frag` ファイルは単体で動作し、日付付きで管理しています。ノイズ、FBM、ドメインワーピング、カレイドスコープ、マンデラ状のシンメトリ、SDF風のフィールド、簡易ライティングなどを使ったプロシージャル表現を中心に制作しています。

## 想定読者

* **採用担当者:** 継続的な制作とアウトプットの確認
* **TouchDesigner エンジニア:** GLSL TOP にそのまま読み込めるピクセルシェーダ
* **Unity / グラフィックスエンジニア:** Unity / HLSL へ移植しやすい GLSL パターンの参考

## クイックスタート

1. TouchDesigner で **GLSL TOP** を作成します。
2. **Text DAT** または **File In DAT** を作成します。
3. 任意の `.frag` ファイルを貼り付け、または読み込みます。
4. GLSL TOP の **Pixel Shader** にその DAT を指定します。
5. GLSL TOP の **Common** ページで出力解像度を設定します。
6. 必要に応じて **Uniforms** ページで値を設定します。

代表的な uniform:

```txt
u_time / uTime              → absTime.seconds
u_resolution / uResolution  → TOP の幅と高さ
uAudio                      → 0〜1 に正規化したオーディオ値
```

## 更新方針

2025年は定期的に更新しています。毎日更新ではありませんが、日付付きの `.frag` を継続的に追加しています。

命名例:

```txt
2025/08_August/20250819.frag
```

既存ファイルを壊さず、各シェーダを単体で確認できる形で管理しています。

## License

This repository is licensed under the MIT License.

Shader studies and original visual experiments are maintained by Rikiya Okawa.
