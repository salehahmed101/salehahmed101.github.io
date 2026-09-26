# Saleh Ahmed — portfolio and browser-local editor

A complete, responsive portfolio using HTML, CSS, and vanilla JavaScript. No build step, framework, database, or paid service is required.

## Step 1: Architecture overview

`index.html` contains the public single-page portfolio, and its footer includes an **Admin** link to `admin.html`. The editor starts at a password screen. The initial password is `admin123`. It compares a SHA-256 hash in the browser before revealing the dashboard.

`index.html` includes the complete published portfolio so it is readable before JavaScript runs. `js/data.js` supplies the same content to the editor and interactive renderer. `js/script.js` validates that data, renders the public page with safe text nodes, and checks browser storage for a local override. `js/admin.js` provides editing, a live preview, saving, and backup tools. Storage keys include the website path so another portfolio hosted under a different GitHub Pages project does not share these edits.

**Saving in the editor updates only this browser on this website.** It updates the embedded preview immediately and other open portfolio tabs when you save. It does not push changes to GitHub or update other visitors. To publish an edit, export both the publication file and the SEO homepage from the same draft. Replace `js/data.js` and root-level `index.html` in the same GitHub commit, and let GitHub Pages redeploy them. The Backups tab explains this workflow.

## Step 2: Design decisions

The palette combines cobalt blue for emphasis, dark ink for readable typography, white and cool gray for open space, and lime accents on dark sections. The public page presents a strong typographic introduction, an about section, a skills grid, work history, academic project cards, education, and contact links. The dashboard uses the same visual language, with section tabs and clearly labeled controls.

The website uses normal date and contact formatting, with no numbered lists or decorative counters. Contact information is available through **Email me** and **Call me** links. LinkedIn stays hidden until a real profile URL is entered. No fictional profile is linked.

The editor keeps dates, phone numbers, and email addresses in their normal readable form. Proficiency uses a subtle optional meter. Skill ratings start disabled because no personal proficiency values were supplied; enable them only when you want to show your own assessment.

Typography uses Manrope and DM Sans from Google Fonts, with Arial fallbacks if the font service is unavailable. Layouts work from narrow phones to wide desktops; reduced-motion settings are respected. Forms, navigation, tabs, focus states, and status messages support keyboard use.

## Step 3: Complete working code

All source code is included as ordinary editable files:

```text
saleh-ahmed-portfolio/
  index.html
  admin.html
  css/
    styles.css
    admin.css
  js/
    data.js
    script.js
    admin.js
  robots.txt
  sitemap.xml
  .nojekyll
  .gitignore
  README.md
```

- `index.html`: public page structure, metadata, favicon, navigation, and Admin link.
- `admin.html`: password form, editor dashboard, live preview, and unsaved-change dialog.
- `css/styles.css`: responsive public styling.
- `css/admin.css`: editor styling.
- `js/data.js`: all publication content, initialized from the supplied resume.
- `js/script.js`: rendering, synchronized search metadata, static homepage export, storage, safe link handling, and import validation.
- `js/admin.js`: password gate, every content editor, save/logout, import/export, and publication export.
- `.nojekyll`: tells GitHub Pages to serve these files without Jekyll processing.

There is no dependency installation or compilation needed. Keep the folder structure intact.

## Step 4: How to use the Admin Panel

- Open the portfolio and choose **Admin** at the bottom of the page.
- Enter `admin123`, then choose **Open editor**.
- Choose a section tab. Edit hero text and buttons, about text, skills, work history and its bullet points, projects and tags, education, contact information, section headings, or the footer.
- Use **Add** and **Remove** controls to change repeated entries. Experience highlights and project tags use one entry per line. Empty project links remain hidden on the public page.
- Open **Live portfolio preview** to see your draft as you edit. A draft is not durable until saved.
- Choose **Save Changes** to keep the content in this browser. Reloading the public page in the same browser retains it. A separate device or browser continues to show the published content.
- Choose **Export / Import JSON** or the **Backups** tab. **Export JSON** downloads the current draft. **Import JSON** checks the file and loads it as a draft; review it and save. Invalid backups are rejected without replacing your content.
- Choose **Logout** to close the dashboard. Unsaved changes prompt you before being discarded. Logging out does not erase saved portfolio content. A page reload always requires the editor password again.

