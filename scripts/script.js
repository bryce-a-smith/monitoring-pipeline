"use strict";

// which site this script belongs to -- only line that differs between sites
const CONFIG = { siteId: "monitoring" };

// -- data layer -- //

const SITES = [
  { id: "portfolio", owner: "bryce-a-smith", repo: "Website", rootDomain: "aldenbryce.com" },
  { id: "monitoring", owner: "bryce-a-smith", repo: "monitoring-pipeline", rootDomain: "status.aldenbryce.com" },
];

const ENVIRONMENTS = [
  { label: "aldenbryce.com", url: "https://aldenbryce.com", siteId: "portfolio" },
  { label: "dev.aldenbryce.com", url: "https://dev.aldenbryce.com", siteId: "portfolio" },
  { label: "qa.aldenbryce.com", url: "https://qa.aldenbryce.com", siteId: "portfolio" },
  { label: "status.aldenbryce.com", url: "https://status.aldenbryce.com", siteId: "monitoring" },
  { label: "dev.status.aldenbryce.com", url: "https://dev.status.aldenbryce.com", siteId: "monitoring" },
  { label: "qa.status.aldenbryce.com", url: "https://qa.status.aldenbryce.com", siteId: "monitoring" },
];

// utility //

function getBranchFromUrl(url) {
  // derives git branch from subdomain convention: dev. = dev, qa. = qa, root = main
  const hostname = new URL(url).hostname;
  if (hostname.startsWith("dev.")) return "dev";
  if (hostname.startsWith("qa.")) return "qa";
  return "main";
}

function getBranch(hostname) {
  // current environment's branch -- same logic, takes hostname directly
  if (hostname.startsWith("dev.")) return "dev";
  if (hostname.startsWith("qa.")) return "qa";
  return "main";
}

function getEnv(hostname) {
  if (hostname.startsWith("dev.")) return "DEV";
  if (hostname.startsWith("qa.")) return "QA";
  return "Production";
}

function isProd(hostname) {
  return getEnv(hostname) === "Production";
}

function formatDate(iso, options) {
  if (!iso) return "unavailable";
  const defaults = { month: "short", day: "numeric", year: "numeric" };
  return new Date(iso).toLocaleDateString("en-US", options || defaults);
}

function setText(element, text) {
  if (element) element.textContent = text;
}

// -- api -- //

function getSite(siteId) {
  const site = SITES.find((s) => s.id === siteId);
  if (!site) throw new Error(`unknown siteId: ${siteId}`);
  return site;
}

async function fetchLastDeployed(siteId, branch) {
  const site = getSite(siteId);
  const url = `https://api.github.com/repos/${site.owner}/${site.repo}/commits?sha=${branch}&per_page=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub API ${res.status} -- ${site.repo}@${branch}`);

  const data = await res.json();
  if (!data.length) throw new Error(`no commits found -- ${site.repo}@${branch}`);

  return data[0].commit.committer.date;
}

// status data api -- this is just a static JSON file in the repo, updated by a GitHub Action on a schedule.
// In a real system, this would likely be a dynamic API endpoint backed by a database or monitoring system.
const STATUS_URL = "https://raw.githubusercontent.com/bryce-a-smith/monitoring-pipeline/status-data/status.json";

