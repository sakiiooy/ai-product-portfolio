/* One user event produces one chronological user message. */
const CandidateInteractions=(()=>{
 const value=v=>String(v??'').trim();
 const zone=v=>v==='Asia/Shanghai'?'北京时间（UTC+08:00）':v==='Asia/Seoul'?'韩国时间 KST（UTC+09:00）':value(v);
 function describe(action,p={},label='',v={},context={}){
  const text=value(label);
  if(['send','home_send'].includes(action))return null;
  if(action==='quick')return value(p.text)||text;
  if(action==='nav')return ({progress:'查看我的申请进度',reschedule:'打开面试改期',stalled:'打开进展跟进'})[p.view]||text;
  if(action==='stage')return '查看'+(['申请已提交','材料审核','笔试','面试','结果评估'][Number(p.index)]||'申请')+'阶段详情';
  if(action==='save_preferences')return `保存我的时间偏好：${value(v.date)||'日期未填写'}，${value(v.period)||'时间段未填写'}，${zone(v.timezone)}`;
  if(action==='save_reminders')return p.on?'开启页面进度提醒':'关闭页面进度提醒';
  if(action==='review_reschedule')return `核对改期需求：${value(v.date)||'日期未填写'} ${value(v.time)||'时间未填写'}，${zone(v.timezone)}${value(v.reason)?'；原因：'+value(v.reason):''}`;
  if(action==='submit_reschedule')return '确认提交这版改期需求';
  if(action==='submit_followup')return '确认提交当前版本的进度跟进内容';
  if(action==='edit_followup')return '查看并编辑我的咨询内容';
  if(action==='close')return `关闭${context.title?value(context.title)+'窗口':'当前窗口'}`;
  if(action==='mobile_menu')return context.mobileOpen?'收起服务导航':'展开服务导航';
  if(action==='conversation')return text||({select_slot:'选择面试时段',confirm_reschedule:'确认提交改期申请',confirm_followup:'确认提交进度跟进',cancel:'取消当前未完成的选择'})[p.command]||'继续当前对话';
  const map={show_progress:'查看完整申请进度',query:'刷新申请进度',profile:'查看我的申请信息',application_details:'核对申请记录',messages:'查看申请消息',help:'查看帮助与支持',contact:'查看负责老师的官方咨询渠道',preferences:'记录我的可参加时间',reminders:'查看进度提醒设置',reschedule_start:'我想调整面试时间',reschedule_form:'填写希望调整的时间',interview_details:'查看面试详情',result_details:'查看申请结果详情',compose_followup:'请帮我准备进度跟进内容',followup_record:'查看进度跟进记录',reschedule_record:'查看改期需求记录',copy_contact:'复制咨询内容',copy_followup:'复制当前咨询内容',clear_chat:'准备开始新对话',confirm_clear:'开始新对话'};
  return map[action]||text||action;
 }
 function changed(field,valueText){const text=value(valueText);const labels={prefDate:'可参加日期',prefPeriod:'可参加时间段',prefTimezone:'时间偏好时区',newDate:'希望改期日期',newTime:'希望改期时间',newZone:'改期时区',newReason:'改期原因'};
  if(field==='followupText')return '我修改了咨询内容：\n'+(text||'（已清空）');
  if(labels[field])return `设置${labels[field]}：${/Timezone|Zone/.test(field)?zone(text):text||'未填写'}`;
  return null;
 }
 return {describe,changed};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CandidateInteractions;