Do not use browser-private mode as your only copy of edits. Clearing website storage removes local changes. Keep a JSON backup somewhere you control.

## Step 5: Local testing

Use a local HTTP server rather than double-clicking the HTML file. File URLs can have inconsistent browser storage behavior, and the password gate needs a secure context such as localhost or HTTPS.

If Python is installed, open a terminal in the portfolio folder and run:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/`. Keep the terminal open while testing; press Ctrl+C when finished. If Python is unavailable, the VS Code Live Server extension is another local-server option.

Check these behaviors:

- All portfolio sections appear, and mobile navigation opens and closes.
- The footer Admin link opens the password screen; a wrong password leaves the dashboard hidden.
- Correct login opens the editor. A changed heading appears in the preview immediately.
- Saving and reloading preserves the changed content; another tab on the same origin updates after saving.
- Adding, editing, and removing skills, roles, projects, and education works.
- Export a JSON backup, make a temporary edit, import the backup, and save to restore it.
- An invalid JSON file or an unsafe link is rejected and does not replace saved content.
- The contact buttons preserve the supplied email and phone destinations.
- Logout returns to the password gate, and narrow screens do not scroll horizontally.

Local storage is separated by origin, including the port. Content saved on localhost does not automatically move to the deployed website. Import your backup on the deployed site if you also want its local editor to contain those changes.

## Step 6: GitHub Pages deployment guide

If this portfolio has already been published for you, use its repository to make future edits instead of creating another one.

### GitHub account and repository

- Sign in at [GitHub](https://github.com/). If you do not have an account, select **Sign up** and complete GitHub’s account and email-verification steps yourself.
- Use the **+** menu and choose **New repository**.
- Select your personal account as owner. Use `saleh-ahmed-portfolio` as the repository name, or another available name you prefer.
- Select **Public** for free GitHub Pages hosting on GitHub Free. This source contains only the intended portfolio and its client-side editor; do not add private documents or real service credentials.
- Enable **Add a README file**, then choose **Create repository**.

### Upload the files

- Open the new repository, select **Add file → Upload files**, and drag the portfolio folder’s *contents* into the upload area. Preserve the `css` and `js` folders. `index.html` must be at the repository root, not inside another nested portfolio folder.
- If your upload chooser hides `.nojekyll`, use **Add file → Create new file**, name it `.nojekyll`, and commit the empty file separately.
- Use a clear commit message such as `Publish Saleh Ahmed portfolio`, then select **Commit changes**.

### Enable Pages

- Open the repository’s **Settings → Pages**.
- Under **Build and deployment**, set **Source** to **Deploy from a branch**.
- Select **main** (or the repository’s actual default branch), and choose **/(root)** as the folder. Save.
- Wait for the Pages deployment to finish. The **Actions** tab shows build progress and any errors. Return to **Settings → Pages** to find the confirmed live address.
- A project repository normally publishes at `https://YOUR-USERNAME.github.io/saleh-ahmed-portfolio/`. Use the address shown by GitHub rather than assuming that deployment has already succeeded.
- Open the live address and verify the public page and `admin.html`. All asset links are relative, so they work under a project repository path.

