"use strict";

async function fetchDateLastUpdated() {
  // Fetch the last commit date from GitHub API
  const response = await fetch("https://api.github.com/repos/bryce-a-smith/monitoring-pipeline/commits/main");
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.commit.author.date; //raw string date from GitHub API
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

function displayEnvironment(element, env) {
  // Display the environment in the specified element
  element.textContent = env;
}

async function init() {
  // Main initialization function to fetch and display date and environment
  // Get references to the DOM elements where the date and environment will be displayed
  const dateLastUpdatedP = document.getElementById("date-last-updated");
  const environmentSpan = document.getElementById("environment");

  // Check if the required elements are present in the DOM
  if (!dateLastUpdatedP || !environmentSpan) {
    console.error("Element with ID 'date-last-updated' or 'environment' not found.");
    return;
  }

  // Display the environment immediately without waiting for the date fetch to complete
  displayEnvironment(environmentSpan, getEnvironment());

  try {
    // Fetch, parse, and display the last updated date
    const rawDate = await fetchDateLastUpdated();
    displayDate(dateLastUpdatedP, parseDate(rawDate)); // Convert raw date string to Date object before displaying
  } catch (error) {
    console.error("Error fetching last updated date:", error);
    dateLastUpdatedP.textContent = "Error fetching date";
  }
}

document.addEventListener("DOMContentLoaded", init); // Initialize the page once the DOM is fully loaded
