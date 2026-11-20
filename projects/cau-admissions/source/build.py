from pathlib import Path
import json
root=Path(__file__).resolve().parent
src=root/'src'
enc=lambda x:json.dumps(x,ensure_ascii=False).replace('</','<\\/').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
content=json.loads((root/'docs/content.json').read_text())
html=(src/'shell.html').read_text().replace('__CSS__',(src/'app.css').read_text()).replace('__CONTENT__',enc(content)).replace('__PROMPT_DOCUMENT__',enc((root/'docs/Prompt模板与话术样例.md').read_text())).replace('__JS__',(src/'engine.js').read_text()+'\n'+(src/'ui.js').read_text())
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(html)
print('Built dist/index.html')
