# UltraTube (Supertube)

A YouTube-browsing frontend powered by RapidAPI, integrated into the Divine platform.

## Overview

UltraTube provides a full-featured video browsing UI at `/divine/supertube/` that proxies all YouTube API calls through the server — **no RapidAPI keys are ever exposed to the browser**.

## Required Environment Variables

| Variable | Description |
|---|---|
| `RAPIDAPI_HOST` | RapidAPI host for the YouTube API (e.g. `yt-api.p.rapidapi.com`) |
| `RAPIDAPI_KEY` | Your RapidAPI key |

Set these alongside the other server environment variables before starting the server.

## How to Run Locally

```bash
# From the server directory
RAPIDAPI_HOST=yt-api.p.rapidapi.com \
RAPIDAPI_KEY=your_key_here \
AUTH_PIN=yourpin OWNER_PIN=yourpin JWT_SECRET=yoursecret \
node index.js
```

Then open `http://localhost:3000/divine/supertube/` in your browser.

## Adding the Logo

Place your logo image at `divine/supertube/ultratube.png`.  
The UI references it at `/divine/supertube/ultratube.png`.

## API Endpoints Contract

All endpoints are mounted at `/api/supertube/`.

| Endpoint | Params | Description |
|---|---|---|
| `GET /channelDetails` | `id` | Channel details |
| `GET /channelVideos` | `id`, `pageToken?`, `pageSize?` | Videos for a channel (default 6 per page) |
| `GET /videoDetails` | `id` | Video metadata |
| `GET /videoComments` | `id`, `pageToken?` | Video comments |
| `GET /videoStreaming` | `id` | Streaming data + `embedUrl` using youtube-nocookie |
| `GET /playlistDetails` | `id` | Playlist metadata |
| `GET /playlistVideos` | `id`, `pageToken?`, `pageSize?` | Videos in a playlist |
| `GET /search` | `query`, `pageToken?`, `pageSize?` | Search videos |
| `GET /home` | `pageToken?`, `pageSize?` | Trending / home feed |
| `GET /shorts` | `pageToken?`, `pageSize?` | Shorts feed (default 10 per page) |
| `GET /channelSearch` | `query` | Search for channels |

### Normalized response shape

All video list responses return:
```json
{
  "videos": [
    {
      "id": "string",
      "title": "string",
      "channel": "string",
      "channelId": "string",
      "description": "string",
      "thumbnails": { "high": "url", "medium": "url", "default": "url" },
      "publishedAt": "string",
      "duration": "4:13",
      "viewCount": "string",
      "likeCount": "string"
    }
  ],
  "nextPageToken": "string"
}
```

### Error responses

| Code | Body | Meaning |
|---|---|---|
| 400 | `{ "error": "Invalid or missing id" }` | Bad request params |
| 502 | `{ "error": "Upstream error", "details": "..." }` | RapidAPI returned an error |
| 503 | `{ "error": "Service not configured", "details": "..." }` | Missing env vars |

## Server Integration

The router is mounted in `server/index.js`:

```js
app.use("/api/supertube", require("./routes/supertube"));
```

This was added just before the `/divine` authentication middleware so the API is accessible without a Divine session (the UI itself is at `/divine/supertube/` which is protected by the existing `/divine` auth middleware).

## Security Notes

- **Keys only via env vars** — `RAPIDAPI_HOST` and `RAPIDAPI_KEY` never appear in client-side code.
- **youtube-nocookie embeds** — the `videoStreaming` endpoint returns `embedUrl` using `https://www.youtube-nocookie.com/embed/...` and the frontend uses the same for watch modals and shorts iframes.
- **Input sanitization** — all `id`, `query`, `pageToken`, and `pageSize` params are validated/sanitized server-side before being forwarded to RapidAPI.
- **`pageSize` capped at 50** — prevents excessive upstream API usage.
- **In-memory TTL cache (2 min)** — reduces RapidAPI call volume and cost.
- **Monitor RapidAPI usage** — watch your RapidAPI dashboard to stay within quota limits.

## TODO

> ⚠️ No existing test harness was found in this repository. Unit tests for the supertube router should be added when a test framework is introduced. Suggested coverage:
> - Param validation (bad `id`, oversized `pageSize`, injection attempts)
> - Cache hit/miss behaviour
> - Upstream 4xx/5xx error handling → 502 responses
> - Normalization helpers (`normalizeDuration`, `normalizeThumbnails`, etc.)
