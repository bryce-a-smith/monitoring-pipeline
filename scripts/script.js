"use strict";

// which site this script belongs to -- only line that differs between sites
const CONFIG = { siteId: "monitoring" };

// -- data layer -- //

const SITES = [
  { id: "portfolio", owner: "bryce-a-smith", repo: "Website", rootDomain: "aldenbryce.com" },
  { id: "monitoring", owner: "bryce-a-smith", repo: "monitoring-monitoring", rootDomain: "status.aldenbryce.com" },
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

// ui and card builder//

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

function buildStatusCards() {
  const container = document.getElementById("status-cards");
  if (!container) return;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const fragment = document.createDocumentFragment();
  ENVIRONMENTS.forEach((env) => fragment.appendChild(createStatusCard(env)));
  container.appendChild(fragment);
}

////

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

async function init() {
  // Main initialization function to fetch and display date and environment
  // Get references to the DOM elements where the date and environment will be displayed
  const dateLastUpdatedP = document.getElementById("date-last-updated");
  const environmentSpan = document.getElementById("environment");
  const envLabel = document.getElementById("env-label");
  const lastDeployed = document.getElementById("last-deployed");

  // Check if the required elements are present in the DOM
  if (!dateLastUpdatedP || !environmentSpan || !envLabel || !lastDeployed) {
    console.error("One or more required elements not found.");
    return;
  }

  // Display the environment immediately without waiting for the date fetch to complete
  displayEnvironment(environmentSpan, getEnvironment());
  showEnvLabel(envLabel);

  try {
    // Fetch, parse, and display the last updated date
    const rawDate = await fetchLastDeployed();
    displayDate(dateLastUpdatedP, parseDate(rawDate)); // Convert raw date string to Date object before displaying
  } catch (error) {
    console.error("Error fetching last updated date:", error);
    dateLastUpdatedP.textContent = "Error fetching date";
  }
}

document.addEventListener("DOMContentLoaded", init); // Initialize the page once the DOM is fully loaded
