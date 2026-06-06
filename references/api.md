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

## Model-Only Image

Use for Luna/influencer solo posts.

```json
{
  "intent": "model-image",
  "modelId": "6a1dee71e7929bbbd0996009",
  "scene": "bright morning window, coffee, oversized knit",
  "referenceImage": "https://example.com/pose-or-style-reference.jpg",
  "count": 1,
  "aspectRatio": "4:5",
  "look": "natural"
}
```

`referenceImage` is optional and is used for pose, composition, or background
guidance. The model's saved images remain the identity reference.

## Product-On-Model Image

```json
{
  "modelId": "6a1dee71e7929bbbd0996009",
  "productImage": "https://example.com/product.png",
  "scene": "holding it in soft window light",
  "count": 2,
  "aspectRatio": "4:5",
  "look": "natural"
}
```

If `productId` is supplied instead of `productImage`, saved product angles become
references automatically.

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
  "aspectRatio": "4:5"
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
