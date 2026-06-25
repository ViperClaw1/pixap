#!/usr/bin/env node
/**
 * Syncs the Retell agent config from retell/ files to the Retell API.
 *
 * Usage (PowerShell):
 *   $env:RETELL_API_KEY="key"; $env:RETELL_AGENT_ID="agent_xxx"; npm run retell:sync:dry
 *
 * Or: add RETELL_API_KEY and RETELL_AGENT_ID to the root .env file — this script loads it automatically.
 *
 * What it does:
 *   1. Fetches the current agent config from Retell.
 *   2. If the agent uses Retell LLM — patches the LLM with the new system prompt
 *      and post-call analysis schema.
 *   3. Patches the agent with call-level settings (IVR detection, voicemail detection).
 *   4. Prints a diff-style summary of what changed.
 */

const fs = require("fs");
const path = require("path");

// Load .env from repo root (two levels up from scripts/) without requiring dotenv package.
(function loadDotEnv() {
  const envPath = path.join(__dirname, "..", "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
})();

// Base URL has NO /v2/ suffix — confirmed from retell-sdk source (client.js).
// Phone call API uses /v2/create-phone-call separately; agent/LLM management does not use /v2/.
const RETELL_API_BASE = "https://api.retellai.com";

function log(msg) {
  console.log(`[sync-retell] ${msg}`);
}

function err(msg) {
  console.error(`[sync-retell] ERROR: ${msg}`);
}

async function retellRequest(method, path, body) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("RETELL_API_KEY env var is required");

  const response = await fetch(`${RETELL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Retell API ${method} ${path} → ${response.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

function loadLocalConfig() {
  const root = path.join(__dirname, "..", "retell");

  const promptPath = path.join(root, "agent.prompt.txt");
  const schemaPath = path.join(root, "post-call-analysis.json");

  if (!fs.existsSync(promptPath)) throw new Error(`Missing: ${promptPath}`);
  if (!fs.existsSync(schemaPath)) throw new Error(`Missing: ${schemaPath}`);

  const prompt = fs.readFileSync(promptPath, "utf8").trim();
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

  return { prompt, schema };
}

function printDiff(label, before, after) {
  const bStr = JSON.stringify(before, null, 2) ?? "undefined";
  const aStr = JSON.stringify(after, null, 2) ?? "undefined";
  if (bStr === aStr) {
    log(`  ${label}: no change`);
  } else {
    log(`  ${label}: CHANGED`);
    log(`    before: ${bStr.slice(0, 200)}${bStr.length > 200 ? "…" : ""}`);
    log(`    after:  ${aStr.slice(0, 200)}${aStr.length > 200 ? "…" : ""}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const agentId = process.env.RETELL_AGENT_ID;
  if (!agentId) {
    err("RETELL_AGENT_ID env var is required");
    process.exit(1);
  }

  log(`Agent ID: ${agentId}${dryRun ? " (dry-run — no writes)" : ""}`);

  const { prompt, schema } = loadLocalConfig();
  log(`Loaded prompt (${prompt.length} chars) and post-call schema (${schema.length} fields)`);

  // ── 1. Fetch current agent ──────────────────────────────────────────────────
  log("Fetching current agent config…");
  const agent = await retellRequest("GET", `/get-agent/${agentId}`);

  log(`Agent name: ${agent.agent_name ?? "(unnamed)"}`);
  log(`Response engine type: ${agent.response_engine?.type ?? "unknown"}`);

  // ── 2. Sync LLM (if Retell-managed) ────────────────────────────────────────
  const llmId = agent.response_engine?.type === "retell-llm" ? agent.response_engine.llm_id : null;

  if (llmId) {
    log(`LLM ID: ${llmId}`);
    log("Fetching current LLM config…");
    const llm = await retellRequest("GET", `/get-retell-llm/${llmId}`);

    const llmUpdate = {};

    if (llm.general_prompt !== prompt) {
      llmUpdate.general_prompt = prompt;
    }

    const currentSchema = JSON.stringify(llm.post_call_analysis_data ?? []);
    const nextSchema = JSON.stringify(schema);
    if (currentSchema !== nextSchema) {
      llmUpdate.post_call_analysis_data = schema;
    }

    if (Object.keys(llmUpdate).length === 0) {
      log("LLM: already up to date");
    } else {
      log("LLM changes:");
      if (llmUpdate.general_prompt !== undefined) {
        printDiff("general_prompt length", llm.general_prompt?.length, prompt.length);
      }
      if (llmUpdate.post_call_analysis_data !== undefined) {
        printDiff("post_call_analysis_data", llm.post_call_analysis_data, schema);
      }

      if (!dryRun) {
        await retellRequest("PATCH", `/update-retell-llm/${llmId}`, llmUpdate);
        log("LLM updated ✓");
      } else {
        log("LLM update skipped (dry-run)");
      }
    }
  } else {
    log("Agent uses a custom LLM — skipping LLM prompt sync.");
    log("Update the system prompt in your custom LLM endpoint manually.");
  }

  // ── 3. Sync agent call settings ────────────────────────────────────────────
  const agentUpdate = {};

  if (!agent.enable_voicemail_detection) {
    agentUpdate.enable_voicemail_detection = true;
  }
  if (!agent.enable_ivr_navigation) {
    agentUpdate.enable_ivr_navigation = true;
  }

  if (Object.keys(agentUpdate).length === 0) {
    log("Agent call settings: already up to date");
  } else {
    log("Agent call settings changes:");
    for (const [k, v] of Object.entries(agentUpdate)) {
      printDiff(k, agent[k], v);
    }

    if (!dryRun) {
      await retellRequest("PATCH", `/update-agent/${agentId}`, agentUpdate);
      log("Agent call settings updated ✓");
    } else {
      log("Agent update skipped (dry-run)");
    }
  }

  log("Done.");
}

main().catch((e) => {
  err(String(e));
  process.exit(1);
});
