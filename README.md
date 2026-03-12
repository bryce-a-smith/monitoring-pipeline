# Monitoring & Alerting Pipeline

### CI/CD · Uptime Monitoring · Automated Alerting

**Live:** [status.aldenbryce.com](https://status.aldenbryce.com) &nbsp;·&nbsp;
**Dev:** [dev.status.aldenbryce.com](https://dev.status.aldenbryce.com) &nbsp;·&nbsp;
**QA:** [qa.status.aldenbryce.com](https://qa.status.aldenbryce.com)

---

## Overview

This project demonstrates a full deployment and observability pipeline built around a static
status dashboard. The goal was to apply and showcase the core concepts behind DevOps
engineering: CI/CD automation, environment lifecycle management, uptime monitoring,
and automated incident alerting.

Every component was chosen deliberately:

| Component        | Role                                                     |
| ---------------- | -------------------------------------------------------- |
| GitHub Actions   | CI pipeline — validates and logs every deployment        |
| AWS Amplify      | Cloud hosting + branch-based environment deployments     |
| AWS Route 53     | DNS configuration and subdomain routing                  |
| UptimeRobot      | HTTP health check monitoring (every 5 minutes)           |
| Power Automate   | Webhook-triggered alert routing (outage + recovery)      |
| GitHub API       | Live last-updated timestamp pulled from commit history   |
| Shared theme CSS | Hosted design tokens for cross-project style consistency |

---

## Architecture

```
[GitHub Repository]
       |
       |  push to branch (dev / qa / main)
       v
[GitHub Actions — CI Pipeline]
       |
       |  validates files, logs commit metadata
       v
[AWS Amplify — Branch Deployments]
       |
       |---> dev   branch --> dev.status.aldenbryce.com
       |---> qa    branch --> qa.status.aldenbryce.com
       |---> main  branch --> status.aldenbryce.com  (Production)
       |
       |  pinged every 5 minutes
       v
[UptimeRobot — Health Check Monitor]
       |
       |  site down? fires webhook
       v
[Power Automate — Alert Flow]
       |
       |  condition: down or recovered?
       |---> DOWN      --> sends outage alert email
       |---> RECOVERED --> sends recovery email
       v
[Inbox — Incident Notification]


[Page Load — Browser]
       |
       |  fetch() call on DOMContentLoaded
       v
[GitHub API — /repos/.../commits/main]
       |
       |  response.ok check → parse JSON → return raw date string
       v
[parseDate() → Date object]
       |
       v
[displayDate() — formats and renders to DOM]
```

---

## Branch Strategy

This project uses a three-branch model that mirrors a real Dev → QA → Production
promotion workflow.

| Branch | Environment  | URL                       |
| ------ | ------------ | ------------------------- |
| `dev`  | Development  | dev.status.aldenbryce.com |
| `qa`   | QA / Staging | qa.status.aldenbryce.com  |
| `main` | Production   | status.aldenbryce.com     |

Changes are developed on `dev`, merged to `qa` for staging validation,
then promoted to `main` for production deployment. Each push triggers
an Amplify auto-deploy and a GitHub Actions pipeline run.

The app detects its current environment at runtime using `window.location.hostname`
and displays the appropriate environment label — no build-time configuration needed.

---

## JavaScript — Function Design

`script.js` follows a strict separation of concerns across five functions:

| Function                           | Responsibility                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `fetchDateLastUpdated()`           | Fetches raw ISO date string from GitHub API. Validates `response.ok` before parsing.     |
| `parseDate(dateString)`            | Converts raw string to a `Date` object. Single responsibility — no DOM, no fetch.        |
| `displayDate(element, date)`       | Formats `Date` object and writes to DOM element.                                         |
| `getEnvironment()`                 | Reads `window.location.hostname`, returns environment string. Synchronous, cannot fail.  |
| `displayEnvironment(element, env)` | Writes environment string to DOM element.                                                |
| `init()`                           | Orchestrator. Grabs DOM references once, calls all other functions, owns error handling. |

`init()` is wired to `DOMContentLoaded` rather than `window.onload` — the DOM only
needs to be parsed, not fully loaded, so this fires faster and more reliably.

`getEnvironment()` is called outside of a try/catch in `init()` because it is
synchronous and reads only from `window.location.hostname` — it cannot throw.
Only the async fetch is wrapped in try/catch.

Error handling in `fetchDateLastUpdated()` includes a `response.ok` guard to catch
HTTP-level failures (403 rate limit, 404, etc.) before attempting to parse the
response body — preventing misleading TypeErrors from propagating to the catch block.

---

## Shared Styles — Cross-Project Design Consistency

Rather than duplicating CSS across repos, shared design tokens (colors, fonts, spacing)
are hosted at `aldenbryce.com/theme.css` and imported via a single `<link>` tag.
Component-specific styles remain local to this repo in `styles/styles.css`.

A change to `theme.css` on the main site propagates to every connected project
automatically — the same principle behind a design system or shared component library,
applied at the CSS level.

```html
<!-- Shared design tokens from main site -->
<link rel="stylesheet" href="https://aldenbryce.com/theme.css" />

<!-- Project-specific styles -->
<link rel="stylesheet" href="styles/styles.css" />
```

---

## Live Last-Updated Timestamp — GitHub API

The "last updated" timestamp shown on the status page is pulled live from the
GitHub API on every page load — not hardcoded, not injected at build time.

Fetch, parse, and display are handled by three separate functions following
single-responsibility principles. `init()` orchestrates all three and owns
error handling in one place.

```javascript
// Fetch — returns raw string from API
async function fetchDateLastUpdated() {
  const response = await fetch("https://api.github.com/repos/bryce-a-smith/monitoring-pipeline/commits/main");
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  const data = await response.json();
  return data.commit.author.date;
}

// Parse — converts string to Date object
function parseDate(dateString) {
  return new Date(dateString);
}

// Display — formats Date and writes to DOM
function displayDate(element, date) {
  element.textContent = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
```

This reflects the last commit to the `main` branch — the actual last deployment
date for production. The `response.ok` check ensures HTTP-level errors (rate limits,
network failures) produce meaningful error messages rather than silent TypeErrors.

---

## CI/CD Pipeline

**File:** `.github/workflows/deploy.yml`

The GitHub Actions workflow triggers on every push to `dev`, `qa`, and `main`.
It performs pre-deploy validation (confirms required files exist) and logs
commit metadata for traceability.

AWS Amplify handles the actual deployment via its GitHub branch connection —
the Actions pipeline serves as the visible audit trail, pre-deploy gate,
and the location for any future build steps (linting, testing, etc.).

**Screenshot — GitHub Actions successful run:**

![GitHub Actions Run](screenshots/actions-run.png)

**Screenshot — Pipeline step output:**

![Pipeline Logs](screenshots/actions-logs.png)

---

## AWS Amplify Deployment

The app is deployed to AWS Amplify with three branch deployments,
each mapped to a custom subdomain via Route 53.

SSL certificates are provisioned automatically by Amplify for all subdomains.

**Screenshot — Amplify branch deployments:**

![Amplify Branches](screenshots/amplify-branches.png)

**Screenshot — All three environments live:**

![Three Environments](screenshots/three-envs.png)

---

## DNS Configuration — Route 53

Custom domain routing is configured in AWS Route 53 using CNAME records
pointing each subdomain to its corresponding Amplify branch deployment URL.

| Record       | Type  | Target                  |
| ------------ | ----- | ----------------------- |
| `status`     | CNAME | Amplify main branch URL |
| `dev.status` | CNAME | Amplify dev branch URL  |
| `qa.status`  | CNAME | Amplify qa branch URL   |

**Screenshot — Route 53 CNAME records:**

![Route 53 Records](screenshots/route53-records.png)

**Screenshot — Amplify custom domain showing SSL active:**

![SSL Active](screenshots/amplify-ssl.png)

---

## Uptime Monitoring — UptimeRobot

UptimeRobot performs HTTP health checks against all three environment URLs
every 5 minutes. A monitor is considered down if the URL returns anything
other than a 200 OK response.

Three monitors are configured:

- `status.aldenbryce.com` — Production
- `dev.status.aldenbryce.com` — Development
- `qa.status.aldenbryce.com` — QA / Staging

When a monitor detects a failure, it fires a webhook to Power Automate.

**Screenshot — UptimeRobot dashboard (all monitors up):**

![UptimeRobot Dashboard](screenshots/uptimerobot-dashboard.png)

---

## Automated Alerting — Power Automate

When UptimeRobot detects an outage, it sends a JSON webhook payload to a
Power Automate HTTP trigger. The flow evaluates the alert type and routes
to the appropriate action:

- **Down** → sends outage alert email with monitor name, URL, and timestamp
- **Recovered** → sends recovery notification email

This applies the same tooling used in production at BNY Mellon for incident
notification routing — in a new infrastructure alerting context.

**Screenshot — Power Automate flow:**

![Power Automate Flow](screenshots/power-automate-flow.png)

---

## End-to-End Test

To verify the full pipeline, an intentional outage was triggered by disabling
the production Amplify branch deployment.

**Test sequence:**

1. Disabled Amplify production deployment — site went offline
2. Waited for UptimeRobot to detect outage (within 5 minutes)
3. Confirmed Power Automate webhook fired
4. Received outage alert email in inbox
5. Re-enabled deployment — site came back online
6. Confirmed UptimeRobot detected recovery
7. Received recovery notification email in inbox

**Screenshot — UptimeRobot showing DOWN state:**

![Monitor Down](screenshots/uptimerobot-down.png)

**Screenshot — Outage alert email received:**

![Outage Email](screenshots/alert-email-down.png)

**Screenshot — UptimeRobot showing RECOVERED state:**

![Monitor Recovered](screenshots/uptimerobot-recovered.png)

**Screenshot — Recovery email received:**

![Recovery Email](screenshots/alert-email-recovered.png)

**Screenshot — Power Automate run history:**

![Flow Run History](screenshots/power-automate-runs.png)

---

## Tech Stack

- **Languages:** HTML5, CSS3, JavaScript (ES6)
- **CI/CD:** GitHub Actions
- **Cloud:** AWS Amplify, AWS Route 53
- **Monitoring:** UptimeRobot
- **Alerting:** Power Automate (HTTP webhook trigger)
- **Data:** GitHub REST API (live commit timestamp)
- **DNS:** AWS Route 53 (CNAME records, custom subdomain routing)
- **SSL:** AWS Amplify Certificate Manager (auto-provisioned)

---

## Future Improvements

- [ ] Add Terraform configuration to provision Amplify app and Route 53 records as Infrastructure as Code
- [ ] Implement a canary deployment script to route a percentage of traffic to a new version before full rollout
- [ ] Add multi-region redundancy using AWS CloudFront and S3 with Route 53 failover routing policy
- [ ] Integrate Datadog or Grafana for metrics dashboarding alongside UptimeRobot uptime checks
- [ ] Add GitHub Actions status badge to README
- [ ] Add automated HTML validation step to the CI pipeline

---

## Author

**Alden Smith**
[aldenbryce.dev](https://aldenbryce.dev) &nbsp;·&nbsp;
[linkedin.com/in/aldenbryce](https://linkedin.com/in/aldenbryce) &nbsp;·&nbsp;
[github.com/bryce-a-smith](https://github.com/bryce-a-smith)
