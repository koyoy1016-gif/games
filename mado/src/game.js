(()=>{
const $=id=>document.getElementById(id);
const T=window.THREE,K=window.MadoCore;
if(!T||!K){$('loading').textContent='3Dの読み込みに失敗しました。再読み込みしてください。';return}
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- constants ---------- */
const C=K.C,RX0=C.RX0,RX1=C.RX1,RZ0=C.RZ0,RZ1=C.RZ1,FRONT=C.FRONT,BACK=C.BACK,HALFZ=C.HALFZ;
const EDGE=50.35,GROUND=-42,STAND_Y=.92;
const SEAT=new T.Vector3(-.55,.67,0);
const WAX=K.WAX;
const QS=new URLSearchParams(location.search),DEBUG=QS.has('debug');
const pick=a=>a[Math.floor(Math.random()*a.length)];
const chance=p=>Math.random()<p;
const rnd=(a,b)=>a+Math.random()*(b-a);
const LINES={
  start:['窓際で のんびりしたい…','今日こそ窓際へ…','席替えか…窓が遠いなあ','窓の外の空が見たいなあ…','今日はどんなフロアかな…','窓際…それは男のロマン','後ろに引いて…離す。\n基本は大事だ'],
  tutorial:'後ろに引っ張って、離すと前へ！\nパチンコの要領だ…',
  bigPull:['ぐぬぬ…','引きすぎ注意…！','い、いけるか…？','窓ガラスが見える…'],
  chill:['ここが一番落ち着くわ〜','今日は空を眺める仕事だな…','窓際、最高…','もう一歩も動かないぞ','ここから見る雲、最高…','窓際こそ我が人生'],
  work:['今日も頑張って働くぞ〜！\nコピー取ってきます！','今日も頑張って働くぞ〜！\n資料、全部やります！','今日も頑張って働くぞ〜！\n（窓際が遠い…）','は、はい…\n議事録やります…','（明日こそ窓際へ…）'],
  crash:['あ〜れ〜〜！！','窓がぁぁぁ！','やりすぎたぁぁ！','空が近いぃぃ！'],
  landed:['た、助かった…\n…会社に戻らなきゃ','植え込みが\nふかふかで良かった…','12階から…\nよく生きてたな…'],
  bump:['うわっ！','ちょっと！','コーヒーが…！','またあの人か…','危ないなぁ'],
  pass:['おっ','速っ','今日も攻めますね','窓際狙いか…'],
  clap:['おお〜','ナイス窓際！','うらやましい…','さすが先輩'],
  senkyaku:['ようこそ、こちら側へ','あなたも窓際を\n目指して…？','ここも景色\nいいですよ','今月3回目です','始末書、一緒に\n書きましょう','ここが本当の\n窓の外ですよ'],
  squash:['ぐえっ','重っ…','上に落ちないで…']
};
const BOSSES={
  kacho:{name:'課長',hair:'short',hairC:'#1b1b20',suit:'#25314a',tie:'#7a1f2b',speed:2.6,scale:1,
    yell:['もっと働け！！','窓際はまだ早い！！','資料まだか！！','会議の時間だ！！'],
    report:['窓際とは何事だ。','明日も早く来るように。','まずは日報をちゃんと書け。']},
  bucho:{name:'部長',hair:'gray',hairC:'#a2a4aa',suit:'#3b3d44',tie:'#24497a',speed:2.0,scale:1.04,
    yell:['君ィ、窓際は\nまだ早いよ','その資料、\n今日中にね','席に戻りたまえ！'],
    report:['若いうちは真ん中で働きなさい。','窓際は定年してからだ。','わしも昔は窓際を目指したものだ。']},
  shacho:{name:'社長',hair:'white',hairC:'#ecebe6',suit:'#1a1a1f',tie:'#c9a227',speed:1.6,scale:1.1,
    yell:['わが社に窓際など\n存在しない！！','君の名は？\n…まあいい、働け！'],
    report:['社長賞…ではないな。','窓の外より売上を見なさい。']}
};
const WEATHER={
  sunny:{name:'晴れ',bg:'#a6d2ec',fog:'#bfdcef',near:70,far:260,hemi:.78,hemiC:'#ffffff',sun:.72,sunC:'#ffffff'},
  sunset:{name:'夕焼け',bg:'#f2a877',fog:'#f0b88f',near:60,far:240,hemi:.72,hemiC:'#ffe2c4',sun:.8,sunC:'#ffc58a'},
  rain:{name:'雨',bg:'#8a97a6',fog:'#95a2b0',near:30,far:170,hemi:.7,hemiC:'#e8eef5',sun:.35,sunC:'#dde6f0'},
  night:{name:'残業（夜）',bg:'#141d33',fog:'#1a2540',near:50,far:240,hemi:.62,hemiC:'#dfe8ff',sun:.3,sunC:'#b8c8ff'}
};

/* ---------- renderer ---------- */
const stage=$('stage');
const renderer=new T.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.domElement.className='gl';
stage.insertBefore(renderer.domElement,stage.firstChild);
const scene=new T.Scene();
scene.background=new T.Color('#a6d2ec');
scene.fog=new T.Fog('#bfdcef',70,260);
const camera=new T.PerspectiveCamera(48,1,.5,600);
let W=1,H=1;
function resize(){const r=stage.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);resize();

const hemi=new T.HemisphereLight(0xffffff,0x7d837a,.78);scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,.72);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:80});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;
scene.add(sun);scene.add(sun.target);

/* ---------- helpers ---------- */
const mc={};
function mat(c){return mc[c]||(mc[c]=new T.MeshLambertMaterial({color:c}))}
function box(w,h,d,m,x,y,z,parent,cast){const o=new T.Mesh(new T.BoxGeometry(w,h,d),typeof m==='string'?mat(m):m);o.position.set(x,y,z);o.receiveShadow=true;if(cast)o.castShadow=true;(parent||scene).add(o);return o}
function cyl(rt,rb,h,c,x,y,z,parent,cast,seg=14){const o=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),mat(c));o.position.set(x,y,z);o.receiveShadow=true;if(cast)o.castShadow=true;(parent||scene).add(o);return o}
function sph(r,c,x,y,z,parent,cast){const o=new T.Mesh(new T.SphereGeometry(r,16,12),mat(c));o.position.set(x,y,z);if(cast)o.castShadow=true;(parent||scene).add(o);return o}
function ctex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');fn(g,w,h);const t=new T.CanvasTexture(c);t.anisotropy=4;t.userData={g,c};return t}
const FB='"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic",sans-serif',FD='"Dela Gothic One","Hiragino Sans",sans-serif',FG='"DotGothic16",monospace';
function ownMat(o){o.material.userData.own=true;return o}
function decal(w,h,tex,x,y,z,ry=0,parent){const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshLambertMaterial({map:tex,transparent:true}));o.position.set(x,y,z);o.rotation.y=ry;(parent||scene).add(o);return ownMat(o)}
const FLOOR_Q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(1,0,0),new T.Vector3(0,1,0)));
function floorDecal(w,h,tex,x,z,y=.02,off=-4,parent,opacity=1){const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshLambertMaterial({map:tex,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:off,polygonOffsetUnits:off}));o.quaternion.copy(FLOOR_Q);o.position.set(x,y,z);o.receiveShadow=true;(parent||scene).add(o);return ownMat(o)}
function textTex(lines,{w=256,h=128,bg=null,fg='#1c283d',font=FB,size=40,weight='700',align='center'}={}){
  return ctex(w,h,(g)=>{if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h)}g.fillStyle=fg;g.textAlign=align;g.textBaseline='middle';
    const ls=Array.isArray(lines)?lines:[lines];ls.forEach((l,i)=>{const s=l.size||size;g.font=`${l.weight||weight} ${s}px ${l.font||font}`;g.fillStyle=l.fg||fg;g.fillText(l.t||l,l.x!=null?l.x:w/2,l.y!=null?l.y:h/2+(i-(ls.length-1)/2)*s*1.25)})});
}
function clearGroup(g){
  g.traverse(o=>{
    if(o.isMesh||o.isPoints||o.isLineSegments){
      if(o.geometry&&!o.userData.shared)o.geometry.dispose();
      const ms=Array.isArray(o.material)?o.material:[o.material];
      for(const m of ms)if(m&&m.userData&&m.userData.own){if(m.map)m.map.dispose();m.dispose()}
    }
  });
  while(g.children.length)g.remove(g.children[0]);
}

/* ---------- the room (固定部分) ---------- */
const WALL='#dbe2dc',CAP='#c3cbc5';
{
  const carpet=ctex(256,256,(g)=>{for(let i=0;i<4;i++)for(let j=0;j<4;j++){g.fillStyle=(i+j)%2?'#5f6d84':'#677590';g.fillRect(i*64,j*64,64,64);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(i*64,j*64,64,1.5);g.fillRect(i*64,j*64,1.5,64)}
    for(let n=0;n<900;n++){g.fillStyle=`rgba(255,255,255,${Math.random()*.06})`;g.fillRect(Math.random()*256,Math.random()*256,2,2)}});
  carpet.wrapS=carpet.wrapT=T.RepeatWrapping;carpet.repeat.set(28,8);
  const floor=new T.Mesh(new T.PlaneGeometry(56,16),new T.MeshLambertMaterial({map:carpet}));floor.rotation.x=-Math.PI/2;floor.position.set(22,0,0);floor.receiveShadow=true;scene.add(floor);
  box(56.35,.4,16,'#7a8088',22.175,-.23,0);
  const fac=ctex(128,112,(g)=>{g.fillStyle='#8e959d';g.fillRect(0,0,128,112);g.fillStyle='#5c7690';g.fillRect(14,26,100,60);g.fillStyle='rgba(255,255,255,.16)';g.fillRect(20,30,10,52);g.fillStyle='#7c838b';g.fillRect(0,0,128,6)});
  fac.wrapS=fac.wrapT=T.RepeatWrapping;fac.repeat.set(14,12);
  const bld=new T.Mesh(new T.BoxGeometry(56.35,41.6,16),new T.MeshLambertMaterial({map:fac}));bld.position.set(22.175,-.4-20.8,0);scene.add(bld);
  box(46,2.8,.2,WALL,17,1.4,-8.1);
  box(10,.85,.2,WALL,45,.425,-8.1);box(10,.35,.2,WALL,45,2.625,-8.1);
  const glassFar=new T.Mesh(new T.PlaneGeometry(10,1.6),new T.MeshLambertMaterial({color:'#9fd0ee',transparent:true,opacity:.35,depthWrite:false}));glassFar.position.set(45,1.65,-8.05);scene.add(glassFar);
  for(const x of [40,42.5,45,47.5,50])box(.08,1.6,.22,'#c9d0d6',x,1.65,-8.1);
  box(10,.42,.04,'#e8ebee',45,2.24,-7.98);
  box(56,.1,.03,'#5f666e',22,.05,-7.99);box(46,.04,.03,'#bcc5be',17,.8,-7.99);
  box(56,.9,.2,WALL,22,.45,8.1);box(56,.04,.28,CAP,22,.92,8.1);
  box(.2,.9,16,WALL,-6.1,.45,0);box(.28,.04,16,CAP,-6.1,.92,0);
  box(.22,2.8,.22,WALL,-6.1,1.4,-8.1);
  box(.16,.08,16,'#c9d0d6',50.06,.04,0);box(.16,.08,16,'#c9d0d6',50.06,2.76,0);
  for(let z=-8;z<=8;z+=2)box(.12,2.8,.1,'#c9d0d6',50.06,1.4,z,null,true);
  box(.45,.08,16.2,'#b9c0c6',50.55,-.06,0); // 外側の窓台（鳩がとまる）
}
const glassMat=new T.MeshLambertMaterial({color:'#9fd0ee',transparent:true,opacity:.32,side:T.DoubleSide,depthWrite:false});
const glassPanels=[];
for(let i=0;i<8;i++){const p=new T.Mesh(new T.PlaneGeometry(2,2.72),glassMat);p.rotation.y=-Math.PI/2;p.position.set(50.04,1.4,-7+2*i);scene.add(p);glassPanels.push(p)}

