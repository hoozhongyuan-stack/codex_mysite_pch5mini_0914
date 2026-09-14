import test from 'node:test';
import assert from 'node:assert/strict';
import { interactionInput, publicationLabel } from '../../lib/mini-content.mjs';
test('interaction only accepts supported published content identifiers and boolean state',()=>{
 assert.deepEqual(interactionInput({kind:'article',id:'abc-1',action:'like',active:true}),{kind:'article',id:'abc-1',action:'like',active:true});
 for(const value of [{kind:'video',id:'x',action:'like',active:true},{kind:'article',id:'../x',action:'like',active:true},{kind:'article',id:'x',action:'like',active:'yes'}]) assert.throws(()=>interactionInput(value));
});
test('publication label has explicit Shanghai date and does not invent absent times',()=>{
 assert.equal(publicationLabel(null),'');assert.equal(publicationLabel('invalid'),'');
 assert.equal(publicationLabel('2026-09-10T23:00:00Z'),'2026-09-11 07:00');
});
import { miniRichNodes } from '../../lib/mini-content.mjs';
test('mini article keeps text image text order and never accepts arbitrary media origins',()=>{
 const nodes=miniRichNodes({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'第一段'}]},{type:'image',attrs:{src:'/api/media/a1234567-1234-1234-1234-123456789012',alt:'图片'}},{type:'paragraph',content:[{type:'text',text:'第二段'}]},{type:'image',attrs:{src:'https://evil.test/pixel'}}]});
 assert.deepEqual(nodes.map(n=>n.type),['paragraph','image','paragraph']);
 assert.equal(nodes[0].children[0].text,'第一段');assert.equal(nodes[2].children[0].text,'第二段');
 assert.equal(nodes[1].mediaId,'a1234567-1234-1234-1234-123456789012');
});
