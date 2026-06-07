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
|-- engagement/
|   |-- plans/
|   |-- logs/
|   `-- reports/
|-- skills/
|   `-- social-media-autoresearch/
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

## Safe API Response Handling

- Never parse concatenated API output with `python -m json` or `json.load()`.
  That causes `JSONDecodeError: Extra data` when two JSON documents, curl
  progress, or shell text end up in one stream.
- Keep one HTTP response per file. Use `>` or `-o`, never `>>`, for JSON
  responses.
- Prefer `curl -fsSL ... -o /tmp/hypergen-response.json` and validate that
  single file before reading fields.
- If a JSON parse fails with `Extra data`, discard the file and refetch it. Do
  not continue from a partially parsed response.
- When a script needs multiple endpoints, save them to separate files such as
  `/tmp/hypergen-hello.json`, `/tmp/hypergen-catalog.json`, and
  `/tmp/hypergen-credits.json`.

Safe shell helper:

```bash
hypergen_get_json() {
  path="$1"
  url="$2"
  tmp="${path}.tmp"
  curl -fsSL -H "Authorization: Bearer ${HYPERGEN_API_KEY}" "$url" -o "$tmp"
  python3 -m json.tool "$tmp" >/dev/null
  mv "$tmp" "$path"
}

hypergen_get_json /tmp/hypergen-hello.json \
  "${HYPERGEN_API_BASE}/skill/hypergen/hello?message=hello"
hypergen_get_json /tmp/hypergen-catalog.json \
  "${HYPERGEN_API_BASE}/skill/hypergen/catalog"
```

Common endpoints:

- Catalog: `GET ${HYPERGEN_API_BASE}/skill/hypergen/catalog`
- Credits: `GET ${HYPERGEN_API_BASE}/skill/hypergen/credits`
- Model context: `GET ${HYPERGEN_API_BASE}/skill/hypergen/models/:modelId`
- Image generation: `POST ${HYPERGEN_API_BASE}/skill/hypergen/generate`
- Video generation: `POST ${HYPERGEN_API_BASE}/skill/hypergen/video`
- Upload user media: `POST ${HYPERGEN_API_BASE}/skill/hypergen/uploads`
- Job polling: `GET ${HYPERGEN_API_BASE}/skill/hypergen/jobs/:id`
- Postiz draft: `POST ${HYPERGEN_API_BASE}/skill/hypergen/postiz/drafts`
- Employee mode config: `GET/PUT ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations`
- Employee mode test run: `POST ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations/:id/run`
- Employee mode run history: `GET ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations/:id/runs`
- Local runner status: `GET/PUT ${HYPERGEN_API_BASE}/skill/hypergen/agent-runner-status`
- Agent permissions: `GET/PUT ${HYPERGEN_API_BASE}/skill/hypergen/agent-permissions`
- Permission check: `POST ${HYPERGEN_API_BASE}/skill/hypergen/agent-permissions/check`
- Agent event log: `GET/POST ${HYPERGEN_API_BASE}/skill/hypergen/agent-events`

Scoped API keys are intentionally narrow:

- A model-scoped key can access only that model, its jobs, posts, channels,
  permissions, events, and automations.
- A product/business-scoped key can access only that product/business.
- A key scoped to both can use that exact model + product pair.
- If a list/read/generation/posting call returns `403 SCOPE_MISMATCH`, do not
  call the API broken or the key invalid. Ask the user to export a key with the
  needed model/product scope, or use an unscoped developer key only when they
  intentionally want account-wide access.

For payload details, read `references/api.md`.
For image-reference behavior, read `references/image-references.md`.
For Instagram, TikTok, and YouTube engagement behavior, read
`references/engagement.md`.

## Two-Layer Permission Model

Do not describe HyperGen permission as Safari/Chrome/social-account access.
These are different layers:

1. HyperGen permission is the server-side policy: who owns the key, which
   model/product it can touch, which actions are allowed, action limits, posting
   mode, and audit logs.
2. Local permission is the user's private computer/browser access: OS
   automation prompts, Safari or Chrome profile access, and logged-in Instagram,
   TikTok, or YouTube sessions.