// floor markings
{
  const lineMat=new T.MeshLambertMaterial({color:'#ffffff',transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  for(const m of [10,20,30,40]){const l=new T.Mesh(new T.PlaneGeometry(.08,16),lineMat);l.rotation.x=-Math.PI/2;l.position.set(m,.015,0);scene.add(l);
    const t=textTex(`${m}m`,{w:256,h:128,bg:'rgba(245,245,238,.92)',font:FG,size:64,weight:'400'});floorDecal(1.5,.75,t,m-.9,6.6);floorDecal(1.5,.75,t,m-.9,-6.6)}
  const hz=ctex(128,128,(g)=>{g.fillStyle='#f2c230';g.fillRect(0,0,128,128);g.fillStyle='#1f1f22';for(let i=-2;i<4;i++){g.beginPath();g.moveTo(i*48,0);g.lineTo(i*48+24,0);g.lineTo(i*48+152,128);g.lineTo(i*48+128,128);g.fill()}});
  hz.wrapS=hz.wrapT=T.RepeatWrapping;hz.repeat.set(1,8);
  const hzm=new T.Mesh(new T.PlaneGeometry(2,16),new T.MeshLambertMaterial({map:hz,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));hzm.rotation.x=-Math.PI/2;hzm.position.set(49,.012,0);hzm.receiveShadow=true;scene.add(hzm);
  floorDecal(1.6,.55,textTex('ギリギリゾーン',{w:320,h:110,bg:'#1c283d',fg:'#f2c230',size:42}),49,0,.03,-6);
  const w50=textTex('窓 50m',{w:256,h:128,bg:'#c4322a',fg:'#fff',font:FG,size:56,weight:'400'});floorDecal(1.4,.7,w50,47.4,6.6);floorDecal(1.4,.7,w50,47.4,-6.6);
}

// wall decor on the far wall (faces +z)
let clockTex;
function drawClock(){const g=clockTex.userData.g;g.clearRect(0,0,256,256);g.fillStyle='#3a4049';g.beginPath();g.arc(128,128,124,0,7);g.fill();g.fillStyle='#fdfdfb';g.beginPath();g.arc(128,128,108,0,7);g.fill();
  g.strokeStyle='#3a4049';for(let i=0;i<12;i++){const a=i/12*Math.PI*2;g.lineWidth=i%3?3:7;g.beginPath();g.moveTo(128+Math.sin(a)*88,128-Math.cos(a)*88);g.lineTo(128+Math.sin(a)*102,128-Math.cos(a)*102);g.stroke()}
  const n=new Date(),hA=((n.getHours()%12)+n.getMinutes()/60)/12*Math.PI*2,mA=n.getMinutes()/60*Math.PI*2;g.lineCap='round';
  g.lineWidth=9;g.beginPath();g.moveTo(128,128);g.lineTo(128+Math.sin(hA)*55,128-Math.cos(hA)*55);g.stroke();
  g.lineWidth=6;g.beginPath();g.moveTo(128,128);g.lineTo(128+Math.sin(mA)*84,128-Math.cos(mA)*84);g.stroke();clockTex.needsUpdate=true}
{
  const Z=-7.97;
  box(1.1,2.1,.06,'#aab3ba',-3.2,1.05,-7.98);box(1,2.0,.02,'#bec6cc',-3.2,1.05,-7.95);sph(.04,'#59606a',-2.8,1.0,-7.92);
  decal(.6,.22,textTex('総務部',{w:240,h:88,bg:'#2b3a55',fg:'#fff',size:40}),-3.2,1.85,-7.93);
  clockTex=ctex(256,256,()=>{});drawClock();setInterval(drawClock,30000);decal(.46,.46,clockTex,-1.2,2.25,Z);
  decal(3.2,1.25,ctex(640,250,(g)=>{g.fillStyle='#a7afb7';g.fillRect(0,0,640,250);g.fillStyle='#fbfcfc';g.fillRect(10,10,620,230);
    g.fillStyle='#24324a';g.font=`700 34px ${FB}`;g.fillText('本日の予定',34,56);g.font=`400 26px ${FB}`;g.fillStyle='#2d4e8a';
    g.fillText('9:00　朝礼',44,110);g.fillText('13:00　定例会議（長め）',44,152);g.fillStyle='#b8322a';g.fillText('15:00　席替え ※窓際は抽選',44,194)}),1.8,1.6,Z);
  box(2.9,.05,.08,'#8c949c',1.8,.95,-7.92);
  decal(.75,.95,ctex(150,190,(g)=>{g.fillStyle='#f8f8f2';g.fillRect(0,0,150,190);g.fillStyle='#2f8a4b';g.fillRect(0,0,150,40);g.fillRect(60,60,30,80);g.fillRect(35,85,80,30);
    g.font=`700 24px ${FB}`;g.textAlign='center';g.fillText('安全第一',75,170);g.fillStyle='#fff';g.font=`400 18px ${FG}`;g.fillText('SAFETY',75,22)}),4.6,1.6,Z);
  const drw=ctex(128,256,(g)=>{g.fillStyle='#a5aeb7';g.fillRect(0,0,128,256);for(let d=0;d<4;d++){const y=6+d*62;g.fillStyle='#b6bec6';g.fillRect(6,y,116,56);g.fillStyle='#59616a';g.fillRect(44,y+40,40,6);g.fillStyle='#f3f3ee';g.fillRect(48,y+12,32,14)}});
  const cabM=[mat('#a5aeb7'),mat('#a5aeb7'),mat('#a5aeb7'),mat('#a5aeb7'),new T.MeshLambertMaterial({map:drw}),mat('#a5aeb7')];
  for(let i=0;i<3;i++)box(.82,1.8,.55,cabM,6.95+i*.84,.9,-7.72,null,true);
  box(1.2,1.0,.75,'#e2e4e1',10.9,.5,-7.6,null,true);box(1.2,.12,.75,'#c4c8c5',10.9,1.06,-7.6);box(.5,.05,.3,'#3b4350',11.2,1.14,-7.4);
  for(let d=0;d<3;d++)box(1.1,.02,.02,'#9aa0a6',10.9,.25+d*.25,-7.22);
  decal(.36,.2,textTex(['紙づまり',{t:'中',size:28,y:76}],{w:180,h:100,bg:'#f6e27a',fg:'#5a4a10',size:30}),10.6,.82,-7.21);
  decal(.8,.85,ctex(160,170,(g)=>{g.fillStyle='#fbfbf8';g.fillRect(0,0,160,170);g.fillStyle='#c4322a';g.fillRect(0,0,160,40);g.fillStyle='#fff';g.font=`400 26px ${FD}`;g.textAlign='center';g.fillText(`${new Date().getMonth()+1}月`,80,30);
    g.fillStyle='#9aa0a6';for(let r=0;r<5;r++)for(let c=0;c<7;c++)g.fillRect(12+c*20,54+r*22,12,12)}),13.2,1.9,Z);
  box(.5,1.05,.45,'#f2f4f4',24.25,.52,-7.75,null,true);const bt=cyl(.17,.17,.4,'#8cc8eb',24.25,1.25,-7.75);bt.material=new T.MeshLambertMaterial({color:'#8cc8eb',transparent:true,opacity:.8});
  decal(3,1.25,ctex(600,250,(g)=>{g.fillStyle='#8b6a45';g.fillRect(0,0,600,250);g.fillStyle='#c99f6b';g.fillRect(12,12,576,226);
    g.fillStyle='#fbfbf6';g.fillRect(40,30,280,190);g.fillStyle='#24324a';g.textAlign='center';g.font=`700 24px ${FB}`;g.fillText('今月の目標',180,70);
    g.fillStyle='#c4322a';g.font=`400 34px ${FD}`;g.fillText('定時退社の徹底',180,130);g.fillStyle='#59606c';g.font=`400 18px ${FB}`;g.fillText('（窓際での昼寝禁止）',180,180);
    g.fillStyle='#fff6b0';g.fillRect(360,50,190,140);g.fillStyle='#3d3a2a';g.font=`700 24px ${FB}`;g.fillText('窓の外を',455,105);g.fillText('見すぎない',455,145)}),27.5,1.6,Z);
  decal(1.15,.78,ctex(230,156,(g)=>{g.fillStyle='#1f1f22';g.fillRect(0,0,230,156);g.fillStyle='#f2c230';g.fillRect(8,8,214,140);g.fillStyle='#1f1f22';g.textAlign='center';
    g.font=`400 46px ${FD}`;g.fillText('注意',115,68);g.font=`700 24px ${FB}`;g.fillText('この先 窓際',115,118)}),37,1.55,Z);
}
function plant(x,z,parent){cyl(.22,.17,.45,'#eceeec',x,.225,z,parent,true);const lg='#4a8a45';
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,l=new T.Mesh(new T.SphereGeometry(.12,10,8),mat(i%2?lg:'#3b7337'));l.scale.set(.7,2.4,.7);l.position.set(x+Math.cos(a)*.12,.8,z+Math.sin(a)*.12);l.rotation.set(Math.sin(a)*.5,0,-Math.cos(a)*.5);l.castShadow=true;(parent||scene).add(l)}}
plant(48.1,-7.6);plant(30.3,7.6);plant(-5.4,7.4);

// outside: ground, hedge, city
const buildings=[];
{
  const gnd=new T.Mesh(new T.PlaneGeometry(900,900),mat('#8c9a85'));gnd.rotation.x=-Math.PI/2;gnd.position.set(40,GROUND-.02,0);gnd.receiveShadow=true;scene.add(gnd);
  box(900,.04,14,'#4a4e55',40,GROUND,-30);box(900,.04,14,'#4a4e55',82,GROUND,0).rotation.y=Math.PI/2;
  box(30,.3,48,'#b8b3a8',58,GROUND+.13,0);
  box(18,.8,28,'#3f7a3b',59.2,GROUND+.5,0,null,false);
  {const bush=new T.InstancedMesh(new T.SphereGeometry(.55,10,8),mat('#47863f'),500),mm=new T.Matrix4();let n=0;
   for(let x=50.8;x<68;x+=.9)for(let z=-13;z<14;z+=1.2){if(n>=500)break;mm.makeTranslation(x+(Math.round(z/1.2)%2)*.4,GROUND+.95,z);bush.setMatrixAt(n++,mm)}
   bush.count=n;bush.receiveShadow=true;scene.add(bush)}
  let s=11;const r=()=>((s=(s*16807)%2147483647)/2147483647);
  const cols=['#8ea4ba','#a7b6c4','#b9c2c9','#7f93a8','#c4cdd4'];
  const win=ctex(64,64,(g)=>{g.fillStyle='#fff';g.fillRect(0,0,64,64);g.fillStyle='#c8d4de';for(let y=6;y<64;y+=14)g.fillRect(4,y,56,6)});win.wrapS=win.wrapT=T.RepeatWrapping;
  for(let i=0;i<90;i++){const x=-120+r()*360,z=-170+r()*340;if(x>-20&&x<95&&z>-40&&z<40)continue;
    const w=8+r()*16,d=8+r()*16,h=18+r()*85;const t=win.clone();t.needsUpdate=true;t.repeat.set(Math.max(1,w/4),h/4);
    const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:cols[i%5],map:t}));m.position.set(x,GROUND+h/2,z);scene.add(m);buildings.push({x,z,w,d,h,m})}
}
// 夜景の窓明かり
const cityLights=(()=>{const pts=[];
  for(const b of buildings){const n=Math.floor(b.h/3);for(let i=0;i<n;i++){if(Math.random()<.45)continue;const y=GROUND+2+Math.random()*(b.h-4);const f=Math.floor(Math.random()*4);
    if(f===0)pts.push(b.x-b.w/2-.1,y,b.z+(Math.random()-.5)*b.w*.9);else if(f===1)pts.push(b.x+b.w/2+.1,y,b.z+(Math.random()-.5)*b.d*.9);
    else if(f===2)pts.push(b.x+(Math.random()-.5)*b.w*.9,y,b.z-b.d/2-.1);else pts.push(b.x+(Math.random()-.5)*b.w*.9,y,b.z+b.d/2+.1)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  const p=new T.Points(g,new T.PointsMaterial({color:'#ffd98a',size:1.1,sizeAttenuation:true,fog:false}));p.visible=false;scene.add(p);return p})();
// 雨
const rain=(()=>{const N=1400,pos=new Float32Array(N*6);
  for(let i=0;i<N;i++){const x=rnd(-10,110),y=rnd(GROUND,30),z=rnd(-45,45);pos.set([x,y,z,x-.05,y+.7,z],i*6)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
  const l=new T.LineSegments(g,new T.LineBasicMaterial({color:'#dfe9f5',transparent:true,opacity:.5}));l.visible=false;l.frustumCulled=false;scene.add(l);return l})();
function updateRain(dt){if(!rain.visible)return;const a=rain.geometry.attributes.position,p=a.array;
  for(let i=0;i<p.length;i+=6){let y=p[i+1]-34*dt;const inside=p[i]<50.3&&p[i]>-6.3&&p[i+2]>-8.3&&p[i+2]<8.3&&y<3.2;if(y<GROUND||inside)y=rnd(5,30);p[i+1]=y;p[i+4]=y+.7}a.needsUpdate=true}

/* ---------- the desk cart ---------- */
const cart=new T.Group();scene.add(cart);
{
  box(1.75,.08,1.6,'#4b525c',-.225,.1,0,cart,true);box(1.75,.015,1.6,'#6b737e',-.225,.145,0,cart);
  for(const x of [-1.0,.55])for(const z of [-.7,.7]){const w=cyl(.05,.05,.04,'#23272d',x,.05,z,cart,false,10);w.rotation.x=Math.PI/2}
  box(.46,.07,.46,'#39404c',-.55,.565,0,cart,true);cyl(.03,.03,.34,'#5a606a',-.55,.36,0,cart);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,l=box(.26,.025,.04,'#2b2f36',-.55+Math.cos(a)*.13,.2,Math.sin(a)*.13,cart);l.rotation.y=-a}
  const back=box(.07,.58,.44,'#39404c',-.83,.96,0,cart,true);back.rotation.z=-.08;box(.06,.3,.05,'#2b2f36',-.8,.66,0,cart);
  box(.76,.04,1.22,'#d4d8db',.225,.86,0,cart,true);box(.76,.012,1.22,'#99a1aa',.225,.835,0,cart);
  box(.7,.69,.03,'#a3aab2',.225,.49,-.58,cart,true);box(.64,.69,.26,'#b1b8c0',.24,.49,.45,cart,true);
  for(const y of [.32,.55,.75])box(.02,.03,.12,'#59616a',-.09,y,.45,cart);
  box(.03,.5,1.1,'#a3aab2',.58,.6,0,cart);
  box(.14,.02,.44,'#e8ebed',.02,.89,0,cart);
  box(.18,.015,.18,'#2b3038',.45,.888,0,cart);box(.03,.12,.03,'#2b3038',.45,.95,0,cart);
  box(.05,.34,.54,'#2f3540',.46,1.16,0,cart,true);
  const scr=new T.Mesh(new T.PlaneGeometry(.48,.28),new T.MeshBasicMaterial({color:'#a7d8ff'}));scr.rotation.y=-Math.PI/2;scr.position.set(.432,1.16,0);cart.add(scr);
  cyl(.04,.04,.1,'#f4f2ec',.22,.93,-.44,cart,true);cyl(.041,.041,.02,'#c4322a',.22,.93,-.44,cart);
  box(.22,.05,.3,'#fbfbf6',.3,.905,.38,cart,true);
}
function cartClone(parent){const c=cart.clone();c.traverse(o=>{o.userData.shared=true});(parent||scene).add(c);return c}

/* ---------- people ---------- */
function capsule(r,len,c){const m=new T.Mesh(new T.CapsuleGeometry(r,len,4,10),mat(c));m.castShadow=true;return m}
const SHIRTS=['#f5f5f0','#dfe9f5','#f3e7d6','#e6f0e0','#f0dfe4'],SUITS=['#2b3346','#3b3d44','#46392f','#283c3a'],TIES=['#b8433b','#2f5d9a','#3d7a4a','#7b4a8a','#c98a2a'];
function makePerson(kind,o={},parent){
  const boss=kind==='boss';
  const P={kind,boss,skin:o.skin||(boss?'#eac3a0':'#f2cba7'),face:'',hair:o.hair||(boss?'short':'bald'),hairC:o.hairC||(boss?'#1b1b20':'#8a847e'),
    glasses:o.glasses!=null?o.glasses:!boss,mustache:o.mustache!=null?o.mustache:!boss};
  const root=new T.Group();P.root=root;
  const shirt=o.shirt||(boss?'#25314a':'#f5f5f0'),pants=o.pants||(boss?'#1d2638':'#4b515d');
  const pel=new T.Mesh(new T.BoxGeometry(.3,.14,.36),mat(pants));root.add(pel);
  const tor=capsule(boss?.17:.18,boss?.32:.24,shirt);tor.position.y=boss?.4:.36;tor.scale.set(boss?.95:1.05,1,1.22);root.add(tor);
  if(!boss){const b=new T.Mesh(new T.SphereGeometry(.18,16,12),mat(shirt));b.position.set(.07,.22,0);b.scale.set(1,.9,1.15);b.castShadow=true;root.add(b)}
  else{const v=new T.Mesh(new T.BoxGeometry(.02,.24,.12),mat('#f5f5f0'));v.position.set(.163,.55,0);root.add(v)}
  const tie=new T.Mesh(new T.BoxGeometry(.025,.3,.06),mat(o.tie||(boss?'#7a1f2b':'#b8433b')));tie.position.set(boss?.172:.215,boss?.5:.38,0);tie.rotation.z=boss?0:.35;root.add(tie);
  const neck=new T.Mesh(new T.CylinderGeometry(.06,.065,.12,10),mat(P.skin));neck.position.y=boss?.68:.62;root.add(neck);
  const head=new T.Group();head.position.y=boss?.87:.81;root.add(head);P.head=head;
  P.tex=ctex(512,256,()=>{});
  const hm=new T.Mesh(new T.SphereGeometry(.17,36,24),new T.MeshLambertMaterial({map:P.tex}));hm.material.userData.own=true;hm.castShadow=true;head.add(hm);
  for(const s of [-1,1]){const e=new T.Mesh(new T.SphereGeometry(.04,10,8),mat(P.skin));e.position.set(-.01,0,.165*s);e.scale.set(.6,1,.6);head.add(e)}
  const sY=boss?.6:.55;
  const arm=(side)=>{const sh=new T.Group();sh.position.set(0,sY,.23*side);root.add(sh);
    const ua=capsule(.055,.2,shirt);ua.position.y=-.14;sh.add(ua);
    const el=new T.Group();el.position.y=-.29;sh.add(el);
    const fa=capsule(.045,.18,boss?shirt:P.skin);fa.position.y=-.12;el.add(fa);
    const hd=new T.Mesh(new T.SphereGeometry(.05,10,8),mat(P.skin));hd.position.y=-.27;el.add(hd);return[sh,el]};
  [P.shR,P.elR]=arm(1);[P.shL,P.elL]=arm(-1);
  const leg=(side)=>{const hp=new T.Group();hp.position.set(0,-.02,.1*side);root.add(hp);
    const th=capsule(.075,.28,pants);th.position.y=-.21;hp.add(th);
    const kn=new T.Group();kn.position.y=-.42;hp.add(kn);
    const sh=capsule(.062,.3,pants);sh.position.y=-.2;kn.add(sh);
    const so=new T.Mesh(new T.BoxGeometry(.24,.08,.11),mat('#1c1c20'));so.position.set(.05,-.44,0);so.castShadow=true;kn.add(so);return[hp,kn]};
  [P.hipR,P.kneeR]=leg(1);[P.hipL,P.kneeL]=leg(-1);
  if(o.scale)root.scale.setScalar(o.scale);
  (parent||scene).add(root);setFace(P,o.face||(boss?'angry':'normal'));return P;
}
function randomWorker(parent,face){
  const bald=chance(.5);
  return makePerson('oji',{shirt:pick(SHIRTS),tie:pick(TIES),pants:pick(SUITS),hair:bald?'bald':pick(['short','short','gray']),
    hairC:bald?pick(['#8a847e','#6d6862','#a19a92']):null,glasses:chance(.6),mustache:chance(.4),skin:pick(['#f2cba7','#eac3a0','#f5d4b5','#e3b892']),face},parent);
}

function setFace(P,f){
  if(P.face===f)return;P.face=f;
  const g=P.tex.userData.g,boss=P.boss;
  g.fillStyle=P.skin;g.fillRect(0,0,512,256);
  if(P.hair!=='bald'){const hc=P.hair==='gray'?(P.hairC||'#a2a4aa'):P.hair==='white'?(P.hairC||'#ecebe6'):(P.hairC||'#1b1b20');
    g.fillStyle=hc;g.fillRect(0,0,512,92);g.fillRect(0,92,156,62);g.fillRect(356,92,156,62);
    g.beginPath();g.moveTo(160,90);g.quadraticCurveTo(220,116,300,96);g.quadraticCurveTo(330,88,352,92);g.lineTo(352,80);g.lineTo(160,80);g.fill()}
  else{const hc=P.hairC||'#8a847e';g.fillStyle=hc;g.fillRect(0,110,165,56);g.fillRect(347,110,165,56);
    g.strokeStyle=hc;g.lineWidth=3;g.lineCap='round';for(let i=0;i<3;i++){g.beginPath();g.moveTo(200,34+i*10);g.quadraticCurveTo(256,24+i*10,312,34+i*10);g.stroke()}
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(276,62,24,7,-.2,0,7);g.fill()}
  const cx=256,ey=124,ink='#2a2622';
  const red=(f==='happy'||f==='resolve'||(boss&&f==='yell'));
  g.fillStyle=red?'rgba(232,105,100,.42)':'rgba(232,130,120,.2)';
  for(const s of [-1,1]){g.beginPath();g.ellipse(cx+s*42,ey+18,11,6,0,0,7);g.fill()}
  let dIn=0,dOut=0;
  if(f==='whoa'||f==='shock'){dIn=-7;dOut=-6}else if(f==='sweat'||f==='sad'){dIn=-7;dOut=4}else if(f==='resolve'||(boss&&f!=='happy')){dIn=6;dOut=-6}else if(f==='happy'){dIn=-3;dOut=-1}
  g.strokeStyle=P.hair==='short'?'#1b1b20':'#5d5650';g.lineWidth=boss?7:4.5;g.lineCap='round';
  for(const s of [-1,1]){g.beginPath();g.moveTo(cx+s*46,ey-24+dOut);g.lineTo(cx+s*12,ey-24+dIn);g.stroke()}
  for(const s of [-1,1]){const x=cx+s*27;
    if(f==='whoa'){g.fillStyle='#fff';g.beginPath();g.arc(x,ey,9,0,7);g.fill();g.fillStyle=ink;g.beginPath();g.arc(x,ey+1,4,0,7);g.fill()}
    else if(f==='shock'){g.fillStyle='#fff';g.beginPath();g.arc(x,ey,11,0,7);g.fill();g.fillStyle=ink;g.beginPath();g.arc(x,ey,2.5,0,7);g.fill()}
    else if(f==='happy'){g.strokeStyle=ink;g.lineWidth=3.5;g.beginPath();g.arc(x,ey+4,7,Math.PI*1.12,Math.PI*1.88);g.stroke()}
    else if(f==='sleep'){g.strokeStyle=ink;g.lineWidth=3.5;g.beginPath();g.moveTo(x-7,ey+2);g.lineTo(x+7,ey+2);g.stroke()}
    else{g.fillStyle=ink;g.beginPath();g.arc(x,ey+(f==='sad'?4:0),4.5,0,7);g.fill()}}
  if(P.glasses){g.strokeStyle='#2b2724';g.lineWidth=3.5;for(const s of [-1,1]){g.beginPath();g.arc(cx+s*27,ey-1,16,0,7);g.stroke()}
    g.beginPath();g.moveTo(cx-11,ey-3);g.lineTo(cx+11,ey-3);g.moveTo(cx-43,ey-3);g.lineTo(cx-70,ey);g.moveTo(cx+43,ey-3);g.lineTo(cx+70,ey);g.stroke()}
  g.fillStyle=boss?'#d9a982':'#dfab86';g.beginPath();g.ellipse(cx,ey+13,7,6,0,0,7);g.fill();
  if(P.mustache){g.fillStyle='#4d4743';g.beginPath();g.moveTo(cx-26,ey+29);g.quadraticCurveTo(cx-13,ey+16,cx,ey+22);g.quadraticCurveTo(cx+13,ey+16,cx+26,ey+29);g.quadraticCurveTo(cx,ey+26,cx-26,ey+29);g.fill()}
  const my=ey+36,mc='#6a3a31';g.strokeStyle=mc;g.lineWidth=3;
  if(boss&&f!=='happy'){if(f==='yell'){g.fillStyle='#4a1d1d';g.beginPath();g.ellipse(cx,my-4,17,13,0,0,7);g.fill();g.fillStyle='#fff';g.fillRect(cx-11,my-16,22,5)}
    else{g.beginPath();g.arc(cx,my+8,10,Math.PI*1.2,Math.PI*1.8);g.stroke()}
    if(f==='yell'){g.strokeStyle='#d9332b';g.lineWidth=4;const ax=cx+52,ay=ey-48;for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;g.beginPath();g.arc(ax+Math.cos(a)*12,ay+Math.sin(a)*12,8,a+Math.PI*.75,a+Math.PI*1.25);g.stroke()}}}
  else if(f==='happy'){g.beginPath();g.arc(cx,my-5,10,.25*Math.PI,.75*Math.PI);g.stroke()}
  else if(f==='whoa'){g.fillStyle='#55261f';g.beginPath();g.ellipse(cx,my,6,7,0,0,7);g.fill()}
  else if(f==='shock'){g.fillStyle='#55261f';g.beginPath();g.ellipse(cx,my+2,10,11,0,0,7);g.fill()}
  else if(f==='resolve'){g.fillStyle='#55261f';g.beginPath();g.moveTo(cx-13,my-3);g.lineTo(cx+13,my-3);g.quadraticCurveTo(cx+11,my+11,cx,my+11);g.quadraticCurveTo(cx-11,my+11,cx-13,my-3);g.fill()}
  else if(f==='sad'){g.beginPath();g.arc(cx,my+8,9,Math.PI*1.2,Math.PI*1.8);g.stroke()}
  else if(f==='sweat'){g.beginPath();g.moveTo(cx-10,my);g.lineTo(cx-5,my-3);g.lineTo(cx,my);g.lineTo(cx+5,my-3);g.lineTo(cx+10,my);g.stroke()}
  else{g.beginPath();g.moveTo(cx-7,my);g.lineTo(cx+7,my);g.stroke()}
  const drop=(x,y,s)=>{g.fillStyle='#7cc3f0';g.beginPath();g.moveTo(x,y-s);g.quadraticCurveTo(x+s*.85,y+s*.35,x,y+s*.65);g.quadraticCurveTo(x-s*.85,y+s*.35,x,y-s);g.fill()};
  if(f==='sweat'||f==='shock'){drop(cx+62,ey-22,10);drop(cx+70,ey+8,7)}
  if(f==='resolve'){drop(cx-34,ey+12,6);drop(cx+34,ey+12,6)}
  if(f==='sad'){g.strokeStyle='rgba(90,110,160,.6)';g.lineWidth=2.5;for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(cx+i*15,ey-60);g.lineTo(cx+i*15,ey-42);g.stroke()}}
  P.tex.needsUpdate=true;
}

