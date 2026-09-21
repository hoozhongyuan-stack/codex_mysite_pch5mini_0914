import {ActionView,ActionText,ActionButton,ActionInput} from './interaction';
import LoadingState from './loading-state';
import { useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image, Input, ScrollView, Button } from '@tarojs/components';
import { image, request, token } from '../lib/api';
export function Cards({rows,points=false,disabled=false}: {rows:any[];points?:boolean;disabled?:boolean}){
 const article=rows[0]?.kind==='articles';
 return <View className={article?'article-list':'cards'}>{rows.map(r=><ActionView disabled={disabled} className={article?'article-card':'card'} key={r.id}  onClick={()=>!disabled&&Taro.navigateTo({url:'/pages/detail/index?id='+encodeURIComponent(r.id)+'&kind='+r.kind+'&mode='+(points?'points':'cash')})}>
 {r.imageId?<Image className='cover' src={image(r.imageId,'card')} mode='aspectFill' lazyLoad/>:<View className='cover no-image'>暂无图片</View>}
 <View className='card-copy'><Text className='card-title'>{r.title}</Text>{article?<><Text className='article-summary'>{r.summary}</Text><Text className='article-more'>阅读全文 ›</Text></>:<Text className='price'>{points?(r.points?`${r.points} 积分`:'暂不可兑换'):(r.price!==null?`${r.currency==='CNY'?'¥':r.currency+' '}${(r.price/100).toFixed(2)}`:'价格待定')}</Text>}</View>
 </ActionView>)}</View>
}
export default function Catalog({kind,refreshVersion=0}:{kind:string;refreshVersion?:number}){
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState(''),[parent,setParent]=useState(''),[page,setPage]=useState(1),[sort,setSort]=useState('latest'),[expanded,setExpanded]=useState(false),[result,setResult]=useState<any>({rows:[],categories:[],pages:1,total:0}),[error,setError]=useState(''),[busy,setBusy]=useState(true),[retry,setRetry]=useState(0),[balance,setBalance]=useState<number|null>(null);
 const sequence=useRef(0);
 useEffect(()=>{let active=true;const session=token();if(!session)setBalance(null);if(kind==='points'&&session)void request('/api/mini/member/points').then(r=>{if(active&&token()===session)setBalance(r.balance)}).catch(()=>{if(active)setBalance(null)});return()=>{active=false}},[kind,refreshVersion]);
 useEffect(()=>{const seq=++sequence.current;setBusy(true);setError('');request('/api/mini/catalog?kind='+kind+'&q='+encodeURIComponent(search)+'&category='+encodeURIComponent(category)+'&page='+page+'&sort='+sort).then(d=>{if(sequence.current===seq)setResult(d)}).catch(e=>{if(sequence.current===seq)setError(e.message)}).finally(()=>{if(sequence.current===seq)setBusy(false)});return()=>{sequence.current++}},[kind,search,category,page,sort,retry,refreshVersion]);
 const roots=result.categories.filter((c:any)=>!c.parentId),children=result.categories.filter((c:any)=>c.parentId===parent&&parent);
 const select=(id:string,root=false)=>{setCategory(id);if(root)setParent(id);setPage(1)};
 const searchNow=()=>{setSearch(query.trim());setPage(1)};
 return <View className='catalog-page'>
 {kind==='points'&&<View className='rewards-intro'><Text className='eyebrow'>积分好礼</Text><Text className='rewards-heading'>让每份热爱，都有回响。</Text>{balance!==null&&<View className='rewards-balance'><Text>可用积分 <Text className='rewards-number'>{balance}</Text></Text><ActionText onClick={()=>Taro.navigateTo({url:'/pages/account/index?section=points'})}>收支明细 ›</ActionText></View>}</View>}
 <View className='catalog-search'><ActionInput value={query} placeholder={kind==='articles'?'搜索感兴趣的文章':'搜索商品名称 / 编码'} onInput={e=>setQuery(e.detail.value)} onConfirm={searchNow} confirmType='search'/><ActionButton size='mini' onClick={searchNow}>搜索</ActionButton></View>
 {roots.length>0&&<><View className='category-toolbar'><ScrollView scrollX className='category-scroll'><View className='category-tabs'>{[{id:'',name:'全部'},...roots].map((c:any)=><ActionText key={c.id} className={parent===c.id?'selected':''} onClick={()=>select(c.id,true)}>{c.name}</ActionText>)}</View></ScrollView>{roots.length>4&&<ActionText className='category-expand' onClick={()=>setExpanded(!expanded)}>{expanded?'收起':'分类'}</ActionText>}</View>{expanded&&<View className='category-grid'>{result.categories.map((c:any)=><ActionText key={c.id} className={category===c.id?'selected':''} onClick={()=>{setParent(c.parentId||c.id);select(c.id);setExpanded(false)}}>{c.name}</ActionText>)}</View>}{children.length>0&&<View className='category-subtabs'>{[{id:parent,name:'全部'},...children].map((c:any)=><ActionText key={c.id} className={category===c.id?'selected':''} onClick={()=>select(c.id)}>{c.name}</ActionText>)}</View>}</>}
 <View className='catalog-meta'><Text>{kind==='articles'?'灵感手记':kind==='points'?'精选好礼':'精选商品'}{!busy&&result.total>0?` · ${result.total}`:''}</Text>{kind==='points'&&<ActionText className='sort-button' onClick={()=>{setSort(sort==='points_asc'?'points_desc':'points_asc');setPage(1)}}>积分 {sort==='points_asc'?'↑':sort==='points_desc'?'↓':'排序'}</ActionText>}</View>
 {busy&&<LoadingState refresh={result.rows.length>0}/>}
 {error&&<View className='catalog-empty'><Text>{error}</Text><ActionButton size='mini' onClick={()=>setRetry(r=>r+1)}>重新加载</ActionButton></View>}
 {result.rows.length>0?<View className={busy?'content-updating':''}><Cards rows={result.rows} points={kind==='points'} disabled={busy}/></View>:!busy&&!error&&<View className='catalog-empty'><Text className='empty-title'>{search||category?'没有找到相关内容':kind==='points'?'好礼即将上新':kind==='articles'?'新内容正在准备中':'新品即将上架'}</Text><Text>{search||category?'试试其他关键词或分类':'稍后再来，发现更多精彩'}</Text>{(search||category)&&<ActionButton size='mini' onClick={()=>{setSearch('');setQuery('');select('',true)}}>查看全部</ActionButton>}</View>}

 {!busy&&!error&&result.pages>1&&<View className='pagination'><ActionButton size='mini' disabled={page<=1} onClick={()=>setPage(p=>p-1)}>上一页</ActionButton><Text>{page} / {result.pages}</Text><ActionButton size='mini' disabled={page>=result.pages} onClick={()=>setPage(p=>p+1)}>下一页</ActionButton></View>}
 </View>
}
