import { SITE, REPOSITORY, OWNER_ID, BRANCH, validateContent, renderPublication } from "./content.mjs";

const SESSION_COOKIE = "__Host-portfolio-session";
const STATE_COOKIE = "__Host-portfolio-oauth";
const SESSION_SECONDS = 3600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const now = () => Math.floor(Date.now() / 1000);
const json = (body, status = 200) => Response.json(body, { status });
const redirect = path => new Response(null, { status: 302, headers: { Location: path } });
const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;

function configured(env) {
  try {
    const origin = new URL(env.APP_ORIGIN);
    return origin.protocol === "https:" && origin.origin === env.APP_ORIGIN && Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET?.length >= 32);
  } catch { return false; }
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function seal(value, secret, purpose) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: encoder.encode(purpose) }, await encryptionKey(secret), encoder.encode(JSON.stringify(value)));
  return base64url(new Uint8Array([...nonce, ...new Uint8Array(encrypted)]));
}

async function readCookie(request, env, name) {
  try {
    const encoded = (request.headers.get("Cookie") || "").split(";").map(value => value.trim()).find(value => value.startsWith(name + "="))?.slice(name.length + 1);
    if (!encoded || encoded.length > 5000) return null;
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), value => value.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: encoder.encode(name) }, await encryptionKey(env.SESSION_SECRET), bytes.slice(12));
    const payload = JSON.parse(decoder.decode(decrypted));
    return Number.isFinite(payload.expiresAt) && payload.expiresAt > now() ? payload : null;
  } catch { return null; }
}

async function bodyJson(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Send JSON content.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request content.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 250000) { await reader.cancel(); throw new HttpError(413, "Your portfolio is too large to publish."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(decoder.decode(bytes)); } catch { throw new HttpError(400, "Invalid JSON content."); }
}

function secure(response) {
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Robots-Tag", "noindex, nofollow");
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  return result;
}