const SEATED={type:1,fasttype:1,grip:1,relax:1,flail:1,sitidle:1};
function pose(P,name,t){
  const s=Math.sin;let hR=0,hL=0,kR=0,kL=0,sRz=.06,sLz=.06,sRx=-.06,sLx=.06,eR=.12,eL=.12,lean=0;
  if(SEATED[name]){hR=hL=Math.PI/2;kR=kL=-Math.PI/2}
  if(name==='type'){sRz=sLz=.7;eR=.8+s(t*13)*.1;eL=.8+s(t*13+1.5)*.1}
  else if(name==='fasttype'){sRz=sLz=.75;eR=.8+s(t*32)*.18;eL=.8+s(t*32+1.5)*.18;lean=-.08}
  else if(name==='grip'){sRz=sLz=1.0;eR=eL=.45;lean=-.1}
  else if(name==='relax'){sRz=sLz=-2.6;sRx=-.45;sLx=.45;eR=eL=-2.0;lean=.18}
  else if(name==='sitidle'){sRz=sLz=.3;eR=eL=.5;lean=.05}
  else if(name==='flail'){sRz=Math.PI+s(t*16)*.5;sLz=Math.PI+s(t*16+2)*.5;sRx=-.5;sLx=.5;eR=eL=.3;hR=Math.PI/2+s(t*14)*.35;hL=Math.PI/2-s(t*14)*.35}
  else if(name==='walk'){hR=s(t)*.5;hL=-s(t)*.5;kR=-Math.max(0,-s(t))*.9;kL=-Math.max(0,s(t))*.9;sRz=-s(t)*.45;sLz=s(t)*.45;eR=eL=.35}
  else if(name==='point'){sRz=1.55;sRx=-.05;eR=0;sLz=.15;sLx=.55;eL=.3}
  else if(name==='wave'){sRz=.3;sRx=-2.6+s(t*8)*.35;eR=.4;sLz=.1}
  else if(name==='cheer'){sRz=sLz=.2;sRx=-2.8+s(t*10)*.15;sLx=2.8-s(t*10)*.15;eR=eL=.1}
  else if(name==='photo'){sRz=sLz=1.3;sRx=-.25;sLx=.25;eR=eL=1.2}
  else if(name==='clap'){sRz=sLz=1.0;sRx=-.35-s(t*18)*.25;sLx=.35+s(t*18)*.25;eR=eL=.9;hR=hL=Math.PI/2;kR=kL=-Math.PI/2}
  else if(name==='lie'){sRz=Math.PI*.9;sLz=Math.PI*.85;sRx=-.4;sLx=.4;eR=eL=.2;hR=.1;hL=-.1}
  P.hipR.rotation.z=hR;P.hipL.rotation.z=hL;P.kneeR.rotation.z=kR;P.kneeL.rotation.z=kL;
  P.shR.rotation.set(sRx,0,sRz);P.shL.rotation.set(sLx,0,sLz);P.elR.rotation.z=eR;P.elL.rotation.z=eL;P.lean=lean;
}
function blendSit(P,k){
  P.hipR.rotation.z=P.hipL.rotation.z=k*Math.PI/2;P.kneeR.rotation.z=P.kneeL.rotation.z=-k*Math.PI/2;
  P.shR.rotation.set(-.06,0,.06+k*.64);P.shL.rotation.set(.06,0,.06+k*.64);P.elR.rotation.z=P.elL.rotation.z=.12+k*.68;P.lean=0}

