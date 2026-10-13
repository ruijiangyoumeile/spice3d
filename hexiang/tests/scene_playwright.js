const path=require('path'),fs=require('fs'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=process.env.SCENE_OUT||path.join(ROOT,'.tools','scene-results');
fs.mkdirSync(OUT,{recursive:true});
const results=[];
for(const [i,engine] of ['chromium','firefox','webkit'].entries()){
 for(const name of ['game_v2_test.js','scene_game_test.js']){
  const env={...process.env,NODE_PATH:path.join(ROOT,'.tools/node_modules'),PLAYWRIGHT_BROWSERS_PATH:path.join(ROOT,'.tools/playwright-browsers'),TEST_ENGINE:engine,TEST_PORT:String(8931+i),SCENE_PORT:String(8941+i)};
  const r=spawnSync(process.execPath,[path.join(__dirname,name)],{env,encoding:'utf8',timeout:180000});
  const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(OUT,engine+'-'+name+'.log'),log);
  const summary=log.split('\n').filter(x=>/通过|Scene verification|失败项|页面异常|脚本异常/.test(x));
  console.log(engine+' '+name+' exit='+r.status+' '+summary.join(' | '));
  results.push({engine,test:name,exit:r.status,error:r.error?.message,summary});
 }
}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(results,null,2));
if(results.some(r=>r.exit!==0))process.exitCode=1;
