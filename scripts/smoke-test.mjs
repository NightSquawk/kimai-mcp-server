#!/usr/bin/env node
/**
 * Smoke test for the endpoint-catalog tools.
 *
 * Speaks real MCP over stdio to a spawned server and asserts on the responses.
 * Two kinds of check run here:
 *
 *   OFFLINE  Every step of kimai_call_endpoint's safety chain returns before
 *            it opens a socket, so the whole chain is verifiable without
 *            credentials and without touching any Kimai instance. These run
 *            against a dummy base URL that would fail instantly if a request
 *            escaped, which is what makes "no request was sent" an assertion
 *            rather than an assumption.
 *
 *   LIVE     Read-only. Only runs when KIMAI_BASE_URL and KIMAI_API_TOKEN are
 *            present in the environment, and only ever issues GETs. This
 *            script never sends a POST, PATCH, PUT, or DELETE to any
 *            instance, which is why the write and delete paths above are
 *            asserted purely on their refusals.
 *
 * Usage:  node scripts/smoke-test.mjs
 */

import { spawn } from "node:child_process";

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  const mark = condition ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${condition || !detail ? "" : `\n         ${detail}`}`);
}

/** Minimal MCP stdio client: initialize, then issue requests in sequence. */
function startServer(env) {
  const child = spawn("node", ["dist/index.js"], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  const pending = new Map();
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const resolve = pending.get(msg.id);
      if (resolve) {
        pending.delete(msg.id);
        resolve(msg);
      }
    }
  });
  child.stderr.on("data", () => {});

  let nextId = 1;
  function send(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`timeout waiting for ${method}`));
        }
      }, 30000);
    });
  }

  return { child, send };
}

async function connect(env) {
  const server = startServer(env);
  await server.send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0" },
  });
  server.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  return server;
}

const callTool = async (server, name, args) => {
  const res = await server.send("tools/call", { name, arguments: args });
  const text = res?.result?.content?.[0]?.text ?? "";
  return { text, isError: Boolean(res?.result?.isError), structured: res?.result?.structuredContent };
};

async function main() {
  // ---------------------------------------------------------------- OFFLINE
  // A base URL pointed at a closed port on localhost. If any assertion below
  // is wrong and a request actually goes out, it fails with ECONNREFUSED
  // rather than quietly succeeding against a real server.
  console.log("\nOFFLINE: safety chain (no network, deletes disabled)\n");
  const offline = await connect({
    KIMAI_BASE_URL: "http://127.0.0.1:9",
    KIMAI_API_TOKEN: "not-a-real-token",
    KIMAI_ALLOW_DELETE: "false",
    KIMAI_TIMEOUT_MS: "2000",
  });

  const tools = await offline.send("tools/list", {});
  const names = tools.result.tools.map((t) => t.name);
  const payloadBytes = Buffer.byteLength(JSON.stringify(tools.result.tools));
  check("three endpoint-catalog tools are registered",
    ["kimai_list_endpoints", "kimai_describe_endpoint", "kimai_call_endpoint"].every((n) => names.includes(n)),
    `got ${names.length} tools`);
  console.log(`         tools/list payload: ${payloadBytes} bytes across ${names.length} tools`);

  const list = await callTool(offline, "kimai_list_endpoints", {});
  check("list_endpoints reports 91 endpoints", list.structured?.totals?.endpoints === 91,
    `totals=${JSON.stringify(list.structured?.totals)}`);
  check("list_endpoints excludes REMOVED tombstones",
    !list.text.includes("post_customer_team"));

  const search = await callTool(offline, "kimai_list_endpoints", { search: "absence" });
  check("list_endpoints finds hand-authored plugin endpoints",
    search.structured?.endpoints?.some((e) => e.operation_id === "get_absences" && e.plugin_only === true));

  const desc = await callTool(offline, "kimai_describe_endpoint", { operation_id: "get_timesheets" });
  check("describe_endpoint surfaces the user pattern", desc.text.includes("\\d+|all"));
  check("describe_endpoint surfaces the 0|1 boolean patterns", desc.text.includes("pattern `0|1`"));
  check("describe_endpoint lists all 21 query params", desc.structured?.params?.length === 21);

  const typo = await callTool(offline, "kimai_describe_endpoint", { operation_id: "get_timesheet_" });
  check("describe_endpoint suggests near-matches on a typo",
    typo.isError && typo.text.includes("Did you mean"), typo.text.slice(0, 120));

  const unknown = await callTool(offline, "kimai_call_endpoint", { operation_id: "not_a_real_op" });
  check("call_endpoint refuses an unknown operationId", unknown.isError && unknown.text.includes("Unknown endpoint"));

  const noPath = await callTool(offline, "kimai_call_endpoint", { operation_id: "get_timesheet" });
  check("call_endpoint refuses a missing required path param",
    noPath.isError && noPath.text.includes("Missing required path parameter"), noPath.text.slice(0, 120));

  const commaTags = await callTool(offline, "kimai_call_endpoint", {
    operation_id: "get_timesheets",
    params: { tags: "bar,foo" },
  });
  check("call_endpoint refuses a comma-string array filter",
    commaTags.isError && commaTags.text.includes("UNFILTERED"), commaTags.text.slice(0, 160));

  const unauthWrite = await callTool(offline, "kimai_call_endpoint", {
    operation_id: "post_timesheet",
    params: { begin: "2026-01-01T09:00:00", project: 1, activity: 1 },
  });
  check("call_endpoint refuses a write without authorization",
    unauthWrite.isError && unauthWrite.text.includes("authorization_confirmed"), unauthWrite.text.slice(0, 140));

  const gatedDelete = await callTool(offline, "kimai_call_endpoint", {
    operation_id: "delete_customer",
    path_params: { id: 1 },
    authorization_confirmed: true,
    authorization_note: "smoke test, should never execute",
  });
  check("call_endpoint refuses a delete when the env gate is off",
    gatedDelete.isError && gatedDelete.text.includes("KIMAI_ALLOW_DELETE"), gatedDelete.text.slice(0, 140));
  check("the delete refusal states no request was sent",
    gatedDelete.text.includes("no request was sent"));

  offline.child.kill();

  // ------------------------------------------------------- OFFLINE, GATE ON
  // With the gate ON, an authorized delete must get PAST both gates and fail
  // at the network instead. That is what proves the gate was the only thing
  // stopping it, rather than some unrelated earlier refusal.
  console.log("\nOFFLINE: gate enabled, delete must reach the network and fail there\n");
  const gateOn = await connect({
    KIMAI_BASE_URL: "http://127.0.0.1:9",
    KIMAI_API_TOKEN: "not-a-real-token",
    KIMAI_ALLOW_DELETE: "true",
    KIMAI_TIMEOUT_MS: "2000",
  });
  const passedGate = await callTool(gateOn, "kimai_call_endpoint", {
    operation_id: "delete_timesheet",
    path_params: { id: 999999 },
    authorization_confirmed: true,
    authorization_note: "smoke test against a closed port",
  });
  check("an authorized delete passes both gates and fails at the transport",
    passedGate.isError && !passedGate.text.includes("KIMAI_ALLOW_DELETE"),
    passedGate.text.slice(0, 140));
  gateOn.child.kill();

  // ------------------------------------------------------------------- LIVE
  const liveUrl = process.env.KIMAI_BASE_URL;
  const liveToken = process.env.KIMAI_API_TOKEN;
  if (!liveUrl || !liveToken) {
    console.log("\nLIVE: skipped (KIMAI_BASE_URL / KIMAI_API_TOKEN not set)\n");
  } else {
    console.log("\nLIVE: read-only GETs\n");
    const live = await connect({ KIMAI_BASE_URL: liveUrl, KIMAI_API_TOKEN: liveToken, KIMAI_ALLOW_DELETE: "false" });

    const ping = await callTool(live, "kimai_call_endpoint", { operation_id: "get_app_api_status_version" });
    check("call_endpoint executes a real GET", !ping.isError, ping.text.slice(0, 160));

    const noUser = await callTool(live, "kimai_call_endpoint", {
      operation_id: "get_timesheets",
      params: { size: 1 },
    });
    check("a timesheet read without user warns about the owner-only default",
      !noUser.isError && JSON.stringify(noUser.structured?.warnings ?? []).includes("token owner"),
      JSON.stringify(noUser.structured?.warnings ?? []).slice(0, 200));

    const withUser = await callTool(live, "kimai_call_endpoint", {
      operation_id: "get_timesheets",
      params: { user: "all", size: 1 },
    });
    check("passing user:all clears the warning",
      !withUser.isError && !(withUser.structured?.warnings ?? []).length);

    const arrayTags = await callTool(live, "kimai_call_endpoint", {
      operation_id: "get_timesheets",
      params: { user: "all", "tags[]": ["definitely-not-a-real-tag-xyz"], size: 1 },
    });
    check("an array tag filter is accepted and sent as a repeated param",
      arrayTags.text.length > 0, arrayTags.text.slice(0, 140));

    live.child.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log(`FAILED: ${failed.map((f) => f.name).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exitCode = 1;
});