const oji=makePerson('oji');
let boss=makePerson('boss');boss.root.visible=false;

/* rope (slingshot band) + forward guide */
const ropeMat=new T.MeshLambertMaterial({color:'#c9a46a'});
const bands=[0,1].map(()=>{const m=new T.Mesh(new T.CylinderGeometry(.035,.035,1,8),ropeMat);m.castShadow=true;scene.add(m);return m});
const handle=new T.Mesh(new T.SphereGeometry(.17,16,12),mat('#f2c230'));scene.add(handle);
const aimRing=new T.Mesh(new T.RingGeometry(.2,.3,24),new T.MeshBasicMaterial({color:'#f2c230',transparent:true,opacity:.7,side:T.DoubleSide}));aimRing.rotation.x=-Math.PI/2;scene.add(aimRing);
const guideMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85,depthWrite:false});
const guide=[];for(let i=0;i<14;i++){const d=new T.Mesh(new T.CircleGeometry(.12,14),guideMat.clone());d.rotation.x=-Math.PI/2;scene.add(d);guide.push(d)}
const arrowHead=new T.Mesh(new T.ConeGeometry(.28,.6,3),mat('#f2c230'));scene.add(arrowHead);
function aimVisible(v){for(const b of bands)b.visible=v;handle.visible=aimRing.visible=arrowHead.visible=v;for(const d of guide)d.visible=v}
aimVisible(false);

/* shards */
const shardGeo=new T.BufferGeometry();shardGeo.setAttribute('position',new T.Float32BufferAttribute([0,.08,0,.07,-.05,0,-.06,-.04,0],3));shardGeo.computeVertexNormals();
const shardMat=new T.MeshBasicMaterial({color:'#c4e6fa',side:T.DoubleSide,transparent:true,opacity:.9});
const paperGeo=new T.PlaneGeometry(.21,.28);const paperMat=new T.MeshLambertMaterial({color:'#fbfbf6',side:T.DoubleSide});

/* ---------- state ---------- */
let best=0,bestStreak=0;try{best=parseFloat(localStorage.getItem('madogiwa3d.best'))||0;bestStreak=parseInt(localStorage.getItem('madogiwa3d.streak'))||0}catch(e){}
const phy={x:0,z:0,vx:0,vz:0,broke:false,hitObj:null};
const st={mode:'ready',t:0,timer:0,day:1,sheets:0,streak:0,wax:WAX[1],stage:null,fx:null,
  y:0,vy:0,pitch:0,fell:false,acc:0,bounced:false,land:null,
  aim:{sx:0,sy:0,dir:new T.Vector2(1,0),power:0,said:false},lastPower:0,
  view:'follow',intro:0,said:false,walk:null,sit:null,shards:[],papers:[],stopX:0,shake:0,paperT:0};
const camPos=new T.Vector3(-8,9,2),camLook=new T.Vector3(3,0,0);

/* ---------- UI: bubbles & pops ---------- */
oji.bub={el:$('bOji'),t:0,dur:0};boss.bub={el:$('bBoss'),t:0,dur:0};
const speakers=new Set(),ownBubbles=new Set();
function say(P,text,dur){if(!P)return;let b=P.bub;
  if(!b){const el=document.createElement('div');el.className='bubble npc';el.hidden=true;stage.appendChild(el);b=P.bub={el,t:0,dur:0,own:true};ownBubbles.add(P)}
  b.el.textContent=text;b.el.hidden=false;b.t=0;b.dur=dur;speakers.add(P)}
function hush(){for(const P of speakers){P.bub.el.hidden=true;P.bub.dur=0}speakers.clear()}
function dropBubble(P){if(P.bub){if(P.bub.own)P.bub.el.remove();else P.bub.el.hidden=true}speakers.delete(P)}
const tmpV=new T.Vector3();
function toScreen(v){tmpV.copy(v).project(camera);return{x:(tmpV.x+1)/2*W,y:(1-tmpV.y)/2*H,ok:tmpV.z<1&&tmpV.x>-1.2&&tmpV.x<1.2&&tmpV.y>-1.2&&tmpV.y<1.2}}
function popText(text,world,cls=''){const s=toScreen(world);if(!s.ok)return;const d=document.createElement('div');d.className='pop '+cls;d.textContent=text;
  d.style.left=Math.max(60,Math.min(W-60,s.x))+'px';d.style.top=Math.max(30,s.y)+'px';stage.appendChild(d);setTimeout(()=>d.remove(),900)}
function notice(lines){const old=stage.querySelector('.notice');if(old)old.remove();if(!lines.length)return;
  const d=document.createElement('div');d.className='notice';d.innerHTML='<b>社内放送</b>'+lines.map(l=>l.replace(/[<>&]/g,'')).join('<br>');stage.appendChild(d);setTimeout(()=>d.remove(),5400)}
function confetti(n=46){if(RM)return;const cols=['#f2c230','#c4322a','#a9dbff','#7bd389','#ffffff','#ff9f6b'];
  for(let i=0;i<n;i++){const d=document.createElement('i');d.className='confetti';d.style.left=rnd(0,W)+'px';d.style.background=pick(cols);
    d.style.setProperty('--dx',rnd(-60,60)+'px');d.style.setProperty('--h',H+'px');d.style.setProperty('--r',rnd(-720,720)+'deg');d.style.animationDelay=rnd(0,.5)+'s';d.style.animationDuration=rnd(1.6,2.6)+'s';
    stage.appendChild(d);setTimeout(()=>d.remove(),3400)}}

/* =====================================================================
 * ステージ（毎日ランダム配置）— 生成とクリア判定は MadoCore
 * ===================================================================== */
const stageG=new T.Group();scene.add(stageG);
let coworkers=[];
function deskIsland(o,g){
  // ローカル: 長辺 x、奥行き z（縦置きは group を回転）
  const vert=o.vert,L=vert?o.z1-o.z0:o.x1-o.x0,D=vert?o.x1-o.x0:o.z1-o.z0,dd=D-.7;
  const grp=new T.Group();grp.position.set((o.x0+o.x1)/2,0,(o.z0+o.z1)/2);if(vert)grp.rotation.y=Math.PI/2;g.add(grp);
  box(L,.04,dd,'#c3c8cd',0,.72,0,grp,true);
  for(const sx of [-L/2+.05,L/2-.05])box(.05,.7,dd,'#9aa2ab',sx,.35,0,grp);
  box(L,.35,.03,'#9aa7b5',0,.92,0,grp);
  const n=o.desks||Math.floor(L/1.5);
  for(let i=0;i<n;i++){const x=-L/2+.75+i*1.5;
    for(const s of [-1,1]){const mz=s*.25;box(.5,.32,.04,'#2f3540',x,.98,mz,grp,true);box(.44,.27,.01,'#9fd3f5',x,.98,mz+s*.022,grp);
      const cz=s*(dd/2+.25),ry=s>0?Math.PI/2:-Math.PI/2;
      const seatRand=((i*7+(s>0?3:0))*9301+Math.floor((o.people||0)*1000))%100/100;
      if(seatRand<(o.people||0)*.55){
        const P=randomWorker(grp);P.root.position.set(x,.58,cz);P.root.rotation.y=ry;pose(P,'type',Math.random()*9);P.seatY=.58;
        P.ph=Math.random()*9;P.island=o;P.passed=false;coworkers.push(P);
        chairMesh(x,cz,ry,grp,true);
      }else{chairMesh(x,cz,ry,grp);
        if((i+(s>0?1:0))%3===0)box(.46,.45,.08,'#26324a',x,.75,s*(dd/2+.5),grp)}}
    if(i===1)box(.25,.2,.25,'#f6e27a',x+.4,.84,.6,grp);
    if(i===n-1&&o.people>.5)cyl(.04,.04,.1,'#f4f2ec',x-.3,.79,-.5,grp)}
}
function chairMesh(x,z,ry,parent,occupied){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;(parent||scene).add(g);
  box(.45,.07,.45,'#39404c',0,.47,0,g,true);cyl(.03,.03,.3,'#5a606a',0,.3,0,g);box(.5,.03,.05,'#2b2f36',0,.12,0,g);box(.05,.03,.5,'#2b2f36',0,.12,0,g);box(.06,.5,.42,'#39404c',-.28,.78,0,g,true)}