HyperGen cannot grant the second layer. The local skill/runner must verify it
inside the user's runtime, then send only readiness status with
`PUT /skill/hypergen/agent-runner-status` or
`node scripts/hypergen-agent.mjs report-runner-status`. Never send cookies,
passwords, OAuth tokens, API keys, session tokens, or raw browser storage.

Before every live browser or engagement action, require both checks:

1. Local runner says browser/session access is verified.
2. `POST /skill/hypergen/agent-permissions/check` returns `allowed: true`.

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
   - CLI shortcut: `node scripts/hypergen-agent.mjs draft --body draft.json --dry-run`, then remove `--dry-run` after approval.
   - Before removing `--dry-run`, review `node scripts/hypergen-agent.mjs permissions --model-id <MODEL_ID>`. Direct agent Postiz calls are permission-gated: drafts require `posting.createPosts`; scheduled bodies require `posting.schedulePosts` plus `posting.approvalMode: "auto"`; publish bodies require `posting.publishPosts` plus `posting.approvalMode: "auto"`.
   - Prefer `jobIds: ["<JOB_ID>"]` over manually copying `mediaUrls`. The backend will resolve the job's media and upload it to Postiz.
   - Completed generated jobs should expose hosted `outputUrls` or `videoUrl`. Legacy jobs may still contain inline base64/data-URI media, which remains valid through `jobIds`.
   - Final status reports should stay simple: list the completed job, credits used, saved output if available, and posting result such as Draft only / scheduled / published. Include a media handoff note only when a live Postiz API call actually failed.
   - Required draft fields: `modelId`, `channelIds`, `caption` or `title`, and either `jobIds` or `mediaUrls`.
   - Do not create placeholder/test drafts to learn the schema. Use this exact shape.

6. User wants HyperGen to create the whole post package:
   - First generate the image or video job and poll until `status: "completed"`.
   - Then call `POST ${HYPERGEN_API_BASE}/skill/hypergen/postiz/posts/from-job`.
   - CLI shortcut: `node scripts/hypergen-agent.mjs post-from-job --body post-from-job.json --dry-run`, then remove `--dry-run` after approval.
   - Before the live call, confirm saved posting permission allows the requested mode. HyperGen checks this before caption credits are spent or Postiz writes happen. Draft output requires `posting.createPosts`; scheduling/publishing additionally require `posting.approvalMode: "auto"` and the matching schedule/publish permission.
   - Required body fields: `modelId`, `channelIds`, and `jobIds`.
   - HyperGen generates caption/hashtags, resolves/uploads the job media, and creates the Postiz draft.
   - Completed generated jobs should expose hosted `outputUrls` or `videoUrl`. Legacy jobs may still contain inline base64/data-URI media, which remains valid through `jobIds`.
   - Final status reports should stay simple: list the completed job, credits used, saved output if available, and posting result such as Draft only / scheduled / published. Include a media handoff note only when a live Postiz API call actually failed.
   - The agent's job after this is review: enhance the caption, ask for approval, schedule, publish, or regenerate.

7. User wants HyperGen or the agent to act like a real employee every day:
   - First verify Postiz channels and credits.
   - CLI shortcut for channels: `node scripts/hypergen-agent.mjs channels --model-id <MODEL_ID>`.
   - Review existing configuration with `GET ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations?modelId=<MODEL_ID>`.
   - Save the configuration with `PUT ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations`.
   - Run a paid test only after user approval with `POST ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations/:id/run`.
   - Review `GET ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations/:id/runs` before saying it works.
   - Modes:
     - `draft`: generate the post and create a Postiz draft for review.
     - `schedule`: generate ahead of the configured time and schedule in Postiz.
     - `publish`: generate and publish through Postiz automatically.
   - Required save body:

```json
{
  "modelId": "6a1dee71e7929bbbd0996009",
  "enabled": true,
  "mode": "draft",
  "contentType": "image",
  "channelIds": ["<POSTIZ_CHANNEL_ID>"],
  "postTime": "19:30",
  "timezone": "America/Chicago",
  "leadMinutes": 30,
  "prompt": "Daily camera-roll post, fresh outfit, natural blur, no AI branding.",
  "imageModelChoice": "grok",
  "videoModelChoice": "seedance",
  "maxCreditsPerRun": 12,
  "monthlyCreditCap": 300
}
```

   - Do not claim employee mode is enabled until the PUT response and a follow-up GET confirm `enabled: true`.
   - Do not claim a test worked until the run history shows `status: "success"`, generated `jobIds`, and `postIds` containing the Postiz output ids for the draft/scheduled/published post.

