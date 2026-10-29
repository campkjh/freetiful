import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseWeddingQuickMatchPrefill,
  readWeddingQuickMatchPrefill,
  weddingPhone,
  weddingQuickMatchUrl,
  WEDDING_QUICK_MATCH_KEY,
  WEDDING_QUICK_MATCH_TTL,
  WEDDING_REGIONS,
} from "./wedding-quick-match";

const now = Date.now();
const draft = {
  version: 1,
  createdAt: now,
  from: "wedding_mc",
  name: "  테스트 고객  ",
  phone: "01012345678",
  date: "2027-02-28",
  time: "14:30",
  dateUndecided: false,
  region: "capital",
  gender: "any",
  consented: true,
  sheetSubmitted: true,
  leadTracked: true,
};

test("all supplied regions and genders map to existing quick-match options", () => {
  for (const region of WEDDING_REGIONS)
    for (const gender of ["male", "female", "any"]) {
      const value = parseWeddingQuickMatchPrefill(
        { ...draft, region: region.code, gender },
        now,
      );
      assert.ok(value);
      assert.equal(value.region, region.code);
      assert.equal(value.gender, gender);
    }
  assert.equal(
    WEDDING_REGIONS.find((r) => r.code === "capital")?.key,
    "sudogwon",
  );
});

test("normalizes contact data without putting name or phone in the URL", () => {
  const value = parseWeddingQuickMatchPrefill(draft, now)!;
  assert.equal(value.name, "테스트 고객");
  assert.equal(value.phone, "010-1234-5678");
  assert.equal(weddingPhone("+82 10 1234 5678"), value.phone);
  const url = new URL(weddingQuickMatchUrl(value), "https://freetiful.com");
  assert.equal(url.pathname, "/quick-match");
  assert.deepEqual([...url.searchParams.keys()].sort(), [
    "date",
    "from",
    "gender",
    "region",
    "time",
  ]);
  assert.equal(url.searchParams.get("time"), "14:30");
  assert.ok(
    !url.href.includes("1234") &&
      !url.href.includes(encodeURIComponent(value.name)),
  );
});

test("undecided means no invented event date or time", () => {
  const value = parseWeddingQuickMatchPrefill(
    { ...draft, dateUndecided: true },
    now,
  )!;
  assert.equal(value.date, "");
  assert.equal(value.time, "");
  const params = new URL(weddingQuickMatchUrl(value), "https://freetiful.com")
    .searchParams;
  assert.equal(params.get("date"), "undecided");
  assert.equal(params.has("time"), false);
});

test("rejects expired, malformed, nonconsented and unsupported inputs", () => {
  for (const patch of [
    { version: 2 },
    { from: "other" },
    { consented: false },
    { createdAt: now - WEDDING_QUICK_MATCH_TTL - 1 },
    { createdAt: now + 60_001 },
    { createdAt: NaN },
    { name: "" },
    { name: "a".repeat(81) },
    { phone: "1234" },
    { region: "unknown" },
    { gender: "unknown" },
    { date: "2027-02-29" },
    { date: "2027-13-01" },
    { time: "23:00" },
    { time: "12:15" },
  ])
    assert.equal(
      parseWeddingQuickMatchPrefill({ ...draft, ...patch }, now),
      null,
      JSON.stringify(patch),
    );
});

test("tab storage retains valid drafts for refresh and discards expired drafts", () => {
  const data = new Map([[WEDDING_QUICK_MATCH_KEY, JSON.stringify(draft)]]);
  const store = {
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  assert.ok(readWeddingQuickMatchPrefill(store, now));
  assert.equal(data.size, 1);
  assert.equal(
    readWeddingQuickMatchPrefill(store, now + WEDDING_QUICK_MATCH_TTL + 1),
    null,
  );
  assert.equal(data.size, 0);
  data.set(WEDDING_QUICK_MATCH_KEY, "{bad");
  assert.equal(readWeddingQuickMatchPrefill(store, now), null);
});

test("strips arbitrary draft properties and treats delivery flags as booleans", () => {
  const value = parseWeddingQuickMatchPrefill(
    { ...draft, admin: true, sheetSubmitted: "yes", leadTracked: false },
    now,
  )!;
  assert.equal("admin" in value, false);
  assert.equal(value.sheetSubmitted, false);
  assert.equal(value.leadTracked, false);
});
