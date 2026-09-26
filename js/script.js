(() => {
  "use strict";
  const storageKey = "saleh-portfolio:" + new URL("../", document.currentScript.src).pathname;
  const clone = value => JSON.parse(JSON.stringify(value));
  const noDigits = value => String(value ?? "");
  const encode = value => String(value ?? "");
  const decode = value => String(value ?? "");

  function safeUrl(value, allowAnchor = true) {
    if (!value) return "";
    if (allowAnchor && /^#[a-z][\w-]*$/i.test(value)) return value;
    try { const url = new URL(value); return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
  }

  function validate(candidate) {
    const schema = {
      ...window.PORTFOLIO_DEFAULTS,
      skills: [{name: "", percentage: null}],
      experience: [{title: "", company: "", location: "", period: "", bullets: [""]}],
      projects: [{title: "", category: "", description: "", institution: "", tags: [""], url: "", linkLabel: ""}],
      education: [{degree: "", institution: "", period: "", description: ""}]
    };
    function walk(value, template, path) {
      if (template === null) {
        if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) throw new Error("Skill proficiency must be within the slider’s range.");
        return value;
      }
      if (typeof template === "string") {
        if (typeof value !== "string" || value.length > 12000) throw new Error("Please use text of a reasonable length in " + path + ".");
        return value;
      }
      if (Array.isArray(template)) {
        if (!Array.isArray(value) || value.length > 100) throw new Error("Please check the list in " + path + ".");
        return value.map(entry => walk(entry, template[0] ?? "", path));
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This backup is missing " + path + ".");
      return Object.fromEntries(Object.entries(template).map(([key, example]) => [key, walk(value[key], example, key)]));
    }
    const clean = walk(candidate, schema, "portfolio content");
    const urls = [clean.hero.primaryUrl, clean.hero.secondaryUrl, clean.contact.linkedin, ...clean.projects.map(project => project.url)];
    if (urls.some(url => url && !safeUrl(url))) throw new Error("Use a website, email, telephone, or section link.");
    if (clean.contact.email && !/^\S+@\S+\.\S+$/.test(clean.contact.email)) throw new Error("Please check the email address.");
    if (clean.contact.phone && !/^[+()\d\s.-]+$/.test(clean.contact.phone)) throw new Error("Please check the telephone number.");
    return clean;
  }

  let storageWarning = "";
  function load() {
    try { const saved = localStorage.getItem(storageKey); return saved ? validate(JSON.parse(saved)) : clone(window.PORTFOLIO_DEFAULTS); }
    catch { storageWarning = "Saved content could not be loaded. The published portfolio is shown; export a backup before making changes."; return clone(window.PORTFOLIO_DEFAULTS); }
  }

  function element(tag, className, text) { const result = document.createElement(tag); if (className) result.className = className; if (text !== undefined) result.textContent = noDigits(text); return result; }
  function link(label, url, className) { const anchor = element("a", className, label); anchor.href = safeUrl(url); if (/^https?:/.test(anchor.getAttribute("href"))) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; } return anchor; }

  function render(data) {
    if (!document.getElementById("hero-name")) return;
    const text = (id, value) => { const target = document.getElementById(id); if (target) target.textContent = noDigits(value); };
    const fill = (id, children) => { const target = document.getElementById(id); if (target) target.replaceChildren(...children); };
    document.title = noDigits(data.hero.name + " — " + data.hero.title);
    text("brand-name", data.hero.name); text("hero-name", data.hero.name); document.getElementById("hero-name").append(element("span", "accent", "."));
    ["title", "tagline", "status", "location"].forEach(key => text("hero-" + key, data.hero[key]));
    ["label", "kicker", "title", "footer"].forEach(key => text("focus-" + key, data.hero["focus" + key[0].toUpperCase() + key.slice(1)]));
    fill("hero-actions", [link(data.hero.primaryLabel, data.hero.primaryUrl, "button button-primary"), link(data.hero.secondaryLabel, data.hero.secondaryUrl, "button button-quiet")]);
    text("about-heading", data.about.heading); text("about-copy", data.about.text); text("about-learning", data.about.learning);
    ["skills", "experience", "projects", "education"].forEach(section => text(section + "-heading", data.headings[section])); text("projects-intro", data.headings.projectsIntro); text("footer-copy", data.headings.footer);
    fill("skills-list", data.skills.map((skill) => { const card = element("article", "skill-card"); const top = element("div", "skill-card-top"); top.append(element("span", "skill-name", skill.name), element("span", "skill-mark", "↗")); card.append(top); if (skill.percentage !== null) { const meter = element("span", "skill-meter"); const level = element("span"); level.style.width = skill.percentage + "%"; meter.append(level); meter.setAttribute("role", "meter"); meter.setAttribute("aria-label", skill.name + " self-assessed proficiency"); meter.setAttribute("aria-valuemin", "0"); meter.setAttribute("aria-valuemax", "100"); meter.setAttribute("aria-valuenow", skill.percentage); card.append(meter); } return card; }));
    fill("experience-list", data.experience.map(job => { const row = element("article", "experience-row"); const marker = element("div", "experience-marker"); marker.append(element("span", "marker-dot")); const when = element("div", "experience-when"); when.append(element("p", "experience-period", job.period), element("p", "muted", job.company)); const detail = element("div", "experience-detail"); detail.append(element("h3", "", job.title), element("p", "muted", job.location)); if (job.bullets.length) { const bullets = element("ul", "job-bullets"); job.bullets.forEach(bullet => bullets.append(element("li", "", bullet))); detail.append(bullets); } row.append(marker, when, detail); return row; }));
    fill("projects-list", data.projects.map(project => { const card = element("article", "project-card"); const head = element("div", "project-head"); head.append(element("span", "project-arrow", "↗"), element("span", "project-category", project.category)); card.append(head, element("h3", "", project.title), element("p", "muted", project.description)); const tags = element("div", "tags"); project.tags.forEach(tag => tags.append(element("span", "tag", tag))); card.append(tags, element("p", "institution", project.institution)); if (project.url) card.append(link(project.linkLabel + " ↗", project.url, "text-link")); return card; }));
    fill("education-list", data.education.map(study => { const card = element("article", "education-card"); card.append(element("span", "education-rule"), element("p", "eyebrow", study.institution), element("h3", "", study.degree), element("p", "muted", study.period)); if (study.description) card.append(element("p", "", study.description)); return card; }));
    text("contact-eyebrow", data.contact.eyebrow); text("contact-heading", data.contact.heading); text("contact-copy", data.contact.text);
    const contacts = []; if (data.contact.email) contacts.push(link(data.contact.emailLabel + " ↗", "mailto:" + data.contact.email, "contact-link")); if (data.contact.phone) contacts.push(link(data.contact.phoneLabel + " ↗", "tel:" + data.contact.phone.replace(/[^+\d]/g, ""), "contact-link")); if (data.contact.linkedin) contacts.push(link(data.contact.linkedinLabel + " ↗", data.contact.linkedin, "contact-link")); contacts.push(element("p", "contact-location", data.contact.location)); fill("contact-links", contacts);
  }

  function save(data) { const clean = validate(data); localStorage.setItem(storageKey, JSON.stringify(clean)); render(clean); return clean; }
  window.Portfolio = {load, save, validate, render, clone, noDigits, encode, decode, storageKey, get storageWarning() { return storageWarning; }};
  render(load());
  window.addEventListener("storage", event => { if (event.key === storageKey) render(load()); });
  const menu = document.querySelector(".menu-toggle");
  menu?.addEventListener("click", () => menu.setAttribute("aria-expanded", String(menu.getAttribute("aria-expanded") !== "true")));
  document.querySelectorAll("#navigation a").forEach(anchor => anchor.addEventListener("click", () => menu?.setAttribute("aria-expanded", "false")));
})();
