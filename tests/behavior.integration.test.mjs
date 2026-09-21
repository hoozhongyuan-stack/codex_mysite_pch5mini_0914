import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import * as domain from "../lib/behavior-domain.mjs";
import * as dates from "../lib/dashboard-domain.mjs";
import { createPostgresDatabase } from "../lib/postgres.mjs";
const sql =
  (await fs.readFile("postgres/003-behavior-events.sql", "utf8")) +
  "\n" +
  (await fs.readFile("postgres/005-share-attribution.sql", "utf8"));
const transpile = async (path, deps) => {
  const output = ts.transpileModule(await fs.readFile(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const result = {};
  new Function("require", "exports", output)((key) => deps[key], result);
  return result;
};
async function verify(db) {
  await db
    .prepare("CREATE TABLE contents(id TEXT,slug TEXT,kind TEXT,data TEXT)")
    .run();
  let role = "owner",
    permissions = ["analytics.view"];
  class HttpError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const server = {
    database: () => db,
    limited: async () => {},
    admin: async (action) => {
      if (
        action === "readAnalytics" &&
        role !== "owner" &&
        !permissions.includes("analytics.view")
      )
        throw new HttpError(403, "denied");
      return { role, userId: "fixture", permissions };
    },
    HttpError,
    fail: (e) =>
      Response.json({ error: e.message }, { status: e.status || 500 }),
    csrf: (r) => {
      if (r.headers.get("origin") !== new URL(r.url).origin)
        throw new HttpError(403, "origin");
    },
    boundedResponse: (r) => r,
  };
  const deps = {
    "./server": server,
    "./behavior-domain.mjs": domain,
    "@/lib/server": server,
    "@/lib/dashboard-domain.mjs": dates,
    "@/lib/behavior-domain.mjs": domain,
  };
  const ingest = (await transpile("lib/behavior-store.ts", deps))
    .ingestBehavior;
  const get = (await transpile("app/api/behavior-summary/route.ts", deps)).GET;
  const payload = {
    id: "e".repeat(20),
    visitorId: "v".repeat(20),
    sessionId: "s".repeat(20),
    event: "page_view",
    path: "/zh",
    channel: "website",
    consent: true,
  };
  const req = (patch = {}, origin = "https://test.example") =>
    new Request("https://test.example/api/behavior", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify({ ...payload, ...patch }),
    });
  assert.equal((await ingest(req({ consent: false }), "website")).status, 400);
  assert.equal(
    (await ingest(req({}, "https://evil.example"), "website")).status,
    403,
  );
  assert.equal((await ingest(req(), "website")).status, 204);
  assert.equal((await ingest(req(), "website")).status, 204);
  const stored = (await db.prepare("SELECT * FROM behavior_events").all())
    .results;
  assert.equal(stored.length, 1);
  assert.notEqual(stored[0].visitor_hash, payload.visitorId);
  assert.equal(
    (await ingest(req({ channel: "mini" }, ""), "mini")).status,
    204,
  );
  const d = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    end = new Date(Date.now() + 8 * 3600000 + 86400000)
      .toISOString()
      .slice(0, 10);
  const url = `https://test.example/api/behavior-summary?start=${d}&end=${end}`;
  const result = await (await get(new Request(url))).json();
  assert.equal(result.views, 2);
  assert.equal(result.visitors, 2);
  assert.equal(result.partial, true);
  assert.equal(
    (await (await get(new Request(url + "&channel=mini"))).json()).views,
    1,
  );
  await db
    .prepare("INSERT INTO contents(id,slug,kind,data) VALUES(?,?,?,?)")
    .bind(
      "article-one",
      "sample",
      "articles",
      JSON.stringify({ titleZh: "样例文章" }),
    )
    .run();
  await ingest(
    req({ id: "r".repeat(20), event: "article_read", target: "article-one" }),
    "website",
  );
  await ingest(
    req({ id: "h".repeat(20), event: "share", target: "article-one" }),
    "website",
  );
  const shared = await (await get(new Request(url))).json();
  assert.equal(shared.articles[0].title, "样例文章");
  assert.equal(shared.shares, 1);
  await ingest(
    req({ id: "i".repeat(20), shareRef: "a".repeat(24) }),
    "website",
  );
  assert.equal((await (await get(new Request(url))).json()).shareReturns, 1);
  role = "staff";
  permissions = [];
  assert.equal((await get(new Request(url))).status, 403);
  permissions = ["analytics.view"];
  assert.equal((await get(new Request(url))).status, 200);
  role = "owner";
  assert.equal(
    (await (await get(new Request(url + "&dataMode=demo"))).json()).available,
    false,
  );
}
test("behavior real SQLite ingestion idempotency, privacy and summary permissions", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(sql);
  const db = {
    prepare: (query) => {
      let values = [];
      const self = {
        bind: (...a) => {
          values = a;
          return self;
        },
        run: async () => sqlite.prepare(query).run(...values),
        first: async () => sqlite.prepare(query).get(...values),
        all: async () => ({ results: sqlite.prepare(query).all(...values) }),
      };
      return self;
    },
  };
  try {
    await verify(db);
  } finally {
    sqlite.close();
  }
});
test(
  "behavior real PostgreSQL incremental migration and ingestion",
  { skip: !process.env.POSTGRES_ADAPTER_TEST_URL },
  async () => {
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: process.env.POSTGRES_ADAPTER_TEST_URL,
    });
    await client.connect();
    const namespace = "behavior_" + Date.now();
    try {
      await client.query(
        `CREATE SCHEMA ${namespace};SET search_path TO ${namespace},public`,
      );
      await client.query(sql);
      await client.query(sql);
      await verify(
        createPostgresDatabase({ query: (...a) => client.query(...a) }),
      );
    } finally {
      await client.query(
        `SET search_path TO public;DROP SCHEMA ${namespace} CASCADE`,
      );
      await client.end();
    }
  },
);
