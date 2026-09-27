import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../", import.meta.url);
const destination = new URL(".wrangler/portfolio-assets/", import.meta.url);
const files = ["admin.html", "css/styles.css", "css/admin.css", "js/data.js", "js/script.js", "js/admin.js", "js/github-config.js", "js/github-publish.js"];
for (const file of files) {
  const target = new URL(file, destination);
  await mkdir(new URL("./", target), { recursive: true });
  await copyFile(new URL(file, source), target);
}
console.log("Prepared " + files.length + " public editor assets.");
