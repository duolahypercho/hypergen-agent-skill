# Image References

HyperGen supports reference images, but the field depends on the generation
intent.

## Automatic References

For saved model generation:

- `intent: "model-image"` automatically sends the model's saved reference
  images to lock identity.
- Model-only posts default to a blurry, low-light, close-cropped phone selfie /
  camera-roll look with soft focus, visible grain/noise, imperfect indoor light,
  and slightly off-center framing.
- Clothing should vary naturally between posts like a real person unless the
  user explicitly asks to preserve the exact outfit.
- Product-on-model generation automatically sends the model references plus the
  supplied `productImage` or saved `productId` angles.
- Business/product posts use a cleaner polished UGC or catalog/product style
  with accurate product details, not the blurry model-selfie default.

The agent does not need to invent a style reference when the user only wants the
same model or product identity.

## User-Provided Example Image

When the user provides an image as an example:

- For model-only posts, send it as `referenceImage`.
- For general product/image generation, send it in `images`.
- For older single-reference callers, `productImage` works as an alias.

## Model-Only Example

```json
{
  "intent": "model-image",
  "modelId": "6a1dee71e7929bbbd0996009",
  "scene": "match this pose and cozy desk mood, but keep Luna's identity",
  "referenceImage": "https://example.com/user-example.jpg",
  "count": 1,
  "aspectRatio": "4:5"
}
```

Backend behavior:

- Model reference images are primary.
- `referenceImage` is secondary pose/composition/background guidance.
- The prompt should explicitly say to keep the saved model identity.

## General Image Example

```json
{
  "intent": "product-image",
  "prompt": "use the example image's lighting and composition; create a premium UGC-style post",
  "images": ["https://example.com/user-example.jpg"],
  "count": 1,
  "aspectRatio": "4:5"
}
```

Backend behavior:

- No images means text-to-image.
- One or more `images` means image-to-image/edit mode.
- References are clamped to three images.

## Agent Questions

If the user says "use this image as an example", ask only when ambiguous:

- "Should this image guide pose/composition while preserving the saved model, or
  should it be the main subject/reference?"

If the request names a saved model such as Luna, assume the example image is
pose/composition/style guidance and send `referenceImage`.
