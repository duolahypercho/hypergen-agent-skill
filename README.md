# HyperGen Agent Skill

Public HyperGen skill and CLI for creator agents.

Use this when an agent needs to:

- verify a HyperGen API key,
- load hosted agent docs,
- generate model/product images,
- generate video,
- poll jobs,
- create complete Postiz drafts from generated media,
- configure automatic employee-mode posting,
- check local engagement permissions for Instagram, TikTok, and YouTube.

The skill is designed for local agent runtimes. HyperGen stores API policy,
credit state, permissions, and audit events. Local browser actions still run on
the user's computer. A connected HyperGen API key proves API access only; it
does not prove Safari/Chrome permission or social-account login.

## Permission Model

There are two separate permission layers:

1. HyperGen permission is server-side consent. It records what the user allows,
   which model/product the agent can act for, action limits, posting mode, and
   audit history.
2. Local permission is private computer access. Safari, Chrome, Instagram,
   TikTok, YouTube, cookies, login sessions, and OS automation prompts stay on
   the user's machine and are never granted by HyperGen.

The local runner must verify browser access locally, then report only a small
readiness heartbeat to HyperGen with `report-runner-status`. That heartbeat can
say `browser.permission: "verified"` or `socialSessions[].status: "logged_in"`,
but it must not include cookies, tokens, passwords, or raw browser storage.

Before any live local action, the runner must still call the HyperGen permission
check endpoint. The action is allowed only when both layers are true: local
browser access is available and HyperGen returns `allowed: true`.

## Install

```bash
git clone https://github.com/duolahypercho/hypergen-agent-skill.git
cd hypergen-agent-skill
npm run check
```

For npm-style local use:

```bash
npm link
hypergen-agent self-test
```

## Required Environment

Store credentials once. Do not paste API keys into every polling script.

```bash
mkdir -p "$HOME/.hypergen"
umask 077
cat > "$HOME/.hypergen/credentials.env" <<'HYPERGEN_CREDENTIALS'
HYPERGEN_API_KEY="<YOUR_HYPERGEN_API_KEY>"
HYPERGEN_API_BASE="https://api.hypercho.com"
HYPERGEN_APP_BASE="https://hypergen.hypercho.com"
HYPERGEN_CREDENTIALS
chmod 600 "$HOME/.hypergen/credentials.env"
```

Load it before live commands:

```bash
set -a
[ -f "$HOME/.hypergen/credentials.env" ] && . "$HOME/.hypergen/credentials.env"
[ -f ./.hypergen.env ] && . ./.hypergen.env
set +a
```

Never run generation or polling scripts with `set -x`; it can print secrets.

## First Checks

```bash
hypergen-agent check-updates
hypergen-agent verify --model-id <MODEL_ID>
hypergen-agent status --model-id <MODEL_ID>
hypergen-agent download-docs --model-id <MODEL_ID> --out ./agent-workspace
```

`verify` calls `/skill/hypergen/hello?message=hello` first, then checks catalog,
credits, agent status, and the selected model/product context.

The API host is `https://api.hypercho.com` and agent routes use
`/skill/hypergen`. Do not call bare `/generate`, `/credits`, `/jobs`, or
`/models` on the API origin.

## Common Commands

Generate from a JSON body:

```bash
hypergen-agent generate --body payload.json
```

Poll a job:

```bash
hypergen-agent poll --job-id <JOB_ID>
```

Review employee-mode automation:

```bash
hypergen-agent automations --model-id <MODEL_ID> --product-id <PRODUCT_ID>
```

Save employee-mode automation:

```bash
hypergen-agent save-automation --body automation.json
```

Check local engagement permission:

```bash
hypergen-agent check-permission --body permission-check.json
```

Read current agent-side request/media/post totals:

```bash
hypergen-agent status --model-id <MODEL_ID> --product-id <PRODUCT_ID>
```

Report local runner/browser/social-session readiness:

```bash
hypergen-agent report-runner-status --body runner-status.json
hypergen-agent report-runner-status \
  --model-id <MODEL_ID> \
  --runtime Codex \
  --browser Safari \
  --browser-permission verified \
  --capability browser_automation \
  --capability social_engagement \
  --social instagram:logged_in:luna \
  --dry-run
```

Log a local engagement/posting event:

```bash
hypergen-agent log-event --body event.json
```

## Generation Payloads

Model-only post:

```json
{
  "intent": "model-image",
  "modelId": "<MODEL_ID>",
  "scene": "low-light phone selfie, soft blur, fresh outfit",
  "count": 1,
  "aspectRatio": "4:5",
  "modelChoice": "grok"
}
```

Do not send `productImage`, `productId`, `type: "product"`, or `solo` for
model-only generation.

Product-on-model:

```json
{
  "modelId": "<MODEL_ID>",
  "productId": "<PRODUCT_ID>",
  "scene": "holding the product near a bright window",
  "count": 1,
  "aspectRatio": "4:5",
  "modelChoice": "grok"
}
```

