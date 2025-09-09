Recruiter Summary / 採用向けサマリー

- What / 何: Real‑time GLSL fragment shaders for TouchDesigner (GLSL TOP) / TouchDesigner 向けリアルタイム GLSL フラグメントシェーダ
- Signals / アピール: Procedural (FBM, noise, domain warping), symmetry (kaleidoscope, mandala), shading (normals, rim/spec), performance awareness
- How to view / 実行: GLSL TOP → set Pixel Shader to any `.frag`; set `u_time` or `uTime` = `absTime.seconds`, `u_resolution` or `uResolution` = TOP size; optional `uAudio`
- Highlights / 見どころ: `2025/08_August/20250819.frag` (smooth segment‑morph mandala), `2025/07_July/20250704.frag` (layered FBM, multi‑rate motion)
- Ready / 即利用: Standalone, no external textures; date‑named files
- Portability / 移植性: Logic ports cleanly to Unity/HLSL
- Cadence / 更新: Regular updates; new date‑named `.frag` added periodically / 定期的に更新、日付付き `.frag` を適宜追加
- Includes .toe / .toe 同梱: Current (TD 2023) and Experimental (TD 2025)

---

TouchDesigner GLSL Practice (2024–2025)

- Real‑time fragment shader studies built for TouchDesigner’s GLSL TOP
- Each `.frag` is standalone and named by date (e.g. `2025/08_August/20250819.frag`)
- No external textures; purely procedural visuals (noise, symmetry, SDF‑style fields)

Who This Repo Serves

- Human Resources: quick proof of consistent practice and output over time
- TouchDesigner engineers: ready‑to‑drop pixel shaders for GLSL TOP
- Unity/graphics engineers: portable GLSL patterns (noise, folds, kaleidoscope, tone mapping)

Repo Structure

- `2024/` — monthly shader fragments from 2024 (single folder of `.frag` files)
- `2025/` — organized per month (e.g. `03_March/20250324.frag`)

Provided .toe Projects

- `toe/20250909_2023.12370.toe` — current/stable build (open with TouchDesigner 2023.12370 or newer in the 2023 series)
- `toe/20250909_2025.30770.toe` — experimental build (open with TouchDesigner 2025.30770 or newer in the 2025 series)
- If your TD build is older, open the `.toe` with the matching build, or create a fresh GLSL TOP and load a `.frag` directly.

Update Cadence / 更新方針

- Regular GLSL practice in 2025; new date‑named `.frag` added periodically (not strictly daily).
- Naming: `YYYY/MM_Month/YYYYMMDD.frag` (e.g. `2025/08_August/20250819.frag`).
- Each shader is standalone; older files are not broken by new additions.
- Commit messages typically: `Add shader: YYYYMMDD` for easy history scanning.
- Next steps: more audio‑reactive variants, Unity/HLSL ports, sample `.toe` project.

Requirements

- TouchDesigner: 2022.3+ recommended (GLSL TOP)
- GPU: OpenGL 3.3+ capable (most modern GPUs are fine)

Quick Start (TouchDesigner)

- Create a GLSL TOP.
- Create a Text DAT (or File In DAT) and paste/open any `.frag` from this repo.
- On the GLSL TOP, set `Pixel Shader` to the DAT you just created.
- Set output resolution on the GLSL TOP’s Common page (e.g. 1920×1080).
- On the GLSL TOP’s Uniforms page, set uniforms if they appear in the shader:
  - Time: `u_time` or `uTime` → expression `absTime.seconds`
  - Resolution: `u_resolution` or `uResolution` (vec2) → set the two fields to your TOP’s size, e.g. `op('glsl1').width` and `op('glsl1').height` if your GLSL TOP is named `glsl1`
  - Optional audio: `uAudio` (0..1) → feed a CHOP channel (e.g. Analyze/Math of `Audio Device In`) into the parameter by dragging the channel onto the uniform

Notes

- Files mix two uniform naming styles (`u_time`/`u_resolution` and `uTime`/`uResolution`). Use what each file declares; TouchDesigner will auto‑expose them on the Uniforms page.
- Some shaders write to `fragColor` directly; others use `TDOutputSwizzle(...)`. Both compile in GLSL TOP.
- Shaders assume normalized coordinates based on `gl_FragCoord` and the provided resolution.

Browsing Suggestions

- Duplicate a GLSL TOP + DAT pair per shader you want to compare, or reuse one GLSL TOP and hot‑swap the DAT’s file path.
- Keep the TOP resolution consistent while switching files so visual scale remains predictable.

What To Look For (Skills Signal)

- Procedural design: FBM, value noise, domain warping, field combinations
- Symmetry systems: kaleidoscope folds, “mandala” spokes, smooth segment morphs
- Shading: normals from height fields, rim/spec, tone curves, dithering, vignette
- Performance awareness: branch‑light loops, small kernels, packed operations

Porting Notes (Unity/HLSL)

- Replace `gl_FragCoord` with interpolants (e.g. `i.screenPos`/`i.uv * _Resolution`), provide `_Resolution` and `_Time`/custom time.
- Output via `float4 frag(...) : SV_Target` and use HLSL equivalents of GLSL functions.
- Most logic (noise, fbm, folds) ports directly; be mindful of `atan`/`mod` semantics and saturate/clamp differences.

