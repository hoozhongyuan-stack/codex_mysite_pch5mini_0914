import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { createPostgresDatabase } from '../lib/postgres.mjs';
import { postgresCompatibilitySql } from '../lib/postgres-compat.mjs';
import * as domain from '../lib/dashboard-domain.mjs';
const url = process.env.POSTGRES_ADAPTER_TEST_URL;
test(
  'real dashboard endpoint aggregates on PostgreSQL and gates modules',
  { skip: !url },
  async () => {
    const { Client } = await import('pg'),
      client = new Client({ connectionString: url });
    await client.connect();
    const schema = 'dashboard_' + Date.now();
    try {
      await client.query(
        `CREATE SCHEMA ${schema}; SET search_path TO ${schema},public`,
      );
      await client.query(postgresCompatibilitySql);
      await client.query(
        await fs.readFile('postgres/001-cms-schema.sql', 'utf8'),
      );
      const db = createPostgresDatabase({
        query: (...a) => client.query(...a),
      });
      const output = ts.transpileModule(
        await fs.readFile('app/api/dashboard/route.ts', 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText;
      let role = 'owner';
      class HttpError extends Error {
        constructor(status, message) {
          super(message);
          this.status = status;
        }
      }
      const deps = {
        '@/lib/server': {
          admin: async () => ({
            role,
            userId: 'test',
            email: 'test@example.test',
            permissions: [],
          }),
          database: () => db,
          fail: (e) =>
            Response.json({ error: e.message }, { status: e.status || 500 }),
          HttpError,
          limited: async () => {},
        },
        '@/lib/identity': {
          identity: async () => ({
            metrics: { newMembers: { available: false, reason: 'test' } },
          }),
        },
        '@/lib/orders': { commerceConfig: async () => ({ grants: {} }) },
        '@/lib/dashboard-domain.mjs': domain,
      };
      const e = {};
      new Function('require', 'exports', output)((n) => deps[n], e);
      const req = new Request(
        'http://localhost/api/dashboard?start=2026-09-01&end=2026-09-08',
      );
      const r = await e.GET(req);
      assert.equal(r.status, 200);
      const d = await r.json();
      for (const key of ['trade', 'leads', 'geo', 'stock'])
        assert.equal(d[key].available, true, key + ' ' + d[key].reason);
      assert.equal(d.trade.current, 0);
      await db
        .prepare(
          "INSERT INTO contents(id,kind,slug,status,data,updated_at,created_at) VALUES('product','products','product','published',?,'2026-09-01','2026-09-01')",
        )
        .bind(
          JSON.stringify({
            titleZh: '聚合测试',
            trade: { inventory: 3 },
            channels: { mini: true },
          }),
        )
        .run();
      await db
        .prepare(
          "INSERT INTO orders(id,user_id,request_key,status,currency,subtotal,shipping,total,data,expires_at,created_at,updated_at) VALUES('o','u','r','completed','CNY',100,0,100,?,'2026-09-01','2026-09-01','2026-09-01')",
        )
        .bind(JSON.stringify({ sourceEnd: 'mini' }))
        .run();
      for (const [id, time] of [
        ['h1', '2026-09-01T01:00:00.000Z'],
        ['h2', '2026-09-02T01:00:00.000Z'],
      ])
        await db
          .prepare(
            "INSERT INTO order_history VALUES(?,'o','a','approve','{}',?)",
          )
          .bind(id, time)
          .run();
      const populated = await (await e.GET(req)).json();
      assert.equal(populated.trade.current, 1);
      assert.equal(populated.trade.money[0].received, 100);
      assert.equal(populated.stock.count, 1);
      const website = await (
        await e.GET(new Request(req.url + '&channel=website'))
      ).json();
      assert.equal(website.trade.current, 0);
      // Exercise the real low-stock drilldown against the PostgreSQL adapter too.
      const listSource = ts.transpileModule(
        await fs.readFile('app/api/admin/list/route.ts', 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText;
      const lists = await import('../lib/list-domain.mjs');
      const listExports = {};
      new Function('require', 'exports', listSource)(
        (n) => (n === '@/lib/list-domain.mjs' ? lists : deps[n]),
        listExports,
      );
      const low = await listExports.GET(
        new Request('http://localhost/api/admin/list?kind=products&lowStock=1'),
      );
      assert.equal(low.status, 200);
      assert.equal((await low.json()).total, 1);
      role = 'editor';
      const restricted = await (await e.GET(req)).json();
      for (const key of ['trade', 'leads', 'geo'])
        assert.deepEqual(Object.keys(restricted[key]).sort(), [
          'available',
          'reason',
        ]);
      assert.equal(
        (
          await e.GET(
            new Request(
              'http://localhost/api/dashboard?start=oops&end=2026-09-08',
            ),
          )
        ).status,
        400,
      );
    } finally {
      await client.query(
        `SET search_path TO public; DROP SCHEMA ${schema} CASCADE`,
      );
      await client.end();
    }
  },
);
