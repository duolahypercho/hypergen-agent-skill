#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, "..");

const API_BASE = process.env.HYPERGEN_API_BASE || "https://api.hypercho.com";
const APP_BASE = process.env.HYPERGEN_APP_BASE || "https://hypergen.hypercho.com";
const API_PREFIX = "/skill/hypergen";
const ENGAGEMENT_REPO =
  "https://github.com/duolahypercho/social-media-autoresearch.git";

const commands = {
  help,
  "check-updates": checkUpdates,
  verify,
  status: statusCommand,
  "download-docs": downloadDocs,
  "install-engagement": installEngagement,
  automations,
  "save-automation": saveAutomation,
  "run-automation": runAutomation,
  "automation-runs": automationRuns,
  "report-runner-status": reportRunnerStatus,
  permissions,
  "check-permission": checkPermission,
  events,
  "log-event": logEvent,
  generate,
  poll,
  "self-test": selfTest,
};

const [command = "help", ...args] = process.argv.slice(2);

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  help();
  process.exit(2);
}

await commands[command](args);

function help() {
  console.log(`HyperGen Agent CLI

Usage:
  hypergen-agent check-updates
  hypergen-agent verify [--model-id ID] [--product-id ID]
  hypergen-agent status [--model-id ID] [--product-id ID]
  hypergen-agent download-docs --model-id ID [--out DIR]
  hypergen-agent install-engagement [--out DIR]
  hypergen-agent automations [--model-id ID] [--product-id ID]
  hypergen-agent save-automation --body payload.json
  hypergen-agent run-automation --id ID
  hypergen-agent automation-runs --id ID
  hypergen-agent report-runner-status --body payload.json
  hypergen-agent report-runner-status --model-id ID --runtime Codex --browser Safari --browser-permission verified --social instagram:logged_in:luna [--dry-run]
  hypergen-agent permissions [--model-id ID] [--product-id ID]
  hypergen-agent check-permission --body payload.json
  hypergen-agent events [--model-id ID] [--product-id ID]
  hypergen-agent log-event --body payload.json
  hypergen-agent generate --body payload.json
  hypergen-agent poll --job-id ID
  hypergen-agent self-test

Environment:
  HYPERGEN_API_KEY   Required for live API calls
  HYPERGEN_API_BASE  Defaults to ${API_BASE}
  HYPERGEN_APP_BASE  Defaults to ${APP_BASE}

Important:
  Agent API paths use ${API_PREFIX}. Do not call bare /generate or /credits.
  Engagement add-on repo: ${ENGAGEMENT_REPO}
`);
}

function requireKey() {
  const key = process.env.HYPERGEN_API_KEY;
  if (!key) {
    throw new Error("HYPERGEN_API_KEY is required");
  }
  return key;
}

