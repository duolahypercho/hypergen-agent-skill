#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(__dirname, "..");

const API_BASE = process.env.HYPERGEN_API_BASE || "https://api.hypercho.com";
const APP_BASE = process.env.HYPERGEN_APP_BASE || "https://hypergen.hypercho.com";
const API_PREFIX = "/skill/hypergen";

const commands = {
  help,
  "check-updates": checkUpdates,
  verify,
  "download-docs": downloadDocs,
  automations,
  "save-automation": saveAutomation,
  "run-automation": runAutomation,
  "automation-runs": automationRuns,
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
  hypergen-agent verify [--model-id ID]
  hypergen-agent download-docs --model-id ID [--out DIR]
  hypergen-agent automations [--model-id ID]
  hypergen-agent save-automation --body payload.json
  hypergen-agent run-automation --id ID
  hypergen-agent automation-runs --id ID
  hypergen-agent generate --body payload.json
  hypergen-agent poll --job-id ID
  hypergen-agent self-test

Environment:
  HYPERGEN_API_KEY   Required for live API calls
  HYPERGEN_API_BASE  Defaults to ${API_BASE}
  HYPERGEN_APP_BASE  Defaults to ${APP_BASE}

Important:
  Agent API paths use ${API_PREFIX}. Do not call bare /generate or /credits.
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
  const modelId = parseFlag(args, "--model-id") || process.env.HYPERGEN_MODEL_ID;
  const [catalog, credits] = await Promise.all([
    api(`${API_PREFIX}/catalog`),
    api(`${API_PREFIX}/credits`),
  ]);
  const output = {
    apiBase: API_BASE,
    catalogOk: Boolean(catalog?.success),
    credits: credits?.data,
  };
  if (modelId) {
    const model = await api(`${API_PREFIX}/models/${encodeURIComponent(modelId)}`);
    output.model = {
      modelId: model?.data?.modelId,
      name: model?.data?.name,
      handle: model?.data?.handle,
    };
  }
  console.log(JSON.stringify(output, null, 2));
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

async function automations(args) {
  const modelId = parseFlag(args, "--model-id") || process.env.HYPERGEN_MODEL_ID;
  const qs = new URLSearchParams();
  if (modelId) qs.set("modelId", modelId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
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
    "SKILL.md",
    "references/api.md",
    "references/image-references.md",
    "scripts/check_updates.sh",
    "scripts/hypergen-agent.mjs",
    "hooks/pre-chat.sh",
    "agents/openai.yaml",
  ];
  for (const file of checks) {
    readFileSync(resolve(skillDir, file), "utf8");
  }
  console.log("ok hypergen-agent skill files present");
}