export function createWorker({ fetcher = fetch, render = renderPublication } = {}) {
  async function github(token, path, options = {}) {
    let response;
    try {
      response = await fetcher("https://api.github.com" + path, {
        method: options.method || "GET", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "Saleh-Portfolio-Publisher", "X-GitHub-Api-Version": "2022-11-28" },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
    } catch { throw new HttpError(502, "GitHub could not be reached. Your draft is still available."); }
    if (!response.ok) {
      if (response.status === 401) throw new HttpError(401, "Your GitHub session expired. Sign in again.");
      if (options.conflict && [409, 422].includes(response.status)) throw new HttpError(409, "The repository changed during publishing. Reload the published content before trying again.");
      if ([403, 404].includes(response.status)) throw new HttpError(403, "This GitHub App needs Contents read/write access to your portfolio repository.");
      throw new HttpError(502, "GitHub did not accept the request. Your draft is still available.");
    }
    return response.status === 204 ? null : response.json();
  }

  async function owner(token) {
    const user = await github(token, "/user");
    if (user.id !== OWNER_ID) throw new HttpError(403, "Only the portfolio owner can publish changes.");
    const repository = await github(token, "/repos/" + REPOSITORY);
    if (!repository.permissions?.push || repository.owner?.id !== OWNER_ID || repository.default_branch !== BRANCH) throw new HttpError(403, "Your account does not have the expected access to this portfolio.");
    return user;
  }

  async function repositoryFile(token, path, revision) {
    const file = await github(token, "/repos/" + REPOSITORY + "/contents/" + path + "?ref=" + encodeURIComponent(revision));
    if (file.encoding !== "base64" || typeof file.content !== "string") throw new HttpError(502, "GitHub returned an unreadable portfolio file.");
    return decoder.decode(Uint8Array.from(atob(file.content.replace(/\s/g, "")), value => value.charCodeAt(0)));
  }

  async function sessionFor(request, env) {
    const session = await readCookie(request, env, SESSION_COOKIE);
    if (!session?.accessToken || session.ownerId !== OWNER_ID) throw new HttpError(401, "Sign in with GitHub to continue.");
    return session;
  }

  function requireWrite(request, env, session) {
    if (request.headers.get("Origin") !== env.APP_ORIGIN || request.headers.get("X-CSRF-Token") !== session.csrf) throw new HttpError(403, "This publishing request did not come from your editor. Refresh and try again.");
  }

  async function routes(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ready: configured(env) });
    if (url.pathname === "/js/github-config.js" && request.method === "GET") return new Response("window.PORTFOLIO_GITHUB = Object.freeze(" + JSON.stringify({ backendUrl: url.origin, server: true, ready: configured(env) }) + ");", { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
    if (url.pathname === "/" && request.method === "GET") return redirect("/admin.html");
    if (request.method === "GET" && (url.pathname === "/admin.html" || /^\/(css|js)\/[a-zA-Z0-9._-]+$/.test(url.pathname))) return env.ASSETS.fetch(request);
    if (!configured(env) || url.origin !== env.APP_ORIGIN) throw new HttpError(503, "GitHub publishing needs its one-time server setup.");

    if (url.pathname === "/auth/login" && request.method === "GET") {
      const state = random();
      const verifier = random();
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
      const authorize = new URL("https://github.com/login/oauth/authorize");
      authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: env.APP_ORIGIN + "/auth/callback", state, code_challenge: challenge, code_challenge_method: "S256", login: "salehahmed101", allow_signup: "false" }).toString();
      const response = redirect(authorize.href);
      response.headers.append("Set-Cookie", cookie(STATE_COOKIE, await seal({ state, verifier, expiresAt: now() + 600 }, env.SESSION_SECRET, STATE_COOKIE), 600));
      return response;
    }

    if (url.pathname === "/auth/callback" && request.method === "GET") {
      const state = await readCookie(request, env, STATE_COOKIE);
      if (!state || url.searchParams.get("state") !== state.state || !url.searchParams.get("code") || url.searchParams.has("error")) throw new HttpError(400, "GitHub sign-in was cancelled or expired. Return to Admin and try again.");
      const exchange = await fetcher("https://github.com/login/oauth/access_token", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get("code"), redirect_uri: env.APP_ORIGIN + "/auth/callback", code_verifier: state.verifier })
      });
      if (!exchange.ok) throw new HttpError(502, "GitHub sign-in could not be completed. Please try again.");
      const token = await exchange.json();
      if (!token.access_token) throw new HttpError(401, "GitHub did not authorize this session. Please sign in again.");
      const user = await owner(token.access_token);
      const lifetime = Math.min(SESSION_SECONDS, Number(token.expires_in) || SESSION_SECONDS);
      const session = { ownerId: user.id, login: user.login, accessToken: token.access_token, csrf: random(), expiresAt: now() + lifetime };
      const response = redirect("/admin.html");
      response.headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
      response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, await seal(session, env.SESSION_SECRET, SESSION_COOKIE), lifetime));
      return response;
    }

    const session = await sessionFor(request, env);
    if (url.pathname === "/api/session" && request.method === "GET") {
      const user = await owner(session.accessToken);
      return json({ login: user.login, csrf: session.csrf, repository: REPOSITORY, expiresAt: session.expiresAt });
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      requireWrite(request, env, session);
      const revoked = await fetcher("https://api.github.com/applications/" + encodeURIComponent(env.GITHUB_CLIENT_ID) + "/token", {
        method: "DELETE", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: "Basic " + btoa(env.GITHUB_CLIENT_ID + ":" + env.GITHUB_CLIENT_SECRET), Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "Saleh-Portfolio-Publisher" },
        body: JSON.stringify({ access_token: session.accessToken })
      });
      if (!revoked.ok && revoked.status !== 404) throw new HttpError(502, "GitHub could not revoke this session. Please retry signing out.");
      const response = json({ signedOut: true });
      response.headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      return response;
    }
    if (url.pathname === "/index.html" && request.method === "GET") {
      const template = await repositoryFile(session.accessToken, "index.html", BRANCH);
      return new Response(template, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/api/content" && request.method === "GET") {
      await owner(session.accessToken);
      const reference = await github(session.accessToken, "/repos/" + REPOSITORY + "/git/ref/heads/" + BRANCH);
      const raw = await repositoryFile(session.accessToken, "content.json", reference.object.sha);
      return json({ head: reference.object.sha, data: validateContent(JSON.parse(raw)) });
    }
    if (url.pathname === "/api/publish" && request.method === "POST") {
      requireWrite(request, env, session);
      await owner(session.accessToken);
      const body = await bodyJson(request);
      if (!/^[a-f0-9]{40}$/.test(body.expectedHead || "") || !/^[a-f0-9-]{36}$/.test(body.requestId || "")) throw new HttpError(400, "Reload the published content before publishing.");
      let data;
      try { data = validateContent(body.data); } catch (error) { throw new HttpError(400, error.message); }
      const prefix = "/repos/" + REPOSITORY;
      const reference = await github(session.accessToken, prefix + "/git/ref/heads/" + BRANCH);
      const head = reference.object.sha;
      const parent = await github(session.accessToken, prefix + "/git/commits/" + head);
      const content = JSON.stringify(data, null, 2) + "\n";
      const message = "Publish portfolio from Admin\n\nRequest: " + body.requestId;
      if (head !== body.expectedHead) {
        if (parent.message === message && await repositoryFile(session.accessToken, "content.json", head) === content) return json({ commit: head, url: SITE, commitUrl: "https://github.com/" + REPOSITORY + "/commit/" + head, alreadyPublished: true });
        throw new HttpError(409, "The repository changed since you opened the editor. Save a backup, then reload the published content and reapply your edits.");
      }
      const template = await repositoryFile(session.accessToken, "index.html", head);
      const html = await render(template, data);
      const dataScript = "window.PORTFOLIO_DEFAULTS = " + JSON.stringify(data, null, 2).replace(/</g, "\\u003c") + ";\n";
      const tree = await github(session.accessToken, prefix + "/git/trees", { method: "POST", body: { base_tree: parent.tree.sha, tree: [{ path: "content.json", mode: "100644", type: "blob", content }, { path: "js/data.js", mode: "100644", type: "blob", content: dataScript }, { path: "index.html", mode: "100644", type: "blob", content: html }] } });
      const commit = await github(session.accessToken, prefix + "/git/commits", { method: "POST", body: { message, tree: tree.sha, parents: [head] } });
      await github(session.accessToken, prefix + "/git/refs/heads/" + BRANCH, { method: "PATCH", body: { sha: commit.sha, force: false }, conflict: true });
      return json({ commit: commit.sha, url: SITE, commitUrl: "https://github.com/" + REPOSITORY + "/commit/" + commit.sha });
    }
    throw new HttpError(404, "This page was not found.");
  }

  return {
    async fetch(request, env) {
      try { return secure(await routes(request, env)); }
      catch (error) { return secure(json({ error: error instanceof HttpError ? error.message : "The publishing service could not finish this request. Your draft is still available." }, error instanceof HttpError ? error.status : 500)); }
    }
  };
}

export default createWorker();
