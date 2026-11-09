export const privacy = {
  controller: "Elemental Corp",
  email: "coradi.maddaloni@gmail.com",
  version: "2026-11-09",
  updated: "9 de novembro de 2026",
  noticeKey: "ew.privacy.notice",
  channel: "elemental-write-privacy",
} as const;
export function noticeAcknowledged() {
  try {
    const record = JSON.parse(
      localStorage.getItem(privacy.noticeKey) || "null",
    );
    return (
      record?.version === privacy.version &&
      typeof record.acknowledgedAt === "string"
    );
  } catch {
    return false;
  }
}
export function acknowledgeNotice() {
  try {
    localStorage.setItem(
      privacy.noticeKey,
      JSON.stringify({
        version: privacy.version,
        acknowledgedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* The editor remains usable when this preference cannot be saved. */
  }
}
