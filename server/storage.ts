// Storage helpers for standalone deployment
// Avatar uploads are stored as base64 data URLs or external URLs
// For production, consider integrating with AWS S3, Cloudflare R2, or similar

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig | null {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Upload file to storage.
 * Falls back to returning a data URL if no storage backend is configured.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  if (!config) {
    // Fallback: return data as base64 data URL
    const base64 = typeof data === "string"
      ? Buffer.from(data).toString("base64")
      : Buffer.from(data).toString("base64");
    const url = `data:${contentType};base64,${base64}`;
    console.warn("[Storage] No storage backend configured, using data URL fallback");
    return { key, url };
  }

  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(config.baseUrl));
  uploadUrl.searchParams.set("path", key);

  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(config.apiKey),
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  if (!config) {
    return { key, url: "" };
  }

  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(config.baseUrl)
  );
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(config.apiKey),
  });
  return {
    key,
    url: (await response.json()).url,
  };
}