function parseFlag(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseFlags(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== name) continue;
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${name} requires a value`);
    }
    values.push(value);
    i += 1;
  }
  return values;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scopeParams(args) {
  const modelId = parseFlag(args, "--model-id") || process.env.HYPERGEN_MODEL_ID;
  const productId =
    parseFlag(args, "--product-id") || process.env.HYPERGEN_PRODUCT_ID;
  const qs = new URLSearchParams();
  if (modelId) qs.set("modelId", modelId);
  if (productId) qs.set("productId", productId);
  return { modelId, productId, suffix: qs.toString() ? `?${qs.toString()}` : "" };
}

async function api(path, options = {}) {
  const key = requireKey();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep text body
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body
        ? body.message || body.error || JSON.stringify(body)
        : body;
    throw new Error(`${res.status} ${msg || res.statusText}`);
  }
  return body;
}

async function app(path) {
  const key = requireKey();
  const res = await fetch(`${APP_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text || res.statusText}`);
  return text;
}

async function checkUpdates() {
  const result = spawnSync("bash", [resolve(skillDir, "scripts/check_updates.sh")], {
    cwd: skillDir,
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exitCode = result.status || 0;
}

async function verify(args) {
  const { modelId, productId, suffix } = scopeParams(args);
  const hello = await api(`${API_PREFIX}/hello?message=hello`);
  const [catalog, credits, status] = await Promise.all([
    api(`${API_PREFIX}/catalog`),
    api(`${API_PREFIX}/credits`),
    api(`${API_PREFIX}/agent-status${suffix}`),
  ]);
  const output = {
    apiBase: API_BASE,
    hello: hello?.data,
    catalogOk: Boolean(catalog?.success),
    credits: credits?.data,
    status: status?.data,
  };
  if (modelId) {
    const model = await api(`${API_PREFIX}/models/${encodeURIComponent(modelId)}`);
    output.model = {
      modelId: model?.data?.modelId,
      name: model?.data?.name,
      handle: model?.data?.handle,
    };
  }
  if (productId) {
    const product = await api(`${API_PREFIX}/products/${encodeURIComponent(productId)}`);
    output.product = {
      productId: product?.data?.productId,
      name: product?.data?.name,
      handle: product?.data?.handle,
    };
  }
  console.log(JSON.stringify(output, null, 2));
}

async function statusCommand(args) {
  const { suffix } = scopeParams(args);
  const result = await api(`${API_PREFIX}/agent-status${suffix}`);
  console.log(JSON.stringify(result, null, 2));
}

async function downloadDocs(args) {
  const modelId = parseFlag(args, "--model-id") || process.env.HYPERGEN_MODEL_ID;
  if (!modelId) throw new Error("--model-id or HYPERGEN_MODEL_ID is required");
  const outDir = resolve(parseFlag(args, "--out") || process.cwd());
  mkdirSync(outDir, { recursive: true });
  await api(`${API_PREFIX}/catalog`);

  const files = {
    "soul.md": `/agents/${encodeURIComponent(modelId)}/soul.md`,
    "skill.md": `/agents/${encodeURIComponent(modelId)}/skill.md`,
    "claude.md": `/agents/${encodeURIComponent(modelId)}/claude.md`,
    "hypergen.requests.json": `/agents/${encodeURIComponent(
      modelId
    )}/hypergen.requests.json`,
  };

  for (const [name, path] of Object.entries(files)) {
    const text = await app(path);
    const file = resolve(outDir, name);
    writeFileSync(file, text);
    console.log(`wrote ${file}`);
  }
}

async function installEngagement(args) {
  const outDir = resolve(parseFlag(args, "--out") || "skills/social-media-autoresearch");
  if (existsSync(outDir)) {
    console.log(`engagement add-on already exists at ${outDir}`);
    return;
  }
  mkdirSync(dirname(outDir), { recursive: true });
  const result = spawnSync("git", ["clone", "--depth", "1", ENGAGEMENT_REPO, outDir], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Could not install social engagement add-on");
  }
  console.log(`installed social engagement add-on to ${outDir}`);
  console.log("read social-media-engagement/instagram, /tiktok, and /youtube before engaging");
}

async function automations(args) {
  const { suffix } = scopeParams(args);
  const result = await api(`${API_PREFIX}/agent-automations${suffix}`);
  console.log(JSON.stringify(result, null, 2));
}

async function saveAutomation(args) {
  const bodyFile = parseFlag(args, "--body");
  if (!bodyFile) throw new Error("--body payload.json is required");
  const body = JSON.parse(readFileSync(resolve(bodyFile), "utf8"));
  const result = await api(`${API_PREFIX}/agent-automations`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function runAutomation(args) {
  const id = parseFlag(args, "--id");
  if (!id) throw new Error("--id is required");
  const result = await api(`${API_PREFIX}/agent-automations/${encodeURIComponent(id)}/run`, {
    method: "POST",
  });
  console.log(JSON.stringify(result, null, 2));
}

async function automationRuns(args) {
  const id = parseFlag(args, "--id");
  if (!id) throw new Error("--id is required");
  const result = await api(`${API_PREFIX}/agent-automations/${encodeURIComponent(id)}/runs`);
  console.log(JSON.stringify(result, null, 2));
}

async function reportRunnerStatus(args) {
  const bodyFile = parseFlag(args, "--body");
  const body = bodyFile
    ? JSON.parse(readFileSync(resolve(bodyFile), "utf8"))
    : {};
  const { modelId, productId } = scopeParams(args);
  if (modelId && !body.modelId) body.modelId = modelId;
  if (productId && !body.productId) body.productId = productId;

  const runtime =
    parseFlag(args, "--runtime") ||
    process.env.HYPERGEN_AGENT_RUNTIME ||
    (!bodyFile ? "Codex" : "");
  if (runtime && !body.runtime) body.runtime = runtime;

  const runnerVersion = parseFlag(args, "--runner-version");
  const skillVersion = parseFlag(args, "--skill-version");
  if (runnerVersion) body.runnerVersion = runnerVersion;
  if (skillVersion) body.skillVersion = skillVersion;
  if (args.includes("--offline")) body.online = false;
  else if (!bodyFile && body.online === undefined) body.online = true;

  const capabilities = [
    ...splitList(parseFlag(args, "--capabilities")),
    ...parseFlags(args, "--capability"),
  ];
  if (capabilities.length) body.capabilities = capabilities;

  const browserName = parseFlag(args, "--browser");
  const browserPermission = parseFlag(args, "--browser-permission");
  const browserVerifiedAt = parseFlag(args, "--browser-verified-at");
  if (browserName || browserPermission || browserVerifiedAt) {
    body.browser = {
      ...(body.browser || {}),
      ...(browserName ? { name: browserName } : {}),
      ...(browserPermission ? { permission: browserPermission } : {}),
      ...(browserVerifiedAt
        ? { lastVerifiedAt: browserVerifiedAt }
        : browserPermission === "verified"
          ? { lastVerifiedAt: new Date().toISOString() }
          : {}),
    };
  }

  const socialSessions = parseFlags(args, "--social").map(parseSocialSession);
  if (socialSessions.length) body.socialSessions = socialSessions;

  if (args.includes("--dry-run")) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const result = await api(`${API_PREFIX}/agent-runner-status`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  console.log(JSON.stringify(result, null, 2));
}

function parseSocialSession(value) {
  const [platform, status = "unknown", handle = ""] = String(value).split(":");
  if (!platform) {
    throw new Error("--social requires platform:status[:handle]");
  }
  return {
    platform,
    status,
    ...(handle ? { handle } : {}),
    ...(status === "logged_in" ? { lastVerifiedAt: new Date().toISOString() } : {}),
  };
}

async function permissions(args) {
  const { suffix } = scopeParams(args);
  const result = await api(`${API_PREFIX}/agent-permissions${suffix}`);
  console.log(JSON.stringify(result, null, 2));
}

async function checkPermission(args) {
  const bodyFile = parseFlag(args, "--body");
  if (!bodyFile) throw new Error("--body payload.json is required");
  const body = JSON.parse(readFileSync(resolve(bodyFile), "utf8"));
  const result = await api(`${API_PREFIX}/agent-permissions/check`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function events(args) {
  const { suffix } = scopeParams(args);
  const result = await api(`${API_PREFIX}/agent-events${suffix}`);
  console.log(JSON.stringify(result, null, 2));
}

async function logEvent(args) {
  const bodyFile = parseFlag(args, "--body");
  if (!bodyFile) throw new Error("--body payload.json is required");
  const body = JSON.parse(readFileSync(resolve(bodyFile), "utf8"));
  const result = await api(`${API_PREFIX}/agent-events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function generate(args) {
  const bodyFile = parseFlag(args, "--body");
  if (!bodyFile) throw new Error("--body payload.json is required");
  const body = JSON.parse(readFileSync(resolve(bodyFile), "utf8"));
  const result = await api(`${API_PREFIX}/generate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function poll(args) {
  const jobId = parseFlag(args, "--job-id");
  if (!jobId) throw new Error("--job-id is required");
  const result = await api(`${API_PREFIX}/jobs/${encodeURIComponent(jobId)}`);
  console.log(JSON.stringify(result, null, 2));
}

async function selfTest() {
  const checks = [
    "README.md",
    "SKILL.md",
    "references/api.md",
    "references/image-references.md",
    "references/engagement.md",
    "scripts/check_updates.sh",
    "scripts/hypergen-agent.mjs",
    "hooks/pre-chat.sh",
    "agents/openai.yaml",
  ];
  for (const file of checks) {
    readFileSync(resolve(skillDir, file), "utf8");
  }
  const requiredSnippets = [
    ["README.md", "## Install"],
    ["README.md", "hypergen-agent verify --model-id"],
    ["README.md", "hypergen-agent status --model-id"],
    ["README.md", "hypergen-agent report-runner-status --body"],
    ["README.md", "--browser-permission verified"],
    ["README.md", "--dry-run"],
    ["README.md", "verify` calls `/skill/hypergen/hello?message=hello` first"],
    ["README.md", "403 SCOPE_MISMATCH"],
    ["README.md", "HyperGen cannot grant Safari"],
    ["README.md", "agent-status.connected` as API-key activity only"],
    ["README.md", "Prefer `jobIds`"],
    ["SKILL.md", "Scoped API keys are intentionally narrow"],
    ["SKILL.md", "403 SCOPE_MISMATCH"],
    ["SKILL.md", "HyperGen cannot grant Safari"],
    ["SKILL.md", "API-key activity only"],
    ["SKILL.md", "agent-runner-status"],
    ["SKILL.md", "Use Grok for ordinary image generation/editing"],
    ["SKILL.md", "Hashtags: hard cap at 3"],
    ["SKILL.md", "Never use AI/self-labeling"],
    ["SKILL.md", "Captions must contain real caption text"],
    ["SKILL.md", "Prefer `jobIds"],
    ["SKILL.md", "live catalog's matching `creditCost`"],
    ["SKILL.md", "social-media-autoresearch"],
    ["references/api.md", "## Scoped API Keys"],
    ["references/api.md", "403 SCOPE_MISMATCH"],
    ["references/api.md", "through `jobIds`; the backend resolves"],
    ["references/api.md", "hard cap of 3 total"],
    ["references/api.md", "HyperGen cannot grant private local browser"],
    ["references/engagement.md", "HyperGen permission is not an operating-system permission"],
    ["references/image-references.md", "reference"],
    ["scripts/hypergen-agent.mjs", "status: statusCommand"],
    ["scripts/hypergen-agent.mjs", "reportRunnerStatus"],
    ["scripts/hypergen-agent.mjs", "parseSocialSession"],
    ["scripts/hypergen-agent.mjs", "args.includes(\"--dry-run\")"],
    ["scripts/hypergen-agent.mjs", "api(`${API_PREFIX}/hello?message=hello`)"],
    ["scripts/hypergen-agent.mjs", "parseFlag(args, \"--product-id\")"],
  ];
  const failures = [];
  for (const [file, snippet] of requiredSnippets) {
    const source = readFileSync(resolve(skillDir, file), "utf8");
    if (!source.includes(snippet)) failures.push(`${file} missing ${snippet}`);
  }
  if (failures.length) {
    console.error("hypergen-agent skill self-test failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("ok hypergen-agent skill files present");
}
