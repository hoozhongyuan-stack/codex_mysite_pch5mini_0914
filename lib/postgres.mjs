// Deliberately scoped to application D1 queries, not SQLite schema/trigger DDL.
const numericPaths = new Set(['$.pointsPrice','$.refundedAmount','$.trade.redemptionSort']);
const booleanPaths = new Set(['$.channels.mini','$.channels.website','$.enabled','$.isDefault','$.pointsPending','$.trade.redemptionEnabled','$.trade.redemptionListed']);
const jsonPaths = new Set(['$.footer','$.grants','$.trade.variants','$.fields','$.values','$.imageIds','$.footer.socials']);
function tokenize(sql) {
 const tokens=sql.match(/--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|<=|>=|<>|!=|\|\||::|./g)||[];
 return tokens.filter(t=>!/^\s+$/.test(t)&&!t.startsWith('--')&&!t.startsWith('/*'));
}
const literal=s=>`'${s.replaceAll("'","''")}'`;
function pathValue(raw) {
 if(!/^['"]\$(\.[A-Za-z_][\w]*)*['"]$/.test(raw))throw Error('Unsupported JSON path');
 return raw.slice(1,-1);
}
function jsonNode(doc,path) {
 const parts=path.slice(1).match(/[A-Za-z_][\w]*|\d+/g)||[];
 return `((${doc})::jsonb #> ARRAY[${parts.map(literal).join(',')}]::text[])`;
}
function extract(doc,raw) {
 const path=pathValue(raw),node=jsonNode(doc,path),text=`(${node} #>> '{}')`;
 if(booleanPaths.has(path))return `(CASE WHEN ${node} IS NULL OR ${node}='null'::jsonb THEN NULL WHEN ${node} IN ('true'::jsonb,'1'::jsonb) THEN 1 ELSE 0 END)`;
 if(numericPaths.has(path))return `(${text})::numeric`;
 if(jsonPaths.has(path))return `(${node})::text`;
 return text;
}
function jsonArg(value) {
 // JSON-producing expressions preserve structure; ordinary SQL text becomes a JSON string.
 if(/^(?:cms_json_|jsonb_|\(jsonb_|\(\(.+::jsonb)/s.test(value)||value.endsWith('::jsonb'))return `(${value})::jsonb`;
 return `to_jsonb(${(/^(?:\$\d+|'(?:''|[^'])*')$/.test(value))?`${value}::text`:value})`;
}
function rewrite(name,args) {
 switch(name.toLowerCase()) {
 case 'json_extract':return extract(args[0],args[1]);
 case 'json_type':{const node=jsonNode(args[0],pathValue(args[1]));return `(CASE WHEN jsonb_typeof(${node})='number' THEN CASE WHEN (${node} #>> '{}') ~ '^-?[0-9]+$' THEN 'integer' ELSE 'real' END WHEN jsonb_typeof(${node})='string' THEN 'text' ELSE jsonb_typeof(${node}) END)`;}
 case 'json':return `(${args[0]})::jsonb`;
 case 'json_set':{
  let out=args[0];for(let i=1;i<args.length;i+=2)out=`cms_json_set((${out})::text,${literal(pathValue(args[i]))},${jsonArg(args[i+1])})`;return out;
 }
 case 'json_patch':return `cms_json_patch((${args[0]})::jsonb,(${args[1]})::jsonb)::text`;
 case 'json_object':return `(jsonb_build_object(${args.join(',')}))::text`;
 case 'json_group_array':return `(COALESCE(jsonb_agg((${args[0]})::jsonb),'[]'::jsonb))::text`;
 case 'json_each':return `cms_json_each((${args[0]})::jsonb,${args[1]?literal(pathValue(args[1])):"'$'"})`;
 case 'json_tree':return `cms_json_tree((${args[0]})::jsonb)`;
 case 'randomblob':if(args[0]!=='16')throw Error('Unsupported randomblob size');return `decode(replace(gen_random_uuid()::text,'-',''),'hex')`;
 case 'hex':return `encode(${args[0]},'hex')`;
 case 'instr':return `strpos(${args.join(',')})`;
 default:return `${name}(${args.join(',')})`;
 }
}
export function translateSql(sql) {
 const tokens=tokenize(sql);let index=0,param=0;
 function sequence(stop=false) {
  const result=[];
  while(index<tokens.length){
   let token=tokens[index++];
   if(token.toUpperCase()==='AS' && /^[a-zA-Z_]\w*$/.test(tokens[index]||'')) {
    const alias=tokens[index++];result.push(`AS ${['INTEGER','TEXT','NUMERIC','REAL'].includes(alias.toUpperCase())?alias:'"'+alias+'"'}`);continue;
   }
   if(token.toUpperCase()==='IS' && (tokens[index]==='?' || (tokens[index]?.toUpperCase()==='NOT' && tokens[index+1]==='?'))) {
    const negated=tokens[index]?.toUpperCase()==='NOT';if(negated)index++;index++;result.push(`${negated?'IS DISTINCT FROM':'IS NOT DISTINCT FROM'} $${++param}`);continue;
   }
   if(stop&&(token===','||token===')')){index--;break;}
   if(token==='?'){result.push(`$${++param}`);continue;}
   if(/^[A-Za-z_]\w*$/.test(token)&&tokens[index]==='('){
    index++;const args=[];
    while(tokens[index]!==')'&&index<tokens.length){args.push(sequence(true));if(tokens[index]===',')index++;else break;}
    if(tokens[index++]!==')')throw Error('Unbalanced SQL expression');result.push(rewrite(token,args));continue;
   }
   if(token==='('){result.push('('+sequence(false));continue;}
   if(token===')'){result.push(')');if(!stop)break;}
   else result.push(token);
  }
  return result.join(' ');
 }
 let out=sequence();
 if(/^INSERT OR IGNORE\b/i.test(out))out=out.replace(/^INSERT OR IGNORE/i,'INSERT').replace(/;\s*$/,'')+' ON CONFLICT DO NOTHING';
 if(/^INSERT INTO order_addresses\b/i.test(out))out=out.replace(/WHERE user_id = excluded \. user_id$/, 'WHERE order_addresses.user_id = excluded.user_id');
 return out;
}
function normalize(result,aliases) {
 const numeric=(result.fields||[]).filter(f=>[20,1700].includes(f.dataTypeID)).map(f=>f.name);
 return (result.rows||[]).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[aliases.get(key)||key,numeric.includes(key)&&value!==null&&Number.isSafeInteger(Number(value))?Number(value):value])));
}
export function createPostgresDatabase(pool) {
 const owner={};
 function statement(sql,values=[]) {
  const query=translateSql(sql);
  const aliases=new Map(tokenize(sql).filter(t=>/^[a-z]\w*[A-Z]\w*$/.test(t)).map(t=>[t.toLowerCase(),t]));
  async function execute(client) {
   const count=Math.max(0,...tokenize(query).map((t,i,a)=>t==='$'&&/^\d+$/.test(a[i+1]||'')?Number(a[i+1]):0));
   if(count!==values.length)throw Error('SQL parameter count mismatch');
   const response=await client.query(query,values);
   return {success:true,results:normalize(response,aliases),meta:{changes:response.rowCount||0}};
  }
  return {owner,execute,bind:(...args)=>statement(sql,args),all:()=>execute(pool),run:()=>execute(pool),first:async(column)=>{const r=(await execute(pool)).results[0];return r?(column?r[column]:r):null;},raw:async()=> (await execute(pool)).results.map(Object.values)};
 }
 return {prepare:sql=>statement(sql),batch:async(statements)=>{
  if(statements.some(s=>s.owner!==owner))throw Error('Statement belongs to another database');
  const client=await pool.connect();
  try{await client.query('BEGIN');const results=[];for(const stmt of statements)results.push(await stmt.execute(client));await client.query('COMMIT');return results;}
  catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
 }};
}
