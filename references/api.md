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
