# nerd-splash-data

Auto-synced Instagram analytics for [@_juliettech](https://instagram.com/_juliettech), updated hourly via GitHub Actions. Data is served over `raw.githubusercontent.com` (CORS-open) so it can be fetched directly by the nerd_splash analytics dashboard without any proxy or backend.

## How it works

```
GitHub Actions (cron: every hour)
  └── curl → Instagram Graph API
        └── writes data/latest.json
        └── appends data/history.jsonl
        └── writes data/daily/YYYY-MM-DD.json
              └── committed & pushed to this repo
                    └── dashboard fetches raw.githubusercontent.com/…/data/latest.json
```

Public repos on GitHub serve raw files with `Access-Control-Allow-Origin: *`, which is the whole point — the dashboard can `fetch()` the data directly from the browser with no CORS issues.

## Files

| Path | Updated | Description |
|------|---------|-------------|
| `data/latest.json` | Every hour | Full current state — followers, media count, last 20 posts with likes/comments/reach |
| `data/history.jsonl` | Every hour | Compact append-only log, one JSON line per run. Use this for charting follower growth over time |
| `data/daily/YYYY-MM-DD.json` | Once per day | Full daily snapshot archive — same format as `latest.json` |

## Setup

### 1. Add the Instagram token as a secret

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|------|-------|
| `IG_TOKEN` | Your Meta system user access token (permanent, never expires) |

The token needs these permissions: `instagram_basic`, `pages_read_engagement`, `instagram_manage_insights`.

### 2. Run the first sync

Actions tab → **Sync Instagram Analytics** → **Run workflow**. It'll populate `data/` in ~30 seconds.

After that it runs automatically every hour with no further action needed.

### 3. Connect to the dashboard

In the nerd_splash analytics artifact, update the config line:

```js
const GH_IG_URL = 'https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/nerd-splash-data/main/data/latest.json';
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub handle. The Instagram tab will start loading live data immediately.

## Data shape

### `data/latest.json`
```json
{
  "username": "_juliettech",
  "followers": 12345,
  "media_count": 89,
  "fetched_at": "2026-06-28T14:00:00Z",
  "posts": [
    {
      "id": "...",
      "date": "2026-06-27",
      "type": "IMAGE",
      "caption": "...",
      "likes": 142,
      "comments": 8,
      "url": "https://www.instagram.com/p/...",
      "impressions": 1840,
      "reach": 1600,
      "saves": 23
    }
  ]
}
```

### `data/history.jsonl`
One compact JSON object per line:
```jsonl
{"t":"2026-06-28T14:00:00Z","f":12345,"mc":89,"pc":20,"tl":142,"tc":8,"al":67.4}
```

| Key | Meaning |
|-----|---------|
| `t` | Timestamp (UTC) |
| `f` | Followers |
| `mc` | Total media count |
| `pc` | Posts fetched this run |
| `tl` | Top post likes |
| `tc` | Top post comments |
| `al` | Average likes across fetched posts |

## Cost

**Free.** Public repositories get unlimited GitHub Actions minutes. The workflow runs ~720 times/month and uses no paid services.
