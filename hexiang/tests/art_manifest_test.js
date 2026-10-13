const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'shared/game-art.js'),'utf8'),ctx);
let count=0;
function walk(x){
 if(!x||typeof x!=='object')return;
 if(x.src){
  assert.match(x.src,/^assets\/art\//);const f=path.resolve(root,x.src);
  assert.ok(f.startsWith(root+path.sep));assert.ok(fs.existsSync(f)&&fs.statSync(f).size>0,'missing '+x.src);
  assert.ok(x.alt&&x.width>0&&x.height>0);count++;
 }
 Object.values(x).forEach(v=>{if(v&&typeof v==='object')walk(v)});
}
walk(ctx.window.GAME_ART);assert.equal(ctx.window.GAME_ART.version,1);
assert.ok(count>=10,'ten core asset classes must exist');
console.log('Asset manifest: '+count+' files valid');
