export const FIELDS = {
  revenue_growth_yoy: { label: '营业收入同比', unit: '%', group: '经营改善', note: '2024年度与2023年度相比；采用年报披露口径。' },
  profit_growth_yoy: { label: '归母净利润同比', unit: '%', group: '经营改善', note: '2024年度归属于上市公司股东的净利润同比；不等同扣非净利润。' },
  pe_ttm: { label: '滚动市盈率 PE TTM', unit: '倍', group: '估值合理', note: '需同一估值时点的价格及过去12个月归母净利润；本样本未提供。' },
  volatility_60d: { label: '近60交易日年化波动率', unit: '%', group: '走势稳定', note: '61个有效复权收盘价，60个对数收益率；样本标准差×√252×100。本样本未提供。' }
};
export const OPS = {'>=':'≥','>':'>','<=':'≤','<':'<','=':'='};
export const DEFAULT_INTENT = '经营改善，营收和归母净利同比至少5%';
export const DEFAULT_RULES = [
  { id:'revenue-default',field:'revenue_growth_yoy',op:'>=',value:5,enabled:true,origin:'建议阈值' },
  { id:'profit-default',field:'profit_growth_yoy',op:'>=',value:5,enabled:true,origin:'建议阈值' }
];
export const clone = x => JSON.parse(JSON.stringify(x));
export function formatValue(v, field) { return typeof v==='number' && Number.isFinite(v) ? `${v.toFixed(2)}${FIELDS[field]?.unit||''}` : '未提供'; }
export function safeRules(input) {
  if(!Array.isArray(input)||input.length>16) throw new Error('条件必须为不超过16项的数组');
  return input.map((r,i)=>{
    if(!r || !Object.hasOwn(FIELDS,r.field) || !Object.hasOwn(OPS,r.op) || typeof r.value!=='number'||!Number.isFinite(r.value)||Math.abs(r.value)>100000) throw new Error('条件包含未知字段、比较符或无效阈值');
    return {id:typeof r.id==='string'?r.id.slice(0,64):`rule-${i}`,field:r.field,op:r.op,value:r.value,enabled:r.enabled!==false,origin:typeof r.origin==='string'?r.origin.slice(0,100):'用户确认'};
  });
}
export function validateRules(input) {
  let rules;
  try { rules=safeRules(input).filter(r=>r.enabled); } catch(e) {return [e.message];}
  if(!rules.length) return ['至少启用一项条件后再执行'];
  const errors=[];
  for(const field of Object.keys(FIELDS)) {
    const rr=rules.filter(r=>r.field===field);
    let low=-Infinity,high=Infinity,lowOpen=false,highOpen=false;
    for(const r of rr) {
      if(r.op==='=' || r.op==='>=' || r.op==='>') {
        if(r.value>low){low=r.value;lowOpen=r.op==='>';}
        else if(r.value===low && r.op==='>') lowOpen=true;
      }
      if(r.op==='=' || r.op==='<=' || r.op==='<') {
        if(r.value<high){high=r.value;highOpen=r.op==='<';}
        else if(r.value===high && r.op==='<') highOpen=true;
      }
    }
    if(low>high || (low===high&&(lowOpen||highOpen))) errors.push(`${FIELDS[field].label}的条件互相冲突，请调整上下限`);
  }
  return errors;
}
export function evaluateMetric(metric, rule) {
  const value=metric?.value;
  if(value===null||value===undefined||typeof value!=='number'||!Number.isFinite(value)||(metric?.status && !['valid','verified','ok'].includes(metric.status))) return {status:'UNKNOWN',value:null,reason:metric?.reason||'缺少可核验数据，无法判断',metric:metric||null,rule};
  const predicates={'>=':(a,b)=>a>=b,'>':(a,b)=>a>b,'<=':(a,b)=>a<=b,'<':(a,b)=>a<b,'=':(a,b)=>a===b};
  return {status:predicates[rule.op](value,rule.value)?'PASS':'FAIL',value,reason:`${FIELDS[rule.field].label} ${formatValue(value,rule.field)} ${OPS[rule.op]} ${rule.value}${FIELDS[rule.field].unit}`,metric,rule};
}
export function screen(dataset,input) {
  const rules=safeRules(input).filter(r=>r.enabled),errors=validateRules(rules);
  if(errors.length) throw new Error(errors.join('；'));
  const results=(dataset.stocks||[]).map(stock=>{
    const checks=rules.map(r=>evaluateMetric(stock.metrics?.[r.field],r));
    const status=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='UNKNOWN')?'UNKNOWN':'PASS';
    return {code:stock.code,name:stock.name,industry:stock.industry||'年报样本',status,checks,stock};
  });
  const counts={PASS:0,FAIL:0,UNKNOWN:0};for(const r of results)counts[r.status]++;
  return {snapshot_id:dataset.snapshot_id,content_hash:dataset.content_hash||null,rules,results,counts,total:results.length};
}
export function diffResults(baseline,next) {
  if(baseline.snapshot_id!==next.snapshot_id||(baseline.content_hash&&next.content_hash&&baseline.content_hash!==next.content_hash)) throw new Error('快照不一致，无法进行条件影响比较');
  const before=new Map(baseline.results.map(r=>[r.code,r.status]));
  return next.results.filter(r=>before.get(r.code)!==r.status).map(r=>({code:r.code,name:r.name,before:before.get(r.code),after:r.status}));
}
const OP_WORDS={'不低于':'>=','不小于':'>=','不大于':'<=','不少于':'>=','至少':'>=','大于等于':'>=','小于等于':'<=','不超过':'<=','不高于':'<=','低于':'<','小于':'<','高于':'>','大于':'>','超过':'>','≥':'>=','≤':'<=','为':'=','以上':'>=','以下':'<='};
function thresholdsAfter(text,label,defaultOp='>=') {
  const match=text.match(new RegExp(`(?:${label})([^，。；,;]{0,65})`,'i'));if(!match)return [];
  const tail=match[1].split(/营收|营业收入|归母净利|净利润|净利|市盈率|\bpe\b|波动率|波动/i)[0].replace(/(?:19|20)\d{2}年/g,'');
  const values=[];
  const pattern=/(不低于|不小于|不大于|不少于|至少|大于等于|小于等于|不超过|不高于|低于|小于|高于|大于|超过|>=|<=|≥|≤|>|<|=|为)?\s*(-?\d+(?:\.\d+)?)\s*[%％]?\s*(以上|以下)?/g;
  for(const m of tail.matchAll(pattern)){
    if(m.index>0 && /[a-z0-9]/i.test(tail[m.index-1]))continue;
    values.push({op:OP_WORDS[m[1]]||m[1]||OP_WORDS[m[3]]||defaultOp,value:Number(m[2])});
  }
  return values;
}
export function parseIntent(input) {
  const text=String(input||'').trim().slice(0,1500);
  const result={mode:'dictionary',rules:[],questions:[],warnings:['本地词典解析已启用，请检查并确认建议条件。'],blocked:false,assumptions:[]};
  if(!text){result.questions.push('请描述想检查的经营、估值或走势条件。');return result;}
  if(/稳赚|保本|保证.{0,6}收益|必涨|内幕|操纵|涨停预测|推荐.{0,5}买|买入.{0,6}建议|直接.{0,4}买卖/.test(text)) {
    result.blocked=true;result.questions.push('无法提供收益承诺、确定性涨跌判断或直接买卖建议。可以改为核验财务、估值和波动条件。');return result;
  }
  if(/忽略.{0,8}(指令|规则)|system\s*:|api.?key|密钥|绕过|执行代码/i.test(text)) {
    result.blocked=true;result.questions.push('输入包含与选股条件无关的指令。请只描述可核验的金融指标。');return result;
  }
  const add=(field,op,value,origin='建议阈值')=>result.rules.push({id:`${field}-${result.rules.length}`,field,op,value,enabled:true,origin});
  const business=/经营改善|业绩改善|基本面改善/.test(text);
  const rev=/营收|营业收入/.test(text),profit=/净利|利润/.test(text);
  const shared=text.match(/(?:营收|营业收入)(?:和|与|、|及)(?:归母)?净利(?:润)?(?:同比)?\s*(至少|不低于|>=|≥|超过|大于|不超过|<=|≤)?\s*(-?\d+(?:\.\d+)?)\s*%?\s*(以上|以下)?/);
  const sharedT=shared?{op:({'至少':'>=','不低于':'>=','≥':'>=','超过':'>','大于':'>','不超过':'<=','≤':'<='})[shared[1]]||shared[1]||OP_WORDS[shared[3]]||'>=',value:Number(shared[2])}:null;
  if(business||rev){const ts=sharedT?[sharedT]:thresholdsAfter(text,'营收|营业收入');if(ts.length)for(const t of ts)add('revenue_growth_yoy',t.op,t.value,'原文明确');else add('revenue_growth_yoy','>=',5);}
  if(business||profit){const ts=sharedT?[sharedT]:thresholdsAfter(text,'归母净利(?:润)?|净利(?:润)?|利润');if(ts.length)for(const t of ts)add('profit_growth_yoy',t.op,t.value,'原文明确');else add('profit_growth_yoy','>=',5);}
  if(/估值合理|合理估值|估值低|市盈率|\bpe\b/i.test(text)) {
    const ts=thresholdsAfter(text,'市盈率|pe(?:\\s*ttm)?','<=');
    add('pe_ttm','>',0,'口径保护');if(ts.length)for(const t of ts)add('pe_ttm',t.op,t.value,'原文明确');else add('pe_ttm','<=',30);
    result.warnings.push('PE TTM 为历史样本缺失字段；启用后可能待核验，不会用零填充。');
  }
  if(/稳定|稳健走势|波动/.test(text)) {
    const ts=thresholdsAfter(text,'波动率|波动','<=');if(ts.length)for(const t of ts)add('volatility_60d',t.op,t.value,'原文明确');else add('volatility_60d','<=',30);
    result.warnings.push('“稳定”解释为近60交易日年化波动率；不表示未来风险可控。');
  }
  if(/便宜|优质|龙头|安全|成长|好公司/.test(text)&&!result.rules.length)result.questions.push('“便宜／优质”等词仍不明确，请选择营业收入、归母净利、PE TTM或60日波动率，并给出阈值。');
  if(/今年|最近|当下|实时/.test(text) || [...text.matchAll(/(?:19|20)\d{2}/g)].some(m=>m[0]!=='2024'))result.questions.push('当前只有2024年度公开年报历史样本。请确认是否改用这一报告期；如需其他时点，需先接入对应数据。');
  if(/或|\bor\b/i.test(text))result.questions.push('当前仅支持所有启用条件同时满足（AND）。请将“或”拆为两套策略。');
  if(/不要|不看|排除.*(?:条件|指标)|忽略.*(?:波动|营收|净利|估值)/.test(text))result.questions.push('检测到否定条件，请在条件编辑器手动启用或关闭指标后重新检查；本地解析不自动处理否定范围。');
  if(/亿元|万元|人民币|美元|总收入|扣非|环比|季度|月度|负债|现金流|股息|分红|市净率|PB|ROE|市值|行业|板块|ST|停牌|股价|收盘|均线|回撤|上市|创业板|科创板|沪深300|收益|涨幅|换手|资金|成交|总资产/i.test(text))result.questions.push('输入包含当前样本未支持的指标、单位或筛选范围。请使用营业收入同比、归母净利润同比、PE TTM和60日年化波动率，或先补齐相应数据。');
  if(/下降|减少|降幅|翻倍|连续|扭亏|亏损|左右|大概|差不多|介于|之间|区间|便宜|优质|龙头|安全|成长|好公司/.test(text))result.questions.push('部分描述仍存在方向、范围或偏好歧义。请在下方明确指标、比较符和阈值后，主动采用手动条件。');
  // Conservative coverage check: anything outside this finite vocabulary requires explicit clarification.
  const residual=text
    .replace(/经营改善|业绩改善|基本面改善|估值合理|合理估值|估值低|走势相对稳定|走势稳定|稳定走势|相对稳定|稳健走势|稳定/g,'')
    .replace(/归属于上市公司股东的净利润|营业收入|归母净利润|归母净利|净利润|净利|营收|利润|市盈率|pe(?:\s*ttm)?|近?\s*60\s*(?:个)?交易日年化波动率|60日年化波动率|年化波动率|波动率|波动/gi,'')
    .replace(/不低于|不小于|不大于|不少于|至少|大于等于|小于等于|不超过|不高于|低于|小于|高于|大于|超过|以上|以下|等于/g,'')
    .replace(/同比|增长率|增长|增速|增幅|年度|年报|年|倍|百分之|近|交易日|日/g,'')
    .replace(/帮我|我想要|想要|选出|筛选|找出|挑选|选择|看看|一些|几只|股票|公司|A股|满足|要求|条件|并且|而且|以及|同时|且|和|与|及|均|都|并|请|的|为|是|我|想|要|只看|只|看|在|中|按|来|吧/gi,'')
    .replace(/-?\d+(?:\.\d+)?/g,'')
    .replace(/[\s%％，。；、,:：;!?！？()（）\[\]【】≥≤><=+\-\/\\|&]/g,'');
  if(residual)result.questions.push(`检测到词典尚未支持的表达“${residual.slice(0,80)}”。请明确这些要求，或主动放弃未支持表达，仅采用下方手动条件。`);
  if(!result.rules.length&&!result.questions.length)result.questions.push('暂未识别可执行指标，请选择下方示例或手动添加条件。');
  if(result.rules.some(r=>r.origin==='建议阈值'))result.assumptions.push('经营改善建议同比≥5%；估值合理建议0<PE≤30；走势稳定建议60日年化波动率≤30%。阈值可编辑，未经效果验证。');
  result.warnings.push(...validateRules(result.rules));
  return result;
}
export function normalizeDataset(raw) {
  const data=Array.isArray(raw)?{stocks:raw}:raw||{};
  return {...data,stocks:Array.isArray(data.stocks)?data.stocks:[]};
}
export function assertProviderResponse(httpOK,body) {
  if(!httpOK)throw new Error('数据接口网络或HTTP状态异常');
  if(!body||body.code!==0)throw new Error(`数据接口业务错误 ${body?.code??'未知'}`);
  return body.data;
}
export function saveStrategy(storage,key,value) {
  try {storage.setItem(key,JSON.stringify(value));return {ok:true};}
  catch{return {ok:false,message:'浏览器未能保存。请导出策略JSON，避免丢失。'};}
}
