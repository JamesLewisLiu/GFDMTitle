import {languages,translator} from './i18n.mjs';
import {PAGE_SIZE,VERSIONS,DEFAULT_STATE,parseState,stateSearch,prepareRows,filterRows,paginate,pageNumbers,csvCell} from './core.mjs';

const $ = id => document.getElementById(id);
const base = new URL('../',import.meta.url);
const initialParams = new URLSearchParams(location.search);
let state = parseState(location.search);
if (!initialParams.has('lang')) { try { const saved=localStorage.getItem('gfdm-title-language');if(languages.includes(saved)) state.lang=saved; } catch {} }
let t=translator(state.lang),rows=[],filtered=[],paging=null,loaded=false,activeTitle='',toastTimer,searchTimer;
const titleDialog=$('title-dialog'),aboutDialog=$('about-dialog');
const el=(tag,className='',text=null)=>{const node=document.createElement(tag);if(className) node.className=className;if(text!==null) node.textContent=String(text);return node;};
const label=row=>row.name || `#${row.id}`;
const path=relative=>new URL(relative,base).href;
const format=value=>Number(value).toLocaleString(state.lang === 'zh' ? 'zh-CN' : state.lang);
const kindLabel=kind=>t(kind==='regular'?'regular':'commemorative');
const modeLabel=mode=>mode==='unverified'?t('unverified'):mode.replace('/', ' / ');

