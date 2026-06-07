---
name: hypergen-agent
description: Use when creating, generating, scheduling, or publishing HyperGen model/product images, videos, captions, or Postiz drafts through the live HyperGen API. Always checks this skill's GitHub source for updates before running a HyperGen workflow, then asks before updating.
---

# HyperGen Agent

Use this skill for HyperGen creator-agent work: loading hosted agent docs,
checking credits, generating images/video, polling jobs, using image references,
and creating Postiz drafts.

## Required First Step

Before each HyperGen workflow in a new chat/session:

1. Run `scripts/check_updates.sh` from this skill folder when shell access is available.
2. If it reports updates, summarize the commits and ask whether to update.
3. Do not run `git pull` or modify this skill unless the user confirms.
4. If the update check cannot run, say why and continue with the installed skill.

This is a skill-level preflight. Plain Codex skills cannot automatically execute
before every chat by themselves. Runtimes that support hooks can wire
`hooks/pre-chat.sh` to call the same update check.

## Workspace File Structure

When the runtime has filesystem access, create this structure inside the fresh
creator-agent folder:

```text
.
|-- soul.md
|-- agents.md or claude.md
|-- hypergen.requests.json
|-- memory/
|   |-- profile.md
|   |-- preferences.md
|   `-- approvals.md
|-- references/
|   |-- model/
|   |-- product/
|   `-- style/
|-- posts/
|   |-- drafts/
|   |-- approved/
|   |-- published/
|   `-- rejected/
|-- jobs/
|   |-- images/
|   `-- videos/
|-- captions/
|-- postiz/
|   |-- drafts/
|   `-- channels.md
`-- logs/
    |-- api-calls.md
    `-- decisions.md
```

Use these folders as lightweight memory, not as a replacement for live API
checks. Store generated job IDs, media URLs, captions, Postiz draft IDs,
approval decisions, and user feedback. Do not store raw API keys in these files.

## Required API Rules

- `HYPERGEN_API_BASE` defaults to `https://api.hypercho.com`.
- External agent routes always include `/skill/hypergen`.
- Do not call bare `/generate`, `/credits`, `/jobs`, or `/models` on the API origin.
- Use `Authorization: Bearer $HYPERGEN_API_KEY`.
- Prefer loading `HYPERGEN_API_KEY` from `$HOME/.hypergen/credentials.env` or the runtime's secret store. Do not print, echo, commit, or repeatedly paste API keys in polling/generation scripts.
- Verify the key against the API host first: `GET ${HYPERGEN_API_BASE}/skill/hypergen/catalog`.
- Do not mark the key invalid from hosted-doc failure alone. Only report it invalid after the API host's catalog or credits endpoint returns `401`/`403` with the same key. If hosted docs fail but catalog works, report docs unavailable and API key ready.

## Global Credential Setup

When shell access is available, store the key once and source it in future scripts:

```bash
mkdir -p "$HOME/.hypergen"
umask 077
cat > "$HOME/.hypergen/credentials.env" <<'HYPERGEN_CREDENTIALS'
HYPERGEN_API_KEY="<YOUR_HYPERGEN_API_KEY>"
HYPERGEN_API_BASE="https://api.hypercho.com"
HYPERGEN_CREDENTIALS
chmod 600 "$HOME/.hypergen/credentials.env"
```

For polling, generation, and hosted-doc downloads, start scripts with:

```bash
set -a
[ -f "$HOME/.hypergen/credentials.env" ] && . "$HOME/.hypergen/credentials.env"
[ -f ./.hypergen.env ] && . ./.hypergen.env
set +a
: "${HYPERGEN_API_KEY:?Missing HYPERGEN_API_KEY. Refresh the selected key in HyperGen.}"
: "${HYPERGEN_API_BASE:=https://api.hypercho.com}"
```

Never show the raw key in status output. Never run these scripts with `set -x`.

Common endpoints:

- Catalog: `GET ${HYPERGEN_API_BASE}/skill/hypergen/catalog`
- Credits: `GET ${HYPERGEN_API_BASE}/skill/hypergen/credits`
- Model context: `GET ${HYPERGEN_API_BASE}/skill/hypergen/models/:modelId`
- Image generation: `POST ${HYPERGEN_API_BASE}/skill/hypergen/generate`
- Video generation: `POST ${HYPERGEN_API_BASE}/skill/hypergen/video`
- Upload user media: `POST ${HYPERGEN_API_BASE}/skill/hypergen/uploads`
- Job polling: `GET ${HYPERGEN_API_BASE}/skill/hypergen/jobs/:id`
- Postiz draft: `POST ${HYPERGEN_API_BASE}/skill/hypergen/postiz/drafts`

For payload details, read `references/api.md`.
For image-reference behavior, read `references/image-references.md`.

## Generation Decision Tree

Use this before every paid generation request. Do not guess alternate flags.

1. User wants the selected model/person alone, with no product:
   - Endpoint: `POST ${HYPERGEN_API_BASE}/skill/hypergen/generate`
   - Required body fields: `intent: "model-image"`, `modelId`, `scene`
   - Optional fields: `referenceImage`, `count`, `aspectRatio`, `modelChoice`, `look`
   - Do not send `productImage`, `productId`, `type: "product"`, or `solo`.
   - Do not probe random payloads after a validation error. Read `references/api.md` and retry this exact shape.

2. User wants a model holding/wearing/using a product:
   - Endpoint: `POST ${HYPERGEN_API_BASE}/skill/hypergen/generate`
   - Required body fields: `modelId` plus either `productImage` or `productId`
   - Use `scene` for the creative direction.

