# 产品体验与网页原型作品

这些内容是不同阶段的产品设计与静态交互原型，使用示例或模拟数据，便于演示界面、业务流程和状态反馈。它们不是已连接真实招生、邮件、日历或招聘服务的生产系统。

| 项目 | 入口 | 阶段与范围 |
| --- | --- | --- |
| CAU 三意图交互 Demo | [打开原型](cau-admissions/index.html) | 较早的流程演示：进度查询、面试改期与进展跟进；保留源码与说明。 |
| CAU 候选人视图 | [打开原型](cau-candidate/index.html) | 在候选人体验阶段整理对话、动作记录与未确认反馈；保留源码、构建所需素材与验收记录。 |
| CAU 申请助手后续版本 | [打开原型](cau-application-latest/index.html) | 后续交付的单文件原型，展示继续迭代的页面与交互。 |
| HR 用户旅程 | [打开网页](journey-maps/hr-journey-map.html) | 招聘相关角色的用户旅程呈现。 |
| 面试官用户旅程 | [打开网页](journey-maps/interviewer-journey-map.html) | 面试官视角的用户旅程呈现。 |

## 查看与编辑

下载对应 HTML 后可用浏览器打开；也可从仓库根目录运行 `python3 -m http.server 8000`，再访问 `http://localhost:8000/projects/` 下的对应 HTML。GitHub 仓库中的 HTML 默认显示为源码，在线网页展示需要单独配置 GitHub Pages 等静态托管。

每个版本只保留一份最终展示 HTML，并统一命名为 `index.html`。随附的原始说明可能沿用原交付文件名。两个带 `source/` 的项目可在各自 `source/` 目录运行 `python3 build.py` 重建 HTML；构建结果输出到该目录下的 `dist/`，候选人版本同时生成开发预览。

CAU 名称、标志与吉祥物用于情境演示。候选人版的吉祥物素材来自[中央大学官方页面](https://www.cau.ac.kr/cms/FR_CON/index.do?CONTENTS_NO=1&MENU_ID=2540&P_TAB_NO=2)，相关权利属于原权利人，本项目不声称得到学校背书。

同步清单见仓库根目录的 `SYNC-MANIFEST.json`；清单保留原交付文件的相对来源路径与校验值，排除了本机运行元数据、重复压缩包、截图、论文和简历资料。
