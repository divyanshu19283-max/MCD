const KEY = "localfix-citizen-id";

export function getCitizenId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= 16) return existing;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(KEY, id);
  return id;
}
