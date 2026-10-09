import type { GameProject } from '../types';

/** Build a single self-contained HTML file with the game embedded. No external deps. */
export function buildStandaloneHtml(project: GameProject): string {
  const data = JSON.stringify(project).replace(/</g, '\\u003c');
  const runtime = EXPORT_RUNTIME_JS;
  const title = 'My Platformer Game';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — made with Platformer Maker</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #0e1020; color: #fff; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
  header { padding: 14px; text-align: center; }
  header h1 { margin: 0 0 4px; font-size: 22px; }
  header p { margin: 0; opacity: 0.6; font-size: 13px; }
  #wrap { width: min(960px, 96vw); }
  canvas { width: 100%; aspect-ratio: 16/9; border-radius: 12px; background: #1b2340; box-shadow: 0 12px 40px rgba(0,0,0,0.5); touch-action: none; }
  #touch { display: flex; gap: 10px; margin: 12px 0 24px; justify-content: center; }
  #touch button { font-size: 20px; padding: 12px 22px; border-radius: 12px; border: 1px solid #444; background: #23263a; color: #fff; }
  #touch button:active { background: #2f6df6; }
  .hint { text-align: center; opacity: 0.55; font-size: 13px; margin-bottom: 20px; }
</style>
</head>
<body>
<header><h1>🎮 ${title}</h1><p>Made with Platformer Maker • Arrows/WASD + Space • R to restart</p></header>
<div id="wrap"><canvas id="game" width="960" height="540"></canvas>
<div id="touch">
  <button id="btnL">◀</button>
  <button id="btnR">▶</button>
  <button id="btnJ">⤒ Jump</button>
</div>
<div class="hint">Tip: stomp enemies from above • collect coins • reach the 🏁 flag</div>
</div>
<script>window.__GAME_DATA__ = ${data};</script>
<script>${runtime}</script>
</body>
</html>`;
}

export function downloadGame(project: GameProject): void {
  const html = buildStandaloneHtml(project);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-platformer-game.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Self-contained runtime (plain JS). Mirrors src/engine/* logic.
const EXPORT_RUNTIME_JS = `
(function(){
"use strict";
var TS=32;
var cv=document.getElementById('game'), ctx=cv.getContext('2d');
var P=window.__GAME_DATA__;
var level=P.levels.find(function(l){return l.id===P.activeLevelId})||P.levels[0];
var tiles=level.tiles.map(function(r){return r.slice()});
var W=level.w,H=level.h;
var input={left:false,right:false,jump:false,jp:false};
function findSpawn(){for(var y=0;y<H;y++)for(var x=0;x<W;x++)if(tiles[y][x]===5)return{x:x*TS,y:y*TS};return{x:64,y:0};}
var sp=findSpawn();
var totalCoins=0;tiles.forEach(function(r){r.forEach(function(t){if(t===4)totalCoins++})});
var defs={};P.enemyTypes.forEach(function(e){defs[e.id]=e});
var player={x:sp.x,y:sp.y-4,w:24,h:28,vx:0,vy:0,ground:false,hp:P.player.maxHp,coyote:0,buf:0,dj:P.player.doubleJump?1:0,face:1,hurt:0,anim:0,dead:false,won:false};
var enemies=level.enemies.map(function(p,i){var d=defs[p.typeId]||P.enemyTypes[0];var s=TS;return{id:i,type:d,x:p.tx*TS,y:p.ty*TS,w:s*0.9,h:s*0.9,vx:0,vy:0,ground:false,hp:d.hp,dir:Math.random()>0.5?1:-1,scd:1+Math.random(),jcd:1+Math.random()*2,hurt:0,dead:false,anim:Math.random()*9}});
var shots=[],parts=[],coins=0,time=0,status='playing',camX=0,camY=0;
var AC=null;
function beep(f,d,type,v,slide){try{if(AC&&AC.state==='suspended')AC.resume();if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,AC.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),AC.currentTime+d);g.gain.setValueAtTime(v||0.08,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d);}catch(e){}}
function sJump(){beep(300,0.15,'square',0.08,250)}function sCoin(){beep(880,0.09,'square',0.07);setTimeout(function(){beep(1320,0.12,'square',0.07)},70)}function sHurt(){beep(200,0.25,'sawtooth',0.1,-120)}function sStomp(){beep(180,0.12,'square',0.1,-80)}function sShoot(){beep(700,0.08,'sawtooth',0.05,-300)}function sWin(){[523,659,784,1046].forEach(function(f,i){setTimeout(function(){beep(f,0.18,'square',0.09)},i*110)})}function sLose(){[400,300,200,140].forEach(function(f,i){setTimeout(function(){beep(f,0.2,'sawtooth',0.09)},i*130)})}
function burst(x,y,c,n){for(var i=0;i<n;i++)parts.push({x:x,y:y,vx:(Math.random()-0.5)*260,vy:-Math.random()*260,life:0,max:0.4+Math.random()*0.3,c:c,s:2+Math.random()*3})}
function tileAt(tx,ty){if(ty<0||tx<0||ty>=H||tx>=W){if(ty<0)return 0;return 1}return tiles[ty][tx]}
function solid(t){return t===1}function oneway(t){return t===2}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function move(b,dt){
 b.x+=b.vx*dt;
 var x0=Math.floor(b.x/TS),x1=Math.floor((b.x+b.w-0.01)/TS),y0=Math.floor(b.y/TS),y1=Math.floor((b.y+b.h-0.01)/TS);
 for(var ty=y0;ty<=y1;ty++)for(var tx=x0;tx<=x1;tx++){if(!solid(tileAt(tx,ty)))continue;var L=tx*TS,R=L+TS;
  if(b.vx>0&&b.x+b.w>L){b.x=L-b.w;b.vx=0}else if(b.vx<0&&b.x<R){b.x=R;b.vx=0}}
 b.y+=b.vy*dt;b.ground=false;
 x0=Math.floor(b.x/TS);x1=Math.floor((b.x+b.w-0.01)/TS);y0=Math.floor(b.y/TS);y1=Math.floor((b.y+b.h-0.01)/TS);
 for(var ty2=y0;ty2<=y1;ty2++)for(var tx2=x0;tx2<=x1;tx2++){var t=tileAt(tx2,ty2);var T2=ty2*TS,B2=T2+TS;
  if(solid(t)){if(b.vy>0&&b.y+b.h>T2&&b.y+b.h-b.vy*0.05<=T2+6){b.y=T2-b.h;b.vy=0;b.ground=true}else if(b.vy<0&&b.y<B2&&b.y-b.vy*0.05>=B2-6){b.y=B2;b.vy=0}}
  else if(oneway(t)){if(b.vy>=0){var pb=b.y+b.h-b.vy*(1/60);if(pb<=T2+8&&b.y+b.h>=T2&&b.y+b.h<=T2+18){b.y=T2-b.h;b.vy=0;b.ground=true}}}}
}
function groundAhead(b,dir){var fx=dir>0?b.x+b.w+2:b.x-2;var t=tileAt(Math.floor(fx/TS),Math.floor((b.y+b.h+4)/TS));return solid(t)||oneway(t)}
function wallAhead(b,dir){var px=dir>0?b.x+b.w+2:b.x-2;return solid(tileAt(Math.floor(px/TS),Math.floor((b.y+b.h/2)/TS)))}
function hurt(dmg,fx){if(player.hurt>0||status!=='playing')return;player.hp-=dmg;player.hurt=1;sHurt();burst(player.x+12,player.y+14,'#ff5c5c',12);if(fx!==undefined){player.vx=(player.x+12<fx?-1:1)*220;player.vy=-320}if(player.hp<=0){player.hp=0;player.dead=true;status='dead';sLose()}}
function drawSprite(px,ox,oy,w,h){var n=px.length,cw=w/px[0].length,ch=h/n;for(var y=0;y<n;y++)for(var x=0;x<px[0].length;x++){var c=px[y][x];if(!c)continue;ctx.fillStyle=c;ctx.fillRect(ox+x*cw,oy+y*ch,Math.ceil(cw),Math.ceil(ch))}}
function update(dt){
 time+=dt;
 if(status!=='playing'){parts.forEach(function(p){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=600*dt});parts=parts.filter(function(p){return p.life<p.max});return}
 var cfg=P.player,pl=player;
 var tgt=(input.right?1:0)-(input.left?1:0);
 var acc=pl.ground?2400:1600;
 if(tgt!==0){pl.vx+=tgt*acc*dt;pl.vx=Math.max(-cfg.speed,Math.min(cfg.speed,pl.vx));pl.face=tgt}
 else{var f=pl.ground?2000:400;if(Math.abs(pl.vx)<=f*dt)pl.vx=0;else pl.vx-=Math.sign(pl.vx)*f*dt}
 if(pl.ground){pl.coyote=cfg.coyote;pl.dj=cfg.doubleJump?1:0}else pl.coyote-=dt;
 if(input.jp){pl.buf=cfg.jumpBuffer;input.jp=false}else pl.buf-=dt;
 if(pl.buf>0){if(pl.coyote>0){pl.vy=-cfg.jumpVelocity;pl.coyote=0;pl.buf=0;pl.ground=false;sJump();burst(pl.x+12,pl.y+28,'#fff',5)}else if(pl.dj>0){pl.vy=-cfg.jumpVelocity*0.9;pl.dj--;pl.buf=0;beep(420,0.15,'square',0.08,300);burst(pl.x+12,pl.y+28,'#9adcff',8)}}
 if(!input.jump&&pl.vy<-200)pl.vy+=cfg.gravity*1.6*dt;
 pl.vy+=cfg.gravity*dt;if(pl.vy>900)pl.vy=900;
 move(pl,dt);pl.anim+=dt*(Math.abs(pl.vx)>20?10:3);if(pl.hurt>0)pl.hurt-=dt;
 if(pl.y>H*TS+80)hurt(99);
 var x0=Math.floor(pl.x/TS),x1=Math.floor((pl.x+pl.w)/TS),y0=Math.floor(pl.y/TS),y1=Math.floor((pl.y+pl.h)/TS);
 for(var ty=y0;ty<=y1;ty++)for(var tx=x0;tx<=x1;tx++){if(ty<0||tx<0||ty>=H||tx>=W)continue;var t=tiles[ty][tx];var r={x:tx*TS,y:ty*TS,w:TS,h:TS};if(!overlap(pl,r))continue;
  if(t===4){tiles[ty][tx]=0;coins++;sCoin();burst(r.x+16,r.y+16,'#ffd94d',8)}
  else if(t===3){if(overlap(pl,{x:r.x+6,y:r.y+14,w:20,h:18}))hurt(1,r.x+16)}
  else if(t===6){pl.won=true;status='won';sWin();burst(pl.x+12,pl.y,'#5cff8a',30)}}
 enemies.forEach(function(e){if(e.dead)return;e.anim+=dt*6;if(e.hurt>0)e.hurt-=dt;
  var dx=pl.x-e.x,adx=Math.abs(dx),pr=e.type.preset;e.vx=0;
  if(pr==='patrol')e.vx=e.dir*e.type.speed;
  else if(pr==='chaser'){e.vx=(adx<e.type.range&&!pl.dead?Math.sign(dx||1):e.dir*0.4)*e.type.speed}
  else if(pr==='jumper'){e.vx=e.dir*e.type.speed*0.7;e.jcd-=dt;if(e.jcd<=0&&e.ground){e.vy=-480;e.jcd=1.2+Math.random()*1.2}}
  else if(pr==='shooter'){e.vx=e.dir*e.type.speed*0.6;e.scd-=dt;if(e.scd<=0&&adx<e.type.range&&Math.abs(pl.y-e.y)<220){shots.push({x:e.x+12,y:e.y+12,w:10,h:10,vx:(pl.x>=e.x?1:-1)*260,vy:0,dead:false,life:3});sShoot();e.scd=e.type.shootCooldown||1.6}}
  else if(pr==='turret'){e.scd-=dt;if(e.scd<=0&&adx<e.type.range){shots.push({x:e.x+12,y:e.y+12,w:10,h:10,vx:(pl.x>=e.x?1:-1)*260,vy:0,dead:false,life:3});sShoot();e.scd=e.type.shootCooldown||1.6}}
  e.vy+=cfg.gravity*0.9*dt;if(e.vy>800)e.vy=800;
  var wd=e.dir;move(e,dt);
  if(pr!=='turret'){if(wallAhead(e,e.dir)&&e.ground)e.dir=-e.dir;else if(e.ground&&!groundAhead(e,e.dir)&&(pr==='patrol'||pr==='shooter'))e.dir=-e.dir;if(Math.abs(e.vx)<1&&e.ground)e.dir=-wd}
  if(e.dir!==0&&e.vx!==0)e.dir=Math.sign(e.vx);
  if(!pl.dead&&overlap(pl,e)){var stomp=pl.vy>120&&pl.y+pl.h-e.y<20;if(stomp){e.hp--;pl.vy=-cfg.jumpVelocity*0.65;sStomp();burst(e.x+14,e.y,'#fff',10);if(e.hp<=0){e.dead=true;burst(e.x+14,e.y+14,'#ff5c5c',16)}}else hurt(e.type.damage||1,e.x+14)}
  if(e.y>H*TS+100)e.dead=true;
 });
 enemies=enemies.filter(function(e){return !e.dead});
 shots.forEach(function(s){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.life<=0){s.dead=true;return}if(solid(tileAt(Math.floor((s.x+5)/TS),Math.floor((s.y+5)/TS)))){s.dead=true;burst(s.x,s.y,'#ffb14d',5);return}if(overlap(player,s)){s.dead=true;hurt(1,s.x)}});
 shots=shots.filter(function(s){return !s.dead});
 parts.forEach(function(p){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=700*dt});parts=parts.filter(function(p){return p.life<p.max});
 var tX=pl.x+12-480,tY=pl.y+14-270-40;var mX=Math.max(0,W*TS-960),mY=Math.max(0,H*TS-540);
 camX+=(Math.max(0,Math.min(mX,tX))-camX)*Math.min(1,dt*8);camY+=(Math.max(0,Math.min(mY,tY))-camY)*Math.min(1,dt*8);
}
var ART_G=['llllllll','GGGGGGGG','GGgGGGGg','gGGgGGgG','DdDDDDdD','DDDDDDDD','DLDDDDdD','kkkkkkkk'];
var ART_D=['DDDDDDDD','DdDDDDdD','DDDDDDDD','DDdDDDLD','DDDDDDDD','DdDDDDdD','DDDDDdDD','kkkkkkkk'];
var ART_DIRT={D:'#8a5a33',d:'#5e3a1e',k:'#3f2612',L:'#b07a45',G:'#3fa34d',l:'#7dd956',g:'#2a7a33'};
var ART_PLAT=['LLLLLLLL','WWWWWWWW','WNWWWWNW','WWWWWWWW','wWWWWWWw','DDDDDDDD','dddddddd','........'];
var ART_PLATP={L:'#d29a5b',W:'#a06a35',w:'#c98d4e',N:'#3a2a18',D:'#6e451f',d:'#4a2d12'};
var ART_SPIKE=['........','M.M.M.M.','M.M.M.M.','MM.MM.MM','MMmMMmMM','MMMMMMMM','DDDDDDDD','dddddddd'];
var ART_SPIKEP={M:'#dfe5f2',m:'#9aa3b2',D:'#565d6b',d:'#333842'};
var ART_COINA=['..YYYY..','.YYYYYY.','YYWWYYYY','YWYYDYYY','YWYYDYYY','YYYYYYYY','.YYYYYY.','..SSSS..'];
var ART_COINB=['........','...YY...','...WYD..','...WYD..','...WYD..','...WYD..','...YY...','...SS...'];
var ART_COINP={Y:'#f5b301',W:'#ffefa8',D:'#9a6200',S:'rgba(0,0,0,0.35)'};
var ART_SPAWN=['........','........','......G.','.GGGGGGG','.WWGGGGG','......G.','........','GGGGGGGG'];
var ART_SPAWNP={G:'#37d67a',W:'#d2ffe4'};
var ART_GOAL=['.PWBBWB.','.PWBWBB.','.PWBBWB.','.PWBWBB.','.P......','.P......','.P......','DDDDDDDD'];
var ART_GOALP={P:'#6e451f',W:'#f4f4f4',B:'#22222a',D:'#3f2612'};
var ART_DECO=['........','...FF...','...FF...','..FFFF..','...GG...','..GGGG..','.GgGGgG.','GGgGGgGG'];
var ART_DECOP={F:'#ff6b9d',G:'#3fa34d',g:'#2a7a33'};
function PX(map,pal,px,py,s){var c=s/8,w=Math.ceil(c*10)/10;for(var y=0;y<8;y++){var r=map[y];for(var x=0;x<8;x++){var ch=r.charAt(x);if(ch==='.')continue;var col=pal[ch];if(!col)continue;ctx.fillStyle=col;ctx.fillRect(px+x*c,py+y*c,w,w)}}}
function AHASH(x,y){var h=(x*374761393+y*668265263)|0;h=(h^(h>>13))|0;h=Math.imul(h,1274126177);h=(h^(h>>16))>>>0;return h}
function drawT(t,tx,ty,px,py){
 if(t===4){var b=Math.sin(time*4+(tx+ty)*0.7)*3;var f=Math.floor(time*5+tx*0.6+ty)%2;PX(f===0?ART_COINA:ART_COINB,ART_COINP,px,py+b,TS);return}
 if(t===5){ctx.fillStyle='rgba(92,255,138,'+(0.14+0.08*Math.sin(time*5)).toFixed(3)+')';ctx.fillRect(px,py,TS,TS);PX(ART_SPAWN,ART_SPAWNP,px,py,TS);return}
 if(t===6){ctx.fillStyle='rgba(255,217,77,'+(0.1+0.06*Math.sin(time*4+ty)).toFixed(3)+')';ctx.fillRect(px,py,TS,TS);PX(ART_GOAL,ART_GOALP,px,py,TS);return}
 if(t===1){var gr=(ty===0||tiles[ty-1][tx]!==1);PX(gr?ART_G:ART_D,ART_DIRT,px,py,TS);var h=AHASH(tx,ty),c=TS/8,w=Math.ceil(c*10)/10,top=gr?4:0;for(var i=0;i<3;i++){var sx=(h>>(i*6))%8,sy=top+((h>>(i*6+3))%(8-top));if(sx<0)sx+=8;ctx.fillStyle=i===2?'#b07a45':'#5e3a1e';ctx.fillRect(px+sx*c,py+sy*c,w,w)}return}
 if(t===2){PX(ART_PLAT,ART_PLATP,px,py,TS);return}
 if(t===3){PX(ART_SPIKE,ART_SPIKEP,px,py,TS);return}
 if(t===7){PX(ART_DECO,ART_DECOP,px,py,TS);return}
}
function render(){
 var sky=ctx.createLinearGradient(0,0,0,540);sky.addColorStop(0,'#1b2340');sky.addColorStop(1,'#3d4d7d');ctx.fillStyle=sky;ctx.fillRect(0,0,960,540);
 ctx.save();ctx.translate(-Math.round(camX),-Math.round(camY));
 var x0=Math.max(0,Math.floor(camX/TS)-1),y0=Math.max(0,Math.floor(camY/TS)-1),x1=Math.min(W-1,Math.ceil((camX+960)/TS)+1),y1=Math.min(H-1,Math.ceil((camY+540)/TS)+1);
 for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){var t=tiles[y][x];if(t!==0)drawT(t,x,y,x*TS,y*TS)}
 shots.forEach(function(s){ctx.fillStyle='#ffb14d';ctx.beginPath();ctx.arc(s.x+5,s.y+5,6,0,7);ctx.fill();ctx.fillStyle='#fff3c4';ctx.beginPath();ctx.arc(s.x+5,s.y+5,3,0,7);ctx.fill()});
 enemies.forEach(function(e){if(e.dead)return;ctx.save();if(e.hurt>0&&Math.floor(time*16)%2===0)ctx.globalAlpha=0.4;ctx.translate(e.x+e.w/2,e.y+e.h);ctx.scale(e.dir>=0?1:-1,1);drawSprite(e.type.pixels,-16,-32,32,32);ctx.restore()});
 if(!player.dead){ctx.save();if(player.hurt>0&&Math.floor(time*16)%2===0)ctx.globalAlpha=0.45;ctx.translate(player.x+12,player.y+28);ctx.scale(player.face>=0?1:-1,1);drawSprite(P.player.pixels,-16,-32,32,32);ctx.restore()}
 parts.forEach(function(p){ctx.globalAlpha=Math.max(0,1-p.life/p.max);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.s,p.s)});ctx.globalAlpha=1;ctx.restore();
 ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(10,10,150,52);ctx.fillStyle='#fff';ctx.font='bold 14px system-ui';ctx.fillText('coins '+coins+'/'+totalCoins,22,32);
 for(var i=0;i<P.player.maxHp;i++){ctx.fillText(i<player.hp?'❤':'🖤',22+i*22,54)}
 if(status==='won'){ctx.fillStyle='rgba(10,20,10,0.6)';ctx.fillRect(0,0,960,540);ctx.fillStyle='#5cff8a';ctx.font='bold 42px system-ui';ctx.textAlign='center';ctx.fillText('YOU WIN!',480,260);ctx.fillStyle='#fff';ctx.font='16px system-ui';ctx.fillText('Press R to play again',480,290);ctx.textAlign='left'}
 else if(status==='dead'){ctx.fillStyle='rgba(30,8,8,0.6)';ctx.fillRect(0,0,960,540);ctx.fillStyle='#ff6b6b';ctx.font='bold 42px system-ui';ctx.textAlign='center';ctx.fillText('GAME OVER',480,260);ctx.fillStyle='#fff';ctx.font='16px system-ui';ctx.fillText('Press R to retry',480,290);ctx.textAlign='left'}
}
function restart(){var f=findSpawn();tiles=level.tiles.map(function(r){return r.slice()});totalCoins=0;tiles.forEach(function(r){r.forEach(function(t){if(t===4)totalCoins++})});player={x:f.x,y:f.y-4,w:24,h:28,vx:0,vy:0,ground:false,hp:P.player.maxHp,coyote:0,buf:0,dj:P.player.doubleJump?1:0,face:1,hurt:0,anim:0,dead:false,won:false};enemies=level.enemies.map(function(p,i){var d=defs[p.typeId]||P.enemyTypes[0];return{id:i,type:d,x:p.tx*TS,y:p.ty*TS,w:28,h:28,vx:0,vy:0,ground:false,hp:d.hp,dir:1,scd:1,jcd:1,hurt:0,dead:false,anim:0}});shots=[];parts=[];coins=0;time=0;status='playing';camX=0;camY=0}
window.addEventListener('keydown',function(e){if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=true;if(e.code==='ArrowRight'||e.code==='KeyD')input.right=true;if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){if(!input.jump)input.jp=true;input.jump=true}if(e.code==='KeyR')restart();if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(e.code)>=0)e.preventDefault()});
window.addEventListener('keyup',function(e){if(e.code==='ArrowLeft'||e.code==='KeyA')input.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')input.right=false;if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')input.jump=false});
function bind(id,down,up){var b=document.getElementById(id);var on=function(e){e.preventDefault();down()};var off=function(e){e.preventDefault();up()};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off)}
bind('btnL',function(){input.left=true},function(){input.left=false});
bind('btnR',function(){input.right=true},function(){input.right=false});
bind('btnJ',function(){if(!input.jump)input.jp=true;input.jump=true},function(){input.jump=false});
var last=0,acc=0;function frame(t){var now=t/1000,dt=now-(last||now);last=now;if(dt>0.25)dt=0.25;acc+=dt;while(acc>=1/60){update(1/60);acc-=1/60}render();requestAnimationFrame(frame)}
requestAnimationFrame(frame);
})();
`;
