import argparse,html,json,shutil
from pathlib import Path
from inspect_glb import inspect
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--model",required=True);ap.add_argument("--name",required=True);ap.add_argument("--out",required=True);ap.add_argument("--runtime");a=ap.parse_args()
 src=Path(a.model).resolve();report=inspect(src);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
 if src!=out/"model.glb":shutil.copy2(src,out/"model.glb")
 runtime="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
 if a.runtime:
  shutil.copy2(Path(a.runtime),out/"model-viewer.min.js");runtime="model-viewer.min.js"
 name=html.escape(a.name)
 page=f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{name} · 3D教学展示</title>
 <style>*{{box-sizing:border-box}}body{{margin:0;font-family:system-ui,'Microsoft YaHei';color:#e7f5f1;background:#102822}}header{{padding:20px 28px}}h1{{margin:0 0 8px}}main{{display:grid;grid-template-columns:3fr 1fr;gap:16px;padding:0 24px}}model-viewer{{height:68vh;width:100%;background:#172f29;border-radius:14px}}aside{{padding:20px;background:#203b32;border-radius:14px}}button{{font-size:16px;padding:10px;margin:8px 6px 8px 0}}#status{{color:#a3e635}}footer{{padding:24px;color:#c7d9d1}}@media(max-width:800px){{main{{display:block}}}}</style>
 <header><h1>{name} · 3D教学展示</h1><div>教师复刻示例｜已有GLB → 展示网页 → 功能验收</div></header>
 <main><model-viewer src="model.glb" camera-controls auto-rotate shadow-intensity="1" alt="{name}三维模型"></model-viewer>
 <aside><h2>操作与观察</h2><p>拖动旋转，滚轮缩放；先观察整体，再辨认局部。</p><button id="rotate">暂停旋转</button><button id="reset">复位</button><p id="status">模型加载中…</p><h3>教师验收</h3><p>形态是否符合参考图？标签是否准确？旋转、缩放和复位是否正常？</p><p>AI生成模型为教学示意，学科准确性需教师核对。</p></aside></main>
 <footer>首次加载运行库和模型解码器可能需要联网；不能据此声称已离线验证。请通过本地HTTP服务打开。</footer>
 <script type="module" src="{html.escape(runtime,quote=True)}"></script><script>
 const m=document.querySelector('model-viewer'),b=document.querySelector('#rotate');m.addEventListener('load',()=>document.querySelector('#status').textContent='模型已加载，可交互');
 m.addEventListener('error',()=>document.querySelector('#status').textContent='加载失败，请检查HTTP服务、模型路径和网络');
 b.onclick=()=>{{m.autoRotate=!m.autoRotate;b.textContent=m.autoRotate?'暂停旋转':'自动旋转'}};
 document.querySelector('#reset').onclick=()=>{{m.cameraOrbit='0deg 75deg 105%';m.fieldOfView='auto';m.jumpCameraToGoal();}};
 </script></html>"""
 (out/"index.html").write_text(page,encoding="utf-8")
 report["name"]=a.name;report["runtime"]=runtime
 (out/"model-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps({"out":str(out),"entry":"index.html","bytes":report["bytes"]},ensure_ascii=False))
if __name__=="__main__":main()
