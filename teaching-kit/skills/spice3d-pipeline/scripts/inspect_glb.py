import json,struct,argparse
from pathlib import Path
def inspect(path):
 data=Path(path).read_bytes()
 if len(data)<20 or data[:4]!=b"glTF":raise ValueError("文件不是GLB")
 magic,version,size=struct.unpack_from("<4sII",data)
 if version!=2 or size!=len(data):raise ValueError("GLB版本或长度不正确")
 offset=12;doc=None
 while offset+8<=len(data):
  length,kind=struct.unpack_from("<I4s",data,offset);offset+=8
  if offset+length>len(data):raise ValueError("GLB数据块越界")
  if kind==b"JSON":doc=json.loads(data[offset:offset+length].decode("utf-8"))
  offset+=length
 if doc is None:raise ValueError("缺少GLB JSON")
 tris=0
 for mesh in doc.get("meshes",[]):
  for primitive in mesh.get("primitives",[]):
   if primitive.get("mode",4)!=4:continue
   ref=primitive.get("indices",primitive.get("attributes",{}).get("POSITION"))
   if ref is not None:tris+=doc["accessors"][ref]["count"]//3
 return {"file":str(Path(path).resolve()),"bytes":len(data),"meshes":len(doc.get("meshes",[])),"triangles":tris,"extensions":doc.get("extensionsUsed",[])}
if __name__=="__main__":
 ap=argparse.ArgumentParser();ap.add_argument("model");a=ap.parse_args()
 print(json.dumps(inspect(a.model),ensure_ascii=False,indent=2))