function buildObstacle(o,g){
  const cx=(o.x0+o.x1)/2,cz=(o.z0+o.z1)/2,w=o.x1-o.x0,d=o.z1-o.z0;
  if(o.kind==='island')deskIsland(o,g);
  else if(o.kind==='pillar'){box(w,2.8,d,'#c9cdc9',cx,1.4,cz,g,true);box(w+.06,.12,d+.06,'#9aa2ab',cx,.06,cz,g);
    if(o.v>.5)decal(.42,.3,textTex(['消火器',{t:'↓',size:40,y:90}],{w:140,h:110,bg:'#c4322a',fg:'#fff',size:30}),cx-w/2-.01,1.5,cz,-Math.PI/2,g)}
  else if(o.kind==='plant')plant(cx,cz,g);
  else if(o.kind==='copier'){box(w,1.0,d,'#e2e4e1',cx,.5,cz,g,true);box(w,.12,d,'#c4c8c5',cx,1.06,cz,g);box(w*.4,.05,d*.4,'#3b4350',cx+w*.2,1.14,cz,g);
    decal(.4,.22,textTex('故障中',{w:180,h:100,bg:'#f6e27a',fg:'#5a4a10',size:36}),cx-w/2-.01,.82,cz,-Math.PI/2,g)}
  else if(o.kind==='meeting'){const r=Math.min(w,d)/2-.35;cyl(r,r,.05,'#d8c7a8',cx,.74,cz,g,true,24);cyl(.08,.08,.7,'#7d838b',cx,.37,cz,g);
    for(let k=0;k<4;k++){const a=k*Math.PI/2+.4;chairMesh(cx+Math.cos(a)*(r+.25),cz+Math.sin(a)*(r+.25),-a+Math.PI,g)}
    box(.3,.02,.22,'#fbfbf6',cx+.1,.78,cz-.1,g);cyl(.05,.05,.1,'#f4f2ec',cx-.2,.82,cz+.15,g)}
  else if(o.kind==='boxes'){const nx=Math.max(1,Math.round(w/.5)),nz=Math.max(1,Math.round(d/.5));
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const lv=1+((i*3+j*5+Math.floor(o.v*10))%3===0?1:0)+(((i+j)%4===1)?1:0);
      for(let k=0;k<lv;k++){const b=box(w/nx-.04,.48,d/nz-.04,boxMat,o.x0+(i+.5)*w/nx,.24+k*.49,o.z0+(j+.5)*d/nz,g,true);b.rotation.y=(Math.random()-.5)*.12}}}
  else if(o.kind==='shelf'){box(w,1.1,d,cabMat,cx,.55,cz,g,true);box(w+.04,.04,d+.04,'#8c949c',cx,1.12,cz,g);
    const n=Math.floor(Math.max(w,d)/.12);for(let k=0;k<n;k+=1){if(k%5===4)continue;const t=(k+.5)/n-.5;const c=['#2f5d9a','#c4322a','#3d7a4a','#f2c230','#59616a'][k%5];
      if(w>d)box(.09,.32,d*.7,c,cx+t*w,1.3,cz,g);else box(w*.7,.32,.09,c,cx,1.3,cz+t*d,g)}}
  else if(o.kind==='partition'){box(w,1.55,d,'#7f8ea6',cx,.85,cz,g,true);box(w+.03,.06,d+.03,'#c9d0d6',cx,1.65,cz,g);
    const long=Math.max(w,d);for(let k=-1;k<=1;k+=2){if(w>d)box(.06,.06,.5,'#59616a',cx+k*long*.4,.03,cz,g);else box(.5,.06,.06,'#59616a',cx,.03,cz+k*long*.4,g)}
    for(let k=0;k<3;k++){const t=(Math.random()-.5)*long*.7,y=1.0+Math.random()*.4,c=pick(['#f6e27a','#ffb3c1','#a9dbff']);
      if(w>d)box(.12,.12,d+.02,c,cx+t,y,cz,g);else box(w+.02,.12,.12,c,cx,y,cz+t,g)}}
}
const boxTex=ctex(128,128,(g)=>{g.fillStyle='#c79a63';g.fillRect(0,0,128,128);g.fillStyle='#b88a52';g.fillRect(0,56,128,16);g.fillStyle='#5a4320';g.font=`700 18px ${FB}`;g.textAlign='center';g.fillText('ワレモノ',64,110);g.strokeStyle='rgba(0,0,0,.15)';g.strokeRect(1,1,126,126)});
const boxMat=new T.MeshLambertMaterial({map:boxTex});
const cabMat=new T.MeshLambertMaterial({color:'#a5aeb7'});
const waxTex=ctex(256,256,(g)=>{g.fillStyle='rgba(190,230,255,.0)';g.fillRect(0,0,256,256);for(let i=0;i<14;i++){g.strokeStyle=`rgba(255,255,255,${.12+Math.random()*.2})`;g.lineWidth=2+Math.random()*5;g.beginPath();const x=Math.random()*256;g.moveTo(x,0);g.lineTo(x+60,256);g.stroke()}});
waxTex.wrapS=waxTex.wrapT=T.RepeatWrapping;
const matTex=ctex(128,128,(g)=>{g.fillStyle='#5b3b33';g.fillRect(0,0,128,128);g.fillStyle='rgba(0,0,0,.25)';for(let y=4;y<128;y+=10)for(let x=4;x<128;x+=10){g.beginPath();g.arc(x,y,2.4,0,7);g.fill()}});
matTex.wrapS=matTex.wrapT=T.RepeatWrapping;
function buildZone(q,g){
  const w=q.x1-q.x0,d=q.z1-q.z0,cx=(q.x0+q.x1)/2,cz=(q.z0+q.z1)/2;
  if(q.kind==='wax'){
    const m=new T.MeshPhongMaterial({color:'#bfe6ff',transparent:true,opacity:.38,shininess:120,specular:'#ffffff',depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});m.userData.own=true;
    const p=new T.Mesh(new T.PlaneGeometry(w,d),m);p.rotation.x=-Math.PI/2;p.position.set(cx,.018,cz);g.add(p);
    const t=waxTex.clone();t.needsUpdate=true;t.repeat.set(w/4,d/4);const m2=new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});m2.userData.own=true;
    const p2=new T.Mesh(new T.PlaneGeometry(w,d),m2);p2.rotation.x=-Math.PI/2;p2.position.set(cx,.02,cz);g.add(p2);
    floorDecal(Math.min(2.4,w*.8),.6,textTex('ワックス すべります',{w:400,h:100,bg:'rgba(28,40,61,.85)',fg:'#a9dbff',size:40}),cx,cz,.03,-6,g);
    for(const zz of [q.z0+.3,q.z1-.3]){if(zz<RZ0+.2||zz>RZ1-.2)continue;wetSign(q.x0+.3,zz,g)}
  }else{
    const t=matTex.clone();t.needsUpdate=true;t.repeat.set(w,d);const m=new T.MeshLambertMaterial({map:t,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});m.userData.own=true;
    const p=new T.Mesh(new T.PlaneGeometry(w,d),m);p.rotation.x=-Math.PI/2;p.position.set(cx,.02,cz);p.receiveShadow=true;g.add(p);
    floorDecal(Math.min(2.4,w*.85),.55,textTex('すべり止めマット',{w:400,h:100,bg:'rgba(251,250,244,.9)',fg:'#5b3b33',size:40}),cx,cz,.035,-6,g);
  }
}
function wetSign(x,z,g){const s=new T.Group();s.position.set(x,0,z);g.add(s);
  const pan=textTex(['足元',{t:'注意',size:44,y:84}],{w:128,h:128,bg:'#f2c230',fg:'#1f1f22',size:34});
  for(const k of [-1,1]){const p=new T.Mesh(new T.PlaneGeometry(.32,.5),new T.MeshLambertMaterial({map:pan,side:T.DoubleSide}));p.material.userData.own=true;p.position.set(k*.08,.25,0);p.rotation.set(0,-Math.PI/2,k*.3);s.add(p)}}

function applyStage(sd){
  clearGroup(stageG);coworkers=[];
  st.stage=sd;st.wax=WAX[sd.wax];
  for(const q of sd.zones)buildZone(q,stageG);
  for(const o of sd.obstacles)buildObstacle(o,stageG);
  $('hFloor').textContent=sd.themeName;$('hStars').textContent='★'.repeat(sd.stars)+'☆'.repeat(5-sd.stars);
}

/* ---------- stage building (Web Worker で先読み) ---------- */
let worker=null,wid=0;const pending={};
try{
  const src=document.getElementById('mado-core').textContent+'\n;onmessage=function(e){var d=e.data;postMessage({id:d.id,stage:self.MadoCore.build(d.seed,d.diff)})};';
  worker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
  worker.onmessage=e=>{const p=pending[e.data.id];if(p){delete pending[e.data.id];p(e.data.stage)}};
  worker.onerror=()=>{worker=null;for(const k in pending){const p=pending[k];delete pending[k];p(null)}};
}catch(e){worker=null}
function requestStage(seed,diff){return new Promise(res=>{
  const done=s=>res(s||K.build(seed,diff));
  if(!worker){setTimeout(()=>done(null),30);return}
  const id=++wid;pending[id]=done;worker.postMessage({id,seed,diff});
  setTimeout(()=>{if(pending[id]){delete pending[id];done(null)}},8000);
})}
const newSeed=()=>(Math.random()*4294967296)>>>0;
let nextStage=null,nextReq=null;
function prefetch(){nextStage=null;const seed=newSeed(),diff=K.pickDiff(Math.random);const req=requestStage(seed,diff);nextReq=req;req.then(s=>{if(nextReq===req)nextStage=s})}
function takeStage(){const s=nextStage||K.build(newSeed(),K.pickDiff(Math.random));nextStage=null;nextReq=null;return s}

/* =====================================================================
 * ランダム演出（毎日変わる）
 * EVENTS に {id, w(確率), when(条件), setup(fx,g), ...} を足すだけで増やせる
 * ===================================================================== */
const fxG=new T.Group();scene.add(fxG);
const npcs=[];// {P, upd(dt,t)}
function npc(P,upd){npcs.push({P,upd});return P}
const EVENTS=[
  {id:'senkyaku',p:.45,label:n=>`先客 ${n}人`,setup(fx){ // 窓から落ちた先輩たちが植え込みに
    const n=1+Math.floor(Math.random()*4.2);fx.senkyaku=[];
    for(let i=0;i<n;i++){
      const x=rnd(52,60),z=rnd(-7.5,7.5),kind=pick(['lie','sitcart','wave','sitcart','lie','sleep']);
      const P=randomWorker(fxG,kind==='sleep'?'sleep':kind==='lie'?'sweat':'normal');
      if(kind==='lie'||kind==='sleep'){P.root.position.set(x,GROUND+1.35,z);P.root.rotation.set(0,rnd(0,6),Math.PI/2);pose(P,'lie',0);
        if(chance(.6)){const c=cartClone(fxG);c.position.set(x+rnd(-1.6,1.6),GROUND+.85,z+rnd(-1.6,1.6));c.rotation.set(rnd(-.3,.3),rnd(0,6),rnd(-.5,.5))}}
      else if(kind==='sitcart'){const c=cartClone(fxG);c.position.set(x,GROUND+.85,z);c.rotation.set(0,rnd(-.6,.6),-.08);c.updateMatrixWorld(true);
        P.root.position.copy(c.localToWorld(SEAT.clone()));P.root.rotation.copy(c.rotation);const typing=chance(.6);npc(P,(dt,t)=>pose(P,typing?'type':'sitidle',t+i))}
      else{P.root.position.set(x,GROUND+.95+STAND_Y-.3,z);P.root.rotation.y=Math.PI+rnd(-.4,.4);npc(P,(dt,t)=>pose(P,'wave',t+i))}
      fx.senkyaku.push(P);
    }
    fx.labels.push(this.label(n));
  }},
  {id:'drill',p:.2,setup(fx){ // 防災訓練：エアマット
    fx.drill=true;const g=new T.Group();fxG.add(g);
    box(12.6,1.4,18,'#f08a2c',57,GROUND+1.55,0,g,true);box(12.2,.08,17.6,'#f7b267',57,GROUND+2.27,0,g);
    for(let k=-3;k<=3;k++)box(12.62,.05,.08,'#c96a18',57,GROUND+1.7,k*2.5,g);
    decal(5,1,textTex('レスキューマット',{w:500,h:100,bg:'#c96a18',fg:'#fff',size:56,font:FD,weight:'400'}),50.69,GROUND+1.55,0,-Math.PI/2,g);
    for(let i=0;i<2;i++){const P=makePerson('oji',{shirt:'#2b3e7a',pants:'#2b3e7a',tie:'#c4322a',hair:'short',glasses:false,mustache:false},fxG);
      P.root.position.set(51.2+i*11,GROUND+.95+STAND_Y-.3,(i?-1:1)*rnd(9.6,10.6));P.root.rotation.y=Math.PI*(i?.5:-.5)+Math.PI;
      npc(P,(dt,t)=>pose(P,fx.drillCheer?'cheer':'stand',t))}
    fx.notices.push('本日は防災訓練です。ビル下にレスキューマットを設置しています。');fx.labels.push('防災訓練');
  }},
  {id:'gondola',p:.25,setup(fx){ // 窓拭きゴンドラ
    const g=new T.Group();fxG.add(g);const z=rnd(-5,5);g.position.set(0,-3,z);
    box(1.0,.1,3.2,'#9aa2ab',50.95,0,0,g,true);box(.05,.9,3.2,'#c9d0d6',51.43,.45,0,g);for(const zz of [-1.6,1.6])box(1.0,.9,.05,'#c9d0d6',50.95,.45,zz,g);
    box(1.0,.06,3.2,'#f2c230',50.95,.92,0,g);for(const zz of [-1.4,1.4])cyl(.012,.012,60,'#59616a',50.95,30.9,zz,g,false,4);
    decal(1.6,.4,textTex('窓清掃中',{w:320,h:80,bg:'#f2c230',fg:'#1f1f22',size:44}),51.47,.55,0,Math.PI/2,g);
    const P=makePerson('oji',{shirt:'#3d6fb0',pants:'#3d6fb0',tie:'#3d6fb0',hair:'short',hairC:'#2b2b2b',glasses:false,mustache:false},g);
    P.root.position.set(50.95,.1+STAND_Y,.4);P.root.rotation.y=Math.PI;
    const sq=box(.04,.04,.5,'#59616a',0,0,0,P.elR,false);sq.position.set(0,-.33,0);
    fx.gondola={g,P,z0:z,base:rnd(-5.5,-1.8),amp:rnd(.4,1.6)};
    npc(P,(dt,t)=>{if(fx.gondolaCaught)return;pose(P,'wave',t*.6);P.shR.rotation.set(-1.2+Math.sin(t*3)*.6,0,.4)});
    fx.notices.push('外窓清掃のゴンドラが稼働中です。');fx.labels.push('窓清掃ゴンドラ');
  }},
  {id:'pigeons',p:.4,setup(fx){
    fx.pigeons=[];const n=2+Math.floor(Math.random()*4);
    for(let i=0;i<n;i++){const g=new T.Group();fxG.add(g);g.position.set(50.6,-.02,rnd(-7,7));g.rotation.y=rnd(0,6);
      const body=sph(.12,'#8f96a3',0,.12,0,g,true);body.scale.set(1.4,1,1);sph(.07,'#6b7280',.15,.24,0,g);box(.05,.02,.03,'#e5a64b',.23,.23,0,g);
      const wl=box(.16,.02,.1,'#7a818d',0,.17,.11,g),wr=box(.16,.02,.1,'#7a818d',0,.17,-.11,g);
      fx.pigeons.push({g,wl,wr,fly:false,v:new T.Vector3(),ph:Math.random()*9})}
    fx.labels.push('鳩');
  }},
  {id:'crowd',p:.3,setup(fx){
    fx.crowd=[];const n=3+Math.floor(Math.random()*5);
    for(let i=0;i<n;i++){const P=randomWorker(fxG);const side=chance(.5)?1:-1;
      P.root.position.set(rnd(51.5,64),GROUND+.3+STAND_Y-.02,side*rnd(14.6,17.5));P.root.rotation.y=Math.atan2(side,-1)+rnd(-.3,.3);
      fx.crowd.push(P);npc(P,(dt,t)=>pose(P,fx.crashed?'photo':'stand',t))}
    fx.labels.push('野次馬');
  }},
  {id:'blimp',p:.12,setup(fx){
    const g=new T.Group();fxG.add(g);const body=sph(1,'#eef0f2',0,0,0,g);body.scale.set(9,3,3);
    for(const k of [-1,1]){const f=box(2,.1,1.6,'#c4322a',-8,0,k*1.2,g);f.rotation.x=k*.4}box(2.5,.7,.9,'#59616a',0,-3.1,0,g);
    const txt=pick(['窓際は最高','定時退社','始末書は計画的に','窓の外に夢がある','働き方改革']);
    const tt=textTex(txt,{w:512,h:128,bg:'#c4322a',fg:'#fff',size:64,font:FD,weight:'400'});
    for(const k of [-1,1]){const p=new T.Mesh(new T.PlaneGeometry(12,3),new T.MeshBasicMaterial({map:tt,side:T.DoubleSide,fog:false}));p.material.userData.own=true;p.position.set(0,-6.5,k*.05);g.add(p)}
    box(.05,3.4,.05,'#59616a',-5.8,-4.9,0,g);box(.05,3.4,.05,'#59616a',5.8,-4.9,0,g);
    g.position.set(150,18,-120);fx.blimp={g,s:rnd(4,7)};fx.labels.push('飛行船');
  }},
  {id:'papers',p:.35,setup(fx){fx.papers=true}},
  {id:'cat',p:.15,setup(fx){ // 窓際に先にくつろぐ猫
    const g=new T.Group();fxG.add(g);const z=rnd(-6.5,6.5);g.position.set(49.3,0,z);
    const b=sph(.22,'#e0a25a',0,.2,0,g,true);b.scale.set(1.5,.9,1);sph(.15,'#e0a25a',.3,.32,0,g,true);
    for(const k of [-1,1]){const e=new T.Mesh(new T.ConeGeometry(.05,.1,4),mat('#e0a25a'));e.position.set(.3,.48,k*.08);g.add(e)}
    const tail=box(.4,.06,.06,'#c98a45',-.4,.24,0,g);fx.cat={g,tail,z,ph:0};
    fx.labels.push('窓際の猫');
  }}
];
function rollDay(first){
  clearGroup(fxG);npcs.length=0;
  const fx={labels:[],notices:[],weather:'sunny',boss:'kacho'};
  const wr=Math.random();fx.weather=first?'sunny':wr<.45?'sunny':wr<.65?'sunset':wr<.85?'rain':'night';
  const br=Math.random();fx.boss=first||br<.6?'kacho':br<.9?'bucho':'shacho';
  // デバッグ用の強制指定: ?ev=drill,gondola&weather=rain&boss=shacho
  if(QS.get('weather')in WEATHER)fx.weather=QS.get('weather');if(QS.get('boss')in BOSSES)fx.boss=QS.get('boss');
  const forced=(QS.get('ev')||'').split(',').filter(Boolean);
  if(forced.length){for(const e of EVENTS)if(forced.includes(e.id))e.setup(fx)}
  else if(!first){
    let any=false;for(const e of EVENTS)if(chance(e.p)){e.setup(fx);any=true}
    if(!any)pick(EVENTS.slice(0,4)).setup(fx);
  }else EVENTS.find(e=>e.id==='pigeons').setup(fx);
  applyWeather(fx.weather);
  // 上司の差し替え
  const B=BOSSES[fx.boss];dropBubble(boss);const old=boss.root;old.parent.remove(old);clearGroup(old);
  boss=makePerson('boss',{hair:B.hair,hairC:B.hairC,shirt:B.suit,pants:B.suit,tie:B.tie,scale:B.scale});boss.root.visible=false;boss.bub={el:$('bBoss'),t:0,dur:0};boss.type=fx.boss;
  // 社内放送
  const th={wax:'本日は床のワックスがけを行っています。足元にご注意ください。',moving:'明日の引っ越しに向け、段ボールを仮置きしています。',maze:'情報セキュリティ強化のためパーテーションを増設しました。',
    remodel:'フロア模様替え中です。通路が変わっています。',meeting:'本日は会議が立て込んでいます。',remote:'本日は在宅勤務推奨日です。出社人数少なめ。',free:'フリーアドレス実施中。好きな席へどうぞ。',tidy:'整理整頓キャンペーン実施中。',usual:null}[st.stage.theme];
  const lines=[];if(th)lines.push(th);if(fx.weather==='night')lines.push('ノー残業デーは明日です。');if(fx.weather==='rain')lines.push('雨のため、傘立てが混み合っています。');
  if(fx.boss==='shacho')lines.push('本日、社長がフロアを視察されます。');else if(fx.boss==='bucho')lines.push('部長が巡回中です。');
  st.fx=fx;
  st.pendingNotice={lines:lines.concat(fx.notices).slice(0,2),at:first?3.4:.6};
}
function applyWeather(k){const w=WEATHER[k];
  scene.background.set(w.bg);scene.fog.color.set(w.fog);scene.fog.near=w.near;scene.fog.far=w.far;
  hemi.intensity=w.hemi;hemi.color.set(w.hemiC);sun.intensity=w.sun;sun.color.set(w.sunC);
  rain.visible=k==='rain';cityLights.visible=k==='night'||k==='sunset';cityLights.material.opacity=1;cityLights.material.size=k==='night'?1.1:.6;
  stage.style.background=w.bg;
}
function updateFx(dt){
  const fx=st.fx;if(!fx)return;
  for(const n of npcs)n.upd(dt,st.t);
  for(const P of coworkers){P.ph+=dt;if(!P.reacting)pose(P,st.mode==='chill'&&st.timer>.4?'clap':'type',P.ph);P.root.position.y=P.seatY}
  if(fx.gondola&&!fx.gondolaCaught){const G=fx.gondola;const ty=G.base+Math.sin(st.t*.35)*G.amp;G.g.position.y+=(ty-G.g.position.y)*Math.min(1,dt*2);
    const tz=Math.max(-6.4,Math.min(6.4,phy.z));G.g.position.z+=Math.sign(tz-G.g.position.z)*Math.min(Math.abs(tz-G.g.position.z),dt*.5)}
  if(fx.pigeons){const near=phy.x+FRONT>45||phy.broke;
    for(const p of fx.pigeons){p.ph+=dt;
      if(!p.fly&&near){p.fly=true;p.v.set(rnd(2,4),rnd(3,5),rnd(-2,2));p.g.rotation.y=Math.atan2(-p.v.z,p.v.x);if(chance(.5))popText('バサバサッ',p.g.position)}
      if(p.fly){p.v.y+=dt*.6;p.g.position.addScaledVector(p.v,dt);const f=Math.sin(p.ph*30)*.9;p.wl.rotation.x=f;p.wr.rotation.x=-f;if(p.g.position.y>40)p.g.visible=false}
      else p.g.children[1].position.y=.24+Math.max(0,Math.sin(p.ph*3))*.02}}
  if(fx.blimp){const b=fx.blimp.g;b.position.z+=fx.blimp.s*dt;if(b.position.z>140)b.position.z=-140}
  if(fx.cat){const c=fx.cat;c.ph+=dt;c.tail.rotation.y=Math.sin(c.ph*2)*.6;
    if(!c.ran&&Math.hypot(phy.x-c.g.position.x,phy.z-c.g.position.z)<3.2&&(phy.vx||phy.vz)){c.ran=true;popText('ニャッ！',c.g.position);c.vz=phy.z>c.g.position.z?-4:4}
    if(c.ran){c.g.position.z+=c.vz*dt;c.g.position.x-=dt*.8;c.g.rotation.y=c.vz>0?-Math.PI/2:Math.PI/2;if(Math.abs(c.g.position.z)>7.6){c.vz=0;c.g.position.z=Math.sign(c.g.position.z)*7.6}}}
}

