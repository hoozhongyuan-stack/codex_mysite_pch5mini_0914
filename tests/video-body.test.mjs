import test from 'node:test';
import assert from 'node:assert/strict';
import {videoBody, displayVideoBody} from '../lib/video-body.mjs';
test('video body supports historical plain text and rich documents without counting image URLs',()=>{
 assert.equal(videoBody('hello').content[0].content[0].text,'hello');
 const doc={type:'doc',content:[{type:'image',attrs:{src:'/api/media/12345678-1234-1234-1234-123456789012'}}]};
 assert.equal(videoBody(doc).content[0].type,'image');
 assert.throws(()=>videoBody('x'.repeat(10001)));
});
test('unsafe video rich content is rejected before display',()=>{
 const doc={type:'doc',content:[{type:'image',attrs:{src:'javascript:alert(1)'}}]};
 assert.throws(()=>videoBody(doc));
 assert.deepEqual(displayVideoBody(doc).content,[]);
});
