# HyperGen Agent API

## Base

```text
HYPERGEN_API_BASE=https://api.hypercho.com
Agent prefix=/skill/hypergen
```

Full generation URL:

```text
POST https://api.hypercho.com/skill/hypergen/generate
```

## Verify

```bash
curl -fsSL "$HYPERGEN_API_BASE/skill/hypergen/catalog" \
  -H "Authorization: Bearer $HYPERGEN_API_KEY"

curl -fsSL "$HYPERGEN_API_BASE/skill/hypergen/credits" \
  -H "Authorization: Bearer $HYPERGEN_API_KEY"
```

Expected unauthenticated response is JSON `401`, not `404`.

Always verify the key with the API host before judging hosted docs. A 401 from
`https://hypergen.hypercho.com/agents/...` alone is not enough to call the key
invalid. If catalog or credits works but hosted docs fail, continue from the
prompt/exported context and report hosted docs unavailable.

## Model-Only Image

Use for Luna/influencer solo posts.

Do not use product-on-model fields for this. The request must include
`intent: "model-image"`. Use `scene` for the creative direction. `prompt` is
allowed only as a full override when the user explicitly needs one.

Before asking for approval, quote credit cost only from the live catalog's
matching `creditCost` for the selected `modelChoice`, multiplied by `count`.
Never infer cost from `count`, engine name, or memory. If the catalog cost
cannot be resolved, say cost unknown and ask without a number. After completion,
report only the job response's `creditsUsed`.

```json
{
  "intent": "model-image",
  "modelId": "6a1dee71e7929bbbd0996009",
  "scene": "bright morning window, coffee, oversized knit",
  "referenceImage": "https://example.com/pose-or-style-reference.jpg",
  "count": 1,
  "aspectRatio": "4:5",
  "modelChoice": "grok",
  "look": "natural"
}
```

`referenceImage` is optional and is used for pose, composition, or background
guidance. The model's saved images remain the identity reference. By default,
model-only posts should use a blurry, grainy, low-light phone selfie /
camera-roll style and can change clothing naturally unless the user asks to
preserve the outfit.

Never send these fields for model-only generation:

```json
{
  "type": "product",
  "solo": true,
  "productImage": "<model reference>",
  "productId": "<anything>"
}
```

If a job response later shows `type: "product"` or `meta.solo: true`, treat that
as backend storage metadata, not the request schema.

## Product-On-Model Image

```json
{
  "modelId": "6a1dee71e7929bbbd0996009",
  "productImage": "https://example.com/product.png",
  "scene": "holding it in soft window light",
  "count": 2,
  "aspectRatio": "4:5",
  "modelChoice": "grok",
  "look": "natural"
}
```

If `productId` is supplied instead of `productImage`, saved product angles become
references automatically. Business/product imagery should stay cleaner and more
polished than model-only selfie posts, with accurate product details.

## General Image With References

Use for image-to-image work without a saved model identity.

```json
{
  "intent": "product-image",
  "prompt": "premium realistic UGC-style image, soft morning light",
  "images": [
    "https://example.com/style-reference.jpg",
    "https://example.com/composition-reference.jpg"
  ],
  "count": 1,
  "aspectRatio": "4:5",
  "modelChoice": "grok"
}
```

`productImage` is accepted as a single-image alias for older callers.

## Poll Job

```bash
JOB_ID="<job id>"
curl -fsSL "$HYPERGEN_API_BASE/skill/hypergen/jobs/$JOB_ID" \
  -H "Authorization: Bearer $HYPERGEN_API_KEY"
```

Return `outputUrls`, `videoUrl`, `creditsUsed`, and `status` from the job body.

## Create Postiz Draft From A Job

Use this after a generation job completes. Prefer `jobIds` so the backend
resolves and uploads the generated media for Postiz.

Completed generated jobs should expose hosted `outputUrls` or `videoUrl`.
Legacy jobs may still contain inline base64/data-URI media, which remains valid
through `jobIds`; the backend resolves, persists, and uploads the job media for
Postiz.

