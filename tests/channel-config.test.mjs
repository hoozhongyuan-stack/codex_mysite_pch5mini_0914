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

test('home components and micro pages validate and link through published entries', () => {
 const value=validateMini({
  navigation:{enabled:true,items:[nav[0],{label:'专题',target:'microPage',contentId:'page-1',enabled:true}]},
  homeComponents:[
    {id:'search-1',type:'search',placeholder:'搜索商品',scope:'products'},
    {id:'notice-1',type:'notice',text:'新品上线',target:'microPage',contentId:'page-1'},
    {id:'line-1',type:'divider',style:'dashed'},
    {id:'banner-1',type:'banners',items:[{imageId:'hero',title:'专题图',target:'microPage',contentId:'page-1'}]},
    {id:'hotspot-1',type:'hotspots',items:[{imageId:'map',zones:[{label:'商品',target:'product',contentId:'product-1',x:0,y:0,width:40,height:40}]}]},
    {id:'floor-1',type:'productFloor',title:'精选商品',productIds:['product-1','product-1','product-2']},
  ],
  microPages:[{id:'page-1',title:'品牌专题',status:'published',components:[
    {id:'p-search',type:'search'},
    {id:'p-banner',type:'banners',items:[{imageId:'page-hero',target:'home'}]},
    {id:'p-hotspot',type:'hotspots',items:[{imageId:'page-map',zones:[{label:'文章',target:'article',contentId:'article-1',x:10,y:10,width:20,height:20}]}]},
    {id:'p-floor',type:'productFloor',title:'页面商品',productIds:['product-3']},
  ]}],
 });
 assert.equal(value.homeComponents.length,6);
 assert.equal(value.microPages[0].components[1].type,'banners');
 assert.deepEqual(value.homeComponents[5].productIds,['product-1','product-2']);
 assert.equal(value.navigation.items[1].contentId,'page-1');
});

test('published micro page links must target published micro pages', () => {
 assert.throws(()=>validateMini({
  navigation:{enabled:true,items:[nav[0],{label:'专题',target:'microPage',contentId:'missing',enabled:true}]},
  microPages:[{id:'page-1',title:'品牌专题',status:'draft',components:[]}],
 }),/微页面|关联内容/);
 assert.doesNotThrow(()=>validateMini({
  navigation:{enabled:true,items:[nav[0],{label:'专题',target:'microPage',enabled:true}]},
  microPages:[{id:'page-1',title:'品牌专题',status:'draft',components:[]}],
 },{draft:true}));
});


test('notification center validates template config and triggers', () => {
 const value=validateMini({
  notificationCenter:{
    enabled:true,
    templates:{order:{enabled:true,templateId:'tmpl_order_1',note:'订单状态'},event:{enabled:true,templateId:'tmpl_event_1'},points:{enabled:false}},
    triggers:{orderPaid:true,eventRegistered:true,pointsChanged:true},
  },
 });
 assert.equal(value.notificationCenter.enabled,true);
 assert.equal(value.notificationCenter.templates.order.templateId,'tmpl_order_1');
 assert.equal(value.notificationCenter.triggers.orderPaid,true);
 assert.equal(value.notificationCenter.triggers.orderShipped,false);
});

test('notification requests map triggers to safe mini program pages and data', async () => {
 const {buildNotificationRequest}=await import('../lib/notification-template.mjs');
 const order=buildNotificationRequest('order','orderShipped',{userId:7,orderId:'ord-1',orderNumber:'NO-1',total:12800,currency:'CNY',status:'已发货'},'tmpl_order');
 assert.equal(order.page,'pages/account/index?section=orders&id=ord-1');
 assert.equal(order.data.amount3.value,'¥128.00');
 assert.equal(order.data.phrase4.value,'已发货');
 const event=buildNotificationRequest('event','eventRegistered',{eventId:'ev 1',title:'沙龙会',status:'已报名',location:'深圳'},'tmpl_event');
 assert.equal(event.page,'pages/salons/index?id=ev%201');
 assert.equal(event.data.thing1.value,'沙龙会');
 const points=buildNotificationRequest('points','pointsChanged',{amount:-10,balance:90,title:'积分兑换'},'tmpl_points');
 assert.equal(points.page,'pages/account/index?section=points');
 assert.equal(points.data.number2.value,'-10');
});
