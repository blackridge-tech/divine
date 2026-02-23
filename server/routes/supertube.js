"use strict";
/**
 * Supertube / UltraTube API router
 * Mounted at /api/supertube by server/index.js
 *
 * Required env vars:
 *   RAPIDAPI_HOST  – e.g. yt-api.p.rapidapi.com
 *   RAPIDAPI_KEY   – your RapidAPI key
 *
 * All responses are normalized to a minimal shape the frontend expects.
 * RapidAPI calls are cached in-memory for 2 minutes (TTL cache).
 */

const express = require("express");
const router = express.Router();

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
function envStr(name, fallback = "") {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

const RAPIDAPI_HOST = () => envStr("RAPIDAPI_HOST");
const RAPIDAPI_KEY  = () => envStr("RAPIDAPI_KEY");

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 6;
const DEFAULT_SHORTS_SIZE = 10;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// ---------------------------------------------------------------------------
// In-memory TTL cache
// ---------------------------------------------------------------------------
const cache = new Map(); // key -> { data, expiresAt }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Periodically evict stale entries so the Map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now > v.expiresAt) cache.delete(k);
  }
}, CACHE_TTL_MS);

// ---------------------------------------------------------------------------
// Param validation / sanitization
// ---------------------------------------------------------------------------
const RE_SAFE_ID = /^[A-Za-z0-9_\-]{1,128}$/;
const RE_SAFE_QUERY = /^.{1,256}$/;

function sanitizeId(v) {
  const s = String(v || "").trim();
  return RE_SAFE_ID.test(s) ? s : null;
}

function sanitizeQuery(v) {
  const s = String(v || "").trim();
  return RE_SAFE_QUERY.test(s) ? s : null;
}

function sanitizePageToken(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // Page tokens from YouTube/RapidAPI may contain URL-safe base64 chars
  return /^[A-Za-z0-9_\-=]{0,512}$/.test(s) ? s : "";
}

function sanitizePageSize(v, def) {
  const n = parseInt(String(v || ""), 10);
  if (isNaN(n) || n < 1) return def;
  return Math.min(n, MAX_PAGE_SIZE);
}

// ---------------------------------------------------------------------------
// RapidAPI fetch helper
// ---------------------------------------------------------------------------
async function rapidFetch(path, params = {}) {
  const host = RAPIDAPI_HOST();
  const key  = RAPIDAPI_KEY();

  if (!host || !key) {
    const err = new Error("RAPIDAPI_HOST or RAPIDAPI_KEY not configured");
    err.status = 503;
    throw err;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `https://${host}${path}${qs ? "?" + qs : ""}`;

  const cacheKey = url;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": key,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Upstream ${res.status}`);
    err.status = 502;
    err.details = text.slice(0, 500);
    throw err;
  }

  const json = await res.json();
  cacheSet(cacheKey, json);
  return json;
}

