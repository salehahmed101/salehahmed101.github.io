export const SITE = "https://salehahmed101.github.io/";
export const REPOSITORY = "salehahmed101/salehahmed101.github.io";
export const OWNER_ID = 75369858;
export const BRANCH = "main";

const fields = names => Object.fromEntries(names.split(" ").map(name => [name, ""]));
const schema = {
  hero: fields("name title tagline status location primaryLabel primaryUrl secondaryLabel secondaryUrl focusLabel focusKicker focusTitle focusFooter"),
  about: fields("heading text learning"),
  headings: fields("skills experience projects projectsIntro education footer"),
  skills: [{ name: "", percentage: null }],
  experience: [{ ...fields("title company location period"), bullets: [""] }],
  projects: [{ ...fields("title category description institution url linkLabel"), tags: [""] }],
  education: [fields("degree institution period description")],
  contact: fields("eyebrow heading text email phone linkedin location emailLabel phoneLabel linkedinLabel")
};

export function safeUrl(value) {
  if (!value) return "";
  if (/^#[a-z][\w-]*$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

export function validateContent(candidate) {
  function walk(value, template) {
    if (template === null) {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) throw new Error("Invalid skill proficiency.");
      return value;
    }
    if (typeof template === "string") {
      if (typeof value !== "string" || value.length > 12000) throw new Error("Invalid portfolio text.");
      return value;
    }
    if (Array.isArray(template)) {
      if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid portfolio list.");
      return value.map(entry => walk(entry, template[0]));
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing portfolio section.");
    return Object.fromEntries(Object.entries(template).map(([key, example]) => [key, walk(value[key], example)]));
  }
  const clean = walk(candidate, schema);
  const urls = [clean.hero.primaryUrl, clean.hero.secondaryUrl, clean.contact.linkedin, ...clean.projects.map(project => project.url)];
  if (urls.some(url => url && !safeUrl(url))) throw new Error("Use a valid website, email, telephone, or section link.");
  if (clean.contact.email && !/^\S+@\S+\.\S+$/.test(clean.contact.email)) throw new Error("Invalid email address.");
  if (clean.contact.phone && !/^[+()\d\s.-]+$/.test(clean.contact.phone)) throw new Error("Invalid phone number.");
  return clean;
}

export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const tag = (name, className, text) => `<${name}${className ? ` class="${className}"` : ""}>${escapeHtml(text)}</${name}>`;
const link = (label, url, className) => `<a class="${className}" href="${escapeHtml(safeUrl(url))}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(label)}</a>`;

export function publicationParts(data) {
  const city = data.contact.location.split(",")[0].trim();
  const title = data.hero.name + " | " + data.hero.title + (city ? " in " + city : "");
  const description = data.hero.name + ", " + data.hero.title + (data.contact.location ? " in " + data.contact.location : "") + ". Explore projects, skills, experience, and education.";
  const text = {
    "brand-name": data.hero.name, "hero-title": data.hero.title, "hero-tagline": data.hero.tagline,
    "hero-status": data.hero.status, "hero-location": data.hero.location,
    "about-heading": data.about.heading, "about-copy": data.about.text, "about-learning": data.about.learning,
    "skills-heading": data.headings.skills, "experience-heading": data.headings.experience,
    "projects-heading": data.headings.projects, "projects-intro": data.headings.projectsIntro,
    "education-heading": data.headings.education, "footer-copy": data.headings.footer,
    "contact-eyebrow": data.contact.eyebrow, "contact-heading": data.contact.heading, "contact-copy": data.contact.text
  };
  const html = {
    "hero-name": escapeHtml(data.hero.name) + '<span class="accent">.</span>',
    "hero-actions": link(data.hero.primaryLabel, data.hero.primaryUrl, "button button-primary") + link(data.hero.secondaryLabel, data.hero.secondaryUrl, "button button-quiet"),
    "skills-list": data.skills.map(skill => `<article class="skill-card"><div class="skill-card-top">${tag("span", "skill-name", skill.name)}<span class="skill-mark">↗</span></div>${skill.percentage === null ? "" : `<span class="skill-meter" role="meter" aria-label="${escapeHtml(skill.name)} self-assessed proficiency" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${skill.percentage}"><span style="width:${skill.percentage}%"></span></span>`}</article>`).join(""),
    "experience-list": data.experience.map(job => `<article class="experience-row"><div class="experience-marker"><span class="marker-dot"></span></div><div class="experience-when">${tag("p", "experience-period", job.period)}${tag("p", "muted", job.company)}</div><div class="experience-detail">${tag("h3", "", job.title)}${tag("p", "muted", job.location)}${job.bullets.length ? `<ul class="job-bullets">${job.bullets.map(bullet => tag("li", "", bullet)).join("")}</ul>` : ""}</div></article>`).join(""),
    "projects-list": data.projects.map(project => `<article class="project-card"><div class="project-head"><span class="project-arrow">↗</span>${tag("span", "project-category", project.category)}</div>${tag("h3", "", project.title)}${tag("p", "muted", project.description)}<div class="tags">${project.tags.map(value => tag("span", "tag", value)).join("")}</div>${tag("p", "institution", project.institution)}${project.url ? link(project.linkLabel + " ↗", project.url, "text-link") : ""}</article>`).join(""),
    "education-list": data.education.map(study => `<article class="education-card"><span class="education-rule"></span>${tag("p", "eyebrow", study.institution)}${tag("h3", "", study.degree)}${tag("p", "muted", study.period)}${study.description ? tag("p", "", study.description) : ""}</article>`).join("")
  };
  html["contact-links"] = (data.contact.email ? link(data.contact.emailLabel + " ↗", "mailto:" + data.contact.email, "contact-link") : "") + (data.contact.phone ? link(data.contact.phoneLabel + " ↗", "tel:" + data.contact.phone.replace(/[^+\d]/g, ""), "contact-link") : "") + (data.contact.linkedin ? link(data.contact.linkedinLabel + " ↗", data.contact.linkedin, "contact-link") : "") + tag("p", "contact-location", data.contact.location);
  const sameAs = ["https://github.com/salehahmed101"];
  if (/^https?:/.test(safeUrl(data.contact.linkedin))) sameAs.push(safeUrl(data.contact.linkedin));
  const profile = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": SITE + "#website", url: SITE, name: data.hero.name, alternateName: data.hero.name + " Portfolio", inLanguage: "en-CA" },
      { "@type": "ProfilePage", "@id": SITE + "#profile", url: SITE, name: title, description, isPartOf: { "@id": SITE + "#website" }, inLanguage: "en-CA", mainEntity: { "@type": "Person", "@id": SITE + "#person", name: data.hero.name, url: SITE, description: data.hero.title, homeLocation: { "@type": "Place", name: data.contact.location }, knowsAbout: data.skills.map(skill => skill.name), sameAs } }
    ]
  };
  html["profile-schema"] = JSON.stringify(profile, null, 2).replace(/</g, "\\u003c");
  const meta = {
    'meta[name="description"]': description, 'meta[name="author"]': data.hero.name,
    'meta[property="og:title"]': title, 'meta[property="og:description"]': description,
    'meta[property="og:site_name"]': data.hero.name, 'meta[name="twitter:title"]': title,
    'meta[name="twitter:description"]': description
  };
  return { title, text, html, meta };
}

export async function renderPublication(template, data) {
  if (!template.includes('id="hero-name"') || !template.includes('id="profile-schema"')) throw new Error("The homepage template is missing required portfolio sections.");
  const parts = publicationParts(data);
  let rewriter = new HTMLRewriter().on("title", { element(element) { element.setInnerContent(parts.title); } });
  for (const [id, value] of Object.entries(parts.text)) rewriter = rewriter.on("#" + id, { element(element) { element.setInnerContent(value); } });
  for (const [id, value] of Object.entries(parts.html)) rewriter = rewriter.on("#" + id, { element(element) { element.setInnerContent(value, { html: true }); } });
  for (const [selector, value] of Object.entries(parts.meta)) rewriter = rewriter.on(selector, { element(element) { element.setAttribute("content", value); } });
  return rewriter.transform(new Response(template)).text();
}
