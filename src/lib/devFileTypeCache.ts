import type { ScannerId } from "./categoryMeta";

/** File-type scanners that support `.dev-cache/{id}.json` in development. */
export const DEV_CACHE_SCANNER_IDS = ["file_video", "file_image"] as const;

export type DevCacheScannerId = (typeof DEV_CACHE_SCANNER_IDS)[number];

export function isDevCacheScannerId(
  scannerId: ScannerId,
): scannerId is DevCacheScannerId {
  return (DEV_CACHE_SCANNER_IDS as readonly string[]).includes(scannerId);
}

export function devCacheCliHint(scannerId: DevCacheScannerId): string {
  return scannerId === "file_video"
    ? "pnpm dev:cache-videos"
    : "pnpm dev:cache-images";
}
