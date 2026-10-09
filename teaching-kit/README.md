# 教师复刻：AI辅助3D课件制作
赵军龙｜西北大学；配套《生成式AI辅助立体化学可视化课件的低代码开发实践》。

## 第一次：已有模型跑通展示
1. 下载并解压本资源包。Python 3运行脚本，浏览器支持WebGL。首次加载运行库CDN和解码器需要联网。
2. 将skills/spice3d-pipeline复制到项目的.agents/skills/（Codex）或.trae/skills/（TRAE）。如果工具不支持自动发现，要求它直接读取SKILL.md。
3. 在Agent里打开项目并输入：
> 用spice3d-pipeline，先用八角GLB跑通流程。制作能旋转、缩放、暂停和复位的网页，输出到output/bajiao。实际打开检查，说明启动和验收方法。可以去GitHub上找类似项目借鉴，请列出链接、可复用部分与改写内容。
4. 无Agent也可在资源包根目录运行：
~~~
python skills/spice3d-pipeline/scripts/inspect_glb.py skills/spice3d-pipeline/assets/bajiao.glb
python skills/spice3d-pipeline/scripts/build_viewer.py --model skills/spice3d-pipeline/assets/bajiao.glb --name 八角 --out output/bajiao
python -m http.server 8899 --directory output
~~~
浏览器打开http://127.0.0.1:8899/bajiao/。Ctrl+C停止服务。
验收：看到模型，拖动旋转，滚轮缩放，暂停与复位正常；教师核对形态与标签，保存截图和model-report.json。

## 第二次：换自己的对象
用新参考图或已有GLB替换输入，输出到新目录。参考图生成模型、生图与压缩见Skill的references/model-generation.md。不要把图像重建模型直接作为精确分子结构。

## 从一次成功到自己的Skill
做通案例 → 记录输入/步骤/失败反馈 → 定义调用条件 → 形成SKILL.md与scripts → 换一个对象再验收。

## 验证范围
网页生成脚本用已有八角GLB检查；实际浏览器已验证加载、暂停与复位，见验证记录.json和复刻实测.png。云端API仅输入和语法检查，未新提交付费任务。AR、所有工具版本与离线运行没有一并验证。

## 来源
示例八角GLB和参考图来自作者既有香料项目，AI生成形态不是精确标本。代码根据原spice3d-pipeline整理成路径可配置的分享版，不含密钥与作者固定目录。官方文档见Skill参考文件。


## 获取完整资源包
[下载教师复刻资源包](spice3d-teacher-kit.zip?raw=true)

包含Skill、脚本、八角GLB、参考图和验证记录。解压后从上面的第一次复刻开始。
