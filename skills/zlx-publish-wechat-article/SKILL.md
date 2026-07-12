---
name: zlx-publish-wechat-article
description: Generate a 2.35:1 square-safe cover, create 3-5 article illustrations with baoyu-slide-deck prompts and Image 2, insert the images and optional H2 headings without rewriting the source text, format the result for WeChat Official Accounts, and create or update a WeChat draft. Use when Codex is asked to prepare, typeset, illustrate, publish, or update a long-form WeChat Official Account article from Markdown or text.
---

# Publish WeChat Article

Turn a finished article into an illustrated, WeChat-compatible HTML article and upload it to the Official Account draft box. Keep the original body text unchanged; add only structural H2 headings, images, and optional image captions.

## Resolve paths

Treat this skill directory as `{baseDir}`. Run bundled scripts with:

```bash
node {baseDir}/scripts/<script-name>.mjs
```

Read [references/layout-plan.md](references/layout-plan.md) before composing the article. Invoke `$baoyu-slide-deck` for body-image prompts and `$imagegen` for Image 2 generation.

## Workflow

### 1. Prepare the workspace

Accept a Markdown or plain-text article path plus its title. Ask only for missing publication metadata that materially affects the result, such as author or digest.

Create `wechat-publish/<article-slug>/` in the current workspace with the layout described in `references/layout-plan.md`. Copy the input to `source.md`; never edit that copy. If the output directory already exists, create a timestamped sibling instead of overwriting it.

Analyze the article only to identify:

- its narrative or argument structure;
- 3-5 visually distinct illustration points, using 4 by default;
- suitable insertion block indexes;
- a consistent visual style;
- one central visual metaphor for the cover.

Do not summarize, rewrite, polish, shorten, expand, or reorder the body text.

### 2. Generate the cover

Invoke `$imagegen` using its built-in Image 2 path. Build a prompt that includes all of these constraints:

- final use: WeChat Official Account cover;
- final aspect ratio: exactly 2.35:1 after center cropping;
- place the complete main subject, facial features, key symbols, and semantic focus inside the centered square safe zone;
- use the left and right wings only for atmosphere, background, or secondary decoration;
- the centered square crop must remain a complete, independently understandable image;
- no watermark, logo, UI chrome, or accidental text;
- use title text only when the user explicitly requests text in the cover.

Save the generated source as `images/cover-source.png`, then run:

```bash
node {baseDir}/scripts/prepare-cover.mjs \
  --input images/cover-source.png \
  --output images/cover.png \
  --square-output images/cover-square-preview.png
```

Inspect both `cover.png` and `cover-square-preview.png`. Regenerate when the square preview cuts off or weakens the main subject. Never stretch an image to reach 2.35:1.

### 3. Generate 3-5 body-image prompts

Invoke `$baoyu-slide-deck` in prompts-only mode against `source.md`:

```text
$baoyu-slide-deck source.md --prompts-only --slides <3-5> --lang zh
```

Honor its required style, audience, outline-review, and prompt-review confirmations. The article's 3-5 image limit overrides the deck skill's normal slide-count recommendation.

Use one prompt for each chosen article section. Preserve the selected style instructions across all prompts. Adapt only the output-use constraints so the result is a WeChat article illustration rather than a presentation page:

- landscape editorial illustration, preferably 3:2;
- one clear idea per image;
- minimal or no embedded text;
- no slide number, footer, watermark, logo, or presentation chrome;
- leave enough breathing room for mobile reading.

Save the final prompts under `prompts/`.

### 4. Generate body images with Image 2

Invoke `$imagegen` with the built-in Image 2 path once per prompt. Use one independent image-generation call per distinct asset; do not use one call's variant count for unrelated prompts. Start independent calls in parallel when the tool runtime supports parallel calls.

Save the selected results as `images/01-<slug>.png` through `images/05-<slug>.png`. Inspect every image for semantic match, visual consistency, text artifacts, and mobile readability. Retry a failed or visibly unsuitable image once with a targeted prompt correction.

### 5. Compose WeChat HTML without changing the text

Create `layout.json` using the schema in `references/layout-plan.md`. Insert an optional H2 and one image before the corresponding original block. Prefer the rhythm "H2 → image → original text". Do not add headings mechanically when the source already has a clear heading.

Compose the HTML deterministically:

```bash
node {baseDir}/scripts/compose-wechat-html.mjs \
  --input source.md \
  --plan layout.json \
  --output article.html
```

This script renders the original blocks directly and only injects the plan's headings, images, and captions. Review `article.html` for image order, heading placement, paragraph spacing, lists, quotations, and code blocks. Do not hand-edit original sentences in the generated HTML.

Keep normal paragraph and list text at `16px`. Preserve the existing hierarchy for H2 headings, block quotes, code blocks, and image captions.

### 6. Dry-run the publication

Run the publisher without network mutation:

```bash
node {baseDir}/scripts/publish-wechat-article.mjs draft \
  --title "<article title>" \
  --html-file article.html \
  --cover-image images/cover.png \
  --author "<optional author>" \
  --digest "<optional digest>" \
  --dry-run
```

The publisher contains `WECHAT_APP_ID` and `WECHAT_APP_SECRET` constants at the top. Fill them locally, or set `WECHAT_APP_ID` and `WECHAT_APP_SECRET` in the environment. Never print either credential or the access token.

Show the user the dry-run summary: title, author, digest, body-image count, cover path, and whether this creates or updates a draft.

### 7. Confirm and create the draft

Creating or updating a WeChat draft is an external write. Ask for explicit confirmation after the dry-run and before removing `--dry-run`.

Create a new draft:

```bash
node {baseDir}/scripts/publish-wechat-article.mjs draft \
  --title "<article title>" \
  --html-file article.html \
  --cover-image images/cover.png \
  --author "<optional author>" \
  --digest "<optional digest>" > publish-result.json
```

Update an existing draft:

```bash
node {baseDir}/scripts/publish-wechat-article.mjs update \
  --media-id "<draft media_id>" \
  --title "<article title>" \
  --html-file article.html \
  --cover-image images/cover.png > publish-result.json
```

The script uploads every non-WeChat `<img>` source, replaces it with the returned WeChat URL, uploads the cover as permanent image material, then calls `draft/add` or `draft/update`. It does not call the mass-publish/free-publish endpoint.

Report the returned `media_id` and saved result path. On error, preserve the generated article and images, surface the exact WeChat error, and do not retry publication automatically.

## Guardrails

- Keep 3-5 body images; the cover is additional.
- Preserve every original body sentence and its order.
- Add only structural headings, images, and optional captions.
- Set normal paragraph and list text to `16px`.
- Use absolute local image paths in the generated HTML; the upload script resolves relative paths against `article.html` when necessary.
- Never ignore an image-upload failure; a draft with missing images is not success.
- Never expose credentials or access tokens in logs or result files.
- Never proceed from draft creation to mass publication without a separate explicit request and a new confirmation.
