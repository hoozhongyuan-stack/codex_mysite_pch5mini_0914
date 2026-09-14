import assert from 'node:assert/strict';
const base='http://localhost:3001',login=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}),cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),tag='media-qa-'+Date.now();let passed=0;const check=(v,l)=>{assert.ok(v,l);passed++;};
const get=(p,auth=true)=>fetch(base+p,{headers:auth?{cookie}:{}});const post=(action,data={},id)=>fetch(base+'/api/admin',{method:'POST',headers:{cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action,data,id})});async function json(r){const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
const assetIds=[];let product,folder;
try{check((await get('/api/assets',false)).status===401,'asset listing private');check((await get('/api/assets?page=-1')).status===400,'page guarded');
for(let i=0;i<2;i++){const form=new FormData();form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),tag+'-'+i+'.png');assetIds.push((await json(await fetch(base+'/api/upload',{method:'POST',headers:{cookie,Origin:base},body:form}))).id);}
folder=(await json(await post('saveFolder',{name:tag}))).id;
check((await post('moveAsset',{folderId:folder},assetIds[0])).ok,'move to folder');
let list=await json(await get('/api/assets?folder='+folder));check(list.total===1&&list.rows[0].id===assetIds[0],'folder filters');
check((await post('renameAsset',{name:tag+'-renamed'},assetIds[0])).ok,'rename');check((await json(await get('/api/assets?q='+tag+'-renamed'))).total===1,'name search');
const content={kind:'products',status:'published',slug:tag,titleZh:'测试商品',titleEn:'Product',summaryZh:'测试',summaryEn:'Test',bodyZh:'测试正文',bodyEn:'Test body',spu:tag,imageIds:[...assetIds].reverse()};
product=(await json(await post('saveContent',content))).id;
list=await json(await get('/api/admin/list?kind=products&q='+tag));check(list.rows[0].imageId===assetIds[1]&&list.rows[0].imageIds[1]===assetIds[0],'ordered gallery and cover persisted');check(list.rows[0].spu===tag,'SPU persisted and searchable');
check((await post('saveContent',{...content,slug:tag+'-duplicate',spu:tag.toUpperCase()})).status===400,'duplicate SPU blocked');
check((await post('deleteAsset',{},assetIds[0])).status===400,'gallery ref deletion blocked');check((await get('/api/media/'+assetIds[0],false)).status===200,'published secondary image public');
const html=await (await get('/zh/products/'+tag,false)).text();check(html.includes('gallery-thumbs')&&html.includes(tag),'public gallery and SPU rendered');
check((await post('deleteFolder',{},folder)).ok,'folder delete');folder=null;list=await json(await get('/api/assets?folder=none&q='+tag));check(list.total===2,'folder delete retains assets ungrouped');
await post('deleteContent',{},product);product=null;
for(const id of assetIds){check((await post('deleteAsset',{},id)).ok,'unreferenced delete');check((await get('/api/media/'+id)).status===404,'deleted file inaccessible');}
console.log(passed+' media integration checks passed');
}finally{if(product)await post('deleteContent',{},product);if(folder)await post('deleteFolder',{},folder);for(const id of assetIds)await post('deleteAsset',{},id);}