These settings follow GitHub’s [publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [site-creation guide](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

### Publish later content changes

- Edit the portfolio in the Admin Panel and save a JSON backup.
- In **Backups**, choose **Export publication file** to download `data.js`, then choose **Export SEO homepage** to download `index.html`. Export both from the same draft. The homepage export preserves your Google verification tag and updates its visible content, search metadata, and structured data.
- Put the exported `data.js` inside a local `js` folder. At the GitHub repository root, use **Add file → Upload files** to upload that `js` folder and the exported `index.html` together. Commit both changes. Keep the existing `css` folder and other files.
- Wait for the next Pages deployment. Open the live site in a private browsing window to inspect the new shared content without your browser-local override.
- If your existing browser still shows an older saved version, import the corresponding new JSON backup and save it, or clear only this site’s local storage after exporting anything you want to preserve.
- To change styling or behavior, edit and commit the matching HTML, CSS, or JavaScript source files. GitHub Pages republishes them after the commit.

## Step 7: Changing the Admin Password

The password hash is the `ADMIN_PASSWORD_SHA256` constant near the top of `js/admin.js`. It currently corresponds to `admin123`.

Generate a new hash locally using Node.js. Start Node with `node` in a terminal, then run this example after replacing the placeholder with your chosen password:

```js
require('node:crypto').createHash('sha256').update('YOUR-NEW-PASSWORD').digest('hex')
```

Replace only the quoted hash assigned to `ADMIN_PASSWORD_SHA256` with the generated hexadecimal value. Save the file, commit it to GitHub, wait for deployment, then reload the Admin page and test the new password. Do not paste your real GitHub password into this portfolio. Use a separate convenience password. Prefer a private local hashing method; do not submit the password to an online hash generator.

Changing this constant changes the default gate for everyone loading that deployed file. The password is not included in content backups. This hash is public and can be guessed offline; hashing does not turn a static page into a secure login system.

## Step 8: Security and future upgrade

This is a static GitHub Pages website. Its Admin Panel provides a **client-side convenience gate only**. Anyone can inspect or modify downloaded JavaScript and bypass it on their own device. Browser-local edits are not access-controlled server records. The editor therefore must not hold confidential data, tokens, private documents, or real account credentials.

Someone bypassing this local gate cannot thereby push to your GitHub repository or change the website for other visitors. Publishing still requires your normal GitHub repository permissions. Imported content is validated, rendered as text, and checked for unsafe link protocols, but the password gate itself is not a security boundary.

For genuine authenticated publishing, keep the public portfolio on Pages and move editing and content storage to a backend such as Firebase or Supabase. Authenticate the owner there, enforce ownership with server-side security rules or row-level policies, validate writes on the server, and allow public read access only to approved portfolio fields. Keep privileged keys exclusively on the server. Never rely on hiding an edit button or checking a password in browser JavaScript to authorize shared writes.

The supplied experience dates are retained as provided. Review current employment and education details before using this portfolio in applications. Project summaries deliberately remain brief; add your own verified responsibilities, outcomes, technologies, and project links through the editor.

## Search optimization

The homepage uses a descriptive title, a canonical URL, social-sharing title and description tags, and WebSite/ProfilePage/Person structured data based on the visible portfolio. Its full content is present in HTML, including skills, work history, projects, education, and contact links. JavaScript enhances the same content rather than being required to read it.

The canonical address is `https://salehahmed101.github.io/`. `sitemap.xml` lists that single public page. `robots.txt` permits crawling and announces the sitemap. The admin page retains its `noindex,nofollow` meta tag; do not disallow it in robots.txt, because crawlers need to read the tag. Do not add admin.html, fragment sections, or duplicate index.html URLs to the sitemap.

The existing Google site-verification tag is preserved in the homepage. Keep it when replacing files. In your verified [Google Search Console property](https://search.google.com/search-console), open **Sitemaps**, submit `sitemap.xml`, then inspect the homepage and choose **Request indexing**. Check the URL Inspection report later for indexing status. These improvements help search engines understand the site; they do not guarantee indexing or a first-place ranking.

For future edits, export and publish both `js/data.js` and `index.html` as described above. An Admin save only changes your browser. The SEO homepage export uses your current draft, including the same titles, dates, skills, and project text shown to visitors.
