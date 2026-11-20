from pathlib import Path
import base64, json
root=Path(__file__).resolve().parent
assets={k:'data:image/png;base64,'+base64.b64encode((root/'assets/official-png'/name).read_bytes()).decode() for k,name in {'smile':'puang-smile.png','cheer':'puang-cheer.png','focus':'puang-focus.png','concern':'puang-overnight.png'}.items()}
base=(root/'shell.html').read_text().replace('__CSS__',(root/'app.css').read_text()).replace('__ASSETS__',json.dumps(assets,ensure_ascii=False)).replace('__LOGO__',json.dumps('data:image/png;base64,'+base64.b64encode((root/'assets/cau-logo.png').read_bytes()).decode())).replace('__ENGINE__',(root/'engine.js').read_text()).replace('__CONVERSATION__',(root/'conversation.js').read_text()).replace('__INTERACTIONS__',(root/'interactions.js').read_text()).replace('__PRESENTATION__',(root/'presentation.js').read_text()).replace('__UI__',(root/'ui.js').read_text())
out=root/'dist'
out.mkdir(parents=True,exist_ok=True)
preview=root/'preview';preview.mkdir(exist_ok=True)
for mode,name,preview_name in [(False,'CAU申请助手-候选人版.html','candidate.html'),(False,'CAU申请助手-完整会话体验.html','index.html')]:
 html=base.replace('__MODE__',str(mode).lower()).replace('__VALIDATION__','false')
 if mode:html=html.replace('<title>CAU申请助手 · 我的申请</title>','<title>CAU申请助手 · 完整会话体验</title>')
 (out/name).write_text(html);(preview/preview_name).write_text(html)
 print('Built',name,len(html.encode()),'bytes')

# Internal validation remains outside the delivered candidate view.
(preview/'qa.html').write_text(base.replace('__MODE__','true').replace('__VALIDATION__','true'))
