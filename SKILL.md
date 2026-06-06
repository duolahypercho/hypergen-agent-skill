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

## Required API Rules

- `HYPERGEN_API_BASE` defaults to `https://api.hypercho.com`.
- External agent routes always include `/skill/hypergen`.
- Do not call bare `/generate`, `/credits`, `/jobs`, or `/models` on the API origin.
- Use `Authorization: Bearer $HYPERGEN_API_KEY`.
- Verify the key against the API host first: `GET ${HYPERGEN_API_BASE}/skill/hypergen/catalog`.
- Do not mark the key invalid from hosted-doc failure alone. Only report it invalid after the API host's catalog or credits endpoint returns `401`/`403` with the same key. If hosted docs fail but catalog works, report docs unavailable and API key ready.

Common endpoints:

- Catalog: `GET ${HYPERGEN_API_BASE}/skill/hypergen/catalog`
- Credits: `GET ${HYPERGEN_API_BASE}/skill/hypergen/credits`
- Model context: `GET ${HYPERGEN_API_BASE}/skill/hypergen/models/:modelId`
- Image generation: `POST ${HYPERGEN_API_BASE}/skill/hypergen/generate`
- Video generation: `POST ${HYPERGEN_API_BASE}/skill/hypergen/video`
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

## Safety

- Never fabricate media URLs, job IDs, credits, channels, or Postiz IDs.
- If a key is invalid, say `INVALID_TOKEN` and ask for a fresh agent API key.
- If a route returns 404, verify the full URL includes `/skill/hypergen` before declaring the API missing.
- Revoke pasted keys after troubleshooting if they were exposed in chat.
