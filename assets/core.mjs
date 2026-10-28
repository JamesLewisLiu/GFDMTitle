export const PAGE_SIZE = 24;
export const VERSIONS = ['V4', 'V5', 'V6', 'V7', 'V8'];
export const DEFAULT_STATE = Object.freeze({lang:'zh',version:'all',kind:'all',mode:'all',review:'all',sort:'version',q:'',page:1,title:''});
const allowed = {lang:['ja','en','zh'],version:['all',...VERSIONS],kind:['all','regular','commemorative'],mode:['all','GF','DM'],review:['all','confirmed','pending','historical'],sort:['version','newest','name','id']};
export const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');
export function parseState(search = '') {
  const parameters = new URLSearchParams(search);
  const state = {...DEFAULT_STATE};
  for (const [key, values] of Object.entries(allowed)) if (values.includes(parameters.get(key))) state[key] = parameters.get(key);
  state.q = (parameters.get('q') ?? '').slice(0,200);
  state.page = Math.max(1, Math.min(100000, Number.parseInt(parameters.get('page'),10) || 1));
  state.title = (parameters.get('title') ?? '').slice(0,80);
  return state;
}
export function stateSearch(state) {
  const params = new URLSearchParams();
  params.set('lang',state.lang);
  for (const key of ['version','kind','mode','review','sort','q','page','title']) {
    if (String(state[key] ?? '') !== String(DEFAULT_STATE[key]) && state[key] !== '') params.set(key,String(state[key]));
  }
  return params.toString();
}
export function prepareRows(rows) {
  return rows.map(row => ({...row,_search:normalize([row.version,row.id,row.name,row.kind,row.mode,...Object.values(row.conditions),row.hint,...row.songs.flatMap(song=>[song.id,song.label])].join(' '))}));
}
export function filterRows(rows, state) {
  const terms = state.q.normalize('NFKC').trim().split(/\s+/u).filter(Boolean);
  const filtered = rows.filter(row => {
    if (state.version !== 'all' && row.version !== state.version) return false;
    if (state.kind !== 'all' && row.kind !== state.kind) return false;
    if (state.mode !== 'all' && row.mode !== state.mode && row.mode !== 'GF/DM') return false;
    if (state.review !== 'all' && row.review !== state.review) return false;
    return terms.every(term => {
      if (/^v[4-8]$/i.test(term)) return row.version.toLowerCase() === term.toLowerCase();
      if (/^#\d+$/.test(term)) return row.id === Number(term.slice(1));
      return row._search.includes(normalize(term));
    });
  });
  const collator = new Intl.Collator(state.lang === 'zh' ? 'zh-CN' : state.lang,{numeric:true,sensitivity:'base'});
  return filtered.sort((a,b) => {
    if (state.sort === 'name') return collator.compare(a.name || String(a.id),b.name || String(b.id)) || a.key.localeCompare(b.key);
    if (state.sort === 'id') return b.id-a.id || b.version.localeCompare(a.version);
    const version = a.version.localeCompare(b.version) * (state.sort === 'newest' ? -1 : 1);
    return version || (a.kind === b.kind ? a.id-b.id : a.kind === 'regular' ? -1 : 1);
  });
}
export function paginate(rows,page,size=PAGE_SIZE) {
  const pages = Math.max(1,Math.ceil(rows.length/size));
  const current = Math.min(Math.max(1,page),pages);
  return {rows:rows.slice((current-1)*size,current*size),page:current,pages,total:rows.length,start:rows.length ? (current-1)*size+1 : 0,end:Math.min(current*size,rows.length)};
}
export function pageNumbers(current,total) {
  const values = [...new Set([1,total,current-1,current,current+1])].filter(n=>n>=1&&n<=total).sort((a,b)=>a-b);
  const result=[];
  for (const n of values) { if (result.length && n-result.at(-1)>1) result.push('…'); result.push(n); }
  return result;
}
export function csvCell(value) {
  let text=String(value ?? '');
  if (/^[=+\-@]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