8. User wants the agent to do social engagement too:
   - Install the engagement add-on inside the creator-agent workspace:
     `node scripts/hypergen-agent.mjs install-engagement`
   - Read `references/engagement.md`.
   - Then read the platform skill:
     - Instagram: `skills/social-media-autoresearch/social-media-engagement/instagram/SKILL.md`
     - TikTok: `skills/social-media-autoresearch/social-media-engagement/tiktok/SKILL.md`
     - YouTube: `skills/social-media-autoresearch/social-media-engagement/youtube/SKILL.md`
   - Ask for approval before live engagement unless the user explicitly enabled automatic engagement.
   - Treat likes, saves, favorites, comments, follows, and subscribes as live account actions.
   - Before each live action, call `POST /skill/hypergen/agent-permissions/check` or `node scripts/hypergen-agent.mjs check-permission --body payload.json`.
   - Act only when the permission response says `allowed: true`.
   - After each action or skipped action, call `POST /skill/hypergen/agent-events` or `node scripts/hypergen-agent.mjs log-event --body payload.json`.
   - Read the latest heartbeat with `node scripts/hypergen-agent.mjs runner-status --model-id <MODEL_ID>`.
   - After verifying local browser access and platform login, preview the heartbeat payload with `node scripts/hypergen-agent.mjs report-runner-status --model-id <MODEL_ID> --runtime Codex --browser Safari --browser-permission verified --social instagram:logged_in:luna --dry-run`, then remove `--dry-run` to send it. Browser permission must be `unknown`, `not_verified`, or `verified`; social entries use `instagram`, `tiktok`, or `youtube` plus `unknown`, `not_logged_in`, or `logged_in`. Never include cookies, passwords, API keys, OAuth tokens, session tokens, or raw browser storage in runner metadata; the CLI strips sensitive metadata keys before dry-run output or API submission. Advanced agents may call `PUT /skill/hypergen/agent-runner-status` directly or use `node scripts/hypergen-agent.mjs report-runner-status --body runner-status.json`.
   - Log every engagement run in `engagement/logs/` and HyperGen agent events.

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
5. Before paid generation, show the request body and quote credit cost only from the live catalog's matching `creditCost` (and video duration rules when relevant). If the live catalog cost cannot be resolved, say cost unknown and ask without a number.
6. Ask before spending credits unless the user explicitly authorized generation.
7. After creating a job, poll until `completed` or `failed`.
8. Return real job IDs, credit usage, and media URLs only from live API responses.

## Engagement Mode

Posting and engagement are separate powers:

- Posting uses HyperGen + Postiz APIs.
- Engagement uses the optional `social-media-autoresearch` add-on in the agent's
  browser/runtime environment.
- HyperGen cannot grant Safari, Instagram, TikTok, or YouTube access by itself.
  The user grants local browser/app access inside their own agent runtime.
  HyperGen stores the policy, limits, and audit log, then the local skill checks
  that policy before acting.

Use engagement only when the user asks for it or when employee mode explicitly
includes engagement. The default posture is review-first: propose the engagement
plan, confirm platforms and safety limits, then run.

Install the add-on:

```bash
node scripts/hypergen-agent.mjs install-engagement
```

Then follow `references/engagement.md` and the platform-specific skill file.

## Employee Mode Review Checklist

Use this checklist before telling the user automatic posting is production-ready:

