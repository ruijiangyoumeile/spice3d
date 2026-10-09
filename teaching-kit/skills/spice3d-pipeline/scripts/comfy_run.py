# -*- coding: utf-8 -*-
"""把 API 格式工作流提交给本地 ComfyUI，等出图并存到指定路径。

用法：
    python comfy_run.py <workflow.json> <输出图片路径> [选项]

选项：
    --set 74.inputs.text="a dried clove bud"     改工作流里的任意字段（可多次）
    --upload 78=正视图.jpg                        先上传本地图片进 ComfyUI/input，并写入该节点的 image 字段
    --url http://127.0.0.1:8188                  服务地址
    --timeout 3600                               等图超时秒数

说明：
    工作流是 ComfyUI 的 API 格式（节点 id -> {class_type, inputs}），不是界面保存的
    那份带 nodes/links 的格式。字段类型会自动推断：纯数字转 int/float，true/false 转布尔。
"""
import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid


def post_json(url, obj, timeout=60):
    req = urllib.request.Request(
        url, data=json.dumps(obj).encode("utf-8"), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def get_json(url, timeout=60):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def set_path(wf, path, value):
    node_id, rest = path.split(".", 1)
    if node_id not in wf:
        raise SystemExit("工作流里没有节点 " + node_id)
    cur = wf[node_id]
    parts = rest.split(".")
    for p in parts[:-1]:
        cur = cur[p]
    v = value
    low = str(value).lower()
    if low in ("true", "false"):
        v = low == "true"
    else:
        try:
            v = int(value)
        except (ValueError, TypeError):
            try:
                v = float(value)
            except (ValueError, TypeError):
                v = value
    cur[parts[-1]] = v


def upload_image(base, local_path):
    """把本地图片 POST 到 /upload/image，返回 ComfyUI 侧的文件名"""
    boundary = "----ComfyUpload" + uuid.uuid4().hex
    name = os.path.basename(local_path)
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    with open(local_path, "rb") as f:
        data = f.read()
    body = b""
    body += ("--%s\r\n" % boundary).encode()
    body += ('Content-Disposition: form-data; name="image"; filename="%s"\r\n' % name).encode("utf-8")
    body += ("Content-Type: %s\r\n\r\n" % ctype).encode()
    body += data + b"\r\n"
    body += ("--%s\r\n" % boundary).encode()
    body += b'Content-Disposition: form-data; name="type"\r\n\r\ninput\r\n'
    body += ("--%s--\r\n" % boundary).encode()
    req = urllib.request.Request(
        base + "/upload/image",
        data=body,
        headers={"Content-Type": "multipart/form-data; boundary=" + boundary},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        res = json.loads(r.read().decode("utf-8"))
    got = res.get("name") or name
    if res.get("subfolder"):
        got = res["subfolder"] + "/" + got
    return got


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workflow")
    ap.add_argument("out")
    ap.add_argument("--set", action="append", default=[])
    ap.add_argument("--upload", action="append", default=[])
    ap.add_argument("--url", default="http://127.0.0.1:8188")
    ap.add_argument("--timeout", type=int, default=3600)
    a = ap.parse_args()

    with open(a.workflow, "r", encoding="utf-8") as f:
        wf = json.load(f)
    for kv in a.set:
        k, v = kv.split("=", 1)
        set_path(wf, k, v)
    for kv in a.upload:
        node_id, local = kv.split("=", 1)
        name = upload_image(a.url, local)
        print("已上传:", local, "->", name, flush=True)
        set_path(wf, node_id + ".inputs.image", name)

    client_id = str(uuid.uuid4())
    r = post_json(a.url + "/prompt", {"prompt": wf, "client_id": client_id})
    if r.get("node_errors"):
        bad = {k: v for k, v in r["node_errors"].items() if v}
        if bad:
            raise SystemExit("节点校验失败: " + json.dumps(bad, ensure_ascii=False)[:1200])
    pid = r["prompt_id"]
    print("prompt_id:", pid, flush=True)

    t0 = time.time()
    while True:
        h = get_json(a.url + "/history/" + pid)
        if pid in h:
            entry = h[pid]
            st = entry.get("status", {})
            if st.get("status_str") == "error":
                raise SystemExit("执行失败: " + json.dumps(st, ensure_ascii=False)[:1200])
            imgs = []
            for nid, out in entry.get("outputs", {}).items():
                imgs += out.get("images", [])
            if not imgs:
                raise SystemExit("没有输出图片: " + json.dumps(entry.get("outputs", {}), ensure_ascii=False)[:600])
            im = imgs[0]
            q = urllib.parse.urlencode(
                {"filename": im["filename"], "subfolder": im.get("subfolder", ""), "type": im.get("type", "output")}
            )
            with urllib.request.urlopen(a.url + "/view?" + q, timeout=180) as resp, open(a.out, "wb") as f:
                f.write(resp.read())
            print("SAVED %s %.0fKB 用时%.0fs" % (a.out, os.path.getsize(a.out) / 1024.0, time.time() - t0), flush=True)
            return
        if time.time() - t0 > a.timeout:
            raise SystemExit("超时未出图（%ds），去 ComfyUI 控制台看日志" % a.timeout)
        time.sleep(2)


if __name__ == "__main__":
    main()