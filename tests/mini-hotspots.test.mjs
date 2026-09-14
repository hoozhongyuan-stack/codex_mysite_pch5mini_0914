import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMini,channelAssetIds} from '../lib/channel-config.mjs';
const zone={label:'商品',x:10,y:20,width:30,height:40,target:'product',contentId:'abc'};
const config=(z=zone)=>({hotspotImages:[{imageId:'img',zones:[z]}]});
test('hotspots preserve percentage bounds and image references',()=>{
 const m=validateMini(config()); assert.deepEqual(m.hotspotImages[0].zones[0],zone);
 assert.ok(channelAssetIds(m,[]).includes('img')); assert.deepEqual(validateMini().hotspotImages,[]);
});
test('hotspots reject out of image, invalid links and excessive regions',()=>{
 for(const patch of [{x:90},{width:0},{height:NaN},{target:'https://evil.test'},{contentId:''}])assert.throws(()=>validateMini(config({...zone,...patch})));
 assert.throws(()=>validateMini({hotspotImages:[{imageId:'img',zones:Array(21).fill(zone)}]}));
});
test('unfinished banner or content link can be saved as draft but not published',()=>{
 const v={banners:[{imageId:'',title:'',target:'products'}],hotspotImages:[{imageId:'img',zones:[{...zone,contentId:''}]}]};
 assert.doesNotThrow(()=>validateMini(v,{draft:true}));
 assert.throws(()=>validateMini(v));
});
