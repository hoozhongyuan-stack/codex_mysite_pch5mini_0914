import assert from 'node:assert/strict';
import {homeShare, publicDetailShare, publicMediaShare} from '../src/lib/share.mjs';

assert.deepEqual(homeShare(), {title:'发现好内容',path:'/pages/index/index'});
const sharedArticle=publicDetailShare({kind:'articles',id:'a-1',title:'文章'});
assert.equal(sharedArticle.title,'文章');
assert.match(sharedArticle.path,/^\/pages\/detail\/index\?kind=articles&id=a-1&share=[a-z0-9]{24}$/);
const sharedMedia=publicMediaShare('videos',{id:'v-1',titleZh:'视频'},'视频');
assert.equal(sharedMedia.title,'视频');
assert.match(sharedMedia.path,/^\/pages\/videos\/index\?id=v-1&share=[a-z0-9]{24}$/);
assert.deepEqual(publicDetailShare({kind:'products',id:'not/a-path'},'商品'), {title:'商品',path:'/pages/index/index'});
