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

function getRepo(repoId) {
  const repo = REPOS.find((r) => r.id === repoId);
  if (!repo) throw new Error(`unknown repoId: ${repoId}`);
  return repo;
}

async function fetchLastDeployed(repoId, branch) {
  const repo = getRepo(repoId);
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?sha=${branch}&per_page=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub API ${res.status} -- ${repo.name}@${branch}`);

  const data = await res.json();
  if (!data.length) throw new Error(`no commits found -- ${repo.name}@${branch}`);

  return data[0].commit.committer.date;
}

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

function getEnvironment() {
  // Determine environment based on subdomain
  const host = window.location.hostname;
  if (host.startsWith("dev.")) {
    return "Development";
  } else if (host.startsWith("qa.")) {
    return "QA / Staging";
  } else {
    return "Production";
  }
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
