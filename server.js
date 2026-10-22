const express=require('express'),http=require('http'),{Server}=require('socket.io'),C=require('./cards');
const app=express();app.get('/',(q,r)=>r.sendFile(__dirname+'/index.html'));
const srv=http.createServer(app),io=new Server(srv),rooms={};
const rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];
const KEYS=['prof','bio','health','hobby','bag','fact','phobia'];
const mkCode=()=>{let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms[c]);return c};
function deal(){const sp=()=>Math.random()<.5?pick(C.ab):(()=>{const a=pick(C.abx);return a})();
 const mk=()=>{const x=sp();return typeof x==='string'?{t:x,id:null}:{t:x.t,id:x.id}};
 const a1=mk();let a2=mk();while(a2.t===a1.t)a2=mk();
 const age=Math.random()<.12?pick(C.ages):(18+rnd(58))+' лет';
 return{card:{prof:pick(C.prof),bio:`${pick(C.beings)}, ${age}`,health:pick(C.health),hobby:pick(C.hobby),bag:pick(C.bag),fact:pick(C.fact),phobia:pick(C.phobia),ab1:a1.t,ab2:a2.t},abid:{ab1:a1.id,ab2:a2.id}}}
const alive=r=>Object.values(r.players).filter(p=>p.alive);
const left=p=>KEYS.filter(k=>!p.open[k]);
function view(r,id){const me=r.players[id];return{t:Date.now(),code:r.code,name:r.name,host:r.host,me:id,phase:r.phase,round:r.round,seats:r.seats,free:r.free,bunker:r.bunker,disaster:r.disaster,shift:r.shift,rooms:r.rooms,last:r.last,turn:r.order&&r.order[r.ti],deadline:r.deadline,log:r.log.slice(-25),
 players:Object.values(r.players).map(p=>{const own=p.id===id||r.phase==='end';const card={},open={};
  for(const k in (p.card||{}))if(own||p.open[k]){card[k]=p.card[k];open[k]=!!p.open[k]}
  (p.fakes||[]).forEach(f=>{card[f.key]=f.text;open[f.key]=true});
  return{id:p.id,name:p.name,alive:p.alive,online:p.online,vote:r.phase==='vote'?r.votes[p.id]||null:null,open,used:p.used,card,fk:(p.fakes||[]).map(f=>f.key),abid:p.id===id?p.abid:null,done:p.rr===r.round}})}}
const push=r=>Object.values(r.players).forEach(p=>p.sock&&io.to(p.sock).emit('state',view(r,p.id)));
const log=(r,t)=>r.log.push(t);
function newRound(r){r.round++;r.phase='reveal';r.votes={};r.deadline=null;
 Object.values(r.players).forEach(p=>p.fakes=(p.fakes||[]).filter(f=>f.exp>=r.round));
 r.order=alive(r).map(p=>p.id);r.ti=0;
 const rm=r.freeRooms.length?r.freeRooms.splice(rnd(r.freeRooms.length),1)[0]:null;if(rm){r.rooms.push(rm);log(r,`🚪 Открыта комната: ${rm.t}`)}
 if(r.cat.includes(r.round)){const e=pick(C.events.filter(x=>x!==r.shift));r.shift=e;log(r,`${e.i} КАТАКЛИЗМ: ${e.t}`)}
 log(r,`— Раунд ${r.round} —`);skip(r)}
function skip(r){while(r.ti<r.order.length&&!left(r.players[r.order[r.ti]]).length)r.ti++;if(r.ti>=r.order.length)startDiscuss(r)}
function startDiscuss(r){r.phase='discuss';r.deadline=Date.now()+180000;log(r,'💬 Обсуждение: 3 минуты')}
function afterDiscuss(r){if(r.round>r.free){r.phase='vote';r.votes={};r.deadline=null;log(r,'🗳 Голосование')}else newRound(r)}
function tally(r){const cnt={};Object.values(r.votes).forEach(t=>cnt[t]=(cnt[t]||0)+1);
 const mx=Math.max(0,...Object.values(cnt)),top=Object.keys(cnt).filter(k=>cnt[k]===mx);
 if(!top.length){log(r,'Никто не голосовал. Без изгнания.');return newRound(r)}
 const p=r.players[pick(top)];p.alive=false;
 log(r,`🔥 ${p.name} изгнан (${mx} гол.${top.length>1?', ничья, решила судьба':''}). Он был: ${p.card.prof}`);
 if(alive(r).length<=r.seats){r.phase='end';log(r,'🏛 Бункер закрыт. Выжили: '+alive(r).map(x=>x.name).join(', '))}else newRound(r)}