async function fetchSiteStatus() {
  const res = await fetch(STATUS_URL);
  if (!res.ok) throw new Error(`status.json fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("status.json is not an array");
  return data;
}

// ui and card builder//

function getStatusConfig(status) {
  switch (status) {
    case "up":
      return { modifier: "up", label: "Operational", cssClass: "status-ok" };
    case "degraded":
      return { modifier: "degraded", label: "Degraded", cssClass: "status-degraded" };
    case "down":
      return { modifier: "down", label: "Outage", cssClass: "status-down" };
    default:
      return { modifier: "unknown", label: "Unknown", cssClass: "" };
  }
}

function applyStatusToCards(container, statusData) {
  statusData.forEach((entry) => {
    const escaped = CSS.escape(entry.url);
    const card = container.querySelector(`.status-card[data-url="${escaped}"]`);
    if (!card) return;

    const indicator = card.querySelector(".status-indicator");
    const badge = card.querySelector(".status-text");
    if (!indicator || !badge) return;

    const config = getStatusConfig(entry.status);

    // reset and apply modifier class
    indicator.className = "status-indicator";
    indicator.classList.add(`status-indicator--${config.modifier}`);

    badge.className = `status-text ${config.cssClass}`.trim();
    badge.textContent = config.label;
  });
}

function createStatusCard(env) {
  const branch = getBranchFromUrl(env.url);

  const card = document.createElement("div");
  card.className = "status-card";
  card.dataset.siteId = env.siteId;
  card.dataset.branch = branch;

  const indicator = document.createElement("span");
  indicator.className = "status-indicator";
  indicator.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "status-card-body";

  const siteLink = document.createElement("a");
  siteLink.className = "status-site";
  siteLink.href = env.url;
  siteLink.target = "_blank";
  siteLink.rel = "noopener noreferrer";
  siteLink.textContent = env.label;

  const statusText = document.createElement("span");
  statusText.className = "status-text status-ok";
  statusText.textContent = "Operational";

  body.appendChild(siteLink);
  body.appendChild(statusText);

  card.appendChild(indicator);
  card.appendChild(body);

  return card;
}

async function buildStatusCards() {
  const container = document.getElementById("status-cards");
  if (!container) return;

  // clear existing cards
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // build all cards synchronously -- page renders immediately with loading state
  const fragment = document.createDocumentFragment();
  ENVIRONMENTS.forEach((env) => fragment.appendChild(createStatusCard(env)));
  container.appendChild(fragment);

  // fire status check and all date fetches in parallel
  const [statusResult, ...dateResults] = await Promise.allSettled([
    fetchSiteStatus(),
    ...ENVIRONMENTS.map((env) =>
      fetchLastDeployed(env.siteId, getBranchFromUrl(env.url))
        .then((raw) => ({
          url: env.url,
          date: formatDate(raw, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          }),
        }))
        .catch(() => ({ url: env.url, date: "unavailable" })),
    ),
  ]);

  // apply live status indicators -- silently skip if fetch failed
  if (statusResult.status === "fulfilled") {
    applyStatusToCards(container, statusResult.value);
  } else {
    console.warn("fetchSiteStatus failed:", statusResult.reason);
  }

  // apply per-card last deployed dates
  dateResults.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const { url, date } = result.value;
    const span = container.querySelector(`.status-card-date[data-url="${CSS.escape(url)}"]`);
    if (span) span.textContent = date;
  });
}

////
/*
function parseDate(dateString) {
  // Convert raw date string to Date object
  return new Date(dateString);
}

function displayDate(element, date) {
  // Format the date and display it in the specified element
  element.textContent = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function showEnvLabel(envLabel) {
  const env = getEnvironment();

  if (!envLabel) return;
  if (env) {
    if (env === "Production") {
      envLabel.style.display = "none"; // Hide the label for production
    } else {
      envLabel.style.display = "inline-block"; // Show the label for non-production environments
      envLabel.textContent = env;
    }
  }
}

function displayEnvironment(element, env) {
  // Display the environment in the specified element
  element.textContent = env;
}
  */

// -- init -- //

async function init() {
  const host = window.location.hostname;
  const branch = getBranch(host);
  const env = getEnv(host);

  const envLabelHeader = document.getElementById("env-label-header");
  if (envLabelHeader) {
    if (!isProd(host)) {
      envLabelHeader.textContent = env;
      envLabelHeader.style.display = "inline-block";
    } else {
      envLabelHeader.style.display = "none";
    }
  }

  setText(document.getElementById("env-label-main"), env);

  buildStatusCards();

  const dateLastDeployedFooter = document.getElementById("date-last-deployed-footer");

  try {
    const raw = await fetchLastDeployed(CONFIG.siteId, branch);
    setText(dateLastDeployedFooter, formatDate(raw));
  } catch (err) {
    console.error("fetchLastDeployed failed:", err);
    setText(dateLastDeployedFooter, "unavailable");
  }
}

document.addEventListener("DOMContentLoaded", init);