Final status reports should stay simple: list the completed job, credits used,
saved output if available, and posting result such as Draft only / scheduled /
published. Include a media handoff note only when a live Postiz API call
actually failed.

```json
{
  "modelId": "6a1dee71e7929bbbd0996009",
  "channelIds": ["<POSTIZ_CHANNEL_ID>"],
  "jobIds": ["<COMPLETED_JOB_ID>"],
  "caption": "mirror check before the night winds down",
  "hashtags": ["ootd", "mirrorselfie"]
}
```

Do not create placeholder drafts while probing. The required fields are:
`modelId`, `channelIds`, and either `jobIds` or `mediaUrls`; include `caption`
or `title` for the post text.

Hashtags are optional and have a hard cap of 3 total. Prefer no hashtags or
only `#fyp` for model-only lifestyle posts. Never use AI/self-labeling tags such
as `#AICreator`, `#AI`, `#AIGenerated`, `#UGC`, or `#HyperGen`. Captions must
contain real caption text; do not create hashtag-only captions.

## Upload User Media

If the user provides their own media, upload it first:

```json
{
  "url": "data:image/jpeg;base64,...",
  "kind": "image",
  "name": "reference"
}
```

Endpoint: `POST ${HYPERGEN_API_BASE}/skill/hypergen/uploads`. The response is
an upload job; use its hosted `outputUrls` in drafts or video requests.

## Auto-Generate Complete Post From A Job

Use this when HyperGen should make the full post package after an image or video
job completes.

```json
{
  "modelId": "6a1dee71e7929bbbd0996009",
  "channelIds": ["<POSTIZ_CHANNEL_ID>"],
  "jobIds": ["<COMPLETED_IMAGE_OR_VIDEO_JOB_ID>"],
  "productIds": []
}
```

Endpoint: `POST ${HYPERGEN_API_BASE}/skill/hypergen/postiz/posts/from-job`.

The backend will:

- generate caption/title/hashtags,
- resolve, persist, and upload the job media to Postiz,
- create the Postiz draft,
- return both the generated copy and draft.

The agent should then review, enhance, ask for approval, schedule, publish, or
regenerate based on the user's posting mode.

## Automatic Employee Mode

Use this when the user wants HyperGen to handle the whole daily post loop
without a chat session: generate media, create copy, draft/schedule/publish
through Postiz, and keep a reviewable run log.

### Review existing config

```bash
curl -fsSL "$HYPERGEN_API_BASE/skill/hypergen/agent-automations?modelId=$HYPERGEN_MODEL_ID" \
  -H "Authorization: Bearer $HYPERGEN_API_KEY"
```

### Save config

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
  "captionTone": "short, human, casual",
  "imageModelChoice": "grok",
  "videoModelChoice": "seedance",
  "maxCreditsPerRun": 12,
  "monthlyCreditCap": 300
}
```

Endpoint: `PUT ${HYPERGEN_API_BASE}/skill/hypergen/agent-automations`.

Modes:

- `draft`: create a Postiz draft for review.
- `schedule`: generate ahead of `postTime` by `leadMinutes`, then schedule.
- `publish`: publish automatically after generation.

Content types:

- `image`: creates a model-only image post.
- `video`: creates an image first, then turns that image into a video.

Do not enable automation without at least one bound Postiz channel. Do not claim
it is enabled until a follow-up GET confirms `enabled: true`, `nextRunAt`, and
the intended mode.

### Run one approved test

```bash
curl -fsSL "$HYPERGEN_API_BASE/skill/hypergen/agent-automations/$AUTOMATION_ID/run" \
  -H "Authorization: Bearer $HYPERGEN_API_KEY" \
  -X POST
```

This is a live paid action. It can draft, schedule, or publish depending on the
saved mode.

### Review run history

```bash
curl -fsSL "$HYPERGEN_API_BASE/skill/hypergen/agent-automations/$AUTOMATION_ID/runs?limit=10" \
  -H "Authorization: Bearer $HYPERGEN_API_KEY"
```

Before saying the automation works, verify the latest run has:

- `status: "success"`,
- generated `jobIds`,
- created `postIds`,
- `creditsUsed`,
- no `error`.