function updateURL(){history.replaceState(null,'',`${location.pathname}?${stateSearch({...state,title:activeTitle})}${location.hash}`);}
function optionButton(text,value,current,onClick,className,count=null){
  const button=el('button',className);button.type='button';button.setAttribute('aria-pressed',String(value===current));
  button.append(el('span',className==='version-option'?'version-text':'',text));
  if(count!==null)button.append(el('span',className==='version-option'?'version-count':'option-count',format(count)));
  button.addEventListener('click',onClick);return button;
}
function setFilter(key,value){state[key]=value;state.page=1;render();}
function renderFilters(){
  $('version-options').replaceChildren(...['all',...VERSIONS].map(value=>optionButton(value==='all'?t('allVersions'):value,value,state.version,()=>setFilter('version',value),'version-option',value==='all'?rows.length:rows.filter(r=>r.version===value).length)));
  const categoryRows=state.version==='all'?rows:rows.filter(r=>r.version===state.version);
  $('kind-options').replaceChildren(...['all','regular','commemorative'].map(value=>optionButton(value==='all'?t('allCategories'):kindLabel(value),value,state.kind,()=>setFilter('kind',value),'kind-option',value==='all'?categoryRows.length:categoryRows.filter(r=>r.kind===value).length)));
  $('mode-options').replaceChildren(...['all','GF','DM'].map(value=>optionButton(value==='all'?t('all'):value,value,state.mode,()=>setFilter('mode',value),'pill-option')));
  $('review-filter').replaceChildren(...['all','confirmed','pending','historical'].map(value=>new Option(value==='all'?t('allReviews'):t(value),value,false,value===state.review)));
  $('sort').replaceChildren(...[['version','sortVersion'],['newest','sortNewest'],['name','sortName'],['id','sortId']].map(([value,key])=>new Option(t(key),value,false,value===state.sort)));
}
function localize(){
  t=translator(state.lang);document.documentElement.lang=state.lang==='zh'?'zh-CN':state.lang;
  document.title=`${t('title')} · V4–V8`;
  for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);
  for(const node of document.querySelectorAll('[data-language]'))node.setAttribute('aria-pressed',String(node.dataset.language===state.lang));
  $('search').placeholder=t('searchPlaceholder');$('search').maxLength=200;
  for(const [id,key] of [['clear-search','clearSearch'],['sort','sort'],['review-filter','review'],['detail-close','close'],['about-close','close'],['detail-prev','previousTitle'],['detail-next','nextTitle']])$(id).setAttribute('aria-label',t(key));
  $('pagination').setAttribute('aria-label',t('page',{number:''}).trim());
}
function changeLanguage(lang){
  if(!languages.includes(lang))return;
  state.lang=lang;try{localStorage.setItem('gfdm-title-language',lang);}catch{}
  render();if(activeTitle)renderDetail(rows.find(r=>r.key===activeTitle));
}
function makeNameImage(row,large=false){
  const frame=el('div','name-image');const image=el('img');
  image.src=path(row.images.name_image);image.alt=label(row);image.loading=large?'eager':'lazy';image.decoding='async';
  frame.append(image);return frame;
}
function card(row){
  const article=el('article','title-card');article.dataset.key=row.key;
  const main=el('div','card-main'),meta=el('div','card-meta');
  meta.append(el('span','version-badge',row.version),el('span','kind-badge',kindLabel(row.kind)),el('span','title-id',`#${String(row.id).padStart(3,'0')}`));main.append(meta);
  const heading=el('h3',row.images.name_image?'sr-only':'',label(row));main.append(heading);
  if(row.images.name_image)main.append(makeNameImage(row));
  main.append(el('p','card-condition',row.conditions[state.lang]));
  const footer=el('div','card-footer'),status=el('span','card-status');status.dataset.review=row.review;
  status.append(el('span','status-dot'),document.createTextNode(t(row.review)));
  const button=el('button','card-open',t('view'));button.type='button';button.dataset.openTitle=row.key;button.setAttribute('aria-label',`${t('view')} · ${label(row)}`);
  footer.append(el('span','card-mode',modeLabel(row.mode)),status,button);main.append(footer);article.append(main);return article;
}
function renderActiveFilters(){
  const nodes=[];
  for(const [key,value] of Object.entries({version:state.version,kind:state.kind,mode:state.mode,review:state.review,q:state.q})){
    if(value==='all'||!value)continue;
    const text=key==='kind'?kindLabel(value):key==='review'?t(value):value;
    const button=el('button','active-chip');button.type='button';button.append(el('span','',text),el('span','','×'));
    button.setAttribute('aria-label',`${t('reset')}: ${text}`);button.addEventListener('click',()=>{state[key]=key==='q'?'':'all';state.page=1;render();});nodes.push(button);
  }
  $('active-filters').replaceChildren(...nodes);
}
function goPage(page){state.page=page;render();$('catalog-title').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
function renderPagination(){
  const nav=$('pagination');nav.replaceChildren();if(!paging.total)return;
  const button=(text,page,description,current=false)=>{const b=el('button','page-button',text);b.type='button';b.disabled=page<1||page>paging.pages;b.setAttribute('aria-label',description);if(current)b.setAttribute('aria-current','page');b.addEventListener('click',()=>goPage(page));return b;};
  nav.append(button('←',paging.page-1,t('previous')));
  for(const n of pageNumbers(paging.page,paging.pages))nav.append(n==='…'?el('span','page-ellipsis','…'):button(n,n,t('page',{number:n}),n===paging.page));
  nav.append(button('→',paging.page+1,t('next')),el('span','page-range',t('pageRange',{start:format(paging.start),end:format(paging.end),total:format(paging.total)})));
}
function render(){
  localize();renderFilters();$('search').value=state.q;$('clear-search').hidden=!state.q;
  if(!loaded)return;
  filtered=filterRows(rows,state);paging=paginate(filtered,state.page);state.page=paging.page;
  $('result-count').textContent=t('resultCount',{count:format(filtered.length)});
  $('results').replaceChildren(...paging.rows.map(card));$('results').setAttribute('aria-busy','false');
  $('empty-state').hidden=filtered.length>0;$('results').hidden=!filtered.length;
  $('export-csv').disabled=!filtered.length;
  renderActiveFilters();renderPagination();renderAboutCounts();updateURL();
}
function section(title){const node=el('section','detail-section');node.append(el('h3','',title));return node;}
function renderDetail(row){
  if(!row)return;
  $('detail-index').textContent=`${row.version} / #${String(row.id).padStart(3,'0')}`;
  const content=$('detail-content'),heading=el('div','detail-heading'),name=el('h2',row.images.name_image?'sr-only':'',label(row));name.id='detail-name';
  const tags=el('div','detail-tags');tags.append(el('span','',kindLabel(row.kind)),el('span','',modeLabel(row.mode)),el('span','',t(row.review)));
  heading.append(name,tags);if(row.images.name_image)heading.append(makeNameImage(row,true));content.replaceChildren(heading);
  const requirement=section(t('requirement')),switcher=el('div','detail-languages');
  for(const [lang,text] of [['ja','日本語'],['en','EN'],['zh','中文']])switcher.append(optionButton(text,lang,state.lang,()=>changeLanguage(lang),'',null));
  requirement.append(switcher,el('p','detail-condition',row.conditions[state.lang]));content.append(requirement);
  if(row.songs.length){
    const songs=section(t('songs')),list=el('ul','song-list');
    for(const song of row.songs){const item=el('li');item.append(el('span','song-id',song.id),el('span','song-label',song.label));list.append(item);}
    songs.append(list);content.append(songs);
  }
  if(row.hint||row.images.hint_image){
    const hint=section(t('officialHint'));
    if(row.images.hint_image){const link=el('a','hint-image-link');link.href=path(row.images.hint_image);link.target='_blank';link.rel='noopener';const image=el('img','hint-image');image.src=link.href;image.alt=t('officialHint');image.decoding='async';link.append(image);hint.append(link);}
    else hint.append(el('p','hint-text',row.hint));
    content.append(hint);
  }
  const evidence=el('details','evidence-details');evidence.append(el('summary','',t('evidence')),el('p','',row.confidence[state.lang]),el('pre','',row.evidence));
  if(row.badgeIndex!==null&&row.badgeIndex!==undefined)evidence.append(el('p','',`${t('badgeIndex')}: ${row.badgeIndex}`));content.append(evidence);
  const index=filtered.findIndex(r=>r.key===row.key);$('detail-prev').disabled=index<=0;$('detail-next').disabled=index<0||index>=filtered.length-1;
}
function openTitle(key){
  const row=rows.find(r=>r.key===key);if(!row)return;
  activeTitle=key;renderDetail(row);if(!titleDialog.open)titleDialog.showModal();titleDialog.scrollTop=0;updateURL();
}
function moveTitle(delta){const index=filtered.findIndex(r=>r.key===activeTitle);const row=filtered[index+delta];if(row)openTitle(row.key);}
function renderAboutCounts(){
  $('about-counts').replaceChildren(...VERSIONS.map(version=>{const cell=el('div');const all=rows.filter(r=>r.version===version);cell.append(el('strong','',version),el('small','',`${all.filter(r=>r.kind==='regular').length} + ${all.filter(r=>r.kind==='commemorative').length}`));return cell;}));
}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function reset(){clearTimeout(searchTimer);state={...DEFAULT_STATE,lang:state.lang};$('search').value='';render();}
async function loadCatalog(){
  $('result-count').textContent=t('loading');$('export-csv').disabled=true;
  try{
    const response=await fetch(path('data/titles.json'));if(!response.ok)throw new Error('Data unavailable');
    const data=await response.json();if(!Array.isArray(data.rows)||data.rows.length!==992)throw new Error('Invalid catalogue');
    rows=prepareRows(data.rows);loaded=true;render();
    const deepLink=initialParams.get('title');if(deepLink)openTitle(deepLink);
  }catch{
    $('results').replaceChildren();$('results').setAttribute('aria-busy','false');$('result-count').textContent='';
    const error=el('div','empty-state');error.append(el('h3','',t('errorTitle')),el('p','',t('errorDescription')));
    const retry=el('button','primary-button',t('retry'));retry.addEventListener('click',()=>loadCatalog());error.append(retry);$('results').append(error);
  }
}
document.addEventListener('click',event=>{const language=event.target.closest('[data-language]');if(language)changeLanguage(language.dataset.language);const title=event.target.closest('[data-open-title]');if(title)openTitle(title.dataset.openTitle);});
$('search-form').addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);state.q=$('search').value.slice(0,200);state.page=1;render();});
$('search').addEventListener('input',event=>{clearTimeout(searchTimer);const value=event.target.value;searchTimer=setTimeout(()=>{state.q=value.slice(0,200);state.page=1;render();},130);});
$('clear-search').addEventListener('click',()=>{clearTimeout(searchTimer);state.q='';state.page=1;render();$('search').focus();});
$('review-filter').addEventListener('change',event=>setFilter('review',event.target.value));$('sort').addEventListener('change',event=>setFilter('sort',event.target.value));
for(const id of ['reset-filters','empty-reset'])$(id).addEventListener('click',reset);
$('about-open').addEventListener('click',()=>aboutDialog.showModal());
$('about-close').addEventListener('click',()=>aboutDialog.close());$('detail-close').addEventListener('click',()=>titleDialog.close());
titleDialog.addEventListener('close',()=>{activeTitle='';updateURL();});
for(const dialog of [titleDialog,aboutDialog])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
$('detail-prev').addEventListener('click',()=>moveTitle(-1));$('detail-next').addEventListener('click',()=>moveTitle(1));
$('copy-link').addEventListener('click',async()=>{updateURL();try{await navigator.clipboard.writeText(location.href);toast(t('copied'));}catch{toast(t('copyFallback'));}});
$('export-csv').addEventListener('click',()=>{
  const csv=[[t('csvVersion'),t('csvCategory'),'ID',t('csvName'),t('csvGame'),t('csvCondition'),t('csvReview'),t('csvSongs')],...filtered.map(row=>[row.version,kindLabel(row.kind),row.id,label(row),modeLabel(row.mode),row.conditions[state.lang],row.confidence[state.lang],row.songs.map(song=>`${song.id}: ${song.label}`).join(' / ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'})),link=el('a');link.href=url;link.download=`gfdm-titles-${state.lang}-${state.version}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!titleDialog.open&&!aboutDialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('search').focus();}});
window.addEventListener('popstate',()=>{const requested=parseState(location.search);state=requested;activeTitle='';if(titleDialog.open)titleDialog.close();render();if(requested.title)openTitle(requested.title);});
if(matchMedia('(max-width:760px)').matches)$('filter-panel').open=false;
localize();loadCatalog();
