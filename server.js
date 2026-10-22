const express=require('express'),http=require('http'),{Server}=require('socket.io'),C=require('./cards');
const app=express();app.get('/',(q,r)=>r.sendFile(__dirname+'/index.html'));
const srv=http.createServer(app),io=new Server(srv),rooms={};
const rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];
const mkCode=()=>{let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms[c]);return c};
function deal(){const a1=pick(C.ab);let a2;do{a2=pick(C.ab)}while(a2===a1);
 return{prof:pick(C.prof),bio:`${pick(['Мужчина','Женщина'])}, ${18+rnd(58)} лет`,health:pick(C.health),hobby:pick(C.hobby),bag:pick(C.bag),fact:pick(C.fact),phobia:pick(C.phobia),ab1:a1,ab2:a2}}
function view(r,id){return{code:r.code,name:r.name,host:r.host,me:id,phase:r.phase,round:r.round,seats:r.seats,free:r.free,bunker:r.bunker,disaster:r.disaster,event:r.event,log:r.log.slice(-25),
 players:Object.values(r.players).map(p=>{const own=p.id===id||r.phase==='end';return{id:p.id,name:p.name,alive:p.alive,online:p.online,done:p.rr===r.round,vote:r.phase==='vote'?r.votes[p.id]||null:null,open:p.open,used:p.used,
 card:own?p.card:Object.fromEntries(Object.keys(p.open).filter(k=>p.open[k]).map(k=>[k,p.card[k]]))}})}}
const push=r=>Object.values(r.players).forEach(p=>p.sock&&io.to(p.sock).emit('state',view(r,p.id)));
const log=(r,t)=>r.log.push(t);
const alive=r=>Object.values(r.players).filter(p=>p.alive);
function newRound(r){r.round++;r.phase='reveal';r.votes={};r.event=null;
 if(r.cat.includes(r.round)){r.event=pick(C.events);log(r,'⚡ '+r.event)}
 log(r,`— Раунд ${r.round} —`)}
function tally(r){const cnt={};Object.values(r.votes).forEach(t=>cnt[t]=(cnt[t]||0)+1);
 const mx=Math.max(0,...Object.values(cnt)),top=Object.keys(cnt).filter(k=>cnt[k]===mx);
 if(!top.length){log(r,'Никто не голосовал. Раунд без изгнания.');return newRound(r)}
 const out=pick(top),p=r.players[out];p.alive=false;
 log(r,`🔥 ${p.name} изгнан (${mx} гол.${top.length>1?', ничья, решила судьба':''}). Он был: ${p.card.prof}`);
 if(alive(r).length<=r.seats){r.phase='end';log(r,'🏛 Бункер закрыт. Выжили: '+alive(r).map(x=>x.name).join(', '))}else newRound(r)}
io.on('connection',s=>{
 const R=()=>rooms[s.data.room],P=()=>R()&&R().players[s.data.pid];
 const err=m=>s.emit('err',m);
 const join=(r,id,name)=>{s.data={room:r.code,pid:id};const p=r.players[id];p.sock=s.id;p.online=true;if(name)p.name=name;push(r)};
 s.on('create',({name,room,token})=>{const c=mkCode();
  const r=rooms[c]={code:c,name:(room||'Пир').slice(0,30),host:token,players:{},phase:'lobby',round:0,votes:{},log:[],cat:[]};
  r.players[token]={id:token,name:(name||'Гость').slice(0,20),alive:true,open:{},used:{},rr:0};join(r,token)});
 s.on('join',({code,name,token})=>{const r=rooms[(code||'').toUpperCase()];if(!r)return err('Комната не найдена');
  if(!r.players[token]){if(r.phase!=='lobby')return err('Игра уже идёт');if(Object.keys(r.players).length>=12)return err('Комната полна');
   r.players[token]={id:token,name:(name||'Гость').slice(0,20),alive:true,open:{},used:{},rr:0};log(r,(name||'Гость')+' вошёл в бункер')}
  join(r,token,r.phase==='lobby'?name:null)});
 s.on('start',({seats,free})=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='lobby')return;
  const n=Object.keys(r.players).length;seats=+seats;free=Math.max(0,Math.min(5,+free||0));
  if(n<2)return err('Нужно хотя бы 2 игрока');if(!(seats>=1&&seats<n))return err('Мест должно быть от 1 до '+(n-1));
  r.seats=seats;r.free=free;r.bunker=pick(C.bunkers);r.disaster=pick(C.disasters);
  Object.values(r.players).forEach(p=>p.card=deal());
  const total=free+n-seats,pool=[];for(let i=2;i<=total;i++)pool.push(i);
  const k=Math.min(pool.length,2+rnd(2));while(r.cat.length<k)r.cat.push(pool.splice(rnd(pool.length),1)[0]);
  r.round=0;log(r,'Игра началась. Катастрофа: '+r.disaster);newRound(r);push(r)});
 s.on('reveal',key=>{const r=R(),p=P();if(!r||r.phase!=='reveal'||!p.alive||p.rr===r.round||!p.card[key]||key.startsWith('ab')||p.open[key])return;
  p.open[key]=true;p.rr=r.round;log(r,`${p.name} открыл: ${key} — ${p.card[key]}`);push(r)});
 s.on('ability',key=>{const r=R(),p=P();if(!r||!['reveal','vote'].includes(r.phase)||!p.alive||!/^ab[12]$/.test(key)||p.used[key])return;
  p.used[key]=true;p.open[key]=true;log(r,`✨ ${p.name} применил способность: ${p.card[key]}`);push(r)});
 s.on('next',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='reveal'||r.round>r.free)return;newRound(r);push(r)});
 s.on('openvote',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='reveal'||r.round<=r.free)return;r.phase='vote';r.votes={};log(r,'Голосование открыто');push(r)});
 s.on('vote',t=>{const r=R(),p=P();if(!r||r.phase!=='vote'||!p.alive||t===p.id||!r.players[t]||!r.players[t].alive)return;
  r.votes[p.id]=t;if(alive(r).every(x=>r.votes[x.id]))tally(r);push(r)});
 s.on('tally',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='vote')return;tally(r);push(r)});
 s.on('disconnect',()=>{const p=P();if(p){p.online=false;p.sock=null;push(R())}});
});
srv.listen(process.env.PORT||3000,()=>console.log('Бункер Диониса запущен'));