1. `GET /skill/hypergen/hello?message=hello` returns connected.
2. `GET /skill/hypergen/catalog` and `/credits` succeed.
3. `GET /skill/hypergen/agent-status?modelId=:modelId` shows API-key activity only. Do not treat this as proof of local browser permission.
4. `GET /skill/hypergen/postiz/models/:modelId/channels` shows at least one selected channel for scheduling/publishing. CLI shortcut: `node scripts/hypergen-agent.mjs channels --model-id <MODEL_ID>`.
5. If engagement is part of employee mode, verify the local runner is installed, the user granted Safari/Chrome/browser automation access, and the relevant Instagram/TikTok/YouTube session is logged in locally.
6. `GET /skill/hypergen/agent-runner-status` or `node scripts/hypergen-agent.mjs runner-status --model-id <MODEL_ID>` reads the latest local runner heartbeat. `PUT /skill/hypergen/agent-runner-status` records browser permission and social-session status without storing cookies or passwords.
7. `PUT /skill/hypergen/agent-automations` returns the saved mode, content type, caps, `nextRunAt`, and `nextPostAt`.
8. `GET /skill/hypergen/agent-automations?modelId=:modelId` confirms the saved values.
9. If the user approved a test, `POST /skill/hypergen/agent-automations/:id/run` returns a run.
10. `GET /skill/hypergen/agent-automations/:id/runs` shows the run result, credits, generated job IDs, Postiz output IDs in `postIds`, and any error.
11. `GET /skill/hypergen/agent-status?modelId=:modelId` reflects the new requests/media/posts totals and the latest `runner` heartbeat.

## Generation Defaults

- Use Grok for ordinary image generation/editing unless the user is creating a new people-specific reusable model identity.
- Never estimate generation cost from `count`, engine name, or memory. Report final credit usage only from the completed job's `creditsUsed`.
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
- Hashtags: hard cap at 3 total. Prefer no hashtags or only #fyp for model-only lifestyle posts. Never use AI/self-labeling tags such as #AICreator, #AI, #AIGenerated, #UGC, or #HyperGen.
- Captions must contain real caption text. Do not return hashtag-only captions; if there is no natural caption, omit hashtags rather than posting only tags.

## Daily Viral UGC Style Bank

Each day, pick one style direction before prompting. Use these as
style/composition references only; do not copy another person's identity. If the
API accepts a `referenceImage`, pass one of the style image URLs as
`referenceImage` for model-only posts or inside `images` for business/product
shots.

1. Blurry close-crop bed selfie
   - Best for: model-only lifestyle posts.
   - Style image: `https://hypergen.hypercho.com/gallery-models/soft-kbeauty-portrait.png`
   - Prompt add-on: `blurry low-light close-cropped phone selfie, half face near frame edge, visible grain, soft focus, messy hair, casual real-person outfit, imperfect bedroom light, compressed camera-roll texture, no text, no watermark`.

2. Cafe mirror check
   - Best for: model outfit posts or casual product-in-hand posts.
   - Style image: `https://hypergen.hypercho.com/gallery-models/iphone-cafe-mirror-creator.png`
   - Prompt add-on: `casual iPhone mirror selfie in a small cafe hallway, slightly smudged mirror, warm practical bulbs, mild indoor noise, relaxed pose, realistic phone perspective, outfit can vary naturally, no readable brands, no watermark`.

3. Window-seat camera roll
   - Best for: softer daily posts, captions, and morning/evening content.
   - Style image: `https://hypergen.hypercho.com/gallery-models/mobile-window-seat-creator.png`
   - Prompt add-on: `friend-taken smartphone photo near an apartment window, soft daylight, lived-in background, slight motion blur, natural skin texture, relaxed pose, imperfect auto-exposure, social-ready vertical crop`.

4. Grocery aisle everyday proof
   - Best for: business/product lifestyle use cases and approachable creator posts.
   - Style image: `https://hypergen.hypercho.com/gallery-models/mobile-grocery-aisle-creator.png`
   - Prompt add-on: `handheld smartphone shot in a grocery aisle, everyday fluorescent lighting, colorful blurred shelves, product or creator used naturally, candid real-life posture, mild phone HDR, no readable labels unless product accuracy requires it`.

Daily use rule: rotate styles instead of repeating the same look. Model posts
can use blurry/camera-roll styles by default; business posts should use the
cleaner grocery/cafe/window styles unless the user explicitly asks for a blurry
selfie ad.

## Safety

- Never fabricate media URLs, job IDs, credits, channels, or Postiz IDs.
- If a key is invalid, say `INVALID_TOKEN` and ask for a fresh agent API key.
- If a route returns 404, verify the full URL includes `/skill/hypergen` before declaring the API missing.
- Revoke pasted keys after troubleshooting if they were exposed in chat.
