export const WEDDING_QUICK_MATCH_KEY = "quickMatchPrefill";
export const WEDDING_QUICK_MATCH_TTL = 30 * 60 * 1000;
export const WEDDING_LEAD_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbwGOi4e1J2Q1w8x-5UEe-czB3uy6mET90xBhP9OG82fl4jRPEyYdBfqJkmDZuYJMFuc/exec";

export const WEDDING_REGIONS = [
  { code: "capital", key: "sudogwon", label: "수도권" },
  { code: "chungcheong", key: "chungcheong", label: "충청권" },
  { code: "gyeongsang", key: "gyeongsang", label: "경상권" },
  { code: "jeolla", key: "jeolla", label: "전라권" },
  { code: "gangwon", key: "gangwon", label: "강원권" },
  { code: "jeju", key: "jeju", label: "제주" },
] as const;

export type WeddingQuickMatchPrefill = {
  version: 1;
  createdAt: number;
  from: "wedding_mc";
  name: string;
  phone: string;
  date: string;
  time: string;
  dateUndecided: boolean;
  region: string;
  gender: "female" | "male" | "any";
  consented: true;
  leadTracked: boolean;
  sheetSubmitted: boolean;
};

export function weddingPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  if (/^(010\d{8}|01[16789]\d{7,8})$/.test(digits)) {
    const split = digits.length === 11 ? 7 : 6;
    return `${digits.slice(0, 3)}-${digits.slice(3, split)}-${digits.slice(split)}`;
  }
  if (/^02\d{8}$/.test(digits))
    return `${digits.slice(0, 2)}-${digits.slice(2, -4)}-${digits.slice(-4)}`;
  if (/^0[3-6]\d{8,9}$/.test(digits))
    return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`;
  return null;
}

function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

export function parseWeddingQuickMatchPrefill(
  value: unknown,
  now = Date.now(),
): WeddingQuickMatchPrefill | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || v.from !== "wedding_mc" || v.consented !== true)
    return null;
  if (
    typeof v.createdAt !== "number" ||
    !Number.isFinite(v.createdAt) ||
    now - v.createdAt > WEDDING_QUICK_MATCH_TTL ||
    v.createdAt > now + 60_000
  )
    return null;
  if (
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.trim().length > 80 ||
    typeof v.phone !== "string"
  )
    return null;
  const phone = weddingPhone(v.phone);
  if (
    !phone ||
    !WEDDING_REGIONS.some((r) => r.code === v.region) ||
    !["female", "male", "any"].includes(String(v.gender))
  )
    return null;
  const undecided = v.dateUndecided === true;
  if (
    !undecided &&
    (typeof v.date !== "string" ||
      !validDate(v.date) ||
      typeof v.time !== "string" ||
      !/^(09|1\d|20):(00|30)$/.test(v.time))
  )
    return null;
  return {
    version: 1,
    createdAt: v.createdAt,
    from: "wedding_mc",
    consented: true,
    name: v.name.trim(),
    phone,
    date: undecided ? "" : String(v.date),
    time: undecided ? "" : String(v.time),
    dateUndecided: undecided,
    region: String(v.region),
    gender: v.gender as WeddingQuickMatchPrefill["gender"],
    leadTracked: v.leadTracked === true,
    sheetSubmitted: v.sheetSubmitted === true,
  };
}

export function readWeddingQuickMatchPrefill(
  store: Pick<Storage, "getItem" | "removeItem">,
  now = Date.now(),
) {
  try {
    const raw = store.getItem(WEDDING_QUICK_MATCH_KEY);
    if (!raw) return null;
    const value = parseWeddingQuickMatchPrefill(JSON.parse(raw), now);
    if (!value) store.removeItem(WEDDING_QUICK_MATCH_KEY);
    return value;
  } catch {
    return null;
  }
}

export function weddingQuickMatchUrl(value: WeddingQuickMatchPrefill) {
  const params = new URLSearchParams({
    from: "wedding_mc",
    date: value.dateUndecided ? "undecided" : value.date,
    region: value.region,
    gender: value.gender,
  });
  if (value.time) params.set("time", value.time);
  return `/quick-match?${params}`;
}
