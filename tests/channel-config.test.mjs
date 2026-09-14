import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMini, validateFloating } from '../lib/channel-config.mjs';
const nav = [
  { label: '首页', target: 'home', enabled: true },
  { label: '商城', target: 'products', enabled: true },
];
test('navigation accepts disabled or 2-5 unique built-in targets', () => {
  assert.equal(
    validateMini({ navigation: { enabled: true, items: nav } }).navigation.items
      .length,
    2,
  );
  assert.throws(() =>
    validateMini({ navigation: { enabled: true, items: nav.slice(0, 1) } }),
  );
  assert.throws(() =>
    validateMini({ navigation: { enabled: true, items: [...nav, nav[0]] } }),
  );
  assert.throws(() =>
    validateMini({
      navigation: {
        enabled: true,
        items: [nav[0], { ...nav[1], target: 'https://evil.test' }],
      },
    }),
  );
  assert.equal(validateMini({}).navigation.enabled, false);
});
test('mini only accepts https API origin and public identifiers', () => {
  assert.throws(() => validateMini({ apiOrigin: 'http://example.com' }));
  assert.throws(() =>
    validateMini({ apiOrigin: 'https://user:pass@example.com' }),
  );
  assert.equal(
    validateMini({ appId: 'wx1234567890abcdef', secret: 'no' }).secret,
    undefined,
  );
});
const entry = (id, ends = ['pc']) => ({
  id,
  labelZh: '电话',
  kind: 'phone',
  phone: '13800138000',
  enabled: true,
  ends,
  pages: [],
});
test('floating max three per end, not three globally', () => {
  assert.equal(
    validateFloating([entry('a'), entry('b'), entry('c'), entry('d', ['h5'])])
      .length,
    4,
  );
  assert.throws(() =>
    validateFloating([entry('a'), entry('b'), entry('c'), entry('d')]),
  );
});
test('floating rejects unsafe phones, paths, duplicates, missing targets', () => {
  assert.throws(() =>
    validateFloating([{ ...entry('a'), phone: 'javascript:alert(1)' }]),
  );
  assert.throws(() =>
    validateFloating([{ ...entry('a'), pages: ['//evil.test'] }]),
  );
  assert.throws(() => validateFloating([entry('a'), entry('a')]));
  assert.throws(() => validateFloating([{ ...entry('a'), kind: 'image' }]));
});
import { channelTransition } from '../lib/channel-config.mjs';
test('publishing floating config does not publish another section draft', () => {
  const old = {
    draft: { mini: { title: 'unfinished' }, floating: [] },
    published: { mini: { title: 'live' }, floating: [] },
  };
  const next = channelTransition(old, 'floating', [entry('a')], 'publish');
  assert.equal(next.published.mini.title, 'live');
  assert.equal(next.draft.mini.title, 'unfinished');
  assert.equal(next.published.floating.length, 1);
});
import { DatabaseSync } from 'node:sqlite';
test('configuration writes reject stale revision and draft assets remain guarded', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      'CREATE TABLE settings(id TEXT PRIMARY KEY,data TEXT);CREATE TABLE assets(id TEXT PRIMARY KEY)',
    );
    const sql =
      "INSERT INTO settings(id,data) VALUES('channels',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(settings.data,'$.revision')=?";
    assert.equal(
      db
        .prepare(sql)
        .run(JSON.stringify({ revision: 'a', draft: { imageId: 'asset' } }), '')
        .changes,
      1,
    );
    assert.equal(
      db.prepare(sql).run(JSON.stringify({ revision: 'b' }), '').changes,
      0,
    );
    db.exec("INSERT INTO assets VALUES('asset')");
    assert.equal(
      db
        .prepare(
          "DELETE FROM assets WHERE id=? AND NOT EXISTS(SELECT 1 FROM settings WHERE id='channels' AND EXISTS(SELECT 1 FROM json_tree(settings.data) WHERE value=?))",
        )
        .run('asset', 'asset').changes,
      0,
    );
  } finally {
    db.close();
  }
});

test('publishing accepts implemented video and salon destinations', async () => {
  const { checkMiniCapabilities } = await import('../lib/channel-config.mjs');
  const value = validateMini({
    navigation: {
      enabled: true,
      items: [nav[0], { label: '视频', target: 'videos', enabled: true }],
    },
  });
  assert.doesNotThrow(() => checkMiniCapabilities(value));
  assert.doesNotThrow(() =>
    checkMiniCapabilities(
      validateMini({ navigation: { enabled: true, items: nav } }),
    ),
  );
});

test('published home and navigation assets remain public while draft changes stay private', async () => {
  const {channelTransition,channelAssetIds}=await import('../lib/channel-config.mjs');
  const original=validateMini({navigation:{enabled:true,items:[{...nav[0],iconId:'home-icon',selectedIconId:'home-selected'},nav[1]]},banners:[{imageId:'banner',target:'home'}],hotspotImages:[{imageId:'hotspot',zones:[{label:'表单',target:'form',contentId:'form-id',x:0,y:0,width:50,height:50}]}]});
  const published=channelTransition({},'mini',original,'publish');
  const draft=channelTransition(published,'mini',{...original,banners:[{imageId:'draft-only',target:'home'}]},'save');
  assert.deepEqual(channelAssetIds(draft.published.mini,[]).sort(),['banner','home-icon','home-selected','hotspot']);
  assert.equal(draft.published.mini.hotspotImages[0].zones[0].contentId,'form-id');
  assert.ok(!channelAssetIds(draft.published.mini,[]).includes('draft-only'));
});

test('all entry types support cart and media links with draft-only incomplete details', () => {
 const base={navigation:{enabled:true,items:[nav[0],{label:'购物车',target:'cart',enabled:true}]},banners:[{imageId:'img',target:'video',contentId:'series-1'}],hotspotImages:[{imageId:'img',zones:[{label:'沙龙',target:'event',contentId:'event-1',x:0,y:0,width:10,height:10}]}]};
 const result=validateMini(base);assert.equal(result.banners[0].contentId,'series-1');assert.equal(result.hotspotImages[0].zones[0].target,'event');
 assert.throws(()=>validateMini({...base,banners:[{imageId:'img',target:'video'}]}),/关联内容/);
 assert.doesNotThrow(()=>validateMini({...base,banners:[{imageId:'img',target:'video'}]},{draft:true}));
});
