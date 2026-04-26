/**
 * Generate or retrieve a stable device fingerprint stored in localStorage.
 * Used by anti-abuse layer alongside server-side IP rate limiting.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "rawl_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    const fp = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || 0,
    ].join("|");
    // Lightweight hash
    let h = 0;
    for (let i = 0; i < fp.length; i++) h = (h * 31 + fp.charCodeAt(i)) | 0;
    id = `dev_${Math.abs(h).toString(36)}_${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
