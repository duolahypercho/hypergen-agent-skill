# Social Engagement Add-On

HyperGen agents can do more than post. With explicit user authorization, the
agent can also perform light engagement on the user's social accounts through a
separate browser-automation add-on:

```text
https://github.com/duolahypercho/social-media-autoresearch
```

Install it inside the creator-agent workspace:

```bash
node scripts/hypergen-agent.mjs install-engagement
```

This creates:

```text
skills/social-media-autoresearch/
|-- social-media-engagement/
|   |-- instagram/SKILL.md
|   |-- tiktok/SKILL.md
|   `-- youtube/SKILL.md
```

## Required Rules

Engagement is a live action on real social accounts. Do not run it silently.
HyperGen does not run this browser session and cannot unlock private local
access. The user must authorize the local agent/browser on their own computer;
HyperGen only stores the policy, checks each requested action, and records the
audit trail.

1. Verify the user asked for engagement or employee mode includes engagement.
2. Confirm the platforms: Instagram, TikTok, YouTube, or a subset.
3. Confirm the niche/topics and skip keywords.
4. Confirm safety limits before the first run.
5. Use the user's logged-in browser/session where required.
6. Before every live action, ask HyperGen permission with
   `POST /skill/hypergen/agent-permissions/check` or
   `node scripts/hypergen-agent.mjs check-permission --body payload.json`.
7. Act only when HyperGen returns `allowed: true`.
8. Watch/read before interacting; do not mass-like or spam.
9. Log every action to HyperGen with `POST /skill/hypergen/agent-events` or
   `node scripts/hypergen-agent.mjs log-event --body payload.json`.
10. Log every action in `engagement/logs/YYYY-MM-DD.md`.
11. Stop immediately on login prompts, rate limits, captchas, suspicious-account
   warnings, or platform errors.

## Default Safety Limits

Per session:

- Instagram Reels: max 10 items, watch at least 30 seconds before action.
- TikTok: max 10 items, watch at least 30 seconds before action.
- YouTube Shorts: max 10 items, watch at least 30 seconds before action.

Per day:

- Likes: max 50 per platform.
- Saves/favorites: max 30 per platform.
- Comments: max 5 per platform.
- Follows/subscribes: rare, user-approved only.

## Engagement Flow

1. Read `skills/social-media-autoresearch/social-media-engagement/<platform>/SKILL.md`.
2. Build a short plan:
   - target platform,
   - target topics,
   - skip keywords,
   - max actions,
   - whether comments/follows are allowed.
3. Ask the user to approve the plan unless they already enabled automatic
   engagement in employee mode.
4. Open the platform with the user's authenticated browser profile.
5. For each candidate item:
   - check topic match,
   - skip ads, sponsors, paid partnerships, off-topic content, or low quality,
   - watch at least 30 seconds,
   - call the HyperGen permission check for the intended action,
   - perform only approved actions,
   - log URL/title/action/reason locally and with HyperGen agent events.
6. Report a concise summary:
   - viewed,
   - liked,
   - saved/favorited,
   - commented,
   - skipped,
   - stopped reason if any.

## Production Notes

- HyperGen backend handles scheduled posting. Engagement currently runs in the
  external agent/browser environment because it depends on user social sessions.
- HyperGen permission is not an operating-system permission. It is a server-side
  consent and limit policy. The local agent must still have user-approved access
  to the browser profile, then check HyperGen before each action and log the
  result after.
- Do not store platform passwords or cookies in the HyperGen repo.
- Do not bypass platform limits, captchas, or trust/safety warnings.
- Keep engagement natural and sparse. The goal is realistic employee behavior,
  not growth-hack spam.