3. User wants a standalone business/product image:
   - Endpoint: `POST ${HYPERGEN_API_BASE}/skill/hypergen/generate`
   - Required body fields: `intent: "product-image"`, `prompt` or `scene`
   - Optional references: `images` or `productImage`.

4. User wants video:
   - Endpoint: `POST ${HYPERGEN_API_BASE}/skill/hypergen/video`
   - Use a completed image URL as the start image when possible.

5. User wants to make a Postiz draft from a generated image:
   - First poll the generation job until `status: "completed"`.
   - Then call `POST ${HYPERGEN_API_BASE}/skill/hypergen/postiz/drafts`.
   - Prefer `jobIds: ["<JOB_ID>"]` over manually copying `mediaUrls`. The backend will resolve the job's media and upload it to Postiz.
   - Completed jobs may return hosted URLs or inline base64/data-URI media. Both are valid through `jobIds`; do not say a base64 job cannot be pushed to Postiz, and do not require regeneration solely because the job returned base64.
   - In final status reports, never add a warning that base64 media cannot be scheduled, published, drafted, or used through Postiz `jobIds`. If posting mode is Draft only, say only that nothing was scheduled or published.
   - Required draft fields: `modelId`, `channelIds`, `caption` or `title`, and either `jobIds` or `mediaUrls`.
   - Do not create placeholder/test drafts to learn the schema. Use this exact shape.

6. User wants HyperGen to create the whole post package:
   - First generate the image or video job and poll until `status: "completed"`.
   - Then call `POST ${HYPERGEN_API_BASE}/skill/hypergen/postiz/posts/from-job`.
   - Required body fields: `modelId`, `channelIds`, and `jobIds`.
   - HyperGen generates caption/hashtags, resolves/uploads the job media, and creates the Postiz draft.
   - Completed jobs may return hosted URLs or inline base64/data-URI media. Both are valid through `jobIds`; let the backend resolve/persist/upload the media.
   - In final status reports, never add a warning that base64 media cannot be scheduled, published, drafted, or used through Postiz `jobIds`. If posting mode is Draft only, say only that nothing was scheduled or published.
   - The agent's job after this is review: enhance the caption, ask for approval, schedule, publish, or regenerate.

Model-only jobs are stored internally as `type: "product"` with `meta.solo: true`.
That is a response/storage detail only. Never copy those internal fields into
the request body.

## Hosted Agent Docs

If the user provides a hosted agent prompt, download the docs and request catalog:

```bash
curl -fsSL -H "Authorization: Bearer ${HYPERGEN_API_KEY}" \
  "https://hypergen.hypercho.com/agents/${HYPERGEN_MODEL_ID}/soul.md" -o soul.md
curl -fsSL -H "Authorization: Bearer ${HYPERGEN_API_KEY}" \
  "https://hypergen.hypercho.com/agents/${HYPERGEN_MODEL_ID}/skill.md" -o skill.md
curl -fsSL -H "Authorization: Bearer ${HYPERGEN_API_KEY}" \
  "https://hypergen.hypercho.com/agents/${HYPERGEN_MODEL_ID}/hypergen.requests.json" \
  -o hypergen.requests.json
```

Treat `hypergen.requests.json` as authoritative when present.

## Workflow

1. Run the update preflight.
2. Verify API key with catalog on the API host.
3. Load hosted docs/catalog if credentials and IDs are available.
4. Check credits and active model/product reads.
5. Before paid generation, show the request body and credit cost if known.
6. Ask before spending credits unless the user explicitly authorized generation.
7. After creating a job, poll until `completed` or `failed`.
8. Return real job IDs, credit usage, and media URLs only from live API responses.

## Generation Defaults

- Use Grok for ordinary image generation/editing unless the user is creating a new people-specific reusable model identity.
- Model-only posts default to blurry low-light phone selfie / camera-roll style: close cropped, soft focus, visible grain/noise, imperfect indoor light, compressed phone texture, and slightly off-center framing.
- Model clothing can differ naturally between posts like a real person; preserve the exact outfit only when the user asks for outfit continuity.
- Business/product posts default to cleaner polished UGC or catalog-quality product imagery with accurate product shape, colors, materials, logos, and scale. Do not apply the blurry model-selfie default to business/product shots unless requested.

## Prompt And Style Defaults

- Model agents: write prompts around the selected synthetic creator's identity, pose, expression, setting, and social-camera feel. Default to Grok for ordinary model image/edit generation. Use the blurry low-light phone selfie / camera-roll style for model-only posts unless the user asks for a cleaner editorial look.
- Model clothing: let clothing, hair styling, accessories, and casual outfit details change naturally between posts like a real person's feed. Preserve a specific outfit only when the user asks for outfit continuity.
- Business agents: write prompts around the business, product line, product references, accurate materials, colors, shape, label/logo treatment, scale, use case, and brand voice. Default to cleaner polished UGC, ecommerce, catalog, lifestyle product, or ad-ready imagery.
- Business agents must not inherit the blurry model-selfie style by default. Use blur, low-light, grain, mirror selfies, or close-cropped selfie language for a business/product only when the user explicitly asks for that look.
- Business + model agents: keep the product/business objective first and use the model as the creator or hand model only when a model is selected. The prompt should protect product accuracy while preserving the creator identity.
- Captions: model-only captions sound like the creator's social voice; business captions sound like the brand/product voice and should mention the product, benefit, use case, or offer when relevant.

## Safety

- Never fabricate media URLs, job IDs, credits, channels, or Postiz IDs.
- If a key is invalid, say `INVALID_TOKEN` and ask for a fresh agent API key.
- If a route returns 404, verify the full URL includes `/skill/hypergen` before declaring the API missing.
- Revoke pasted keys after troubleshooting if they were exposed in chat.
