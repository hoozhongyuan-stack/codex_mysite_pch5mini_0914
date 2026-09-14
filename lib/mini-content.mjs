export function interactionInput(input) {
  if (!input || !['article', 'product'].includes(input.kind) ||
      typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id) ||
      !['like', 'favorite', 'share'].includes(input.action) || typeof input.active !== 'boolean') {
    throw Error('互动参数无效');
  }
  return {kind: input.kind, id: input.id, action: input.action, active: input.active};
}
export function publicationLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0,16).replace('T',' ');
}
// Typed native components render these nodes; HTML and arbitrary media URLs are never injected.
export function miniRichNodes(doc) {
  const types = ['doc','paragraph','heading','text','hardBreak','horizontalRule','blockquote','bulletList','orderedList','listItem','codeBlock','image','video','table','tableRow','tableCell','tableHeader'];
  let count=0;
  function visit(node,depth=0) {
    if(!node || !types.includes(node.type) || depth>20 || ++count>6000)return null;
    if(node.type==='text')return {type:'text',text:typeof node.text==='string'?node.text:'',marks:(node.marks||[]).filter(m=>['bold','italic','strike','underline','code','link'].includes(m.type)).map(m=>m.type)};
    if(['image','video'].includes(node.type)) {
      const match=/^\/api\/media\/([a-f0-9-]{36})$/.exec(node.attrs?.src||'');
      return match?{type:node.type,mediaId:match[1],alt:String(node.attrs?.alt||'')}:null;
    }
    return {type:node.type,level:[2,3,4].includes(node.attrs?.level)?node.attrs.level:2,children:(Array.isArray(node.content)?node.content:[]).map(n=>visit(n,depth+1)).filter(Boolean)};
  }
  const root=visit(doc);
  return root?.type==='doc'?root.children:[];
}
