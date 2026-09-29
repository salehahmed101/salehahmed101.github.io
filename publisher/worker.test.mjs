import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWorker } from "./worker.mjs";
import { validateContent, publicationParts, REPOSITORY, OWNER_ID } from "./content.mjs";

const content = JSON.parse(await readFile(new URL("../content.json", import.meta.url), "utf8"));
const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
const originalHead = "a".repeat(40);
const nextHead = "b".repeat(40);
const requestId = "00000000-0000-4000-8000-000000000001";

function harness(options = {}) {
  const calls = [];
  let currentHead = originalHead;
  let currentMessage = "Previous update";
  let committedData = JSON.stringify(content, null, 2) + "\n";
  const env = {
    APP_ORIGIN: "https://publisher.example.test",
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    SESSION_SECRET: "test-only-session-key-not-for-production-12345678",
    ASSETS: { fetch: async () => new Response("asset") }
  };
  const response = (data, status = 200) => Response.json(data, { status });
  const worker = createWorker({
    render: async (html, data) => { assert.equal(html, template); assert.equal(data.hero.name, content.hero.name); return "rendered-homepage"; },
    fetcher: async (url, init = {}) => {
      const target = new URL(url);
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ url: target.href, path: target.pathname, method: init.method || "GET", body, headers: init.headers, redirect: init.redirect });
      if (init.redirect === "error") throw new TypeError("Cloudflare Workers does not support redirect: error.");
      if (target.pathname === options.redirectPath) return new Response(null, { status: 302, headers: { Location: "https://unexpected.example.test/" } });
      if (target.hostname === "github.com") return response({ access_token: "test-user-access-token", expires_in: 28800 });
      assert.equal(target.hostname, "api.github.com");
      if (target.pathname === "/user") return response({ id: options.ownerId ?? OWNER_ID, login: "salehahmed101" });
      if (target.pathname.startsWith("/applications/") && init.method === "DELETE") return new Response(null, { status: 204 });
      assert.ok(target.pathname.startsWith("/repos/" + REPOSITORY));
      const path = target.pathname.slice(("/repos/" + REPOSITORY).length);
      if (!path) return response({ permissions: { push: options.push ?? true }, owner: { id: OWNER_ID }, default_branch: "main" });
      if (path === "/git/ref/heads/main") return response({ object: { sha: currentHead } });
      if (path.startsWith("/git/commits/") && init.method !== "POST") return response({ tree: { sha: "tree-sha" }, message: currentMessage });
      if (path.startsWith("/contents/")) return response({ encoding: "base64", content: Buffer.from(path.endsWith("index.html") ? template : committedData).toString("base64") });
      if (path === "/git/trees") {
        committedData = body.tree.find(entry => entry.path === "content.json").content;
        return response({ sha: "new-tree-sha" });
      }
      if (path === "/git/commits" && init.method === "POST") { currentMessage = body.message; return response({ sha: nextHead }); }
      if (path === "/git/refs/heads/main" && init.method === "PATCH") {
        if (options.race) return response({ message: "Not a fast-forward" }, 422);
        currentHead = nextHead;
        return response({ object: { sha: nextHead } });
      }
      throw new Error("Unexpected request: " + url);
    }
  });
  const call = (path, init = {}) => worker.fetch(new Request(env.APP_ORIGIN + path, init), env);
  async function login() {
    const started = await call("/auth/login");
    assert.equal(started.status, 302);
    const authorize = new URL(started.headers.get("Location"));
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorize.searchParams.has("scope"), false);
    const stateCookie = started.headers.getSetCookie()[0].split(";")[0];
    const callback = await call("/auth/callback?code=test-code&state=" + authorize.searchParams.get("state"), { headers: { Cookie: stateCookie } });
    return { callback, stateCookie, authorize };
  }
  async function authorized() {
    const { callback } = await login();
    assert.equal(callback.status, 302);
    const storedCookie = callback.headers.getSetCookie().find(value => value.startsWith("__Host-portfolio-session="));
    assert.match(storedCookie, /HttpOnly/);
    assert.match(storedCookie, /Secure/);
    assert.match(storedCookie, /SameSite=Lax/);
    assert.ok(!storedCookie.includes("test-user-access-token"));
    const sessionCookie = storedCookie.split(";")[0];
    const sessionResponse = await call("/api/session", { headers: { Cookie: sessionCookie } });
    const session = await sessionResponse.json();
    assert.ok(!JSON.stringify(session).includes("test-user-access-token"));
    return { Cookie: sessionCookie, Origin: env.APP_ORIGIN, "X-CSRF-Token": session.csrf, "Content-Type": "application/json" };
  }
  return { call, calls, env, login, authorized, changeHead: () => { currentHead = "c".repeat(40); } };
}

test("unconfigured service fails closed and requires authentication", async () => {
  const backend = harness();
  assert.equal((await backend.call("/api/content")).status, 401);
  assert.equal((await backend.call("/api/publish", { method: "POST" })).status, 401);
  backend.env.GITHUB_CLIENT_SECRET = "";
  assert.deepEqual(await (await backend.call("/health")).json(), { ready: false });
  assert.equal((await backend.call("/auth/login")).status, 503);
});