Contact

- For questions or collaboration: open an issue or reach out directly.

---

日本語版（クリエイティブテクノロジー向け）

概要

- TouchDesigner の GLSL TOP 向けに作成したリアルタイム・フラグメントシェーダの習作集です。
- それぞれの `.frag` は単体で動作し、日付でリネームされています（例: `2025/08_August/20250819.frag`）。
- 外部テクスチャは使用せず、ノイズ／シンメトリ折り畳み／距離場などによる純粋なプロシージャル表現です。

想定読者（アピール対象）

- 人事・採用担当：継続的な制作とアウトプットの可視化
- TouchDesigner エンジニア：GLSL TOP にそのまま貼れるピクセルシェーダ
- Unity / グラフィックスエンジニア：ノイズ、折り畳み、カレイド、トーンマップ等の移植しやすいGLSLパターン

リポジトリ構成

- `2024/` — 2024年のシェーダ（`.frag` を1フォルダに配置）
- `2025/` — 月別に整理（例: `03_March/20250324.frag`）

同梱 .toe プロジェクト

- `toe/20250909_2023.12370.toe` — 現行（安定）ビルド向け（TouchDesigner 2023.12370 以降の 2023 系で開いてください）
- `toe/20250909_2025.30770.toe` — Experimental ビルド向け（TouchDesigner 2025.30770 以降の 2025 系で開いてください）
- 旧い TD では開けない場合があります。該当バージョンで開くか、GLSL TOP を新規作成して `.frag` を直接ロードしてください。

更新方針（Cadence）

- 2025年は定期的に更新。日付付き `.frag` を適宜追加します（毎日更新ではありません）。
- 命名規則: `YYYY/MM_Month/YYYYMMDD.frag`（例: `2025/08_August/20250819.frag`）。
- 既存ファイルは破壊的に変更しません（各 `.frag` は単体で動作）。
- コミットメッセージの基本形: `Add shader: YYYYMMDD`（履歴の視認性向上）。
- 今後の予定: オーディオリアクティブの拡充、Unity/HLSL への移植、サンプル `.toe` の用意。

動作要件

- TouchDesigner 2022.3 以降推奨（GLSL TOP）
- OpenGL 3.3 以上に対応したGPU

クイックスタート（TouchDesigner）

- GLSL TOP を作成。
- Text DAT（または File In DAT）を作成し、任意の `.frag` を貼り付け／参照。
- GLSL TOP の `Pixel Shader` にその DAT を指定。
- GLSL TOP の `Common` ページで出力解像度（例: 1920×1080）を設定。
- GLSL TOP の `Uniforms` ページで、シェーダに応じて以下を設定：
  - 時間: `u_time` または `uTime` → 式に `absTime.seconds`
  - 解像度: `u_resolution` または `uResolution`（vec2）→ それぞれ `op('glsl1').width` / `op('glsl1').height`（GLSL TOP 名が `glsl1` の場合）
  - 任意のオーディオ入力: `uAudio`（0..1）→ `Audio Device In CHOP` → `Analyze/Math` などで正規化し、Uniform にチャンネルをドラッグ＆ドロップ

補足

- ファイルによって `u_time`/`u_resolution` と `uTime`/`uResolution` が混在します。宣言されている名前に合わせて設定してください（Uniforms ページに自動的に出現します）。
- 出力は `fragColor` に直接代入するものと、`TDOutputSwizzle(...)` を使うものがあり、いずれも GLSL TOP で動作します。
- 多くのシェーダは `gl_FragCoord` ベースで正規化座標を計算します。TOP の解像度を変えると見え方（スケール）が変わります。

閲覧のコツ

- 比較したい場合は、GLSL TOP + DAT のペアを複製するか、1つの GLSL TOP に対して DAT のファイルパスだけ差し替える運用が手軽です。
- シェーダを切り替える際は、TOP の解像度を固定しておくとスケール差が出にくくなります。

見どころ（スキルのシグナル）

- プロシージャル生成：FBM、バリューノイズ、ドメインワーピング、複数フィールドの合成
- シンメトリ：カレイドスコープ折り畳み、放射状スポーク、連続セグメントモーフ
- 簡易ライティング：高さ場からの法線、リムライト、スペキュラ、トーンカーブ、ディザ、ビネット
- パフォーマンス配慮：軽量ループ、小カーネル、条件分岐の最小化

移植の目安（Unity/HLSL）

- `gl_FragCoord` は頂点からの補間値（`i.uv` など）に置き換え、`_Resolution` と `_Time`（または任意の時間 Uniform）を自前で供給。
- 出力は `float4 frag(...) : SV_Target`。GLSL 関数は HLSL 相当へ置き換え（`saturate`/`clamp` や `mod` の挙動差に注意）。
- ノイズ／FBM／折り畳みなどのロジックは概ねそのまま移植可能です。

連絡先

- コラボやご質問は Issue を作成いただくか、直接ご連絡ください。
