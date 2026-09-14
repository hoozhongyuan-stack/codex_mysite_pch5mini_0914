import { database } from './server';
import { activityModule } from './staff-activity.mjs';
import { modules } from './list-domain.mjs';
export async function cmsActivity(q:any) {
  const db=database(), where:string[]=[], args:any[]=[];
  if(q.actor){where.push('(instr(lower(actor),lower(?))>0 OR instr(lower(target),lower(?))>0)');args.push(q.actor,q.actor);}
  if(q.action){where.push('action=?');args.push(q.action);}
  if(q.from){where.push('created_at>=?');args.push(q.from+'T00:00:00.000Z');}
  if(q.to){where.push('created_at<?');args.push(new Date(Date.parse(q.to)+86400000).toISOString());}
  if(q.module){
    const map:any={...modules,accounts:['saveAdmin'],permissions:[],orders:[],marketing:[]};
    const conditions:string[]=[],values:any[]=[];
    for(const a of map[q.module]||[]){conditions.push('action=?');values.push(a);}
    const prefixes:any={accounts:['staff-','account-'],permissions:['permission-','group-','member-','legacy-'],orders:['order-'],marketing:['marketing-','salon-'],users:['user-','visitor-']};
    for(const p of prefixes[q.module]||[]){conditions.push('action LIKE ?');values.push(p+'%');}
    if(q.module==='other'){
      const known=Object.values(map).flat() as string[];
      where.push('action NOT IN ('+known.map(()=>'?').join(',')+')');args.push(...known);
      for(const p of Object.values(prefixes).flat()){where.push('action NOT LIKE ?');args.push(p+'%');}
    }else{where.push('('+ (conditions.join(' OR ')||'1=0') +')');args.push(...values);}
  }
  const clause=where.length?' WHERE '+where.join(' AND '):'';
  const total=(await db.prepare('SELECT COUNT(*) AS total FROM audit_logs'+clause).bind(...args).first<any>()).total;
  const rows=(await db.prepare('SELECT * FROM audit_logs'+clause+' ORDER BY created_at DESC,id DESC LIMIT ?').bind(...args,q.page*q.size).all<any>()).results;
  return {total,rows:rows.map((r:any)=>{
    let target=r.target,before:any={},after:any={};
    if(r.action==='permission-legacy-orders') {try{const v=JSON.parse(r.target);target=String(v.target||'');before=Array.isArray(v.before)?v.before.filter((x:any)=>typeof x==='string'&&x.length<100):[];after=Array.isArray(v.after)?v.after.filter((x:any)=>typeof x==='string'&&x.length<100):[];}catch{target='历史订单授权';}}
    return {id:'cms:'+r.id,actor:r.actor,action:r.action,target:String(target).slice(0,500),created:r.created_at,module:activityModule(r.action),result:r.action==='permission-legacy-orders'?'success':'recorded',before,after};
  })};
}
