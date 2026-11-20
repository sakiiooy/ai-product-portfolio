/* Presentation guards keep preview metadata out of candidate-facing text. */
const CandidatePresentation=(()=>{
 const internalReceipt=v=>typeof v==='string'&&/^(?:LOCAL-|MOCK-|DEMO-)/i.test(v);
 const hiddenCommands=new Set(['start_path','query_failure','reschedule_failure','followup_failure','next_schedule','next_evaluation','next_result','next_waiting_interview']);
 const isInternalAction=a=>a?.action==='experience_path'||(a?.action==='conversation'&&hiddenCommands.has(a.payload?.command))||/兜底|体验.*失败|信息不足兜底/.test(a?.label||'');
 function cleanText(text){return String(text??'').split('\n').filter(line=>!/本地.{0,8}(?:演练|工单|回执)|LOCAL-EXERCISE|没有联系真实|没有改变真实|不会发给真实|没有发送真实|当前没有连接咨询提交服务/.test(line)).join('\n').trim();}
 function publicReply(reply){if(!reply?.text)return reply;const synthetic=/LOCAL-EXERCISE|本地.{0,8}(?:演练|回执|工单)/.test(reply.text);let text=cleanText(reply.text);if(synthetic&&/改期成功|改期已完成/.test(reply.text))text='已保存希望调整的时间，但尚未取得面试安排变更的确认。请继续按已确认的信息准备，并联系负责老师核对。';else if(synthetic&&/提交|发送|工单.*已创建/.test(reply.text))text='内容已保存在当前页面，尚未取得提交或转接确认。你可以查看保留的内容、重试，或通过官方渠道咨询负责老师。';if(!text)text='当前信息尚待确认，请查看已有记录或通过官方渠道进一步核实。';return {...reply,text,actions:(reply.actions||[]).filter(a=>!isInternalAction(a)).map(a=>({...a,label:a.label.replace(/^继续：/,'查看')}))};}
 function receiptText(receipt){return receipt&&!internalReceipt(receipt)?receipt:'尚未取得确认';}
 function sanitizeState(state){const copy=JSON.parse(JSON.stringify(state));if(copy.interview&&internalReceipt(copy.interview.receipt)){copy.interview=null;copy.phase='awaiting_interview';}
  if(copy.result&&internalReceipt(copy.result.receipt)){copy.result=null;copy.phase=copy.interview?'scheduled':'awaiting_interview';}
  for(const key of ['reschedule','followup'])if(copy[key]&&internalReceipt(copy[key].receipt)){copy[key].receipt=null;copy[key].status='unconfirmed';}
  return copy;
 }
 return {internalReceipt,isInternalAction,cleanText,publicReply,receiptText,sanitizeState};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CandidatePresentation;