// ---------------------------------------------------------------------------
// Normalizers – convert RapidAPI response shapes to a minimal frontend shape
// ---------------------------------------------------------------------------
function normalizeDuration(iso) {
  // ISO 8601 e.g. PT4M13S -> "4:13"
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const sec = parseInt(m[3] || "0", 10);
  if (h) return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function normalizeThumbnails(thumbs) {
  if (!thumbs) return {};
  // Prefer high/medium/default in that order
  return {
    high:   thumbs.high?.url   || thumbs.medium?.url || thumbs.default?.url || "",
    medium: thumbs.medium?.url || thumbs.default?.url || "",
    default: thumbs.default?.url || "",
  };
}

function normalizeVideo(item) {
  const snip = item.snippet || {};
  const stats = item.statistics || {};
  const content = item.contentDetails || {};
  const id = item.id?.videoId || item.id || "";
  return {
    id: typeof id === "string" ? id : (id.videoId || ""),
    title: snip.title || "",
    channel: snip.channelTitle || "",
    channelId: snip.channelId || "",
    description: snip.description || "",
    thumbnails: normalizeThumbnails(snip.thumbnails),
    publishedAt: snip.publishedAt || "",
    duration: normalizeDuration(content.duration || ""),
    viewCount: stats.viewCount || "",
    likeCount: stats.likeCount || "",
  };
}

function normalizeChannel(item) {
  const snip = item.snippet || {};
  const stats = item.statistics || {};
  return {
    id: item.id || "",
    title: snip.title || "",
    description: snip.description || "",
    thumbnails: normalizeThumbnails(snip.thumbnails),
    subscriberCount: stats.subscriberCount || "",
    videoCount: stats.videoCount || "",
  };
}

function normalizePlaylist(item) {
  const snip = item.snippet || {};
  const content = item.contentDetails || {};
  return {
    id: item.id || "",
    title: snip.title || "",
    channel: snip.channelTitle || "",
    channelId: snip.channelId || "",
    thumbnails: normalizeThumbnails(snip.thumbnails),
    itemCount: content.itemCount || "",
  };
}

function normalizeComment(item) {
  const top = item.snippet?.topLevelComment?.snippet || item.snippet || {};
  return {
    id: item.id || "",
    text: top.textDisplay || "",
    author: top.authorDisplayName || "",
    authorAvatar: top.authorProfileImageUrl || "",
    likeCount: top.likeCount || 0,
    publishedAt: top.publishedAt || "",
  };
}

function normalizeList(items, normalizer) {
  return Array.isArray(items) ? items.map(normalizer) : [];
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------
function sendUpstreamError(res, err) {
  if (err.status === 503) return res.status(503).json({ error: "Service not configured", details: err.message });
  return res.status(502).json({ error: "Upstream error", details: err.details || err.message || "Unknown error" });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/supertube/channelDetails?id=
router.get("/channelDetails", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const data = await rapidFetch("/channel/details", { id });
    return res.json(normalizeChannel(data));
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/channelVideos?id=&pageToken=&pageSize=6
router.get("/channelVideos", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const pageToken = sanitizePageToken(req.query.pageToken);
    const pageSize  = sanitizePageSize(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const params = { id, maxResults: pageSize };
    if (pageToken) params.cursor = pageToken;
    const data = await rapidFetch("/channel/videos", params);
    return res.json({
      videos: normalizeList(data.data || data.items || [], normalizeVideo),
      nextPageToken: data.continuation || data.nextPageToken || "",
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/videoDetails?id=
router.get("/videoDetails", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const data = await rapidFetch("/video/details", { id });
    return res.json(normalizeVideo(data));
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/videoComments?id=&pageToken=
router.get("/videoComments", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const pageToken = sanitizePageToken(req.query.pageToken);
    const params = { id };
    if (pageToken) params.cursor = pageToken;
    const data = await rapidFetch("/comments", params);
    return res.json({
      comments: normalizeList(data.data || data.items || [], normalizeComment),
      nextPageToken: data.continuation || data.nextPageToken || "",
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/videoStreaming?id=
router.get("/videoStreaming", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const data = await rapidFetch("/video/streaming-data", { id });
    // Return embed URL using youtube-nocookie and any streaming formats available
    return res.json({
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      formats: Array.isArray(data.formats) ? data.formats.slice(0, 5) : [],
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/playlistDetails?id=
router.get("/playlistDetails", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const data = await rapidFetch("/playlist/details", { id });
    return res.json(normalizePlaylist(data));
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/playlistVideos?id=&pageToken=&pageSize=6
router.get("/playlistVideos", async (req, res) => {
  try {
    const id = sanitizeId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });
    const pageToken = sanitizePageToken(req.query.pageToken);
    const pageSize  = sanitizePageSize(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const params = { id, maxResults: pageSize };
    if (pageToken) params.cursor = pageToken;
    const data = await rapidFetch("/playlist/videos", params);
    return res.json({
      videos: normalizeList(data.data || data.items || [], normalizeVideo),
      nextPageToken: data.continuation || data.nextPageToken || "",
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/search?query=&pageToken=&pageSize=6
router.get("/search", async (req, res) => {
  try {
    const query = sanitizeQuery(req.query.query);
    if (!query) return res.status(400).json({ error: "Invalid or missing query" });
    const pageToken = sanitizePageToken(req.query.pageToken);
    const pageSize  = sanitizePageSize(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const params = { q: query, maxResults: pageSize, type: "video" };
    if (pageToken) params.cursor = pageToken;
    const data = await rapidFetch("/search", params);
    return res.json({
      videos: normalizeList(data.data || data.items || [], normalizeVideo),
      nextPageToken: data.continuation || data.nextPageToken || "",
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/home?pageToken=&pageSize=6
router.get("/home", async (req, res) => {
  try {
    const pageToken = sanitizePageToken(req.query.pageToken);
    const pageSize  = sanitizePageSize(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const params = { type: "video", maxResults: pageSize };
    if (pageToken) params.cursor = pageToken;
    const data = await rapidFetch("/trending", params);
    return res.json({
      videos: normalizeList(data.data || data.items || [], normalizeVideo),
      nextPageToken: data.continuation || data.nextPageToken || "",
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/shorts?pageToken=&pageSize=10
router.get("/shorts", async (req, res) => {
  try {
    const pageToken = sanitizePageToken(req.query.pageToken);
    const pageSize  = sanitizePageSize(req.query.pageSize, DEFAULT_SHORTS_SIZE);
    const params = { maxResults: pageSize };
    if (pageToken) params.cursor = pageToken;
    const data = await rapidFetch("/shorts", params);
    return res.json({
      videos: normalizeList(data.data || data.items || [], normalizeVideo),
      nextPageToken: data.continuation || data.nextPageToken || "",
    });
  } catch (e) { return sendUpstreamError(res, e); }
});

// GET /api/supertube/channelSearch?query=
router.get("/channelSearch", async (req, res) => {
  try {
    const query = sanitizeQuery(req.query.query);
    if (!query) return res.status(400).json({ error: "Invalid or missing query" });
    const data = await rapidFetch("/search", { q: query, type: "channel", maxResults: 10 });
    const items = data.data || data.items || [];
    const channels = items.map(item => {
      const snip = item.snippet || {};
      return {
        id: item.id?.channelId || item.id || "",
        title: snip.title || snip.channelTitle || "",
        thumbnails: normalizeThumbnails(snip.thumbnails),
        description: snip.description || "",
      };
    });
    return res.json({ channels });
  } catch (e) { return sendUpstreamError(res, e); }
});

module.exports = router;