Standalone business/product image:

```json
{
  "intent": "product-image",
  "prompt": "clean ecommerce lifestyle image with accurate product details",
  "images": ["https://example.com/reference.jpg"],
  "count": 1,
  "aspectRatio": "4:5",
  "modelChoice": "grok"
}
```

Video:

```json
{
  "image": "https://example.com/completed-image.jpg",
  "prompt": "subtle handheld motion, natural social video",
  "durationSeconds": 5,
  "modelChoice": "seedance"
}
```

Before asking approval for paid generation, read the live catalog and quote
only the matching `creditCost`. If the catalog cost cannot be resolved, say the
cost is unknown and ask without a number.

## Postiz Handoff

Prefer `jobIds` for generated media. HyperGen resolves the completed job media,
persists legacy base64/data-URI outputs when needed, uploads it for Postiz, and
creates the draft.

Do not create placeholder drafts to learn the schema.

```json
{
  "modelId": "<MODEL_ID>",
  "channelIds": ["<POSTIZ_CHANNEL_ID>"],
  "jobIds": ["<COMPLETED_JOB_ID>"],
  "caption": "first sip of the day",
  "hashtags": ["fyp"]
}
```

Hashtags are optional and capped at 3. Prefer no hashtags or only `#fyp` for
model-only lifestyle posts. Never use AI/self-labeling tags such as
`#AICreator`, `#AI`, `#AIGenerated`, `#UGC`, or `#HyperGen`.

## Scoped API Keys

HyperGen agent keys may be scoped to a model, a product/business, or both.

- Model-scoped key: use only that model.
- Product/business-scoped key: use only that product/business.
- Model + product scoped key: use only that exact pair.
- Unscoped developer key: account-wide; use only when the user intentionally
  selected account-wide access.

If the API returns `403 SCOPE_MISMATCH`, the key is valid but too narrow for
the requested action. Ask the user to export a matching key.

## Local Engagement

Posting and engagement are separate.

- Posting uses HyperGen + Postiz APIs.
- Engagement uses the optional local browser automation add-on.

HyperGen cannot grant Safari, Instagram, TikTok, or YouTube access by itself.
The user authorizes local browser access in their own agent runtime. The local
skill checks HyperGen permission before acting and logs the result after.
Treat `agent-status.connected` as API-key activity only. Verify the local
runner, browser permission, and Instagram/TikTok/YouTube sessions locally before
engagement.

Report local runner readiness after verification:

```json
{
  "modelId": "6a1dee71e7929bbbd0996009",
  "runtime": "Codex",
  "online": true,
  "capabilities": ["browser_automation", "social_engagement"],
  "browser": {
    "name": "Safari",
    "permission": "verified",
    "lastVerifiedAt": "2026-06-07T12:00:00.000Z"
  },
  "socialSessions": [
    {
      "platform": "instagram",
      "status": "logged_in",
      "handle": "luna"
    }
  ]
}
```

```bash
hypergen-agent report-runner-status --body runner-status.json
hypergen-agent report-runner-status \
  --model-id "$HYPERGEN_MODEL_ID" \
  --runtime Codex \
  --browser Safari \
  --browser-permission verified \
  --capability browser_automation \
  --capability social_engagement \
  --social instagram:logged_in:luna \
  --dry-run
```

Remove `--dry-run` after the payload looks right to update HyperGen.
Allowed `--browser-permission` values are `unknown`, `not_verified`, and
`verified`. Allowed `--social` platforms are `instagram`, `tiktok`, and
`youtube`; allowed statuses are `unknown`, `not_logged_in`, and `logged_in`.
Do not put cookies, passwords, API keys, OAuth tokens, session tokens, or raw
browser storage in runner metadata. HyperGen only needs readiness status, not
private session material. The CLI strips sensitive metadata keys before dry-run
output or API submission, but agents should avoid collecting them at all.

Install the engagement add-on:

```bash
hypergen-agent install-engagement
```

Then read:

- `references/engagement.md`
- `skills/social-media-autoresearch/social-media-engagement/instagram/SKILL.md`
- `skills/social-media-autoresearch/social-media-engagement/tiktok/SKILL.md`
- `skills/social-media-autoresearch/social-media-engagement/youtube/SKILL.md`

## Production Rules

- Do not fabricate job IDs, media URLs, credit balances, channels, Postiz IDs,
  schedules, or published-post status.
- Ask before spending credits unless the user explicitly enabled automatic
  employee mode or gave direct paid-generation approval.
- Report credits only from live job responses.
- Include media handoff warnings only when a live Postiz API call actually
  failed.
- Store raw API keys only in a secret store or `$HOME/.hypergen/credentials.env`.
- Log local engagement actions with `hypergen-agent log-event`.

## Checks

```bash
npm run check
```

The self-test validates required files and production-critical guidance for
scoped keys, Postiz media handoff, local browser permissions, Grok defaults,
credit-cost handling, hashtags, and engagement.
