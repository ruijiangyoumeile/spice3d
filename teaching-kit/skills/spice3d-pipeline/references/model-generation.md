# 从参考图生成3D
先准备主体完整、背景简洁的图片，核对植物或器官形态。不同AI视角图可能不一致，不能自动当作正确多视图。

## 可选本地生图
ComfyUI需要已运行，并已具备工作流所需模型与节点。klein_t2i.json是作者当前工作流快照，不代表接收者已经安装环境。可先用自己的照片跳过生图。
~~~
python scripts/comfy_run.py workflows/klein_t2i.json reference.png --set "4.inputs.text=A single star anise fruit, whole object visible, plain white background"
~~~

## 图生3D
简单路线：进入腾讯混元3D官方网页，上传核对后的图片，生成后下载GLB。当前版本、排队与费用以实际页面为准。
API路线：安装tencentcloud-sdk-python，用自己的环境变量TENCENTCLOUD_SECRET_ID、TENCENTCLOUD_SECRET_KEY提供凭据，不写入项目。
~~~
python scripts/generate_model.py --image reference.png --out model.glb
~~~
默认检查输入，不提交。加--execute才提交一次云端任务，可能产生费用。超时先查询已提交任务，不自动重试。
本公开版未用作者账户新提交付费任务；由实际本地脚本改写并检查接口字段，执行前核对当前官方SDK。

## 可选压缩
~~~
gltf-transform optimize model.glb model.optimized.glb --compress draco --texture-compress webp
~~~
保留原GLB，优化后实际检查细节。压缩模型可能依赖解码器网络资源。

## 官方文档
- https://cloud.tencent.com/document/product/1804
- https://3d.hunyuan.tencent.com/
- https://gltf-transform.dev/cli
- https://modelviewer.dev/
- https://docs.comfy.org/
