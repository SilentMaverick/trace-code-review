/* Trace is a local-first review aid. Its static checks are heuristics, never proof of a defect. */
const sampleFiles = {
  'src/index.js': `import { createApp } from './app.js';
import { connectDatabase } from './services/database.js';
import { registerRoutes } from './routes/index.js';

async function bootstrap() {
  const db = await connectDatabase();
  const app = createApp({ db });
  registerRoutes(app);
  app.listen(process.env.PORT || 3000);
}

bootstrap();`,
  'src/app.js': `import { errorHandler } from './middleware/errors.js';

export function createApp({ db }) {
  const app = createFramework();
  app.context.db = db;
  app.use(errorHandler);
  return app;
}`, 
  'src/routes/index.js': `import { getUsers, createUser } from '../services/users.js';
import { validateUser } from '../middleware/validate.js';

export function registerRoutes(app) {
  app.get('/users', getUsers);
  app.post('/users', validateUser, createUser);
  app.get('/health', healthCheck);
}

function healthCheck(req, res) {
  res.json({ ok: true });
}`,
  'src/services/users.js': `import { findUsers, insertUser } from './database.js';

export async function getUsers(req, res) {
  const users = await findUsers({ limit: req.query.limit || 100 });
  res.json(users);
}

export async function createUser(req, res) {
  const user = await insertUser(req.body);
  res.status(201).json(user);
}

export function findByEmail(users, email) {
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (users[i].email === email) return users[i];
    }
  }
  return null;
}`,
  'src/services/database.js': `export async function connectDatabase() {
  return createConnection(process.env.DATABASE_URL);
}

export async function findUsers({ limit }) {
  return db.query('SELECT id, email FROM users LIMIT ' + limit);
}

export async function insertUser(user) {
  return db.insert('users', user);
}`,
  'src/middleware/validate.js': `export function validateUser(req, res, next) {
  if (!req.body.email) return res.status(400).json({ error: 'Email required' });
  next();
}`,
  'src/middleware/errors.js': `export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: err.message });
}`,
  'src/utils/cache.js': `const cache = new Map();

export function getCached(key) {
  return cache.get(key);
}

export function setCached(key, value) {
  cache.set(key, value);
}`
};
let files = { ...sampleFiles };
let functions = [];
let findings = [];
let connections = [];
let selected = null;
let activeFilter = 'all';
let scale = 1, panX = 0, panY = 0;
let mapMode = 'files';
let mapPositions = { files: {}, functions: {} };
let toastTimer;
const $ = (id) => document.getElementById(id);
const colors = { entry: 'violet', service: 'blue', data: 'green' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themeKey='trace-theme';
function setTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem(themeKey,theme);const dark=theme==='dark';$('themeToggle').textContent=dark?'☀':'☾';$('themeToggle').title=`Switch to ${dark?'light':'dark'} mode`;$('themeToggle').setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);}

function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function classifyPath(path) { return /(?:index|main|server|app)\.(?:js|jsx|ts|tsx|py|go|rs)$/.test(path) ? 'entry' : /(?:database|db|repository|model|store|schema)/i.test(path) ? 'data' : 'service'; }
function lineAt(source, offset) { return source.slice(0, offset).split('\n').length; }
function loopBody(source, match) {
  const start=match.index+match[0].length;
  const open=match[0].trimEnd().endsWith('{')?start-1:source.indexOf('{',start);
  const next=source.indexOf('\n',start);
  if(open<0 || (next>=0 && next<open)) return source.slice(start,Math.min(source.length,start+180)).split('\n')[0];
  let depth=1,quote='',escaped=false;
  for(let i=open+1;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(open+1,i);
  }
  return source.slice(open+1);
}
function sourceComments(source) {
  return [...source.matchAll(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*|^\s*#[^\n]*/gm)].map(m=>({text:m[0].trim().replace(/\s+/g,' ').slice(0,140),line:lineAt(source,m.index)})).filter(x=>x.text).slice(0,8);
}

function parseFunctions(path, source) {
  const out = [];
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(([^)]*)\)/g,
    /(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    /^\s*def\s+([\w]+)\s*\(([^)]*)\)\s*:/gm,
    /(?:public|private|protected|static|async|\s)+[\w<>\[\]?]+\s+([\w$]+)\s*\(([^)]*)\)\s*\{/g
  ];
  for (const re of patterns) { re.lastIndex=0; let m; while ((m=re.exec(source))) {
    if (out.some(f=>f.name===m[1] && Math.abs(f.offset-m.index)<20)) continue;
    out.push({ id:`${path}::${m[1]}`, name:m[1], path, line:lineAt(source,m.index), offset:m.index, params:m[2].trim(), kind:'function', signature:m[0].trim().replace(/\s+/g,' ') });
  }}
  return out;
}