/* ---------- placement ---------- */
const aimOff=new T.Vector3();
function placeCart(){cart.position.set(phy.x+aimOff.x,st.y,phy.z+aimOff.z);cart.rotation.set(0,0,st.pitch);cart.updateMatrixWorld(true)}
const qL=new T.Quaternion(),zAx=new T.Vector3(0,0,1);
function syncSeated(){
  oji.root.position.copy(cart.localToWorld(SEAT.clone()));
  qL.setFromAxisAngle(zAx,oji.lean||0);oji.root.quaternion.copy(cart.quaternion).multiply(qL);
}
function frontX(){return phy.x+FRONT}
function resetDay(sd,first){
  for(const P of ownBubbles)dropBubble(P);ownBubbles.clear();
  applyStage(sd);
  phy.x=sd.start.x;phy.z=sd.start.z;phy.vx=phy.vz=0;phy.broke=false;phy.hitObj=null;st.acc=0;
  st.y=0;st.vy=0;st.pitch=0;st.fell=false;st.land=null;st.bounced=false;aimOff.set(0,0,0);
  for(const g of glassPanels)g.visible=true;
  for(const s of st.shards)scene.remove(s.m);st.shards=[];for(const p of st.papers)scene.remove(p.m);st.papers=[];
  rollDay(first);
  boss.root.visible=false;placeCart();
  st.intro=RM?0:2.2;
  prefetch();
}

/* ---------- input: drag to pull (パチンコ式：引いた逆方向へ飛ぶ) ---------- */
const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),-.3),ndc=new T.Vector2();
function floorPt(cx,cy){const r=renderer.domElement.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);const o=new T.Vector3();return ray.ray.intersectPlane(plane,o)?o:null}
let dragId=null,dragStart=null;
const cvs=renderer.domElement;
cvs.addEventListener('pointerdown',e=>{
  if(st.mode!=='ready')return;e.preventDefault();st.intro=0;
  dragId=e.pointerId;try{cvs.setPointerCapture(e.pointerId)}catch(_){}
  st.aim.sx=e.clientX;st.aim.sy=e.clientY;st.aim.power=0;st.aim.said=false;dragStart=floorPt(e.clientX,e.clientY);
  st.mode='aiming';hush();
});
cvs.addEventListener('pointermove',e=>{
  if(st.mode!=='aiming'||e.pointerId!==dragId)return;
  const dx=e.clientX-st.aim.sx,dy=e.clientY-st.aim.sy,len=Math.hypot(dx,dy);
  st.aim.power=Math.min(1,len/(C.DRAG_FULL*Math.min(W,H)));
  const a=dragStart,b=floorPt(e.clientX,e.clientY);
  if(a&&b){const d=new T.Vector2(a.x-b.x,a.z-b.z);if(d.length()>.05)st.aim.dir.copy(d.normalize())}
});
function endDrag(e){
  if(st.mode!=='aiming'||(e&&e.pointerId!==dragId))return;dragId=null;
  if(st.aim.power<.05){st.mode='ready';aimOff.set(0,0,0);return}
  launch();
}
cvs.addEventListener('pointerup',endDrag);cvs.addEventListener('pointercancel',endDrag);
window.addEventListener('blur',()=>endDrag());
$('viewBtn').addEventListener('click',()=>{st.intro=0;st.view=st.view==='follow'?'overview':'follow';$('viewBtn').textContent=st.view==='follow'?'全体を見る':'おじさんを追う'});

function launch(){
  const sp=K.launchSpeed(st.aim.power,st.wax.f);st.lastPower=st.aim.power;
  phy.vx=st.aim.dir.x*sp;phy.vz=st.aim.dir.y*sp;st.acc=0;st.mode='sliding';
  aimOff.set(0,0,0);st.shake=.08;
  popText(pick(['バシュッ！','ビヨーン！','グイッ！']),cart.localToWorld(new T.Vector3(0,1.2,0)));
}

/* ---------- physics ---------- */
function onBump(speed,o){
  st.bounced=true;
  if(speed>3){st.shake=.15;popText('ドン！',cart.localToWorld(new T.Vector3(.3,1,0)))}
  if(o&&o.kind==='island'&&speed>2){const near=coworkers.filter(P=>P.island===o);if(near.length&&chance(.7)){const P=pick(near);say(P,pick(LINES.bump),1.6);reactCoworker(P)}}
  if(o&&o.kind==='boxes'&&speed>4)popText('ガラガラッ',cart.localToWorld(new T.Vector3(.6,1.4,0)));
}
function reactCoworker(P){P.reacting=true;setFace(P,'shock');pose(P,'grip',0);setTimeout(()=>{P.reacting=false;setFace(P,'normal')},1400)}
function crash(){
  phy.vx=Math.max(2.6,phy.vx*.7);st.shake=.5;
  const zc=phy.z;for(const g of glassPanels)if(Math.abs(g.position.z-zc)<2)g.visible=false;
  for(let i=0;i<40;i++){const m=new T.Mesh(shardGeo,shardMat);m.position.set(50.05,.1+Math.random()*2.6,zc+(Math.random()-.5)*3);scene.add(m);
    st.shards.push({m,v:new T.Vector3(1+Math.random()*4+phy.vx*.3,-1+Math.random()*3.5,(Math.random()-.5)*3),r:new T.Vector3(Math.random()*6-3,Math.random()*6-3,Math.random()*6-3)})}
  popText('ガシャーン！',new T.Vector3(50.2,2.2,zc),'glass');
  setFace(oji,'shock');say(oji,pick(LINES.crash),2.4);
  const fx=st.fx;fx.crashed=true;
  for(const P of coworkers)if(chance(.35)){setFace(P,'shock');say(P,pick(['あーあ…','窓が…！','またか…','始末書だな']),1.8);break}
  if(fx.crowd){for(const P of fx.crowd)setFace(P,'whoa');flashT=2.2}
  if(fx.gondola){say(fx.gondola.P,'うわっ！？',1.4);setFace(fx.gondola.P,'shock')}
  if(fx.drill)fx.drillCheer=true;
}
let flashT=0;
const flashes=[];
function updateFlashes(dt){
  if(flashT>0&&st.fx&&st.fx.crowd){flashT-=dt;if(Math.random()<dt*8){const P=pick(st.fx.crowd);P.head.getWorldPosition(tmpV);
    const f=new T.Mesh(new T.SphereGeometry(.22,8,6),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:1,fog:false}));f.position.copy(tmpV);f.position.y+=.05;scene.add(f);flashes.push({m:f,t:0});
    if(Math.random()<.3)popText('パシャッ',tmpV)}}
  for(const f of flashes){f.t+=dt;f.m.material.opacity=Math.max(0,1-f.t*6);f.m.scale.setScalar(1+f.t*6)}
  for(let i=flashes.length-1;i>=0;i--)if(flashes[i].t>.2){scene.remove(flashes[i].m);flashes[i].m.geometry.dispose();flashes[i].m.material.dispose();flashes.splice(i,1)}
}

