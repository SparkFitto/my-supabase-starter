export const TARGET_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "pt", label: "Portuguese (BR)", flag: "🇧🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
] as const;

export const SOURCE_LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
] as const;

export const SERIES_TYPES = [
  { code: "manga", label: "Manga", flag: "🇯🇵", country: "Japanese" },
  { code: "manhwa", label: "Manhwa", flag: "🇰🇷", country: "Korean" },
  { code: "manhua", label: "Manhua", flag: "🇨🇳", country: "Chinese" },
] as const;

export function languageLabel(code: string) {
  return TARGET_LANGUAGES.find((l) => l.code === code)?.label
    ?? SOURCE_LANGUAGES.find((l) => l.code === code)?.label
    ?? code.toUpperCase();
}

export function typeLabel(code: string) {
  return SERIES_TYPES.find((t) => t.code === code)?.label ?? code;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,.png,.zip,.cbz,.pdf";
export const ACCEPTED_MIME = ["image/jpeg","image/png","application/zip","application/x-cbz","application/pdf","application/x-zip-compressed"];

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["jpg","jpeg","png","zip","cbz","pdf"].includes(ext)) {
    return "Unsupported file. Use JPG, PNG, ZIP, CBZ or PDF.";
  }
  if (file.size > 200 * 1024 * 1024) return "File too large (max 200MB).";
  return null;
}
