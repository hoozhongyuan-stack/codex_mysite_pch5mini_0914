import {richText} from './cms-domain.mjs';
const text=(r,lang,key)=>r?.[key+(lang==='en'?'En':'Zh')] || '';
export function pageMetadata(origin,lang,path,title,description) {
 const base=origin.replace(/\/$/,''), suffix=path?'/'+path:'';
 const url=`${base}/${lang}${suffix}`;
 return {title,description,alternates:{canonical:url,languages:{'zh-CN':`${base}/zh${suffix}`,en:`${base}/en${suffix}`}},openGraph:{title,description,url,type:'website'},twitter:{card:'summary',title,description}};
}
export function categoryDescription(record,lang) {
 const name=text(record,lang,'name'), product=record.kind==='products';
 return text(record,lang,'summary') || (lang==='en'?`Explore ${name}: ${product?'product details and available options':'articles, ideas and insights'}.`:`浏览${name}分类，了解${product?'商品详情与可选规格':'文章、观点与相关内容'}。`);
}
export function contentSchema(record,lang,url,settings) {
 const article=record.kind==='articles', origin=new URL(url).origin;
 const common={'@context':'https://schema.org','@type':article?'Article':'Product',url,inLanguage:lang,description:text(record,lang,'summary'),...(record.imageId&&!record.imageMime?.startsWith('video')?{image:`${origin}/api/media/${record.imageId}`}:{})};
 if(article) return {...common,headline:text(record,lang,'title'),datePublished:record.publishedAt||record.createdAt,dateModified:record.updatedAt,articleBody:richText(record[lang==='en'?'richEn':'richZh'])||text(record,lang,'body'),author:record.author?{'@type':'Person',name:record.author}:{'@type':'Organization',name:text(settings,lang,'name')}};
 const trade=record.trade||{};
 const offers=(trade.variants||[]).filter(v=>v.enabled&&Number.isInteger(v.priceMinor)&&v.priceMinor>=0&&/^[A-Z]{3}$/.test(trade.currency||'')).map(v=>{
   const inventory=trade.inventoryMode==='variants'?v.inventory:trade.inventory;
   const availability=Number.isInteger(inventory)?(inventory>0?'InStock':'OutOfStock'):trade.inventoryMode==='variants'?null:trade.stockStatus==='in'?'InStock':trade.stockStatus==='out'?'OutOfStock':null;
   return {'@type':'Offer',url,price:v.priceMinor/100,priceCurrency:trade.currency,...(availability?{availability:`https://schema.org/${availability}`}:{})};
 });
 return {...common,name:text(record,lang,'title'),...(record.spu?{sku:record.spu}:{}),...(record.author?{brand:{'@type':'Brand',name:record.author}}:{}),...(offers.length?{offers}:{})};
}
export function collectionSchema(url,name,lang,items=[]) {
 return {'@context':'https://schema.org','@type':'CollectionPage',url,name,inLanguage:lang,mainEntity:{'@type':'ItemList',numberOfItems:items.length,itemListElement:items.map((item,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Thing',...item}}))}};
}