/* ---------- flow ---------- */
function finishSlide(){
  st.timer=0;st.stopX=frontX();
  if(st.stopX>=C.ZONE){st.mode='chill';setFace(oji,'happy');say(oji,pick(LINES.chill),2.6);confetti();
    if(coworkers.length&&chance(.8)){const P=pick(coworkers);setTimeout(()=>{if(st.mode==='chill')say(P,pick(LINES.clap),1.6)},500)}
    if(st.fx.cat&&!st.fx.cat.ran)setTimeout(()=>popText('ニャー',st.fx.cat.g.position),900)}
  else{
    st.mode='boss';st.said=false;setFace(oji,'normal');
    const sp=bossSpawn();
    boss.root.visible=true;boss.root.position.set(sp[0],STAND_Y,sp[1]);setFace(boss,'angry');
    st.walk={who:boss,tx:phy.x-1.75,tz:phy.z-1.0,speed:BOSSES[boss.type].speed,ph:0};
  }
}
function segClear(x0,z0,x1,z1){const obs=K.STATIC.concat(st.stage.obstacles);
  for(let k=0;k<=20;k++){const x=x0+(x1-x0)*k/20,z=z0+(z1-z0)*k/20;if(x<RX0+.3||x>RX1-.5||z<RZ0+.3||z>RZ1-.3)return false;
    for(const o of obs)if(x>o.x0-.35&&x<o.x1+.35&&z>o.z0-.35&&z<o.z1+.35)return false}return true}
function bossSpawn(){const tx=phy.x-1.75,tz=phy.z-1.0;
  for(const r of [6.5,5,3.5])for(let a=0;a<12;a++){const ang=Math.PI+(a%2?1:-1)*Math.ceil(a/2)*.45;const x=tx+Math.cos(ang)*r,z=tz+Math.sin(ang)*r;if(segClear(x,z,tx,tz))return[x,z]}
  return[Math.max(RX0+.6,Math.min(RX1-1,phy.x-6.5)),Math.max(RZ0+.6,Math.min(RZ1-.6,phy.z-4.5))]}
function judge(x){
  const left=RX1-x;
  if(left<=.1)return{stamp:'神<br>窓際',title:'伝説の窓際社員',comment:pick(['窓ガラスまで鼻先ひとつ。上司も近寄れない、完璧な窓際です。','ガラスに息がかかる距離。もはや窓と一体化しています。'])};
  if(left<=.5)return{stamp:'窓際<br>認定',title:'立派な窓際社員',comment:pick(['ギリギリの好位置。今日の業務は外の景色を眺めることです。','絶妙な距離感。鳩とも目が合う特等席です。'])};
  if(left<=2)return{stamp:'窓際<br>見習',title:'窓際社員（見習い）',comment:pick(['窓際は確保。上司の巡回ルートからは外れました。もう少し攻められます。','窓際デビュー成功。次はもっとガラスに寄せましょう。'])};
  if(x<15)return{stamp:'要<br>指導',title:'ほぼ自席',comment:pick(['ほとんど動いていません。上司の目の前で、今日も一日がんばります。','引っ張りが足りません。60%前後を目安にしてみましょう。'])};
  if(x<35)return{stamp:'要<br>指導',title:'島のあたり',comment:pick(['フロアの真ん中は上司の通り道。仕事を山ほど振られました。','島の机で止まりました。壁で跳ね返すルートもありますよ。'])};
  if(x<45)return{stamp:'要<br>指導',title:'窓が遠い',comment:pick(['窓の景色はまだ遠く、上司の視界にしっかり入っています。','窓が見えてきた…けれど、ここはまだ会議室の延長線です。'])};
  return{stamp:'要<br>指導',title:'あと一歩',comment:pick(['窓際まであと少し。そこはまだ上司の巡回ルートでした。','惜しい！あと数十センチで窓際でした。'])};
}
function bizDate(n){const d=new Date();d.setHours(12);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1);let c=1;while(c<n){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)c++}return d}
function fmtDate(d){return`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`}
function showCard(){
  st.mode='result';hush();
  const x=st.stopX,j=judge(x);let nb=false;
  const win=x>=C.ZONE;st.streak=win?st.streak+1:0;
  if(x>best){best=x;nb=true}
  if(st.streak>bestStreak)bestStreak=st.streak;
  try{localStorage.setItem('madogiwa3d.best',String(best));localStorage.setItem('madogiwa3d.streak',String(bestStreak))}catch(e){}
  $('rDate').textContent=fmtDate(bizDate(st.day));$('rDay').textContent=`第${st.day}営業日`;
  $('rPos').textContent=`${x.toFixed(2)} m`;$('rLeft').textContent=`${(RX1-x).toFixed(2)} m`;
  $('rTitle').textContent=j.title;$('rComment').textContent=j.comment+(st.streak>1?`（${st.streak}日連続窓際！）`:'');$('stampText').innerHTML=j.stamp;
  $('rFloor').textContent=`${st.stage.themeName} ${'★'.repeat(st.stage.stars)}${'☆'.repeat(5-st.stage.stars)}・${WEATHER[st.fx.weather].name}`;
  const B=BOSSES[boss.type];
  $('rBoss').innerHTML=win?`<b>${B.name}</b>：「${pick(['…まあ、今日はいいだろう。','窓際か…うらやましい。','明日は真ん中で働けよ。'])}」`:`<b>${B.name}</b>：「${pick(B.report)}」`;
  $('rSeed').textContent=`フロアNo.${st.stage.seed} 力${Math.round(st.lastPower*100)}%`;
  const sp=$('stamp');sp.classList.remove('pop2');void sp.offsetWidth;sp.classList.add('pop2');
  $('rBest').hidden=!nb;$('overlay').hidden=false;setTimeout(()=>{try{$('again').focus()}catch(e){}},50);
}
function nextDay(){
  $('overlay').hidden=true;st.day++;
  resetDay(takeStage());st.mode='ready';setFace(oji,'normal');say(oji,pick(LINES.start),3);
}
$('again').addEventListener('click',nextDay);
window.addEventListener('keydown',e=>{if(!$('overlay').hidden&&(e.key==='Enter'||e.key===' ')){e.preventDefault();nextDay()}});

const COMMUTE={
  hedge:['植え込み','1F 受付','エレベーター','12F 総務部'],
  mat:['レスキューマット','救護テント','階段（12階分）','12F 総務部'],
  gondola:['ゴンドラ','屋上','非常階段','12F 総務部'],
  senkyaku:['先客と名刺交換','1F 受付','エレベーター','12F 総務部']
};
const EXCUSES=['言い訳：窓の外の景色を確かめたくて…','言い訳：机が勝手に滑りました','言い訳：鳩に呼ばれた気がして','言い訳：窓の強度テストです','言い訳：風を感じたかった','言い訳：通勤の練習です'];
function startCommute(){
  st.mode='commute';st.timer=0;hush();st.sheets++;st.streak=0;
  $('sheetNote').textContent=`始末書 +1（累計 ${st.sheets}枚）`;$('excuse').textContent=pick(EXCUSES);
  const route=COMMUTE[st.land&&st.land.kind||'hedge']||COMMUTE.hedge;
  const cm=$('commute');cm.hidden=false;[...$('steps').children].forEach((s,i)=>{s.classList.remove('on');s.textContent=route[i]});
  st.day++;resetDay(takeStage());
  oji.root.position.set(-3.2,STAND_Y,-7.7);oji.root.rotation.set(0,Math.PI/2,0);pose(oji,'stand',0);setFace(oji,'normal');
}
function beginWalkIn(){
  $('commute').hidden=true;st.mode='walkin';
  const side=phy.z<6?1:-1;
  st.walk={who:oji,path:[[-3.2,-6.6],[phy.x-.55,phy.z+side*1.15]],i:0,speed:2.1,ph:0};
  say(oji,'す、すみません…\n再出社しました…',2.2);
}

/* ---------- falling & landing ---------- */
function landingCheck(){
  const fx=st.fx;
  if(fx.gondola&&!fx.gondolaCaught){const G=fx.gondola.g;const gy=G.position.y+.15;
    if(phy.x<53.3&&Math.abs(phy.z-G.position.z)<1.9&&st.y<=gy&&st.y>gy-1.2)return{kind:'gondola',y:gy}}
  if(fx.drill&&phy.x>50.5&&phy.x<63.4&&Math.abs(phy.z)<9.2&&st.y<=GROUND+2.3)return{kind:'mat',y:GROUND+2.3};
  if(st.y<=GROUND+.85)return{kind:fx.senkyaku?'senkyaku':'hedge',y:GROUND+.85};
  return null;
}
function onLand(L){
  const fx=st.fx;st.land=L;st.y=L.y;
  if(L.kind==='mat'&&!st.bouncedMat){st.bouncedMat=true;st.vy=7.5;popText('ボヨーン！',cart.localToWorld(new T.Vector3(0,1,0)));st.shake=.25;return false}
  st.mode='landed';st.timer=0;st.shake=.4;st.fell=true;phy.vx=phy.vz=0;
  if(L.kind==='gondola'){fx.gondolaCaught=true;const G=fx.gondola;phy.x=Math.min(phy.x,52.2);popText('キャッチ！',cart.localToWorld(new T.Vector3(0,1.2,0)));
    setTimeout(()=>{say(G.P,pick(['お客さん、ここ\n窓の外ですよ','清掃中なんですけど…','12階、上がりまーす']),2.2);setFace(G.P,'sweat')},500)}
  else if(L.kind==='senkyaku'){let nP=null,nd=1e9;for(const P of fx.senkyaku){const d=Math.hypot(P.root.position.x-phy.x,P.root.position.z-phy.z);if(d<nd){nd=d;nP=P}}
    if(nP){if(nd<1.3){popText('ムギュッ',nP.root.position);setTimeout(()=>say(nP,pick(LINES.squash),1.6),300)}else setTimeout(()=>say(nP,pick(LINES.senkyaku),2.2),700);setFace(nP,'happy')}}
  return true;
}
function landedLine(){const k=st.land&&st.land.kind;
  if(k==='mat')return'防災訓練…\nバンザイ…';if(k==='gondola')return'た、助かった…\nすみません…';if(k==='senkyaku')return'先客がいた…\n…会社に戻らなきゃ';return pick(LINES.landed)}

