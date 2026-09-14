import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationTime } from '../lib/publication.mjs';
test('publication date is set on publishing and retained by drafts and edits', () => {
  assert.equal(publicationTime(null, 'draft', 'today'), null);
  assert.equal(publicationTime(null, 'published', 'today'), 'today');
  assert.equal(publicationTime({ publishedAt: 'first' }, 'published', 'today'), 'first');
  assert.equal(publicationTime({ publishedAt: 'first' }, 'draft', 'today'), 'first');
});

test('legacy published content remains undated until explicitly backfilled', () => {
  assert.equal(publicationTime({}, 'published', '2026-09-10T00:00:00Z', undefined, 'published'), null);
  assert.equal(publicationTime({}, 'published', '2026-09-10T00:00:00Z', '2026-09-01T00:00:00Z', 'published'), '2026-09-01T00:00:00.000Z');
  assert.throws(()=>publicationTime({}, 'published', '2026-09-10T00:00:00Z', 'not-a-date'), /发布时间/);
  assert.throws(()=>publicationTime({}, 'published', '2026-09-10T00:00:00Z', '2027-01-01T00:00:00Z'), /发布时间/);
});
