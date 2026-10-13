/* =====================================================================
 * MadoCore — 物理・ステージ生成・クリア判定（three.js 非依存の純粋ロジック）
 * ブラウザでは window.MadoCore、Node では tools/check-stages.mjs から読み込まれる。
 * ここを変えたら `node mado/tools/check-stages.mjs` で全ステージがクリア可能か確認すること。
 * ===================================================================== */
(function(root){
'use strict';
const C={
  RX0:-6,RX1:50,RZ0:-8,RZ1:8,          // 部屋の範囲（x=50 が窓）
  FRONT:.65,BACK:1.1,HALFZ:.8,         // 台車（机＋椅子）の当たり判定
  DECEL:5,REST:.55,                    // 減速[m/s²]・跳ね返り係数
  MAXD:67,CURVE:.65,                   // 飛距離 = MAXD × 力^CURVE（60%で約48m）
  H:1/120,                             // 固定タイムステップ（ゲーム本体と判定で共通）
  ZONE:48,                             // ここ以上で「窓際」成功
  DRAG_FULL:.55                        // 画面短辺×この比率のドラッグで力100%
};
const WAX=[{name:'重い',f:.94,cls:'heavy'},{name:'普通',f:1,cls:''},{name:'よく滑る',f:1.06,cls:'slip'}];
// 壁際の固定オブジェクト（キャビネット・コピー機・ウォーターサーバー・観葉植物）
const STATIC=[
  {x0:6.5,x1:9.1,z0:-8,z1:-7.4},{x0:10.3,x1:11.5,z0:-8,z1:-7.2},{x0:24,x1:24.5,z0:-8,z1:-7.5},
  {x0:47.8,x1:48.4,z0:-7.9,z1:-7.3},{x0:30,x1:30.6,z0:7.3,z1:7.9},{x0:-5.7,x1:-5.1,z0:7.1,z1:7.7}
];

function rng(seed){let a=(seed>>>0)||0x9e3779b9;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function launchDist(power,waxF){return C.MAXD*Math.pow(Math.max(0,Math.min(1,power)),C.CURVE)*(waxF||1)}
function launchSpeed(power,waxF){return Math.sqrt(2*C.DECEL*launchDist(power,waxF))}
function zoneAt(stage,x,z){const zs=stage&&stage.zones;if(zs)for(let i=0;i<zs.length;i++){const q=zs[i];if(x>=q.x0&&x<=q.x1&&z>=q.z0&&z<=q.z1)return q}return null}

/** 1ステップ進める。s={x,z,vx,vz,broke}。戻り値: 衝突時の速さ（0=衝突なし） */
function step(s,stage,h){
  let sp=Math.hypot(s.vx,s.vz);
  const zq=s.broke?null:zoneAt(stage,s.x-.22,s.z);
  sp=Math.max(0,sp-(s.broke?1:C.DECEL*(zq?zq.f:1))*h);
  if(sp===0){s.vx=s.vz=0;return 0}
  const k=sp/Math.hypot(s.vx,s.vz);s.vx*=k;s.vz*=k;
  s.x+=s.vx*h;s.z+=s.vz*h;
  if(s.broke)return 0;
  let hit=0;const sp0=sp;s.hitObj=null;
  if(s.x-C.BACK<C.RX0){s.x=C.RX0+C.BACK;s.vx=Math.abs(s.vx)*C.REST;hit=sp0}
  if(s.z-C.HALFZ<C.RZ0){s.z=C.RZ0+C.HALFZ;s.vz=Math.abs(s.vz)*C.REST;hit=sp0}
  if(s.z+C.HALFZ>C.RZ1){s.z=C.RZ1-C.HALFZ;s.vz=-Math.abs(s.vz)*C.REST;hit=sp0}
  const lists=[STATIC,stage?stage.obstacles:null];
  for(let L=0;L<2;L++){const obs=lists[L];if(!obs)continue;
    for(let i=0;i<obs.length;i++){const o=obs[i];
      const a0=s.x-C.BACK,a1=s.x+C.FRONT,b0=s.z-C.HALFZ,b1=s.z+C.HALFZ;
      if(a1<=o.x0||a0>=o.x1||b1<=o.z0||b0>=o.z1)continue;
      const pl=a1-o.x0,pr=o.x1-a0,pf=b1-o.z0,pb=o.z1-b0,m=Math.min(pl,pr,pf,pb);
      if(m===pl){s.x-=pl;s.vx=-Math.abs(s.vx)*C.REST}else if(m===pr){s.x+=pr;s.vx=Math.abs(s.vx)*C.REST}
      else if(m===pf){s.z-=pf;s.vz=-Math.abs(s.vz)*C.REST}else{s.z+=pb;s.vz=Math.abs(s.vz)*C.REST}
      hit=sp0;s.hitObj=o;
    }
  }
  if(s.x+C.FRONT>=C.RX1){s.broke=true;s.x=C.RX1-C.FRONT}
  return hit;
}

/** 1発シミュレーション。dir は単位ベクトル角度[rad]（0=窓方向） */
function simulate(stage,ang,power){
  const d=launchDist(power,WAX[stage.wax].f);
  if(d+waxBonus(stage)<C.ZONE-(stage.start.x+C.FRONT)-.01)return{broke:false,front:stage.start.x+d,bounces:0,pruned:true};
  const sp=Math.sqrt(2*C.DECEL*d);
  const s={x:stage.start.x,z:stage.start.z,vx:Math.cos(ang)*sp,vz:Math.sin(ang)*sp,broke:false};
  let bounces=0;const minF=minFric(stage);
  for(let n=0,N=30/C.H;n<N;n++){
    if(step(s,stage,C.H)>0)bounces++;
    // 早期打ち切り: 残りの勢いでは窓際ゾーンに届かない
    if((n&7)===7&&!s.broke){const v2=s.vx*s.vx+s.vz*s.vz;if(s.x+C.FRONT+v2/(2*C.DECEL*minF)<C.ZONE)return{broke:false,front:s.x+C.FRONT,bounces,pruned:true}}
    if(s.broke)return{broke:true,front:C.RX1,bounces};
    if(s.vx===0&&s.vz===0)break;
  }
  return{broke:false,front:s.x+C.FRONT,x:s.x,z:s.z,bounces};
}

function minFric(stage){let f=1;for(const q of stage.zones||[])f=Math.min(f,q.f);return f}
function waxBonus(stage){if(stage._wb!=null)return stage._wb;let b=0;for(const q of stage.zones||[])if(q.f<1)b+=(q.x1-q.x0)*(1/q.f-1)*1.3;return stage._wb=b}
/** 角度×力のグリッドで総当たりして、窓際に止まれる割合を測る */
function evaluate(stage,opt){
  opt=opt||{};
  const A0=-84,A1=84,AS=opt.angStep||4,P0=.2,P1=1,PS=opt.powStep||.015;
  let total=0,hits=0,direct=0;const sols=[];
  for(let a=A0;a<=A1+1e-9;a+=AS){
    const ang=a*Math.PI/180;
    for(let p=P0;p<=P1+1e-9;p+=PS){
      total++;const r=simulate(stage,ang,p);
      if(!r.broke&&r.front>=C.ZONE){hits++;if(r.bounces===0)direct++;sols.push({a,p:Math.round(p*100),b:r.bounces})}
    }
  }
  return{total,hits,direct,rate:hits/total,sols};
}

/* ---------------- ステージ生成 ---------------- */
const THEMES={
  easy:[
    {id:'free',name:'フリーアドレス日',islands:[1,1],smalls:[0,2],kinds:['plant','meeting','pillar'],zones:[0,1]},
    {id:'remote',name:'在宅勤務デー',islands:[1,2],smalls:[0,1],kinds:['plant','boxes'],zones:[0,0]},
    {id:'tidy',name:'整理整頓キャンペーン',islands:[1,2],smalls:[1,2],kinds:['pillar','shelf'],zones:[0,1]}
  ],
  normal:[
    {id:'usual',name:'いつものフロア',islands:[2,2],smalls:[1,3],kinds:['pillar','copier','plant','meeting'],zones:[0,1]},
    {id:'meeting',name:'会議ラッシュ',islands:[1,2],smalls:[2,3],kinds:['meeting','partition','plant'],zones:[0,1]},
    {id:'wax',name:'ワックスがけの日',islands:[2,2],smalls:[1,2],kinds:['pillar','plant','copier'],zones:[1,2],zoneKind:'wax'}
  ],
  hard:[
    {id:'moving',name:'引っ越し前日',islands:[1,2],smalls:[4,7],kinds:['boxes','boxes','boxes','shelf','partition'],zones:[0,1]},
    {id:'remodel',name:'模様替え中',islands:[2,3],smalls:[3,5],kinds:['partition','shelf','pillar','boxes'],zones:[1,1]},
    {id:'maze',name:'パーテーション迷路',islands:[1,2],smalls:[4,6],kinds:['partition','partition','pillar','plant'],zones:[0,1]}
  ]
};
const DIFF_RULE={// rate = 角度×力の全パターン中で窓際に止まれる割合（障害物なしの部屋で約2.1%）
  easy:{minRate:.009,maxRate:1,minDirect:4,minHits:20},     // まっすぐ狙って届くルートが必ずある
  normal:{minRate:.0045,maxRate:.014,minDirect:0,minHits:10},
  hard:{minRate:.003,maxRate:.007,minDirect:0,minHits:7}     // 難しいが、壁バウンド等で必ずクリアできる
};
const SIZES={
  pillar:()=>[.8,.8],plant:()=>[.6,.6],copier:()=>[1.2,.8],meeting:()=>[1.9,1.9],
  boxes:r=>{const w=1+Math.round(r()*2)*.4;return r()<.5?[w,1]:[1,w]},
  shelf:r=>{const l=2.4+Math.round(r()*3)*.4;return r()<.5?[l,.5]:[.5,l]},
  partition:r=>{const l=2+Math.round(r()*4)*.4;return r()<.65?[.14,l]:[l,.14]}
};
function overlap(a,b,m){return!(a.x1+m<=b.x0||b.x1+m<=a.x0||a.z1+m<=b.z0||b.z1+m<=a.z0)}

function generate(seed,diff){
  const r=rng(seed),ri=(a,b)=>a+Math.floor(r()*(b-a+1)),rf=(a,b)=>a+r()*(b-a),pk=a=>a[Math.floor(r()*a.length)];
  const theme=pk(THEMES[diff]);
  const obs=[];
  const start={x:+rf(-2.5,2.5).toFixed(2),z:+rf(-5.6,5.6).toFixed(2)};
  const startBox={x0:start.x-C.BACK,x1:start.x+C.FRONT,z0:start.z-C.HALFZ,z1:start.z+C.HALFZ};
  function fits(o,gap){
    if(o.x0<6.5||o.x1>(o.kind==='island'?44:46.6)||o.z0<C.RZ0+.05||o.z1>C.RZ1-.05)return false;
    if(overlap(o,startBox,2))return false;
    for(const s of STATIC)if(overlap(o,s,.4))return false;
    for(const p of obs)if(overlap(o,p,gap))return false;
    return true;
  }
  function place(kind,w,d,gap,xr,extra){
    for(let t=0;t<60;t++){
      const x0=rf(xr[0],xr[1]-w),z0=rf(C.RZ0,C.RZ1-d);
      // 端に寄せる配置も出やすく
      const zz=r()<.3?(r()<.5?C.RZ0+.06:C.RZ1-d-.06):z0;
      const o=Object.assign({kind,x0:+x0.toFixed(2),x1:+(x0+w).toFixed(2),z0:+zz.toFixed(2),z1:+(zz+d).toFixed(2)},extra||{});
      if(fits(o,gap)){obs.push(o);return o}
    }
    return null;
  }
  const nI=ri(theme.islands[0],theme.islands[1]);
  for(let i=0;i<nI;i++){
    const vert=r()<.3;const n=ri(3,5);const L=n*1.5;
    const w=vert?4:L,d=vert?L:4;
    place('island',w,d,2.2,[8,44],{vert,desks:n,people:r()});
  }
  const nS=ri(theme.smalls[0],theme.smalls[1]);
  for(let i=0;i<nS;i++){const k=pk(theme.kinds);const [w,d]=SIZES[k](r);place(k,w,d,diff==='hard'?1.2:1.9,[8,46.6],{v:r()})}
  const zones=[];
  const nZ=ri(theme.zones[0],theme.zones[1]);
  for(let i=0;i<nZ;i++){
    const kind=theme.zoneKind||(r()<.6?'wax':'mat');
    const w=kind==='wax'?rf(4,9):rf(2.5,4.5),full=r()<.5,d=full?16:rf(5,9);
    const x0=rf(12,44-w),z0=full?C.RZ0:rf(C.RZ0,C.RZ1-d);
    zones.push({kind,f:kind==='wax'?.45:2.2,x0:+x0.toFixed(2),x1:+(x0+w).toFixed(2),z0:+z0.toFixed(2),z1:+(z0+d).toFixed(2)});
  }
  const wax=diff==='easy'?1:ri(0,2);
  return{seed,diff,theme:theme.id,themeName:theme.name,obstacles:obs,zones,wax,start};
}

/** 指定難易度で「クリア可能かつ複雑すぎない」ステージができるまで生成し直す */
function build(seed,diff,opt){
  opt=opt||{};
  const rule=DIFF_RULE[diff];let s=seed>>>0,last=null,lastEv=null;
  for(let tries=0;tries<(opt.maxTries||40);tries++){
    const st=generate(s,diff);const ev=evaluate(st,opt.eval||null);
    st.eval={rate:ev.rate,hits:ev.hits,direct:ev.direct,total:ev.total,tries:tries+1};
    st.sol=ev.sols.length?ev.sols[Math.floor(ev.sols.length/2)]:null;
    if(ev.hits>=rule.minHits&&ev.rate>=rule.minRate&&ev.rate<=rule.maxRate&&ev.direct>=rule.minDirect){st.stars=stars(ev.rate);return st}
    if(ev.hits>=rule.minHits&&(!lastEv||Math.abs(ev.rate-target(rule))<Math.abs(lastEv.rate-target(rule)))){last=st;lastEv=ev}
    s=(Math.imul(s,1664525)+1013904223)>>>0;
  }
  if(last){last.stars=stars(lastEv.rate);return last}
  // 最終手段: 障害物なしの安全なフロア
  const st={seed,diff,theme:'free',themeName:'フリーアドレス日',obstacles:[],zones:[],wax:1,start:{x:0,z:0}};
  const ev=evaluate(st,{angStep:6,powStep:.02});st.eval={rate:ev.rate,hits:ev.hits,direct:ev.direct,total:ev.total,tries:-1};st.stars=1;return st;
}
function target(rule){return(rule.minRate+Math.min(rule.maxRate,.02))/2}
function stars(rate){return rate>=.015?1:rate>=.01?2:rate>=.006?3:rate>=.0035?4:5}
function pickDiff(rand){const x=rand();return x<.3?'easy':x<.75?'normal':'hard'}

const api={C,WAX,STATIC,THEMES,DIFF_RULE,rng,launchDist,launchSpeed,zoneAt,step,simulate,evaluate,generate,build,stars,pickDiff};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MadoCore=api;
})(typeof window!=='undefined'?window:globalThis);
