# monitoring-pipeline

Personal infrastructure monitoring and alerting pipeline. Automated health checks, live status page, and incident documentation across six environments.

Live at [status.aldenbryce.com](https://status.aldenbryce.com)

---

## What it does

- Runs automated HTTP health checks against all six environments every five minutes via GitHub Actions
- Writes results to a dedicated `status-data` branch so the status page always has current data without triggering a redeploy
- Renders a live status dashboard showing per-environment uptime, response state, and last commit timestamp
- Routes downtime alerts through UptimeRobot webhooks to Power Automate for email notification
- Tracks production incidents in a structured postmortem log at [aldenbryce.com/incidents](https://aldenbryce.com/incidents)

---

## Architecture

```
GitHub Actions (cron, every 5 min)
  |
  |- pings all six URLs via curl
  |- writes status.json to status-data branch
  |
status.aldenbryce.com
  |- fetches status.json from raw.githubusercontent.com
  |- fetches last commit date per branch from GitHub API
  |- renders environment cards with live state

UptimeRobot (independent, every 5 min)
  |- fires webhook on state change
  |
Power Automate
  |- receives webhook
  |- sends email alert
```

---

## Environments

| Environment    | URL                               | Repo                | Branch |
| -------------- | --------------------------------- | ------------------- | ------ |
| Portfolio prod | https://aldenbryce.com            | Website             | main   |
| Portfolio dev  | https://dev.aldenbryce.com        | Website             | dev    |
| Portfolio qa   | https://qa.aldenbryce.com         | Website             | qa     |
| Status prod    | https://status.aldenbryce.com     | monitoring-pipeline | main   |
| Status dev     | https://dev.status.aldenbryce.com | monitoring-pipeline | dev    |
| Status qa      | https://qa.status.aldenbryce.com  | monitoring-pipeline | qa     |

---

## Stack

- **GitHub Actions** -- scheduled health check workflow, cron every 5 minutes
- **AWS Amplify** -- hosts all six environments via branch deployments
- **AWS Route 53** -- DNS for all subdomains
- **ACM** -- SSL certificates, provisioned in us-east-1
- **UptimeRobot** -- independent uptime monitoring and webhook alerts
- **Power Automate** -- webhook receiver and email alert routing
- **GitHub API** -- last commit timestamp per branch, fetched client-side

---

## Repo structure

```
monitoring-pipeline/
  .github/
    workflows/
      health-check.yml     # cron job, runs every 5 min, writes to status-data branch
  site/
    index.html             # status page
    incidents.html         # incident log (linked from aldenbryce.com/incidents)
    styles/
      styles.css           # dark theme + status card component
    scripts/
      script.js            # data layer, GitHub API fetches, card builder
  amplify.yml              # tells Amplify to serve from site/ subfolder
  README.md
```

Branch `status-data` contains only `status.json` -- written by the health check workflow, never deployed by Amplify.

---

## Health check workflow

`.github/workflows/health-check.yml` runs on a 5-minute cron and `workflow_dispatch` (manual trigger).

For each URL it records:

- HTTP status code
- Response time in milliseconds
- Timestamp
- Derived status: `up` (2xx), `degraded` (3xx/4xx), `down` (5xx or timeout)

Results are written to `status.json` on the `status-data` branch. Only commits if the file changed -- no unnecessary history.

Requires `permissions: contents: write` to push back to the repo.

---

## Status page data flow

On load, `script.js` fires two sets of requests in parallel:

1. Fetches `status.json` from `status-data` via raw.githubusercontent.com -- applies status indicators to cards
2. Fetches last commit date per branch from the GitHub API -- populates the "Last commit" line on each card

Cards render immediately with a loading state. Results populate as they resolve. One failed fetch does not affect the others -- `Promise.allSettled` handles each independently.

---

## Incident log

Production incidents are documented at [aldenbryce.com/incidents](https://aldenbryce.com/incidents) using a structured postmortem format based on standard SRE practice. Each entry includes root cause analysis, timeline, affected environments, and lessons learned.

See [INC-001](https://aldenbryce.com/incidents) for an example -- a DNS conflict between two AWS Amplify apps claiming the same CloudFront distribution, resolved through IAM role recreation and domain ownership transfer.

---

## AWS infrastructure notes

- Main portfolio app: us-east-1 (N. Virginia)
- Monitoring pipeline app: us-east-2 (Ohio)
- SSL certificates always provisioned in us-east-1 regardless of app region
- Only one Amplify app can own a root domain -- all subdomains must be under the same app
- Remove domain config before deleting an Amplify app to avoid ownership conflicts

---

## Screenshots

_Add after deploying all environments and verifying green status._

|                       |                                                  |
| --------------------- | ------------------------------------------------ |
| Status page           | `docs/screenshots/screenshot-status-page.png`    |
| Incident log          | `docs/screenshots/screenshot-incident-log.png`   |
| UptimeRobot dashboard | `docs/screenshots/screenshot-uptimerobot.png`    |
| GitHub Actions run    | `docs/screenshots/screenshot-github-actions.png` |
| Power Automate flow   | `docs/screenshots/screenshot-power-automate.png` |

---

## Related

- Portfolio site: [aldenbryce.com](https://aldenbryce.com) -- [github.com/bryce-a-smith/Website](https://github.com/bryce-a-smith/Website)
- Incident log: [aldenbryce.com/incidents](https://aldenbryce.com/incidents)