function scan() {
  functions = Object.entries(files).flatMap(([p,s])=>parseFunctions(p,s));
  const fnByName = new Map(); for (const fn of functions) { if(!fnByName.has(fn.name)) fnByName.set(fn.name,[]); fnByName.get(fn.name).push(fn); }
  connections=[];
  for (const fn of functions) {
    const src=files[fn.path]||'';
    const nextFunction=functions.filter(candidate=>candidate.path===fn.path&&candidate.offset>fn.offset).sort((a,b)=>a.offset-b.offset)[0];
    const ownBody=src.slice(fn.offset+fn.signature.length,nextFunction?.offset??src.length);
    for (const [name, targets] of fnByName) {
      if(name===fn.name) continue;
      const callRe = new RegExp(`\\b${name.replace(/[$]/g,'\\$')}\\s*\\(`);
      if(callRe.test(ownBody)) {
        const target=targets.find(t=>t.path!==fn.path)||targets[0];
        if(target && !connections.some(c=>c.from===fn.id&&c.to===target.id)) connections.push({from:fn.id,to:target.id,label:'calls'});
      }
    }
  }
  findings=[];
  for(const [path,source] of Object.entries(files)) {
    const add=(severity,title,category,match,description,fix)=>findings.push({id:`${path}:${lineAt(source,match.index)}:${title}`,severity,title,category,path,line:lineAt(source,match.index),offset:match.index,description,fix});
    for(const m of source.matchAll(/\bTODO\b|\bFIXME\b|\bXXX\b/gi)) add('low','Unresolved code marker','Maintainability',m,'A TODO or FIXME marker may indicate incomplete behavior. Confirm whether this work is still needed.',null);
    for(const m of source.matchAll(/\bconsole\.(?:log|debug)\s*\(/g)) add('low','Debug output in source','Maintainability',m,'Debug logging can expose internal values or clutter production logs. Check whether this output should remain.',null);
    for(const m of source.matchAll(/\beval\s*\(/g)) add('high','Dynamic code execution','Security',m,'eval executes a string as code. If any part can be influenced by input, this can allow arbitrary code execution. Prefer explicit parsing or dispatch.',null);
    for(const m of source.matchAll(/\b(?:innerHTML|outerHTML)\s*=\s*[^;\n]+/g)) if(!/sanitize|trusted/i.test(m[0])) add('high','Unescaped HTML assignment','Security',m,'Assigning untrusted content to an HTML sink can create cross-site scripting. Verify the value is safely encoded or sanitized.',null);
    for(const m of source.matchAll(/\bcatch\s*\([^)]*\)\s*\{\s*\}/g)) add('medium','Empty error handler','Reliability',m,'This handler swallows errors with no logging or recovery. Decide whether to rethrow, report, or handle the failure.',null);
    for(const m of source.matchAll(/\b(?:for|while)\s*\([^\n]*\)\s*\{?/g)) {
      const body=loopBody(source,m);
      if(/\b(?:for|while)\s*\(/.test(body)) add('medium','Nested loop may scale poorly','Performance',m,'A nested loop can grow quadratically as input grows. Check the input size and whether a Set or Map lookup can replace the inner scan.',null);
    }
    for(const m of source.matchAll(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^\n;]*\+\s*[\w$.]+/gi)) add('high','SQL built by string concatenation','Security',m,'Dynamic SQL assembled from strings can permit injection. Use parameterized query values and keep SQL structure fixed.',null);
    for(const m of source.matchAll(/\b(?:password|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{5,}['"]/gi)) add('high','Possible hard-coded secret','Security',m,'A credential-like literal appears in source. Move secrets to a protected environment or secret store and rotate exposed credentials.',null);
  }
  findings.sort((a,b)=>({high:0,medium:1,low:2}[a.severity]-{high:0,medium:1,low:2}[b.severity])||a.path.localeCompare(b.path)||a.line-b.line);
  updateSummary(); renderMap(); renderFindings();
  if(selected && !findings.some(f=>f.id===selected) && !functions.some(f=>f.id===selected) && !files[selected]) selected=null;
  if(selected) selectNode(selected,false);
}

function updateSummary(){
  const n=Object.keys(files).length, counts={high:findings.filter(f=>f.severity==='high').length,medium:findings.filter(f=>f.severity==='medium').length,low:findings.filter(f=>f.severity==='low').length};
  $('fileStat').textContent=n;$('functionStat').textContent=functions.length;$('findingStat').textContent=String(findings.length).padStart(2,'0');$('railCount').textContent=String(findings.length).padStart(2,'0');$('findingBadge').textContent=String(findings.length).padStart(2,'0');$('allCount').textContent=findings.length;$('highCount').textContent=counts.high;$('mediumCount').textContent=counts.medium;$('lowCount').textContent=counts.low;
  $('criticalStat').textContent=`${counts.high} high · ${counts.medium} medium · ${counts.low} low`;$('mapSummary').textContent=`${n} files`;$('mapFunctionSummary').textContent=`${functions.length} functions`;
}

function makeMapNodes(mode=mapMode){
  const width=$('mapCanvas').clientWidth||760,positions=mapPositions[mode];
  if(mode==='functions'){
    const columns=Math.max(1,Math.min(4,Math.floor((width-24)/175)));
    return functions.map((fn,i)=>{const defaults={x:14+(i%columns)*175,y:12+Math.floor(i/columns)*54},nextLine=functions.filter(other=>other.path===fn.path&&other.line>fn.line).map(other=>other.line).sort((a,b)=>a-b)[0]??Infinity;return {id:fn.id,path:fn.path,name:fn.name,type:classifyPath(fn.path),line:fn.line,x:positions[fn.id]?.x??defaults.x,y:positions[fn.id]?.y??defaults.y,meta:`${fn.path.split('/').pop()}:${fn.line}`,hasFinding:findings.some(f=>f.path===fn.path&&f.line>=fn.line&&f.line<nextLine)};});
  }
  const paths=Object.keys(files).sort(),columns=Math.max(1,Math.min(4,Math.floor((width-24)/175)));
  return paths.map((path,i)=>{const defaults={x:14+(i%columns)*175,y:16+Math.floor(i/columns)*66};return {id:path,path,type:classifyPath(path),x:positions[path]?.x??defaults.x,y:positions[path]?.y??defaults.y,meta:`${functions.filter(f=>f.path===path).length} functions`,hasFinding:findings.some(f=>f.path===path)};});
}
function fileLinks(){
  const links=[];for(const c of connections){const a=functions.find(f=>f.id===c.from),b=functions.find(f=>f.id===c.to);if(a&&b&&a.path!==b.path&&!links.some(x=>x.from===a.path&&x.to===b.path))links.push({from:a.path,to:b.path,label:'calls'});}
  for(const [path,source] of Object.entries(files)) for(const m of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)){
    const base=path.includes('/')?path.slice(0,path.lastIndexOf('/')+1):'';let target=m[1];if(target.startsWith('.')){const stack=base.split('/').filter(Boolean);for(const bit of target.split('/')){if(bit==='..')stack.pop();else if(bit!=='.')stack.push(bit)}target=stack.join('/')}
    const found=Object.keys(files).find(p=>p===target||p===target+'.js'||p===target+'.ts'||p===target+'/index.js'||p===target+'/index.ts');if(found&&found!==path&&!links.some(x=>x.from===path&&x.to===found))links.push({from:path,to:found,label:'imports'});
  }
  return links;
}
function renderMap(){
  const canvas=$('mapCanvas'),nodes=makeMapNodes(),layer=$('mapNodes');layer.innerHTML='';
  const maxY=Math.max(canvas.clientHeight,...nodes.map(n=>n.y+54));$('mapLines').style.height=`${maxY}px`;layer.style.height=`${maxY}px`;
  nodes.forEach(n=>{const el=document.createElement('div');el.className='node'+(selected===n.id?' selected':'')+(mapMode==='functions'?' function-node':'');el.dataset.id=n.id;el.style.left=`${n.x}px`;el.style.top=`${n.y}px`;const title=mapMode==='functions'?n.name:n.path.split('/').pop();const meta=mapMode==='functions'?`${n.path}:${n.line}`:n.meta;el.innerHTML=`<div class="node-title"><i class="node-dot ${colors[n.type]}"></i>${escapeHtml(title)}</div><div class="node-meta">${escapeHtml(meta)}</div>${n.hasFinding?'<span class="node-flag">⚑</span>':''}`;el.title=mapMode==='functions'?`${n.name} — ${n.path}:${n.line}`:n.path;el.setAttribute('role','button');el.tabIndex=0;el.addEventListener('pointerdown',startNodeDrag);el.addEventListener('click',()=>selectNode(n.id));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id)}});layer.appendChild(el);});
  const links=mapMode==='functions'?connections.map(c=>({from:c.from,to:c.to,label:'calls'})):fileLinks();
  drawEdges(nodes,links,maxY);applyTransform();
}
function drawEdges(nodes,links,height){const svg=$('mapLines'),canvas=$('mapCanvas');svg.setAttribute('viewBox',`0 0 ${canvas.clientWidth} ${height||canvas.clientHeight}`);svg.innerHTML='';for(const l of links){const a=nodes.find(n=>n.id===l.from),b=nodes.find(n=>n.id===l.to);if(!a||!b)continue;const x1=a.x+52,y1=a.y+21,x2=b.x+52,y2=b.y+21,mx=(x1+x2)/2;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);path.setAttribute('class','edge');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',`${l.label||'reference'} link from ${a.name||a.path} to ${b.name||b.path}. Inferred from source; does not mean the code ran.`);const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`${l.label||'reference'} · inferred from source · click to inspect ${b.name||b.path}`;path.appendChild(title);path.addEventListener('click',()=>selectNode(l.to));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(l.to)}});svg.appendChild(path);}}
function applyTransform(){for(const el of [$('mapNodes'),$('mapLines')])el.style.transform=`translate(${panX}px,${panY}px) scale(${scale})`; $('zoomLabel').textContent=`${Math.round(scale*100)}%`;}
let nodeDrag=null, canvasDrag=null;
function startNodeDrag(e){const el=e.currentTarget;nodeDrag={el,startX:e.clientX,startY:e.clientY,left:parseFloat(el.style.left),top:parseFloat(el.style.top),moved:false};el.setPointerCapture(e.pointerId);const move=ev=>{if(!nodeDrag)return;const dx=(ev.clientX-nodeDrag.startX)/scale,dy=(ev.clientY-nodeDrag.startY)/scale;if(Math.abs(dx)+Math.abs(dy)>3)nodeDrag.moved=true;const x=nodeDrag.left+dx,y=nodeDrag.top+dy;el.style.left=`${x}px`;el.style.top=`${y}px`;mapPositions[mapMode][el.dataset.id]={x,y};const updated=makeMapNodes().map(n=>n.id===el.dataset.id?{...n,x,y}:n);drawEdges(updated,mapMode==='functions'?connections.map(c=>({from:c.from,to:c.to,label:'calls'})):fileLinks(),Math.max($('mapCanvas').clientHeight,...updated.map(n=>n.y+54)));};const up=()=>{if(nodeDrag){const moved=nodeDrag.moved;nodeDrag=null;if(moved)el.dataset.dragged='1';setTimeout(()=>delete el.dataset.dragged,50)}el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up)};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);}
function selectNode(id,scroll=true){if(document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.dataset.dragged)return;selected=id;document.querySelectorAll('.node').forEach(n=>n.classList.toggle('selected',n.dataset.id===id));renderDetail(id);if(scroll&&id.includes(':')){const f=findings.find(x=>x.id===id);if(f)document.querySelector(`[data-finding="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});}}

function renderDetail(id){const panel=$('detailPanel');const finding=findings.find(f=>f.id===id);if(finding){panel.innerHTML=`<div class="detail-top"><div class="detail-kicker">${escapeHtml(finding.category.toUpperCase())} · ${finding.severity.toUpperCase()}</div><div class="detail-name">${escapeHtml(finding.title)}</div><p class="detail-description">${escapeHtml(finding.description)}</p></div><div class="detail-section"><div class="section-label">SOURCE LOCATION</div><a href="#" class="source-link" id="sourceLink">${escapeHtml(finding.path)}:${finding.line}</a></div><div class="detail-section"><div class="section-label">WHY THIS WAS FLAGGED</div><div class="detail-description">Heuristic match from local static analysis. Review nearby code and confirm whether this is a real issue in your context.</div></div><div class="detail-actions"><button class="button button-dark" id="editFinding">Open source & edit ↗</button></div>`;$('sourceLink').onclick=e=>{e.preventDefault();openEditor(finding.path,finding.line,finding)};$('editFinding').onclick=()=>openEditor(finding.path,finding.line,finding);return;}
  const fn=functions.find(f=>f.id===id);const path=files[id]!==undefined?id:fn?.path;if(!path){panel.innerHTML=`<div class="detail-empty"><div class="empty-glyph">⌖</div><h3>Select a node</h3><p>Choose a file or function on the map to see its connections and source.</p></div>`;return;}
  const relatedFns=functions.filter(f=>f.path===path);const related=fn?connections.filter(c=>c.from===fn.id||c.to===fn.id):connections.filter(c=>{const a=functions.find(f=>f.id===c.from),b=functions.find(f=>f.id===c.to);return a?.path===path||b?.path===path}).slice(0,7);const issueCount=findings.filter(f=>f.path===path).length;const type=classifyPath(path);const comments=sourceComments(files[path]);
  panel.innerHTML=`<div class="detail-top"><div class="detail-kicker">${fn?'FUNCTION':'FILE'} · ${type.toUpperCase()} ${issueCount?`· <span style="color:#c88842">${issueCount} FLAG${issueCount===1?'':'S'}</span>`:''}</div><div class="detail-name">${escapeHtml(fn?fn.name:path)}</div><p class="detail-description">${escapeHtml(fn?`${fn.signature} · ${path}:${fn.line}`:`${relatedFns.length} functions found in this file.`)}</p></div><div class="detail-section"><div class="section-label">${fn?'FUNCTIONS IN FILE':'FUNCTIONS'} (${relatedFns.length})</div>${relatedFns.length?relatedFns.slice(0,12).map(f=>`<div class="connection"><i class="node-dot ${colors[type]}"></i><button data-fn="${escapeHtml(f.id)}">${escapeHtml(f.name)} <span style="color:#a5a9b3">:${f.line}</span></button></div>`).join(''):'<div class="detail-description">No functions detected in this file.</div>'}</div><div class="detail-section"><div class="section-label">${fn?'CALLS & CALLERS':'CONNECTED FUNCTIONS'} · STATIC LINKS</div>${related.length?related.map(c=>{const a=functions.find(f=>f.id===c.from),b=functions.find(f=>f.id===c.to),other=a?.id===(fn?.id||'')?b:a,label=fn?(a?.id===fn.id?'calls':'called by'):'↗';return other?`<div class="connection"><span class="arrow">${escapeHtml(label)}</span><button data-fn="${escapeHtml(other.id)}">${escapeHtml(other.name)}</button><span class="finding-meta">${escapeHtml(other.path.split('/').pop())}:${other.line}</span></div>`:''}).join(''):'<div class="detail-description">No direct call links detected. Static links show recognizable source references only; no code ran.</div>'}</div>${comments.length?`<div class="detail-section"><div class="section-label">COMMENTS (${comments.length})</div>${comments.map(c=>`<div class="comment-item"><span class="finding-meta">:${c.line}</span> ${escapeHtml(c.text)}</div>`).join('')}</div>`:''}<div class="detail-section"><div class="detail-metrics"><div class="metric"><span>Lines</span><b>${files[path].split('\n').length}</b></div><div class="metric"><span>Potential flags</span><b>${issueCount}</b></div></div></div><div class="detail-actions"><button class="button button-dark" id="openFile">View source ↗</button></div>`;
  panel.querySelectorAll('[data-fn]').forEach(b=>b.onclick=()=>{const f=functions.find(x=>x.id===b.dataset.fn);if(f){selectNode(f.id);openEditor(f.path,f.line)}});$('openFile').onclick=()=>openEditor(path,fn?.line||1);
}
function renderFindings(){const list=$('findingsList');const rows=findings.filter(f=>activeFilter==='all'||f.severity===activeFilter);if(!rows.length){list.innerHTML='<div class="finding-empty">No findings in this filter. Nice and quiet.</div>';return;}list.innerHTML=rows.map(f=>`<div class="finding-row" data-finding="${escapeHtml(f.id)}"><i class="severity ${f.severity}"></i><div><div class="finding-name">${escapeHtml(f.title)}</div><div class="finding-meta">${escapeHtml(f.path)}</div></div><span class="severity-label ${f.severity}">${f.severity}</span><span class="finding-category">${escapeHtml(f.category)}</span><span class="finding-line">${f.line} : 1</span><button class="inspect-btn" aria-label="Inspect ${escapeHtml(f.title)}">↗</button></div>`).join('');list.querySelectorAll('.finding-row').forEach(row=>{row.addEventListener('click',()=>{const f=findings.find(x=>x.id===row.dataset.finding);if(!f)return;selectNode(f.path,false);renderDetail(f.id);selected=f.id;document.querySelectorAll('.node').forEach(n=>n.classList.remove('selected'));row.scrollIntoView({behavior:'smooth',block:'nearest'});});});}
function openEditor(path,line=1,finding=null){const source=files[path];if(source===undefined)return;const dialog=$('editDialog');$('dialogTitle').textContent=`${path}:${line}`;$('dialogDescription').textContent=finding?finding.description:'Edit this file locally. The original upload is never changed.';const area=$('editArea');area.value=source;area.dataset.path=path;area.dataset.line=line;dialog.showModal();setTimeout(()=>{const lines=source.split('\n');let pos=lines.slice(0,line-1).join('\n').length+(line>1?1:0);area.focus();area.setSelectionRange(pos,Math.min(source.length,pos+lines[line-1]?.length||pos));},30);}

function download(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportReport(){const report={generatedAt:new Date().toISOString(),files:Object.keys(files).length,functions:functions.map(f=>({name:f.name,file:f.path,line:f.line})),connections,findings:findings.map(({id,severity,title,category,path,line,description})=>({id,severity,title,category,path,line,description})),note:'Static analysis uses heuristics and requires human verification.'};download('trace-review-report.json',JSON.stringify(report,null,2),'application/json');showToast('Review report downloaded');}
function readUpload(fileList){const selectedFiles=[...fileList].filter(f=>/\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|cs|cpp|c|h|rb|php|swift|kt|json|html|css|sql|sh|md)$/i.test(f.name)&&f.size<2_000_000);if(!selectedFiles.length){showToast('No supported source files found (2 MB per file max)');return;}const next={};let remaining=selectedFiles.length;selectedFiles.forEach(file=>{const reader=new FileReader();reader.onload=()=>{const path=(file.webkitRelativePath||file.name).replace(/^.*?\//,'');next[path]=String(reader.result||'');if(--remaining===0){files=next;selected=null;$('projectCrumb').textContent=selectedFiles.length>1?'uploaded-codebase':selectedFiles[0].name.replace(/\.[^.]+$/,'');$('scanTime').textContent='JUST NOW';scan();showToast(`Reviewed ${Object.keys(files).length} source files locally`);}};reader.onerror=()=>{if(--remaining===0&&Object.keys(next).length){files=next;scan();showToast('Some files could not be read');}};reader.readAsText(file);});}

$('fileInput').addEventListener('change',e=>{if(e.target.files?.length)readUpload(e.target.files);e.target.value='';});
$('filterTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;document.querySelectorAll('.filter-tab').forEach(x=>x.classList.toggle('active',x===b));renderFindings();});
$('exportBtn').onclick=exportReport;$('issuesNav').onclick=()=>$('findingsPanel').scrollIntoView({behavior:'smooth'});$('showAll').onclick=()=>setMapMode(mapMode==='files'?'functions':'files');$('helpBtn').onclick=()=>showToast('Files view shows imports. Functions view shows inferred calls. Lines are static references; no code executes.');
$('mapModeFiles').onclick=()=>setMapMode('files');$('mapModeFunctions').onclick=()=>setMapMode('functions');
$('themeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
$('zoomIn').onclick=()=>{scale=Math.min(1.7,scale+.1);applyTransform()};$('zoomOut').onclick=()=>{scale=Math.max(.65,scale-.1);applyTransform()};$('fitMap').onclick=()=>{scale=1;panX=0;panY=0;applyTransform()};$('mapReset').onclick=()=>{selected=null;scale=1;panX=0;panY=0;mapPositions={files:{},functions:{}};scan();renderDetail(null)};
$('mapCanvas').addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey){e.preventDefault();scale=Math.max(.65,Math.min(1.7,scale+(e.deltaY<0?.07:-.07)));applyTransform()}},{passive:false});
$('mapCanvas').addEventListener('pointerdown',e=>{if(e.target.closest('.node,.edge'))return;canvasDrag={x:e.clientX,y:e.clientY,px:panX,py:panY};$('mapCanvas').classList.add('grabbing');$('mapCanvas').setPointerCapture(e.pointerId)});$('mapCanvas').addEventListener('pointermove',e=>{if(!canvasDrag)return;panX=canvasDrag.px+e.clientX-canvasDrag.x;panY=canvasDrag.py+e.clientY-canvasDrag.y;applyTransform()});$('mapCanvas').addEventListener('pointerup',()=>{canvasDrag=null;$('mapCanvas').classList.remove('grabbing')});
$('applyEdit').addEventListener('click',e=>{e.preventDefault();const path=$('editArea').dataset.path;files[path]=$('editArea').value;$('editDialog').close('apply');scan();download(path.split('/').pop(),files[path]);showToast('Change applied in this review and file downloaded');});
$('editDialog').addEventListener('click',e=>{if(e.target===$('editDialog'))$('editDialog').close();});
$('rerunBtn').onclick=()=>{scan();$('scanTime').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}).toUpperCase();showToast(`Review complete · ${findings.length} potential finding${findings.length===1?'':'s'}`);};
function setMapMode(mode){mapMode=mode;$('mapModeFiles').classList.toggle('active',mode==='files');$('mapModeFunctions').classList.toggle('active',mode==='functions');$('showAll').innerHTML=`Show ${mode==='files'?'functions':'files'} <span>→</span>`;selected=null;renderMap();renderDetail(null);}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('fileInput').click()}if(e.key==='Escape'&&$('editDialog').open)$('editDialog').close();});
window.addEventListener('resize',()=>renderMap());
setTheme(localStorage.getItem(themeKey)==='dark'?'dark':'light');
scan();renderDetail(null);