test("OAuth binds state and PKCE, and rejects other GitHub users", async () => {
  const backend = harness();
  const started = await backend.call("/auth/login");
  const cookie = started.headers.getSetCookie()[0].split(";")[0];
  assert.equal((await backend.call("/auth/callback?code=x&state=wrong", { headers: { Cookie: cookie } })).status, 400);
  assert.equal(backend.calls.length, 0);
  const stranger = harness({ ownerId: 999 });
  assert.equal((await stranger.login()).callback.status, 403);
  const readOnly = harness({ push: false });
  assert.equal((await readOnly.login()).callback.status, 403);
  const success = await backend.login();
  assert.equal(success.callback.status, 302);
  assert.ok(backend.calls.find(call => call.path === "/login/oauth/access_token").body.code_verifier);
});

test("publishing rejects cross-origin requests, bad CSRF, and forged sessions", async () => {
  const backend = harness();
  const headers = await backend.authorized();
  const body = JSON.stringify({ expectedHead: originalHead, requestId, data: content });
  assert.equal((await backend.call("/api/publish", { method: "POST", headers: { ...headers, Origin: "https://attacker.example" }, body })).status, 403);
  assert.equal((await backend.call("/api/publish", { method: "POST", headers: { ...headers, "X-CSRF-Token": "wrong" }, body })).status, 403);
  assert.equal((await backend.call("/api/content", { headers: { Cookie: "__Host-portfolio-session=forged" } })).status, 401);
  assert.equal(backend.calls.filter(call => ["POST", "PATCH"].includes(call.method) && call.path.startsWith("/repos/")).length, 0);
});

test("GitHub redirects fail closed without forwarding credentials", async () => {
  const options = { redirectPath: "/login/oauth/access_token" };
  const backend = harness(options);
  const rejected = (await backend.login()).callback;
  assert.equal(rejected.status, 502);
  assert.equal(rejected.headers.getSetCookie().length, 0);
  options.redirectPath = "";
  const headers = await backend.authorized();
  options.redirectPath = "/user";
  assert.equal((await backend.call("/api/content", { headers })).status, 502);
  options.redirectPath = "/applications/test-client-id/token";
  assert.equal((await backend.call("/api/logout", { method: "POST", headers })).status, 502);
  assert.ok(backend.calls.every(call => call.redirect === "manual"));
  assert.ok(backend.calls.every(call => new URL(call.url).hostname !== "unexpected.example.test"));
});

test("publishes only the fixed content files in one non-forced commit", async () => {
  const backend = harness();
  const headers = await backend.authorized();
  const result = await backend.call("/api/publish", { method: "POST", headers, body: JSON.stringify({ expectedHead: originalHead, requestId, data: content, repository: "attacker/other", path: "js/admin.js", html: "untrusted html" }) });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).commit, nextHead);
  const tree = backend.calls.find(call => call.path.endsWith("/git/trees"));
  assert.deepEqual(tree.body.tree.map(entry => entry.path), ["content.json", "js/data.js", "index.html"]);
  assert.equal(tree.body.base_tree, "tree-sha");
  assert.equal(tree.body.tree[2].content, "rendered-homepage");
  const update = backend.calls.find(call => call.method === "PATCH");
  assert.deepEqual(update.body, { sha: nextHead, force: false });
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal(result.headers.get("X-Robots-Tag"), "noindex, nofollow");
});

test("rejects stale drafts and concurrent ref updates without forcing", async () => {
  const backend = harness();
  const headers = await backend.authorized();
  backend.changeHead();
  assert.equal((await backend.call("/api/publish", { method: "POST", headers, body: JSON.stringify({ expectedHead: originalHead, requestId, data: content }) })).status, 409);
  assert.equal(backend.calls.filter(call => call.path.endsWith("/git/trees")).length, 0);
  const racing = harness({ race: true });
  const raceHeaders = await racing.authorized();
  assert.equal((await racing.call("/api/publish", { method: "POST", headers: raceHeaders, body: JSON.stringify({ expectedHead: originalHead, requestId, data: content }) })).status, 409);
});

test("an identical retry returns the existing commit", async () => {
  const backend = harness();
  const headers = await backend.authorized();
  const body = JSON.stringify({ expectedHead: originalHead, requestId, data: content });
  assert.equal((await backend.call("/api/publish", { method: "POST", headers, body })).status, 200);
  const retry = await backend.call("/api/publish", { method: "POST", headers, body });
  assert.equal((await retry.json()).alreadyPublished, true);
  assert.equal(backend.calls.filter(call => call.path.endsWith("/git/trees")).length, 1);
});

test("validates content, blocks unsafe links, and escapes HTML and JSON-LD", () => {
  assert.equal(validateContent(content).hero.name, "Saleh Ahmed");
  const unsafe = structuredClone(content);
  unsafe.hero.primaryUrl = "javascript:alert(1)";
  assert.throws(() => validateContent(unsafe));
  const text = structuredClone(content);
  text.hero.name = '</script><img src=x onerror="alert(1)">';
  const parts = publicationParts(validateContent(text));
  assert.ok(!parts.html["hero-name"].includes("<img"));
  assert.ok(!parts.html["profile-schema"].includes("</script>"));
  assert.equal(JSON.parse(parts.html["profile-schema"])["@graph"][1].mainEntity.name, text.hero.name);
});

test("rejects oversized content and revokes the GitHub token on logout", async () => {
  const backend = harness();
  const headers = await backend.authorized();
  const large = await backend.call("/api/publish", { method: "POST", headers, body: JSON.stringify({ data: "a".repeat(250001) }) });
  assert.equal(large.status, 413);
  const loggedOut = await backend.call("/api/logout", { method: "POST", headers });
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.getSetCookie()[0], /Max-Age=0/);
  assert.ok(backend.calls.some(call => call.method === "DELETE" && call.path === "/applications/test-client-id/token"));
});