/* ---------- loop ---------- */
const v3=new T.Vector3(),v3b=new T.Vector3(),UPY=new T.Vector3(0,1,0);
function update(dt){
  st.t+=dt;st.shake=Math.max(0,st.shake-dt*1.5);
  for(const P of speakers){const b=P.bub;if(b.dur>0){b.t+=dt;if(b.t>=b.dur){b.dur=0;b.el.hidden=true;speakers.delete(P)}}}
  for(const s of st.shards){s.v.y-=9.8*dt;s.m.position.addScaledVector(s.v,dt);s.m.rotation.x+=s.r.x*dt;s.m.rotation.y+=s.r.y*dt;if(s.m.position.y<GROUND){scene.remove(s.m);s.dead=true}}
  st.shards=st.shards.filter(s=>!s.dead);
  for(const p of st.papers){p.t+=dt;p.v.y=Math.max(-1.2,p.v.y-4*dt);p.m.position.addScaledVector(p.v,dt);p.v.x*=Math.pow(.3,dt);p.v.z*=Math.pow(.3,dt);
    p.m.rotation.x+=p.r.x*dt;p.m.rotation.z+=p.r.z*dt;if(p.m.position.y<.03&&p.m.position.x<50.3){p.m.position.y=.03;p.v.set(0,0,0);p.m.rotation.set(-Math.PI/2,0,p.m.rotation.z)}
    if(p.m.position.y<GROUND||p.t>14){scene.remove(p.m);p.dead=true}}
  st.papers=st.papers.filter(p=>!p.dead);
  updateFx(dt);updateFlashes(dt);updateRain(dt);
  if(st.intro>0)st.intro-=dt;
  const m=st.mode;
  let opose='type';
  if(m==='ready'&&st.day===1&&!st.tutSaid&&st.t>3.6){st.tutSaid=true;say(oji,LINES.tutorial,3.2)}
  if(st.pendingNotice&&(m==='ready'||m==='aiming')){st.pendingNotice.at-=dt;if(st.pendingNotice.at<=0){notice(st.pendingNotice.lines);st.pendingNotice=null}}
  if(m==='aiming'){const pw=st.aim.power;setFace(oji,pw>.6?'whoa':'normal');opose='grip';
    aimOff.set(-st.aim.dir.x*pw*.45,0,-st.aim.dir.y*pw*.45);if(pw>.8&&!RM){aimOff.x+=(Math.random()-.5)*.04;aimOff.z+=(Math.random()-.5)*.04}
    if(pw>.85&&!st.aim.said){st.aim.said=true;say(oji,pick(LINES.bigPull),1.4)}}
  else if(m==='sliding'){
    opose='grip';st.acc+=dt;let n=0;
    while(st.acc>=C.H&&n<30){st.acc-=C.H;n++;const was=phy.broke;const hit=K.step(phy,st.stage,C.H);
      if(hit>0&&!phy.broke)onBump(hit,phy.hitObj);
      if(phy.broke&&!was){crash();break}
      if(!phy.broke&&phy.vx===0&&phy.vz===0)break}
    const spd=Math.hypot(phy.vx,phy.vz);
    if(st.fx.papers&&spd>7&&!RM){st.paperT-=dt;if(st.paperT<=0){st.paperT=.07;const pm=new T.Mesh(paperGeo,paperMat);pm.position.copy(cart.localToWorld(v3b.set(.25,.95,(Math.random()-.5)*.8)));scene.add(pm);
      st.papers.push({m:pm,t:0,v:new T.Vector3(-phy.vx*.15+rnd(-1,1),rnd(1.5,3),-phy.vz*.15+rnd(-1,1)),r:new T.Vector3(rnd(-6,6),0,rnd(-6,6))})}}
    for(const P of coworkers){if(P.passed||spd<6)continue;P.root.getWorldPosition(v3b);if(Math.hypot(v3b.x-phy.x,v3b.z-phy.z)<2.4){P.passed=true;if(chance(.35))say(P,pick(LINES.pass),1.3)}}
    if(!phy.broke){setFace(oji,frontX()>44?'sweat':'whoa');if(phy.vx===0&&phy.vz===0)finishSlide()}
    else if(phy.x-.2>EDGE){st.mode='falling';st.vy=.5;st.bouncedMat=false}
  }
  else if(m==='falling'){
    opose='flail';st.vy-=13*dt;st.y+=st.vy*dt;phy.x+=phy.vx*dt;phy.z+=phy.vz*dt;if(phy.x>62.5){phy.x=62.5;phy.vx=0}const k=Math.pow(.22,dt);phy.vx*=k;phy.vz*=k;st.pitch=Math.max(-.95,st.pitch-dt*1.2);
    if(st.vy<0){const L=landingCheck();if(L)onLand(L)}
  }
  else if(m==='landed'){
    opose='grip';st.timer+=dt;st.pitch+=(-.08-st.pitch)*Math.min(1,dt*7);
    if(st.land&&st.land.kind==='gondola'){const G=st.fx.gondola.g;st.y=G.position.y+.15}
    if(st.timer>.5&&oji.face==='shock'){setFace(oji,'sweat');say(oji,landedLine(),2.4)}
    if(st.timer>3.1)startCommute();
  }
  else if(m==='commute'){
    st.timer+=dt;const n=Math.min(4,Math.floor(st.timer/.55)+1);[...$('steps').children].forEach((s,i)=>s.classList.toggle('on',i<n));
    if(st.timer>2.6)beginWalkIn();
  }
  else if(m==='chill'){opose='relax';st.timer+=dt;if(st.timer>2.9)showCard()}
  else if(m==='boss'){
    if(st.walk){opose='type'}
    else{st.timer+=dt;opose=st.said?'fasttype':'type';
      if(st.timer>1.6&&!st.said){st.said=true;setFace(oji,'resolve');say(oji,pick(LINES.work),2.6)}
      if(st.timer>4.1)showCard()}
  }
  if(st.walk){const w=st.walk,P=w.who;
    const tgt=w.path?w.path[w.i]:[w.tx,w.tz];
    const dx=tgt[0]-P.root.position.x,dz=tgt[1]-P.root.position.z,d=Math.hypot(dx,dz);
    w.ph+=dt*9;pose(P,'walk',w.ph);P.root.rotation.set(0,Math.atan2(-dz,dx),0);P.root.position.y=STAND_Y*(P.root.scale.y)+Math.abs(Math.sin(w.ph))*.03;
    const stp=Math.min(d,w.speed*dt);if(d>1e-4){P.root.position.x+=dx/d*stp;P.root.position.z+=dz/d*stp}
    if(d<.03){
      if(w.path&&w.i<w.path.length-1)w.i++;
      else{st.walk=null;P.root.position.y=STAND_Y*P.root.scale.y;pose(P,'stand',0);
        if(P===boss){P.root.rotation.set(0,Math.atan2(-(phy.z-P.root.position.z),phy.x-.5-P.root.position.x),0);pose(boss,'point',0);setFace(boss,'yell');
          st.timer=0;st.shake=.2;say(boss,pick(BOSSES[boss.type].yell),1.9);setFace(oji,'sad');
          if(coworkers.length&&chance(.4)){const C2=pick(coworkers);setTimeout(()=>{if(st.mode==='boss')say(C2,pick(['（とばっちりが来ませんように）','（今日も平和だ…）','（見てない見てない）']),1.8)},900)}}
        else{st.mode='sitting';st.sit={k:0,from:P.root.position.clone(),yaw:P.root.rotation.y}}}
    }
  }
  if(m==='boss'&&!st.walk&&boss.face==='yell')pose(boss,'point',st.t);
  if(m==='walkin'){}
  else if(m==='sitting'){
    const s=st.sit;s.k=Math.min(1,s.k+dt/.9);const k=s.k*s.k*(3-2*s.k);
    placeCart();const seat=cart.localToWorld(SEAT.clone());
    oji.root.position.lerpVectors(s.from,seat,k);oji.root.rotation.set(0,s.yaw*(1-k),0);blendSit(oji,k);
    if(s.k>=1){st.mode='ready';setFace(oji,'normal');say(oji,'ふぅ…再出社完了。\n今日こそ窓際へ…',2.8)}
  }
  else if(st.mode!=='commute'&&st.mode!=='walkin'&&st.mode!=='sitting'){pose(oji,opose,st.t);placeCart();syncSeated()}
  if(st.mode==='commute')placeCart();

  // aim visuals: 引っ張りゴム（後ろ）＋ 発射方向ガイド（前）
  const aiming=st.mode==='aiming';aimVisible(aiming);
  if(aiming){const d=st.aim.dir,pw=st.aim.power;
    const cx=cart.position.x-.22,cz=cart.position.z;
    const back=.9+pw*4.2,hx=cx-d.x*back,hz=cz-d.y*back;
    handle.position.set(hx,.5,hz);aimRing.position.set(hx,.02,hz);
    const px=-d.y,pz=d.x;
    bands.forEach((b,i)=>{const s=i?1:-1;const a=v3.set(cx-d.x*.8+px*.75*s,.5,cz-d.y*.8+pz*.75*s);const L=a.distanceTo(handle.position);
      b.position.lerpVectors(a,handle.position,.5);b.scale.set(1,L,1);b.quaternion.setFromUnitVectors(UPY,v3b.copy(handle.position).sub(a).normalize())});
    const len=1.6+pw*7;
    guide.forEach((g,i)=>{const t=(i+1)/guide.length;g.position.set(cx+d.x*(1.2+t*len),.04,cz+d.y*(1.2+t*len));g.material.opacity=.9*(1-t*.75);const s=.7+pw*.5;g.scale.setScalar(s)});
    arrowHead.position.set(cx+d.x*(1.5+len),.25,cz+d.y*(1.5+len));arrowHead.quaternion.setFromUnitVectors(UPY,v3.set(d.x,0,d.y));
    ropeMat.color.setHSL(.1-.1*pw,.55+.35*pw,.6);handle.material.color.setHSL(.13-.1*pw,.9,.55)}

  // camera
  const portrait=W/H<1;let tgt;
  if(m==='walkin')tgt=v3.set(oji.root.position.x,0,oji.root.position.z);
  else tgt=v3.set(phy.x-.2,st.y,phy.z);
  let cp,cl;
  const over=(st.view==='overview'||st.intro>0)&&!(m==='falling'||m==='landed');
  if(over){
    if(portrait){camera.up.set(1,0,0);cp=new T.Vector3(10,70,0);cl=new T.Vector3(23,0,0)}
    else{camera.up.set(0,1,0);cp=new T.Vector3(22,46,40);cl=new T.Vector3(22,0,-1)}
  }else{
    camera.up.set(0,1,0);
    const k=portrait?1.15:1;
    cp=portrait?new T.Vector3(tgt.x-8*k,tgt.y+9*k,tgt.z+1.6):new T.Vector3(tgt.x-6.5,tgt.y+7.5,tgt.z+8.5);
    cl=portrait?new T.Vector3(tgt.x+3.5,tgt.y,tgt.z):new T.Vector3(tgt.x+3,tgt.y,tgt.z-.6);
  }
  const r=(m==='sliding'||m==='falling')?Math.min(1,dt*9):Math.min(1,dt*(st.intro>0?6:4));
  if(m==='commute'){camPos.copy(cp);camLook.copy(cl)}else{camPos.lerp(cp,r);camLook.lerp(cl,r)}
  camera.position.copy(camPos);
  if(st.shake>0&&!RM)camera.position.add(new T.Vector3((Math.random()-.5)*st.shake,(Math.random()-.5)*st.shake,(Math.random()-.5)*st.shake));
  camera.lookAt(camLook);
  sun.position.set(tgt.x-10,tgt.y+24,tgt.z+14);sun.target.position.set(tgt.x,tgt.y,tgt.z);
}

const miniC=$('mini'),mg=miniC.getContext('2d');
function drawMini(){
  const w=miniC.width,h=miniC.height,pad=8,sx=x=>pad+(x-RX0)/(RX1-RX0)*(w-pad*2),sz=z=>pad+(z-RZ0)/(RZ1-RZ0)*(h-pad*2);
  mg.clearRect(0,0,w,h);mg.fillStyle='#3a4a66';mg.fillRect(sx(RX0),sz(RZ0),sx(RX1)-sx(RX0),sz(RZ1)-sz(RZ0));
  if(st.stage)for(const q of st.stage.zones){mg.fillStyle=q.kind==='wax'?'rgba(169,219,255,.35)':'rgba(150,80,60,.6)';mg.fillRect(sx(q.x0),sz(q.z0),sx(q.x1)-sx(q.x0),sz(q.z1)-sz(q.z0))}
  mg.fillStyle='#f2c230';mg.globalAlpha=.5;mg.fillRect(sx(48),sz(RZ0),sx(50)-sx(48),sz(RZ1)-sz(RZ0));mg.globalAlpha=1;
  mg.fillStyle='#8592a8';const obs=st.stage?K.STATIC.concat(st.stage.obstacles):K.STATIC;
  for(const o of obs)mg.fillRect(sx(o.x0),sz(o.z0),Math.max(2,sx(o.x1)-sx(o.x0)),Math.max(2,sz(o.z1)-sz(o.z0)));
  mg.fillStyle='#a9dbff';mg.fillRect(sx(RX1)-1,sz(RZ0),4,sz(RZ1)-sz(RZ0));
  for(let x=10;x<50;x+=10){mg.fillStyle='rgba(255,255,255,.25)';mg.fillRect(sx(x),sz(RZ0),1,sz(RZ1)-sz(RZ0))}
  const px=Math.min(RX1+2,phy.x),pz=phy.z;
  if(st.mode==='aiming'){const L=4+st.aim.power*10;mg.strokeStyle='#f2c230';mg.lineWidth=2;mg.beginPath();mg.moveTo(sx(px),sz(pz));mg.lineTo(sx(px+st.aim.dir.x*L),sz(pz+st.aim.dir.y*L));mg.stroke()}
  if(DEBUG&&st.stage&&st.stage.sol){const a=st.stage.sol.a*Math.PI/180;mg.strokeStyle='#7bd389';mg.setLineDash([3,3]);mg.beginPath();mg.moveTo(sx(st.stage.start.x),sz(st.stage.start.z));mg.lineTo(sx(st.stage.start.x+Math.cos(a)*12),sz(st.stage.start.z+Math.sin(a)*12));mg.stroke();mg.setLineDash([])}
  mg.fillStyle=phy.broke?'#c4322a':'#f2c230';mg.fillRect(sx(px-BACK),sz(pz-HALFZ),Math.max(4,sx(px+FRONT)-sx(px-BACK)),Math.max(4,sz(pz+HALFZ)-sz(pz-HALFZ)));
}
let dbgEl=null;if(DEBUG){dbgEl=document.createElement('div');dbgEl.className='dbg';stage.appendChild(dbgEl)}
function hud(){
  const out=phy.broke||st.fell;
  $('hLeft').textContent=out?'窓の外':Math.max(0,RX1-frontX()).toFixed(2);
  $('hWax').textContent=st.wax.name;$('hWaxChip').className='chip wax '+st.wax.cls;
  $('sDay').textContent=st.day;$('sBest').textContent=best>0?best.toFixed(2):'--';$('sSheet').textContent=st.sheets;$('sStreak').textContent=st.streak;
  const p=st.mode==='aiming'?st.aim.power:0;$('gFill').style.width=(p*100).toFixed(1)+'%';$('gP').textContent=Math.round(p*100);
  for(const P of speakers){const b=P.bub;if(b.el.hidden)continue;
    P.head.getWorldPosition(v3);v3.y+=.3;const s=toScreen(v3);
    if(!s.ok){b.el.style.visibility='hidden';continue}b.el.style.visibility='visible';
    const bw=b.el.offsetWidth/2+8;b.el.style.left=Math.max(bw,Math.min(W-bw,s.x))+'px';b.el.style.top=Math.max(b.el.offsetHeight+20,s.y)+'px'}
  drawMini();
  if(dbgEl&&st.stage){const e=st.stage.eval||{};dbgEl.textContent=`seed ${st.stage.seed} ${st.stage.diff}/${st.stage.theme} ★${st.stage.stars}\nrate ${(e.rate*100).toFixed(2)}% hits ${e.hits}/${e.total} direct ${e.direct} tries ${e.tries}\nsol ${st.stage.sol?st.stage.sol.a+'° '+st.stage.sol.p+'%':'-'}  aim ${(Math.atan2(st.aim.dir.y,st.aim.dir.x)*180/Math.PI).toFixed(0)}° ${Math.round(st.aim.power*100)}%\nfx ${st.fx?[st.fx.weather,st.fx.boss].concat(st.fx.labels).join(','):''}`}
}

/* ---------- boot ---------- */
{
  const qs=parseInt(QS.get('seed')),qd=QS.get('diff');
  const sd=K.build(isFinite(qs)?qs>>>0:newSeed(),['easy','normal','hard'].includes(qd)?qd:'easy');
  resetDay(sd,!QS.has('fx'));
}
$('loading').remove();
syncSeated();
say(oji,pick(LINES.start),3.2);
let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);renderer.render(scene,camera);hud();requestAnimationFrame(frame)}
requestAnimationFrame(frame);
window.__mado={st,phy,K,get boss(){return boss},nextDay,launchShot(angDeg,power){st.aim.dir.set(Math.cos(angDeg*Math.PI/180),Math.sin(angDeg*Math.PI/180));st.aim.power=power;st.mode='aiming';launch()}};
})();
