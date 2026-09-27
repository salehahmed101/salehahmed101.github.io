# Activate GitHub publishing

The publishing service is implemented but is not connected to a hosting account or GitHub App yet. Until setup is complete, the public Admin retains its password-protected local editor and manual exports. It does not claim that local saves publish the site.

The public portfolio stays at https://salehahmed101.github.io/. The connected editor runs on a Cloudflare Worker, with GitHub authentication and the editor on the same origin so smartphone browsers do not need third-party cookies.

## Deploy the service

Open a terminal in this `publisher` directory. Install the locked dependencies with `npm ci`, run `npm test`, then run `npx wrangler login` and complete Cloudflare sign-in in your browser. Choose your own Cloudflare account. Run `npm run deploy` to provision the Worker and note its actual HTTPS URL. The initial deployment is intentionally unconfigured and refuses publishing.

Set `APP_ORIGIN` in `wrangler.toml` to that exact URL, without a trailing slash. Do not substitute the public GitHub Pages URL: these are different services.

## Register a GitHub App

In the `salehahmed101` GitHub account, open **Settings → Developer settings → GitHub Apps → New GitHub App**.

- Choose an available name such as **Saleh Ahmed Portfolio Publisher**.
- Homepage URL: `https://salehahmed101.github.io/`.
- Callback URL: your actual Worker origin followed by `/auth/callback`.
- Enable expiring user authorization tokens and PKCE if a corresponding option is shown.
- Leave Device Flow disabled. Disable webhooks; this service does not need them.
- Repository permissions: **Contents: Read and write**. Metadata read access is automatically included. Do not grant Actions, Administration, or organization permissions.
- Allow installation only on this account.

Create the app, then install it on **only** `salehahmed101.github.io`. Copy the app's **Client ID** into `GITHUB_CLIENT_ID` in `wrangler.toml`. Use the Client ID, not the numeric App ID. Generate a Client Secret in the app settings.

Set secrets directly in the terminal using these prompts:

```powershell
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

For `SESSION_SECRET`, generate a fresh random value with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, then enter that value at the second prompt. Store secrets only in Cloudflare secret storage. Do not add them to `wrangler.toml`, source files, GitHub, or chat. This flow does not use a personal access token or a GitHub App private key.

Run `npm run deploy` again. Visit the Worker URL followed by `/health`; it should return `{"ready":true}`. This only checks configuration, so complete the sign-in test below before connecting the public Admin link.

## Connect the public Admin

At the Worker origin, open `/admin.html` and choose **Sign in with GitHub**. Authorize the app as `salehahmed101`. The backend also checks the immutable GitHub owner ID `75369858`, repository ownership, and push access. The repository and branch are fixed in `content.mjs`.

After sign-in, confirm the current published content loads. Make a small deliberate edit and choose **Publish to GitHub**. Verify the commit contains only `content.json`, `js/data.js`, and `index.html`, and check the Pages deployment. Restore the text if the change was only a test. Sign out and confirm that publishing again requires GitHub authentication.

Then set the public `js/github-config.js` file to:

```js
window.PORTFOLIO_GITHUB = Object.freeze({
  backendUrl: "YOUR_ACTUAL_HTTPS_WORKER_ORIGIN",
  server: false
});
```

Upload that file to GitHub. The portfolio's existing footer Admin link now presents GitHub sign-in and takes you to the connected editor. The Worker serves its own configuration dynamically; do not set `server: true` in the public file.

## How publishing works

- **Save draft** stores a recovery copy only in the current browser. **Publish to GitHub** publishes the current draft.
- The server validates the content and renders the HTML itself using the current repository homepage as its template. It preserves the Google verification tag, styling, and scripts. It does not accept raw HTML, arbitrary repository names, branches, or file paths from the browser.
- The JSON content, JavaScript defaults, and complete SEO homepage are committed together, preserving other repository files. `content.json` is the connected editor's publication source.
- Each publish checks the repository revision loaded when editing began. A newer commit causes a conflict rather than overwriting it. Save a JSON backup, reload the editor to get the latest content, and reapply or import the changes intentionally.
- A connection interruption can leave the success response uncertain. Retrying the same unchanged draft recognizes the existing commit if it already succeeded.
- GitHub access tokens are kept in authenticated encrypted, HttpOnly, Secure cookies; client secrets remain on the server. Tokens are not returned to browser JavaScript or stored in localStorage. Sessions last at most one hour; sign-out revokes the GitHub user token.
- The Worker and Admin responses use `noindex` and `no-store`. The public portfolio and sitemap remain on GitHub Pages.

For a local draft made before setup, export JSON from the old local editor and import it into the GitHub-connected editor. Review the live preview before publishing.

Manual exports remain available as a fallback. If uploading `index.html` and `js/data.js` manually, also replace `content.json` with the corresponding JSON backup so the connected editor opens the same content.

Changes to the editor's own code require another Worker deployment because its eight public assets are bundled. Editing portfolio content through Publish does not require redeploying the Worker. After installing updates run `npm ci`, `npm test`, `npm run check`, and `npm run deploy`.

Official references: [GitHub App user authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-on-behalf-of-a-user), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), and [GitHub non-forced reference updates](https://docs.github.com/en/rest/git/refs#update-a-reference).
