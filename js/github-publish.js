(() => {
  "use strict";
  const config = window.PORTFOLIO_GITHUB || {};
  let backend = "";
  try {
    const parsed = new URL(config.backendUrl);
    if (parsed.protocol === "https:") backend = parsed.origin;
  } catch {}
  const server = config.server === true && backend === location.origin;
  let session = null;

  async function request(path, options = {}) {
    if (!server) throw new Error("Open the GitHub-connected editor to publish your changes.");
    let response;
    try {
      response = await fetch(path, {
        ...options, credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", ...(session ? { "X-CSRF-Token": session.csrf } : {}) }
      });
    } catch { throw new Error("The connection was interrupted. Keep your draft and retry the same publish request."); }
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.error || "GitHub publishing is temporarily unavailable.");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  window.PortfolioPublisher = {
    server,
    configured: Boolean(backend) && (!server || config.ready === true),
    loginUrl: backend ? backend + "/auth/login" : "",
    async connect() { session = await request("/api/session"); return session; },
    async load() { return request("/api/content"); },
    async publish(data, expectedHead, requestId) { return request("/api/publish", { method: "POST", body: JSON.stringify({ data, expectedHead, requestId }) }); },
    async logout() { if (session) await request("/api/logout", { method: "POST" }); session = null; }
  };
})();
