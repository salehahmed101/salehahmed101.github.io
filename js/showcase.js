(() => {
  "use strict";

  const demo = document.getElementById("tracker-demo");
  if (!demo) return;
  const originalDemo = demo.cloneNode(true);
  const galleryDefaults = Array.from(document.querySelectorAll("[data-gallery]"), gallery => gallery.cloneNode(true));
  const sample = [
    { date: "2026-06-03", weight: 12.1 },
    { date: "2026-06-10", weight: 12.4 },
    { date: "2026-06-17", weight: 12.6 },
    { date: "2026-06-24", weight: 12.9 }
  ];
  let measurements = sample.map(entry => ({ ...entry }));
  const dateInput = document.getElementById("tracker-date");
  const weightInput = document.getElementById("tracker-weight");
  const status = document.getElementById("tracker-status");
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const shortDateFormatter = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
  const parseDate = value => new Date(value + "T00:00:00Z");
  const svgElement = name => document.createElementNS("http://www.w3.org/2000/svg", name);

  function announce(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function updateChart() {
    const ordered = [...measurements].sort((first, second) => first.date.localeCompare(second.date));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const delta = Math.round((last.weight - first.weight) * 10) / 10;
    document.getElementById("tracker-latest").textContent = last.weight.toFixed(1);
    document.getElementById("tracker-change").textContent = (delta > 0 ? "+" : "") + delta.toFixed(1) + " kg";
    const minimum = Math.min(...ordered.map(entry => entry.weight));
    const maximum = Math.max(...ordered.map(entry => entry.weight));
    const padding = Math.max((maximum - minimum) * .2, .2);
    const lower = Math.max(0, minimum - padding);
    const upper = maximum + padding;
    const start = parseDate(first.date).getTime();
    const duration = parseDate(last.date).getTime() - start;
    const coordinates = ordered.map(entry => ({
      horizontal: duration ? 46 + (parseDate(entry.date).getTime() - start) / duration * 490 : 291,
      vertical: 172 - (entry.weight - lower) / (upper - lower) * 140,
      entry
    }));
    const points = coordinates.map(point => point.horizontal.toFixed(2) + "," + point.vertical.toFixed(2));
    document.getElementById("tracker-line").setAttribute("points", points.join(" "));
    document.getElementById("tracker-area").setAttribute("d", "M" + points.join(" L") + " L" + coordinates.at(-1).horizontal + ",172 L" + coordinates[0].horizontal + ",172 Z");
    document.getElementById("tracker-points").replaceChildren(...coordinates.map(point => {
      const circle = svgElement("circle");
      circle.setAttribute("cx", point.horizontal);
      circle.setAttribute("cy", point.vertical);
      circle.setAttribute("r", "4");
      const title = svgElement("title");
      title.textContent = dateFormatter.format(parseDate(point.entry.date)) + ": " + point.entry.weight.toFixed(1) + " kg";
      circle.append(title);
      return circle;
    }));
    const labels = [first, last].map((entry, index) => {
      const label = svgElement("text");
      label.setAttribute("x", index ? "536" : "46");
      label.setAttribute("y", "205");
      label.setAttribute("text-anchor", index ? "end" : "start");
      label.textContent = shortDateFormatter.format(parseDate(entry.date));
      return label;
    });
    document.getElementById("tracker-labels").replaceChildren(...labels);
    document.getElementById("tracker-chart-description").textContent = "Sample timeline from " + dateFormatter.format(parseDate(first.date)) + " to " + dateFormatter.format(parseDate(last.date)) + ". First weight: " + first.weight.toFixed(1) + " kg. Latest weight: " + last.weight.toFixed(1) + " kg. All measurements are available in the table below.";
    document.getElementById("tracker-rows").replaceChildren(...ordered.map(entry => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      const weightCell = document.createElement("td");
      dateCell.textContent = dateFormatter.format(parseDate(entry.date));
      weightCell.textContent = entry.weight.toFixed(1);
      row.append(dateCell, weightCell);
      return row;
    }));
  }

  document.getElementById("tracker-controls").disabled = false;
  document.getElementById("tracker-form").addEventListener("submit", event => {
    event.preventDefault();
    dateInput.removeAttribute("aria-invalid");
    weightInput.removeAttribute("aria-invalid");
    const date = dateInput.value;
    const parsed = parseDate(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || Number(date.slice(0, 4)) < 1900 || Number(date.slice(0, 4)) > 2100) {
      dateInput.setAttribute("aria-invalid", "true");
      announce("Choose a valid date between 1900 and 2100.", true);
      dateInput.focus();
      return;
    }
    const weight = Number(weightInput.value);
    if (!weightInput.value.trim() || !Number.isFinite(weight) || weight < .1 || weight > 2000 || Math.abs(weight * 10 - Math.round(weight * 10)) > .000001) {
      weightInput.setAttribute("aria-invalid", "true");
      announce("Enter a weight from 0.1 to 2000 kg, with at most one decimal place.", true);
      weightInput.focus();
      return;
    }
    if (measurements.some(entry => entry.date === date)) {
      dateInput.setAttribute("aria-invalid", "true");
      announce("That date already has a measurement. Choose another date or reset the sample.", true);
      dateInput.focus();
      return;
    }
    if (measurements.length >= 40) {
      announce("This small demo holds up to 40 entries. Reset the sample to start again.", true);
      return;
    }
    measurements.push({ date, weight });
    updateChart();
    announce("Added " + weight.toFixed(1) + " kg for " + dateFormatter.format(parsed) + ". Chart and table updated. Nothing was saved to a server.");
    weightInput.value = "";
    dateInput.focus();
  });
  document.getElementById("tracker-reset").addEventListener("click", () => {
    measurements = sample.map(entry => ({ ...entry }));
    dateInput.value = "";
    weightInput.value = "";
    dateInput.removeAttribute("aria-invalid");
    weightInput.removeAttribute("aria-invalid");
    updateChart();
    announce("Sample restored. Your temporary entries have been cleared.");
  });
  document.querySelectorAll("[data-gallery]").forEach(gallery => {
    gallery.querySelectorAll("button[data-image]").forEach(button => {
      button.addEventListener("click", () => {
        gallery.querySelector("img").src = button.dataset.image;
        gallery.querySelector("img").alt = button.dataset.alt;
        gallery.querySelector(".evidence-window").href = button.dataset.image;
        gallery.querySelector(".gallery-caption").textContent = button.textContent;
        gallery.querySelectorAll("button[data-image]").forEach(control => control.setAttribute("aria-pressed", String(control === button)));
      });
    });
  });
  window.PortfolioShowcase = {
    resetSnapshot(snapshot) {
      snapshot.getElementById("tracker-demo")?.replaceWith(originalDemo.cloneNode(true));
      snapshot.querySelectorAll("[data-gallery]").forEach((gallery, index) => gallery.replaceWith(galleryDefaults[index].cloneNode(true)));
      snapshot.querySelectorAll("details").forEach(detail => detail.removeAttribute("open"));
    }
  };
  updateChart();
})();
