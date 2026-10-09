"""单图生成GLB。默认仅检查；--execute才提交云端任务。凭据只读环境变量。"""
import argparse,base64,json,os,time,urllib.request,zipfile,tempfile,shutil
from pathlib import Path
from inspect_glb import inspect
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--image",required=True);ap.add_argument("--out",required=True);ap.add_argument("--model",default="3.0");ap.add_argument("--faces",type=int,default=50000);ap.add_argument("--timeout",type=int,default=1500);ap.add_argument("--execute",action="store_true");a=ap.parse_args()
 image=Path(a.image);data=image.read_bytes()
 if not data:raise SystemExit("参考图为空")
 payload={"Model":a.model,"FaceCount":a.faces,"GenerateType":"Normal","ImageBase64":base64.b64encode(data).decode()}
 print(json.dumps({"mode":"submit" if a.execute else "check-only","image":str(image),"imageBytes":len(data),"model":a.model,"faces":a.faces,"out":a.out},ensure_ascii=False))
 if not a.execute:print("未提交任务。确认账户计费和参考图后，加 --execute 运行。");return
 sid=os.environ.get("TENCENTCLOUD_SECRET_ID");key=os.environ.get("TENCENTCLOUD_SECRET_KEY")
 if not sid or not key:raise SystemExit("缺少腾讯云凭据环境变量；不读取凭据文件。")
 from tencentcloud.common import credential
 from tencentcloud.common.profile.client_profile import ClientProfile
 from tencentcloud.common.profile.http_profile import HttpProfile
 from tencentcloud.ai3d.v20250513 import ai3d_client,models
 hp=HttpProfile();hp.endpoint="ai3d.tencentcloudapi.com";cp=ClientProfile();cp.httpProfile=hp
 client=ai3d_client.Ai3dClient(credential.Credential(sid,key),"ap-guangzhou",cp)
 req=models.SubmitHunyuanTo3DProJobRequest();req.from_json_string(json.dumps(payload))
 job=client.SubmitHunyuanTo3DProJob(req).JobId;print("任务已提交：",job)
 q=models.QueryHunyuanTo3DProJobRequest();q.JobId=job;deadline=time.monotonic()+a.timeout
 while True:
  result=client.QueryHunyuanTo3DProJob(q)
  if result.Status=="FAIL":raise SystemExit("生成失败："+str(result.ErrorCode)+" "+str(result.ErrorMessage))
  if result.Status=="DONE":break
  if time.monotonic()>deadline:raise SystemExit("等待超时；先查询已有任务，不自动重新提交。")
  time.sleep(5)
 out=Path(a.out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory() as td:
  td=Path(td);got=None
  for idx,item in enumerate(result.ResultFile3Ds or []):
   raw=td/("result-"+str(idx));urllib.request.urlretrieve(item.Url,raw)
   if raw.read_bytes()[:4]==b"glTF":got=raw;break
   if zipfile.is_zipfile(raw):
    with zipfile.ZipFile(raw) as z:
     n=next((n for n in z.namelist() if n.lower().endswith(".glb")),None)
     if n:got=td/"model.glb";got.write_bytes(z.read(n));break
  if got is None:raise SystemExit("结果未包含GLB。")
  inspect(got);shutil.copy2(got,out)
 print(json.dumps(inspect(out),ensure_ascii=False))
if __name__=="__main__":main()