setInterval(()=>{for(const r of Object.values(rooms))if(r.phase==='discuss'&&Date.now()>r.deadline){afterDiscuss(r);push(r)}},1000);
io.on('connection',s=>{
 const R=()=>rooms[s.data.room],P=()=>R()&&R().players[s.data.pid],err=m=>s.emit('err',m);
 const join=(r,id,name)=>{s.data={room:r.code,pid:id};const p=r.players[id];p.sock=s.id;p.online=true;if(name)p.name=name;push(r)};
 const mkp=(id,name)=>({id,name:(name||'Гость').slice(0,20),alive:true,open:{},used:{},rr:0,fakes:[]});
 s.on('create',({name,room,token})=>{const c=mkCode();const r=rooms[c]={code:c,name:(room||'Пир').slice(0,30),host:token,players:{},phase:'lobby',round:0,votes:{},log:[],cat:[],rooms:[]};r.players[token]=mkp(token,name);join(r,token)});
 s.on('join',({code,name,token})=>{const r=rooms[(code||'').toUpperCase()];if(!r)return err('Комната не найдена');
  if(!r.players[token]){if(r.phase!=='lobby')return err('Игра уже идёт');if(Object.keys(r.players).length>=12)return err('Комната полна');r.players[token]=mkp(token,name);log(r,(name||'Гость')+' вошёл в бункер')}
  join(r,token,r.phase==='lobby'?name:null)});
 s.on('start',({seats,free})=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='lobby')return;
  const n=Object.keys(r.players).length;seats=+seats;free=Math.max(0,Math.min(5,+free||0));
  if(n<2)return err('Нужно хотя бы 2 игрока');if(!(seats>=1&&seats<n))return err('Мест должно быть от 1 до '+(n-1));
  r.seats=seats;r.free=free;r.bunker=pick(C.bunkers);r.disaster=pick(C.disasters);r.freeRooms=C.rooms.slice();r.shift=null;
  Object.values(r.players).forEach(p=>{const d=deal();p.card=d.card;p.abid=d.abid});
  const total=free+n-seats,pool=[];for(let i=2;i<=total;i++)pool.push(i);
  const k=Math.min(pool.length,2+rnd(2));while(r.cat.length<k)r.cat.push(pool.splice(rnd(pool.length),1)[0]);
  log(r,'Игра началась. '+r.disaster.t);newRound(r);push(r)});
 s.on('reveal',key=>{const r=R(),p=P();if(!r||r.phase!=='reveal'||!p.alive||r.order[r.ti]!==p.id||!KEYS.includes(key)||p.open[key])return;
  p.open[key]=true;p.rr=r.round;r.last={name:p.name,key,text:p.card[key],round:r.round};log(r,`${p.name} открыл (${key}): ${p.card[key]}`);r.ti++;skip(r);push(r)});
 s.on('skipturn',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='reveal')return;r.ti++;skip(r);push(r)});
 s.on('ability',({key,target,fkey,text})=>{const r=R(),p=P();if(!r||!['reveal','discuss','vote'].includes(r.phase)||!p.alive||!/^ab[12]$/.test(key)||p.used[key])return;
  const id=p.abid[key],t=r.players[target];
  if(id==='bluff'){if(!KEYS.includes(fkey)||!text)return err('Выбери категорию и напиши текст');p.fakes.push({key:fkey,text:String(text).slice(0,80),exp:r.round});log(r,`🎭 ${p.name} выставил карту (${fkey}): ${String(text).slice(0,80)}`)}
  else if(id==='blind'||id==='scramble'){Object.values(r.players).forEach(o=>o.id!==p.id&&o.sock&&io.to(o.sock).emit('fx',{type:id,by:p.name}));log(r,`✨ ${p.name}: ${id==='blind'?'Слепота':'Путаница'}`)}
  else if(id==='time'){if(r.phase!=='discuss')return err('Работает только во время обсуждения');r.deadline+=120000;log(r,`⏳ ${p.name} продлил обсуждение`)}
  else if(id==='spy'||id==='force'){if(!t||t.id===p.id||!t.alive)return err('Выбери другого игрока');const cl=left(t);if(!cl.length)return err('У него всё открыто');const k=pick(cl);
   if(id==='spy'){s.emit('toast',`Шпион: у ${t.name} закрыто «${k}»: ${t.card[k]}`);log(r,`🕵 ${p.name} использовал шпиона`)}
   else{t.open[k]=true;r.last={name:t.name,key:k,text:t.card[k],round:r.round};log(r,`⚖ ${p.name} заставил ${t.name} открыть (${k}): ${t.card[k]}`)}}
  else log(r,`✨ ${p.name} применил способность: ${p.card[key]}`);
  p.used[key]=true;if(!id)p.open[key]=true;push(r)});
 s.on('extend',m=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='discuss')return;r.deadline+=(m===2?120000:60000);push(r)});
 s.on('enddiscuss',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='discuss')return;afterDiscuss(r);push(r)});
 s.on('vote',t=>{const r=R(),p=P();if(!r||r.phase!=='vote'||!p.alive||t===p.id||!r.players[t]||!r.players[t].alive)return;r.votes[p.id]=t;if(alive(r).every(x=>r.votes[x.id]))tally(r);push(r)});
 s.on('tally',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='vote')return;tally(r);push(r)});
 s.on('disconnect',()=>{const p=P();if(p){p.online=false;p.sock=null;push(R())}});
});
srv.listen(process.env.PORT||3000,()=>console.log('Бункер Диониса запущен'));
