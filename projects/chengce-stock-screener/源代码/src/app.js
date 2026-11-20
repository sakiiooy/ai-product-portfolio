import {FIELDS,OPS,DEFAULT_INTENT,DEFAULT_RULES,clone,formatValue,validateRules,screen,diffResults,parseIntent,saveStrategy} from '/engine.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel={PASS:'入选',FAIL:'排除',UNKNOWN:'待核验'};
const state={data:null,rules:clone(DEFAULT_RULES),baseline:null,tab:'PASS',selected:new Set(),blocked:false,pendingQuestions:[],parseMode:'dictionary',saved:[],health:null};
let toastTimer,lastFocus;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function originTag(r){return r.origin==='原文明确'?'原文明确':r.origin==='口径保护'?'口径保护':r.origin==='用户修改'?'已修改':'建议阈值';}
function currentPreview(){try{return state.data?screen(state.data,state.rules):null;}catch{return null;}}
function renderRules(){
 $('#rule-count').textContent=state.rules.filter(r=>r.enabled).length;
 $('#rules').innerHTML=state.rules.map((r,i)=>`<div class="rule-row ${r.enabled?'':'inactive'}" data-rule="${i}"><label class="switch"><input aria-label="启用条件 ${i+1}" type="checkbox" data-prop="enabled" ${r.enabled?'checked':''}></label><select data-prop="field" aria-label="条件 ${i+1} 指标">${Object.entries(FIELDS).map(([k,v])=>`<option value="${k}" ${r.field===k?'selected':''}>${v.label}</option>`).join('')}</select><select data-prop="op" aria-label="条件 ${i+1} 比较符">${Object.entries(OPS).map(([k,v])=>`<option value="${esc(k)}" ${r.op===k?'selected':''}>${esc(v)}</option>`).join('')}</select><input data-prop="value" aria-label="条件 ${i+1} 阈值" type="number" value="${Number.isFinite(r.value)?r.value:''}" step="0.1" min="-100000" max="100000"><span class="unit">${FIELDS[r.field].unit}</span><span class="rule-origin"><span class="tag">${originTag(r)}</span></span><button class="rule-delete" data-delete="${i}" aria-label="删除条件 ${i+1}">×</button></div>`).join('');
 renderRuleErrors();renderImpact();
}
function renderRuleErrors(){const errors=validateRules(state.rules);$('#rule-errors').textContent=errors.join('；');$('#rule-errors').className='feedback error';$('#run-screen').disabled=errors.length>0||state.blocked||state.pendingQuestions.length>0||!state.data;}
function dirty(){ $('#confirm-rules').checked=false; renderRuleErrors();renderImpact(); if(state.baseline)$('#results-caption').textContent='条件已修改，以下仍是上次确认结果；重新执行后更新';}
function renderImpact(){
 const next=currentPreview(),base=state.baseline;
 $('#impact-section').hidden=!base||!next||JSON.stringify(base.rules)===JSON.stringify(next.rules);
 if(!base||!next)return;
 const changes=diffResults(base,next),entered=changes.filter(r=>r.after==='PASS').length,left=changes.filter(r=>r.before==='PASS').length;
 $('#impact-summary').textContent=`入选 ${base.counts.PASS} → ${next.counts.PASS}；新增 ${entered}，移出 ${left}，${changes.length} 只状态变化`;
 $('#impact-detail').innerHTML=`<p>以下为当前编辑条件的预览，数据始终锁定在 <code>${esc(state.data.snapshot_id)}</code>。仅说明规则变化，不预测收益。</p>${changes.length?changes.map(r=>`<div>${esc(r.name)} <code>${esc(r.code)}</code>：${statusLabel[r.before]} → ${statusLabel[r.after]}</div>`).join(''):'<div>当前阈值变化没有改变样本状态。</div>'}`;
}
function renderFeedback(result){
 state.blocked=result.blocked;state.pendingQuestions=result.questions||[];state.parseMode=result.mode;
 const feedback=$('#parse-feedback');feedback.className=`feedback ${result.blocked?'error':''}`;
 const title=result.mode==='llm'?'AI 已生成建议条件，请逐条核对':'本地词典解析 · 未调用大模型';
 feedback.innerHTML=`<strong>${title}</strong>${[...result.questions,...result.warnings,...(result.assumptions||[])].map(s=>`<p>${esc(s)}</p>`).join('')}${result.questions.some(q=>q.includes('2024年度'))?'<button class="button quiet" id="use-historical">改用2024年度历史样本</button>':''}${result.questions.length&&!result.blocked?'<button class="button quiet" id="manual-clarify">放弃未支持表达，仅用下方条件</button>':''}`;
 $('#engine-mode').textContent=result.mode==='llm'?'AI 解析可用':'本地解析 · 需确认';
 renderRuleErrors();
}
async function parse(){
 const input=$('#intent').value;const button=$('#parse-intent');button.disabled=true;button.textContent='正在解析…';
 let result;
 try{const response=await fetch('/api/interpret',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({intent:input}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('解析服务异常');result=await response.json();if(!Array.isArray(result.rules)||!Array.isArray(result.questions)||!Array.isArray(result.warnings))throw new Error('解析响应格式异常');}
 catch{result=parseIntent(input);result.warnings.unshift('解析服务暂不可用，已显式切换为本地词典。');}
 state.rules=result.rules;$('#confirm-rules').checked=false;renderFeedback(result);renderRules();button.disabled=false;button.textContent='解析为条件';
}
function reasonSummary(result){
 const fails=result.checks.filter(c=>c.status==='FAIL'),unknown=result.checks.filter(c=>c.status==='UNKNOWN');
 if(fails.length)return fails.map(c=>`${FIELDS[c.rule.field].label}${formatValue(c.value,c.rule.field)}，未满足${OPS[c.rule.op]}${c.rule.value}${FIELDS[c.rule.field].unit}`).join('；');
 if(unknown.length)return `${[...new Set(unknown.map(c=>FIELDS[c.rule.field].label))].join('、')}缺少数据，无法确认全部条件`;
 return `全部 ${result.checks.length} 项条件均有证据满足`;
}
function renderResults(){
 const result=state.baseline;
 for(const s of ['PASS','FAIL','UNKNOWN']){$(`#count-${s}`).textContent=result?result.counts[s]:'—';const tab=$(`[data-status="${s}"]`);tab.classList.toggle('active',state.tab===s);tab.setAttribute('aria-selected',String(state.tab===s));}
 $('#compare-count').textContent=state.selected.size;$('#compare').disabled=state.selected.size<2;$('#export-csv').disabled=!result;
 if(!result){$('#results').innerHTML='<div class="empty-state"><div class="empty-symbol">⌕</div><h3>先确认规则，再查看候选</h3><p>恢复或新建条件后，请重新检查并执行。</p></div>';$('#results-caption').textContent='执行后显示入选、排除与待核验证据';return;}
 const rows=result.results.filter(r=>r.status===state.tab).sort((a,b)=>a.code.localeCompare(b.code));
 $('#result-snapshot').textContent=`快照 ${state.data.snapshot_id}`;
 if(!rows.length){$('#results').innerHTML=`<div class="empty-state"><div class="empty-symbol">⌕</div><h3>${state.tab==='PASS'?'没有样本满足全部条件':state.tab==='FAIL'?'没有已知不满足条件的样本':'没有待核验样本'}</h3><p>${state.tab==='PASS'?'检查排除与待核验页签。可调整一项条件，先查看影响再执行。':'可切换其他页签查看逐条依据。'}</p></div>`;return;}
 $('#results').innerHTML=`<table class="result-table"><thead><tr><th><span class="sr-only">比较选择</span></th><th>股票 / 代码</th><th>营业收入同比</th><th>归母净利同比</th><th>状态与依据</th><th>查看证据</th></tr></thead><tbody>${rows.map(r=>`<tr><td><input type="checkbox" aria-label="比较 ${esc(r.name)}" data-select="${esc(r.code)}" ${state.selected.has(r.code)?'checked':''}></td><td><span class="stock-name">${esc(r.name)}</span><span class="stock-code">${esc(r.code)}</span></td><td><span class="${r.stock.metrics.revenue_growth_yoy?.value>=0?'metric-positive':'metric-neutral'}">${formatValue(r.stock.metrics.revenue_growth_yoy?.value,'revenue_growth_yoy')}</span></td><td><span class="${r.stock.metrics.profit_growth_yoy?.value>=0?'metric-positive':'metric-neutral'}">${formatValue(r.stock.metrics.profit_growth_yoy?.value,'profit_growth_yoy')}</span></td><td class="reason-summary"><span class="status-badge status-${r.status}">${statusLabel[r.status]}</span> ${esc(reasonSummary(r))}</td><td><button class="text-button" data-evidence="${esc(r.code)}">逐条核验</button></td></tr>`).join('')}</tbody></table>`;
}
async function run(){
 if(!$('#confirm-rules').checked){toast('请先勾选确认条件及历史样本范围。');$('#confirm-rules').focus();return;}
 if(state.blocked||state.pendingQuestions.length){toast('请先解决输入中的澄清问题。');return;}
 const errors=validateRules(state.rules);if(errors.length){toast(errors.join('；'));return;}
 const button=$('#run-screen');button.disabled=true;button.textContent='正在筛选…';
 let response;
 try{response=await fetch('/api/screen',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rules:state.rules,snapshot_id:state.data.snapshot_id}),signal:AbortSignal.timeout(10000)});}
 catch{state.baseline={...screen(state.data,state.rules),executed_at:new Date().toISOString(),execution_mode:'local_snapshot'};toast('网络不可用，已使用加载完成的同一历史快照在本地计算；数据未刷新。');}
 if(response){try{const body=await response.json();if(!response.ok)throw new Error(body.error||'筛选接口异常');state.baseline=body;}catch(e){toast(`筛选未执行：${e.message}。请检查并重试。`);button.disabled=false;button.textContent='确认条件并筛选';return;}}
 state.tab=state.baseline.counts.PASS?'PASS':state.baseline.counts.UNKNOWN?'UNKNOWN':'FAIL';state.selected.clear();$('#results-caption').textContent=`${state.baseline.total} 只固定样本 · ${state.baseline.rules.length} 项条件 · ${state.baseline.execution_mode==='local_snapshot'?'本地快照计算':'用户已确认执行'}`;
 renderResults();renderImpact();button.disabled=false;button.textContent='确认条件并筛选';toast(`已完成核验：${state.baseline.counts.PASS} 入选，${state.baseline.counts.FAIL} 排除，${state.baseline.counts.UNKNOWN} 待核验`);
}
function openLayer(element){lastFocus=document.activeElement;$('#overlay').hidden=false;element.hidden=false;document.body.style.overflow='hidden';element.querySelector('button')?.focus();}
function closeLayers(){ $('#drawer').hidden=true;$('#modal').hidden=true;$('#overlay').hidden=true;document.body.style.overflow='';lastFocus?.focus();}
function sourceURL(url){try{const u=new URL(url);return /^https:$/.test(u.protocol)?u.href:'#';}catch{return '#';}}
function evidence(code){
 const result=state.baseline?.results.find(r=>r.code===code);if(!result)return;
 const drawer=$('#drawer');drawer.innerHTML=`<div class="drawer-header"><div><h2 id="drawer-title">${esc(result.name)} <span class="status-badge status-${result.status}">${statusLabel[result.status]}</span></h2><p>${esc(code)} · ${esc(result.industry)} · 2024年度公开披露</p></div><button class="close-button" data-close aria-label="关闭证据">×</button></div><div class="drawer-body"><h3>为什么${statusLabel[result.status]}</h3><p>${esc(reasonSummary(result))}</p>${result.checks.map(c=>`<article class="evidence-card"><div class="evidence-title"><h4>${FIELDS[c.rule.field].label}</h4><span class="status-badge status-${c.status}">${c.status==='PASS'?'满足':c.status==='FAIL'?'不满足':'缺少证据'}</span></div><div class="evidence-number">${formatValue(c.value,c.rule.field)}</div><div class="evidence-condition">确认条件：${FIELDS[c.rule.field].label} ${OPS[c.rule.op]} ${c.rule.value}${FIELDS[c.rule.field].unit}</div><div class="evidence-meta">${c.metric?.source_url?`<dl><dt>原始字段</dt><dd>${esc(c.metric.raw_label)}</dd><dt>披露原值</dt><dd>${esc(c.metric.raw_value)}</dd><dt>本期金额</dt><dd>${esc(c.metric.raw_current||'未提供')} ${esc(c.metric.raw_amount_unit||'')}</dd><dt>上期金额</dt><dd>${esc(c.metric.raw_previous||'未提供')} ${esc(c.metric.raw_amount_unit||'')}</dd><dt>计算口径</dt><dd>${esc(c.metric.growth_basis||'采用披露同比值')}</dd><dt>报告期</dt><dd>${esc(c.metric.report_period)}</dd><dt>披露日期</dt><dd>${esc(c.metric.published_at||'未核验')}（日期精度）</dd><dt>精确可用时刻</dt><dd>未掌握，不支持时点回测</dd><dt>原始文档</dt><dd><a href="${esc(sourceURL(c.metric.source_url))}" target="_blank" rel="noopener noreferrer">${esc(c.metric.source_title)} · 第${esc(c.metric.page??'未核实')}页</a></dd><dt>口径说明</dt><dd>${esc(c.metric.notes||FIELDS[c.rule.field].note)}</dd></dl>`:`<p>${esc(c.metric?.reason||'本历史财务快照未提供这一字段。')}</p><p>${esc(FIELDS[c.rule.field].note)}</p>`}</div></article>`).join('')}<p>快照：<code>${esc(state.data.snapshot_id)}</code><br>证据采集：${esc(state.data.collected_at)}<br>事实为披露字段；“满足条件”为确定性比较结果；不包含未来收益推断。</p></div>`;openLayer(drawer);
}
function compare(){
 const rows=state.baseline.results.filter(r=>state.selected.has(r.code));if(rows.length<2)return;
 $('#modal').innerHTML=`<div class="modal-header"><h2 id="modal-title">候选比较 <span class="small-count">${rows.length}只</span></h2><button class="close-button" data-close aria-label="关闭比较">×</button></div><div class="modal-body"><p>使用同一历史快照和同一报告期，比较事实与规则状态。未提供的数据保留为空。</p><table class="compare-table"><thead><tr><th>指标</th>${rows.map(r=>`<th>${esc(r.name)}<small>${esc(r.code)}</small></th>`).join('')}</tr></thead><tbody><tr><th>当前策略状态</th>${rows.map(r=>`<td><span class="status-badge status-${r.status}">${statusLabel[r.status]}</span></td>`).join('')}</tr>${Object.entries(FIELDS).map(([k,v])=>`<tr><th>${v.label}</th>${rows.map(r=>`<td>${formatValue(r.stock.metrics[k]?.value,k)}</td>`).join('')}</tr>`).join('')}<tr><th>报告期</th>${rows.map(()=>'<td>2024年度</td>').join('')}</tr></tbody></table><p>快照 <code>${esc(state.data.snapshot_id)}</code> · 不进行综合荐股评分或收益排名。</p></div>`;openLayer($('#modal'));
}
function loadSaved(){try{const raw=JSON.parse(localStorage.getItem('chengce-strategies-v1')||'[]');state.saved=Array.isArray(raw)?raw.filter(s=>s&&Array.isArray(s.rules)&&typeof s.id==='string').slice(0,50):[];}catch{state.saved=[];toast('本地策略无法读取，当前工作台仍可继续。');}$('#saved-count').textContent=state.saved.length;}
function persist(){let result;try{result=saveStrategy(localStorage,'chengce-strategies-v1',state.saved);}catch{result={ok:false,message:'浏览器禁止访问本地存储，请导出策略JSON备份。'};}if(!result.ok)toast(result.message);$('#saved-count').textContent=state.saved.length;return result.ok;}
function save(){if(!state.data||!state.rules.length){toast('请先创建有效条件。');return;}const errors=validateRules(state.rules);if(errors.length){toast('请先修正条件。');return;}if(state.blocked||state.pendingQuestions.length){toast('请先解决澄清问题后再保存。');return;}const strategy={id:crypto.randomUUID(),name:$('#intent').value.trim().slice(0,60)||'自定义策略',intent:$('#intent').value,rules:clone(state.rules),snapshot_id:state.data.snapshot_id,snapshot_hash:state.data.content_hash||null,saved_at:new Date().toISOString()};state.saved.unshift(strategy);state.saved=state.saved.slice(0,50);if(persist())toast('已保存到此浏览器，可在“我的策略”恢复。');}
function renderSaved(){
 $('#saved-list').innerHTML=state.saved.length?state.saved.map(s=>`<article class="saved-card"><div><p>原始意图</p><h2>${esc(s.name)}</h2><p><strong>当前条件：</strong>${esc(s.rules.filter(r=>r.enabled).map(r=>`${FIELDS[r.field]?.label||'未知指标'} ${OPS[r.op]||'?'} ${r.value}${FIELDS[r.field]?.unit||''}`).join('；'))}<br>${s.rules.filter(r=>r.enabled).length} 项启用条件 · ${esc(s.snapshot_id)}<br>${esc(new Date(s.saved_at).toLocaleString('zh-CN'))}</p></div><div class="saved-card-actions"><button class="button primary" data-restore="${esc(s.id)}">恢复条件</button><button class="button quiet" data-export="${esc(s.id)}">导出JSON</button><button class="text-button" data-remove="${esc(s.id)}">删除</button></div></article>`).join(''):'<section class="panel"><div class="empty-state"><div class="empty-symbol">▤</div><h3>还没有保存的策略</h3><p>回到意图选股，检查条件后选择保存策略。</p><button class="button quiet" data-view="workspace" style="margin-top:18px">开始检查</button></div></section>';
}
function renderData(){
 const d=state.data;if(!d)return;
 $('#data-details').innerHTML=`<div class="data-grid"><article class="data-card"><h2>当前数据快照</h2><dl><dt>样本范围</dt><dd>${esc(d.universe_description)}</dd><dt>报告期</dt><dd>2024年度，期末2024-12-31</dd><dt>资料快照日期</dt><dd>${esc(d.dataset_as_of||'2025-04-30')}，非行情日期</dd><dt>采集时点</dt><dd>${esc(d.collected_at)}</dd><dt>快照编号</dt><dd><code>${esc(d.snapshot_id)}</code></dd><dt>内容校验值</dt><dd><code>${esc(d.content_hash||'构建时生成')}</code></dd></dl></article><article class="data-card"><h2>能力与数据边界</h2><dl><dt>自然语言解析</dt><dd>${state.health?.ai_configured?'大模型接入已配置；失败时显式降级本地词典':'大模型未配置；本地词典解析，须人工确认'}</dd><dt>金融数据接口</dt><dd>扶摇 / iFinD 未配置，当前未调用实时接口</dd><dt>PE与波动率</dt><dd>缺失（null），启用条件会逐股待核验</dd><dt>保存与比较</dt><dd>本地策略保存、JSON / CSV导出、同快照比较</dd><dt>回测与监控</dt><dd>未实现；不提供占位收益或假监控任务</dd></dl></article></div><article class="data-card"><h2>真实数据来源</h2><p>下列文档来自交易所或巨潮公开披露。精确盘中可用时刻未掌握，因此不支持历史可交易回测。页面及原值可在每只股票的逐条核验中检查。</p><div style="overflow:auto"><table class="data-sources"><thead><tr><th>股票</th><th>营收同比</th><th>归母净利同比</th><th>披露日期</th><th>原始文档</th></tr></thead><tbody>${d.stocks.map(s=>`<tr><td><strong>${esc(s.name)}</strong><br><code>${esc(s.code)}</code></td><td>${formatValue(s.metrics.revenue_growth_yoy?.value,'revenue_growth_yoy')}</td><td>${formatValue(s.metrics.profit_growth_yoy?.value,'profit_growth_yoy')}</td><td>${esc(s.metrics.revenue_growth_yoy?.published_at||'未核验')}</td><td><a href="${esc(sourceURL(s.metrics.revenue_growth_yoy?.source_url))}" target="_blank" rel="noopener noreferrer">查看官方年报</a></td></tr>`).join('')}</tbody></table></div></article><article class="data-card"><h2>规则与统计口径</h2>${Object.entries(FIELDS).map(([k,v])=>`<div class="method-row"><strong>${v.label} <code>${k}</code></strong><p>${esc(v.note)}</p></div>`).join('')}<div class="method-row"><strong>三种筛选状态</strong><p>入选：全部启用条件都有证据满足。排除：至少一个条件已知不满足，即使其他字段缺失也列为排除并同时展示缺失。待核验：没有已知不满足条件，但至少一项缺失、异常或过期。缺失不补零。</p></div><div class="method-row"><strong>条件影响比较</strong><p>数据快照保持不变，只比较确认策略与当前编辑规则造成的状态变化；不能将变化解释为未来收益变化。</p></div></article>`;
}
function view(name){for(const n of ['workspace','saved','data']){$(`#${n}-view`).hidden=n!==name;$$(`.nav-item[data-view="${n}"]`).forEach(el=>el.classList.toggle('active',n===name));}$('#page-name').textContent=({workspace:'意图选股',saved:'我的策略',data:'数据与口径'})[name];if(name==='saved')renderSaved();if(name==='data')renderData();window.scrollTo(0,0);}
function exportCSV(){
 if(!state.baseline)return;const headers=['股票代码','股票名称','状态','报告期','营收同比(%)','归母净利同比(%)','逐条依据','快照编号','证据采集时点','年报原文URL','确认规则JSON','快照内容SHA256','执行时点','执行方式'];
 const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
 const rows=state.baseline.results.map(r=>[r.code,r.name,statusLabel[r.status],'2024年度',r.stock.metrics.revenue_growth_yoy?.value,r.stock.metrics.profit_growth_yoy?.value,reasonSummary(r),state.data.snapshot_id,state.data.collected_at,r.stock.metrics.revenue_growth_yoy?.source_url,JSON.stringify(state.baseline.rules),state.data.content_hash,state.baseline.executed_at,state.baseline.execution_mode]);
 download('澄策_筛选证据.csv','\uFEFF'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
$('#parse-intent').addEventListener('click',parse);$('#run-screen').addEventListener('click',run);$('#save-strategy').addEventListener('click',save);$('#compare').addEventListener('click',compare);$('#export-csv').addEventListener('click',exportCSV);$('#show-impact').addEventListener('click',()=>{$('#impact-detail').hidden=!$('#impact-detail').hidden;$('#show-impact').textContent=$('#impact-detail').hidden?'展开变化':'收起变化';});
$('#add-rule').addEventListener('click',()=>{if(state.rules.length>=16){toast('最多支持16项条件。');return;}state.rules.push({id:crypto.randomUUID(),field:'revenue_growth_yoy',op:'>=',value:5,enabled:true,origin:'用户修改'});renderRules();dirty();});
$('#rules').addEventListener('change',e=>{const row=e.target.closest('[data-rule]');if(!row||!e.target.dataset.prop)return;const r=state.rules[Number(row.dataset.rule)],prop=e.target.dataset.prop;r[prop]=prop==='enabled'?e.target.checked:prop==='value'?(e.target.value.trim()===''?NaN:Number(e.target.value)):e.target.value;r.origin='用户修改';renderRules();dirty();});
$('#rules').addEventListener('click',e=>{if(e.target.dataset.delete===undefined)return;state.rules.splice(Number(e.target.dataset.delete),1);renderRules();dirty();});
$('#intent').addEventListener('input',()=>{state.blocked=true;$('#parse-feedback').className='feedback';$('#parse-feedback').textContent='意图已修改，请重新解析，或保留原文并只编辑下方条件。';dirty();});
$('#overlay').addEventListener('click',closeLayers);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayers();if(e.key==='Tab'&& !$('#overlay').hidden){const layer=!$('#drawer').hidden?$('#drawer'):$('#modal'),items=[...layer.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')];if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
$('#results').addEventListener('change',e=>{const code=e.target.dataset.select;if(!code)return;if(e.target.checked){if(state.selected.size>=3){e.target.checked=false;toast('最多比较3只股票。');return;}state.selected.add(code);}else state.selected.delete(code);$('#compare-count').textContent=state.selected.size;$('#compare').disabled=state.selected.size<2;});
$('#export-strategies').addEventListener('click',()=>download('澄策_全部策略.json',JSON.stringify(state.saved,null,2)));

document.addEventListener('click',async e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.dataset.view)view(target.dataset.view);
 if(target.dataset.example){$('#intent').value=target.dataset.example;await parse();}
 if(target.dataset.status){state.tab=target.dataset.status;renderResults();}
 if(target.dataset.evidence)evidence(target.dataset.evidence);
 if(target.hasAttribute('data-close'))closeLayers();
 if(target.id==='use-historical'){$('#intent').value=$('#intent').value.replace(/今年|最近|当下|实时/g,'').replace(/(?:19|20)\d{2}年?/g,m=>m.startsWith('2024')?m:'');await parse();}
 if(target.id==='manual-clarify'){state.pendingQuestions=[];state.blocked=false;$('#confirm-rules').checked=false;$('#parse-feedback').textContent='已放弃未支持表达，仅用下方条件作为策略定义。请逐条修改并重新勾选确认；原文中的其他要求不会执行。';renderRuleErrors();}
 if(target.dataset.restore){const s=state.saved.find(s=>s.id===target.dataset.restore);try{const errors=validateRules(s.rules);if(errors.length)throw new Error(errors.join('；'));if(s.snapshot_id!==state.data.snapshot_id||(s.snapshot_hash&&s.snapshot_hash!==state.data.content_hash))throw new Error('保存策略的快照或内容已变化，无法直接复现');state.rules=clone(s.rules);$('#intent').value=s.intent;state.blocked=false;state.pendingQuestions=[];state.baseline=null;state.selected.clear();$('#confirm-rules').checked=false;$('#parse-feedback').textContent='已恢复保存条件。请重新检查并确认后执行。';renderRules();renderResults();view('workspace');toast('已恢复条件，尚未执行。');}catch(err){toast(err.message);}}
 if(target.dataset.export){const s=state.saved.find(s=>s.id===target.dataset.export);download('澄策_策略.json',JSON.stringify(s,null,2));}
 if(target.dataset.remove){state.saved=state.saved.filter(s=>s.id!==target.dataset.remove);persist();renderSaved();}
});
async function init(){
 loadSaved();renderRules();
 try{const [dataResponse,healthResponse]=await Promise.all([fetch('/api/data'),fetch('/api/health')]);if(!dataResponse.ok)throw new Error('数据快照不可用');state.data=await dataResponse.json();state.health=healthResponse.ok?await healthResponse.json():null;if(!Array.isArray(state.data.stocks)||!state.data.stocks.length)throw new Error('未取得有效股票样本');$('#snapshot-heading').textContent=state.data.title;$('#snapshot-summary').textContent=`${state.data.stocks.length}只固定A股样本 · 非实时 · PE / 波动率未提供`;$('#engine-mode').textContent=state.health?.ai_configured?'AI 解析已配置':'本地解析 · 需确认';$('#parse-feedback').innerHTML='<strong>本地词典解析 · 未调用大模型</strong><p>下方已预填“经营改善”的两项建议条件。阈值未经策略效果验证，请检查后确认执行。</p>';renderRules();}
 catch(e){$('#snapshot-summary').textContent=e.message;$('#snapshot-banner')?.classList.add('error');$('#parse-feedback').className='feedback error';$('#parse-feedback').textContent='数据加载失败，筛选已禁用。请刷新重试；不会生成正常结果。';toast(e.message);}
}
init();
