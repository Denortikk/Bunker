const express=require('express'),http=require('http'),{Server}=require('socket.io'),C=require('./cards');
const app=express();app.get('/',(q,r)=>r.sendFile(__dirname+'/index.html'));
app.use((q,r,n)=>/^\/[\w-]+\.(jpe?g|png|webp)$/.test(q.path)?r.sendFile(__dirname+q.path,e=>e&&r.status(404).end()):n());
const srv=http.createServer(app),io=new Server(srv),rooms={};
const rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];
const NT=['spy','force','swap','silence','wipe','duel','lightning','candidate','tost','grill','shield','gift','frame','rumor','insight','jam','hood','coin'];
const MIR=['force','silence','wipe','candidate','tost','grill','frame','jam','hood','rumor','coin'];
const nxt=(u,k,list)=>{if(!u[k]||!u[k].length)u[k]=list.slice().sort(()=>Math.random()-.5);return u[k].pop()};
const KEYS=['prof','bio','health','hobby','bag','fact','fact2','phobia'];
const bc=(r,m)=>Object.values(r.players).forEach(o=>o.sock&&io.to(o.sock).emit('toast',m));
const dice=(r,title,rolls)=>Object.values(r.players).forEach(o=>o.sock&&io.to(o.sock).emit('dice',{title,rolls}));
const bio=()=>{const g=Math.random()<.88?pick(['Мужчина','Женщина']):pick(C.beings);const odd=!/^(Мужчина|Женщина)$/.test(g);const x=Math.random();
 return g+', '+(odd&&x<.4?pick(C.ages):x<.8?(18+rnd(48))+' лет':(66+rnd(30))+' лет')};
const mkCode=()=>{let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms[c]);return c};
const uniq=(list,used)=>{let v,g=0;do{v=pick(list)}while(used.has(v)&&g++<30);used.add(v);return v};
function deal(used){
 const sp=()=>{const a=Math.random()<.15?nxt(used,'pm',C.perm):nxt(used,'ab',C.abx);return{t:a.t,id:a.id}};
 const a1=sp();let a2=sp(),g=0;while(a2.id===a1.id&&g++<20)a2=sp();
 const F=[uniq(C.factsGood,used.fact),uniq(C.factsBad,used.fact)];if(Math.random()<.5)F.reverse();
 const fx={};if(Math.random()<.35){const dd=pick(C.dyn),dk=Math.random()<.5?'fact':'fact2';F[dk==='fact'?0:1]=dd.t;fx[dk]=dd.fx}
 return{fx,abid:{ab1:a1.id,ab2:a2.id},card:{prof:uniq(C.prof,used.prof),bio:bio(),health:uniq(C.health,used.health),hobby:uniq(C.hobby,used.hobby),bag:uniq(C.bag,used.bag),fact:F[0],fact2:F[1],phobia:uniq(C.phobia,used.phobia),ab1:a1.t,ab2:a2.t}}}
const alive=r=>Object.values(r.players).filter(p=>p.alive);
const left=p=>KEYS.filter(k=>!p.open[k]);
const log=(r,t)=>r.log.push(t);
const vr=r=>r.round<=r.free?r.free+1:r.round;
function view(r,id){return{t:Date.now(),code:r.code,name:r.name,host:r.host,me:id,phase:r.phase,round:r.round,seats:r.seats,free:r.free,bunker:r.bunker,bimg:r.bunker?C.bunkerImg(r.bunker):null,disaster:r.disaster,
 events:(r.events||[]).map(e=>({i:e.i,t:e.t,d:e.d,img:e.img})),pop:r.pop||null,popSeq:r.popSeq||0,rooms:r.rooms,order:r.order||[],turn:r.order&&r.order[r.ti],tbl:r.tbl||[],deadline:r.deadline,q:r.q,log:r.log.slice(-40),
 players:Object.values(r.players).map(p=>{const own=p.id===id||r.phase==='end';const card={},open={};
  for(const k in (p.card||{}))if(own||p.open[k]){card[k]=p.card[k];open[k]=!!p.open[k]}
  (p.fakes||[]).forEach(f=>{card[f.key]=f.text;open[f.key]=true});
  return{id:p.id,name:p.name,alive:p.alive,online:p.online,vote:r.phase==='vote'?(r.votes[p.id]?(r.secret===r.round&&p.id!==id?'?':r.votes[p.id]):null):null,open,used:p.used,card,fk:(p.fakes||[]).map(f=>f.key),abid:p.id===id?p.abid:null,perm:p.id===id?p.perm||null:null,mark:p.mark||'',secret:own?p.secret||null:null}})}}
const push=r=>Object.values(r.players).forEach(p=>p.sock&&io.to(p.sock).emit('state',view(r,p.id)));
function show(r,o,k){r.tbl.push({id:o.id,key:k,text:o.card[k]})}
function newRound(r){r.round++;r.phase='reveal';r.votes={};r.deadline=null;r.tbl=[];
 Object.values(r.players).forEach(p=>p.fakes=(p.fakes||[]).filter(f=>f.exp>=r.round));
 r.order=alive(r).map(p=>p.id);r.ti=0;if(r.nextReverse){r.order.reverse();r.nextReverse=false}
 if(r.round%2===1&&r.freeRooms.length){const rm=r.freeRooms.splice(rnd(r.freeRooms.length),1)[0];r.rooms.push(rm);log(r,`🚪 Открыта комната: ${rm.t}`)}
 if(r.cat.includes(r.round)){const pool=C.events.filter(x=>!r.events.includes(x));if(pool.length){const e=pick(pool);r.events.push(e);r.pop={i:e.i,t:e.t,d:e.d,img:e.img,tag:'Событие'};r.popSeq++;log(r,`${e.i} СОБЫТИЕ: ${e.t}`)}}
 Object.values(r.players).forEach(p=>{if(p.alive&&p.perm==='allseeing'&&p.sock){const o=alive(r).filter(x=>x.id!==p.id&&x.perm!=='stoic'&&left(x).length);if(o.length){const t=pick(o),k=pick(left(t));io.to(p.sock).emit('toast',`Всевидящий: у ${t.name} закрыто «${k}»: ${t.card[k]}`)}}});
 log(r,`— Раунд ${r.round} —`);skip(r)}
function skip(r){while(r.ti<r.order.length&&!left(r.players[r.order[r.ti]]).length)r.ti++;if(r.ti>=r.order.length)startDiscuss(r)}
function startDiscuss(r){r.q=pick(C.questions);r.phase='discuss';r.deadline=Date.now()+(r.disc||180000)+(r.extra||0);r.extra=0;log(r,'💬 Обсуждение')}
function afterDiscuss(r){if(r.round>r.free){r.phase='vote';r.votes={};r.deadline=null;log(r,'🗳 Голосование')}else newRound(r)}
function outcomes(r){Object.values(r.players).forEach(p=>{const s=p.secret;if(!s)return;let ok;
 if(s.kind==='bond')ok=p.alive&&r.players[s.partner].alive;else if(s.typ==='survive')ok=p.alive;else if(s.typ==='hunter')ok=!r.players[s.target].alive;else ok=r.players[s.target].alive;
 log(r,`🔒 Тайна ${p.name}: «${s.text}» — ${ok?'ВЫПОЛНЕНО ✅':'провалено ❌'}`)})}
function fire(r,o,k){const fx=o.fx&&o.fx[k];if(!fx)return;const V=vr(r);
 if(fx==='applause'){o.imm=V;log(r,`👏 ${o.name}: иммунитет в ближайшем голосовании`)}
 else if(fx==='scandal'){o.muted=V;log(r,`💥 ${o.name} устроил скандал: не голосует в ближайшем голосовании`)}
 else if(fx==='bragger'){const cl=left(o);if(cl.length){const k2=pick(cl);o.open[k2]=true;show(r,o,k2);log(r,`📣 ${o.name} проболтался и открыл ещё (${k2}): ${o.card[k2]}`)}}
 else if(fx==='curious'){const os=alive(r).filter(x=>x.id!==o.id&&x.perm!=='stoic'&&left(x).length);if(os.length&&o.sock){const t=pick(os),k3=pick(left(t));io.to(o.sock).emit('toast',`Любопытство: у ${t.name} закрыто «${k3}»: ${t.card[k3]}`)}}
 else if(fx==='jackpot'){const d=1+rnd(6);if(d>=5)o.dbl=V;else if(d<=2)o.muted=V;dice(r,'Азартный факт',[{name:o.name,v:d}]);log(r,`🎰 ${o.name} бросил кубик (${d}): ${d>=5?'двойной голос':d<=2?'не голосует':'ничего'}`)}
 else if(fx==='gossip')bc(r,`🗣 ${o.name} выдал секрет, теперь о нём шепчутся все`)}
function tally(r){const cnt={};
 Object.entries(r.votes).forEach(([vid,t])=>{const T=r.players[t],Vp=r.players[vid];if(Vp.perm==='lucky'||(T.imm===r.round&&T.perm!=='tyrant'))return;cnt[t]=(cnt[t]||0)+(Vp.dbl===r.round||Vp.perm==='tyrant'?2:1)+(Vp.bonus===r.round?1:0)});
 Object.values(r.players).forEach(x=>{if(x.alive&&x.cand===r.round&&!(x.imm===r.round&&x.perm!=='tyrant'))cnt[x.id]=(cnt[x.id]||0)+2});
 const mx=Math.max(0,...Object.values(cnt)),top=Object.keys(cnt).filter(k=>cnt[k]===mx);
 if(!top.length){log(r,'Голосов нет или у всех иммунитет. Без изгнания.');return newRound(r)}
 const tp=top.filter(i=>r.players[i].perm!=='lucky'),p=top.map(i=>r.players[i]).find(x=>x.perm==='stoic')||r.players[pick(tp.length?tp:top)];
 if(r.secret===r.round)log(r,'Голоса: '+Object.entries(r.votes).map(([a,b])=>r.players[a].name+'→'+r.players[b].name).join(', '));
 if(p.lucky===r.round){const d=1+rnd(6);dice(r,'Счастливый билет',[{name:p.name,v:d}]);if(d>=4){log(r,`🍀 ${p.name} вытянул счастливый билет (${d}) и остаётся в бункере`);return newRound(r)}}
 p.alive=false;
 log(r,`🔥 ${p.name} изгнан (${mx} гол.${top.length>1?', ничья, решила судьба':''}). Он был: ${p.card.prof}`);
 {const b=p.secret&&p.secret.kind==='bond'&&r.players[p.secret.partner];if(b&&b.alive){b.alive=false;log(r,`💔 Нить оборвалась: ${b.name} уходит вслед за ${p.name}. Он был: ${b.card.prof}`)}}
 if(alive(r).length<=r.seats){r.phase='end';outcomes(r);log(r,'🏛 Бункер закрыт. Выжили: '+alive(r).map(x=>x.name).join(', '))}else newRound(r)}
setInterval(()=>{for(const r of Object.values(rooms))if(r.phase==='discuss'&&Date.now()>r.deadline){afterDiscuss(r);push(r)}},1000);
io.on('connection',s=>{
 const R=()=>rooms[s.data.room],P=()=>R()&&R().players[s.data.pid],err=m=>s.emit('err',m);
 const join=(r,id,name)=>{s.data={room:r.code,pid:id};const p=r.players[id];p.sock=s.id;p.online=true;if(name)p.name=name;push(r)};
 const mkp=(id,name)=>({id,name:(name||'Гость').slice(0,20),alive:true,open:{},used:{},rr:0,fakes:[]});
 s.on('create',({name,room,token})=>{const c=mkCode();const r=rooms[c]={code:c,name:(room||'Пир').slice(0,30),host:token,players:{},phase:'lobby',round:0,votes:{},log:[],cat:[],rooms:[],events:[],tbl:[],popSeq:0};r.players[token]=mkp(token,name);join(r,token)});
 s.on('join',({code,name,token})=>{const r=rooms[(code||'').toUpperCase()];if(!r)return err('Комната не найдена');
  if(!r.players[token]){if(r.phase!=='lobby')return err('Игра уже идёт');if(Object.keys(r.players).length>=12)return err('Комната полна');r.players[token]=mkp(token,name);log(r,(name||'Гость')+' вошёл в бункер')}
  join(r,token,r.phase==='lobby'?name:null)});
 s.on('start',({seats,free})=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='lobby')return;
  const n=Object.keys(r.players).length;seats=+seats;free=Math.max(0,Math.min(5,isNaN(+free)?2:+free));
  if(n<2)return err('Нужно хотя бы 2 игрока');if(!(seats>=1&&seats<n))return err('Мест должно быть от 1 до '+(n-1));
  r.seats=seats;r.free=free;r.disc=n<=3?90000:n<=5?150000:180000;r.extra=0;r.bunker=pick(C.bunkers);r.disaster=pick(C.disasters);r.freeRooms=C.rooms.slice();r.events=[];r.cat=[];r.rooms=[];r.tbl=[];
  const used={prof:new Set(),health:new Set(),hobby:new Set(),bag:new Set(),fact:new Set(),phobia:new Set()};
  Object.values(r.players).forEach(p=>{const d=deal(used);p.card=d.card;p.abid=d.abid;p.fx=d.fx});
  {const slots=[];Object.values(r.players).forEach(p=>['ab1','ab2'].forEach(k=>slots.push([p,k])));
   for(const gid of (n>=3?['bluff','blind']:['bluff']))if(!slots.some(([p,k])=>p.abid[k]===gid)){const c=slots.filter(([p,k])=>!['bluff','blind'].includes(p.abid[k]));if(c.length){const[p,k]=pick(c),a=C.abx.find(x=>x.id===gid);p.abid[k]=a.id;p.card[k]=a.t}}}
  {const ids=Object.keys(r.players),pool=ids.slice(),take=()=>pool.splice(rnd(pool.length),1)[0];
   if(pool.length>=2&&Math.random()<1/6){const a=take(),b=take(),[ta,tb]=pick(C.bonds);r.players[a].secret={kind:'bond',text:ta.replace('{P}',r.players[b].name),partner:b};r.players[b].secret={kind:'bond',text:tb.replace('{P}',r.players[a].name),partner:a}}
   if(pool.length&&Math.random()<1/7){const a=take(),typ=pick(['survive','hunter','guardian']),T=r.players[pick(ids.filter(i=>i!==a))];r.players[a].secret={kind:'mission',typ,text:pick(C.missions[typ]).replace(/\{T\}/g,T.name),target:T.id}}}
  if(Math.random()<.55){const pl=pick(Object.values(r.players)),g=pick(C.legend),kk=g.key==='fact'?pick(['fact','fact2']):g.key;pl.card[kk]=g.t;if(pl.fx)delete pl.fx[kk]}
  const total=free+n-seats,pool=[];for(let i=2;i<=total;i++)pool.push(i);
  const k=Math.min(pool.length,1+rnd(2));while(r.cat.length<k)r.cat.push(pool.splice(rnd(pool.length),1)[0]);
  r.pop={i:r.disaster.i,t:r.disaster.t,d:r.disaster.d,img:r.disaster.img,tag:'Катастрофа',extra:r.bunker,bimg:C.bunkerImg(r.bunker)};r.popSeq++;
  log(r,'Игра началась. '+r.disaster.t);r.round=0;newRound(r);push(r)});
 s.on('reveal',key=>{const r=R(),p=P();if(!r||r.phase!=='reveal'||!p.alive||r.order[r.ti]!==p.id||!KEYS.includes(key)||p.open[key])return;
  p.open[key]=true;p.rr=r.round;show(r,p,key);log(r,`${p.name} открыл (${key}): ${p.card[key]}`);fire(r,p,key);r.ti++;skip(r);push(r)});
 s.on('skipturn',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='reveal')return;r.ti++;skip(r);push(r)});
 s.on('ability',({key,target,fkey,text})=>{const r=R(),p=P();if(!r||!['reveal','discuss','vote'].includes(r.phase)||!p.alive||!/^ab[12]$/.test(key)||p.used[key])return;
  const id=p.abid[key],to=(o,m)=>o.sock&&io.to(o.sock).emit('toast',m),V=vr(r);let t=r.players[target];if(p.jam===r.round)return err('Твои способности заглушены до конца раунда');
  if(NT.includes(id)&&(!t||(t.id===p.id&&id!=='shield')||!t.alive))return err('Выбери цель');
  if(t&&t.perm==='stoic'&&t.id!==p.id&&NT.includes(id))return err('Эта цель непоколебима: способности на неё не действуют');
  if(['bluff','swap','hide','reroll','wipe','extra','frame','insight'].includes(id)&&!KEYS.includes(fkey))return err('Выбери категорию');
  if(t&&t.id!==p.id&&t.mirror===r.round&&MIR.includes(id)){log(r,`🪞 Зеркало ${t.name} отразило способность на ${p.name}`);to(t,'Зеркало сработало: способность отражена');t=p}
  if(id==='bluff'){if(!text)return err('Напиши текст карточки');p.fakes.push({key:fkey,text:String(text).slice(0,80),exp:r.round});log(r,`🎭 ${p.name} выставил карту (${fkey}): ${String(text).slice(0,80)}`)}
  else if(id==='blind'||id==='scramble'){Object.values(r.players).forEach(o=>o.id!==p.id&&o.perm!=='stoic'&&o.sock&&io.to(o.sock).emit('fx',{type:id,by:p.name}));log(r,`✨ ${p.name}: ${id==='blind'?'Слепота':'Путаница'}`)}
  else if(id==='time'){if(r.phase==='discuss')r.deadline+=120000;else r.extra=(r.extra||0)+120000;log(r,`⏳ ${p.name} добавил 2 минуты к обсуждению`)}
  else if(id==='spy'||id==='force'){const cl=left(t);if(!cl.length)return err('У него всё открыто');const k=pick(cl);
   if(id==='spy'){s.emit('toast',`Шпион: у ${t.name} закрыто «${k}»: ${t.card[k]}`);log(r,`🕵 ${p.name} использовал шпиона`)}
   else{t.open[k]=true;show(r,t,k);log(r,`⚖ ${p.name} заставил ${t.name} открыть (${k}): ${t.card[k]}`);fire(r,t,k)}}
  else if(id==='swap'){const x=p.card[fkey],xo=!!p.open[fkey];p.card[fkey]=t.card[fkey];p.open[fkey]=!!t.open[fkey];t.card[fkey]=x;t.open[fkey]=xo;
   {p.fx=p.fx||{};t.fx=t.fx||{};const fa=p.fx[fkey],fb=t.fx[fkey];if(fb)p.fx[fkey]=fb;else delete p.fx[fkey];if(fa)t.fx[fkey]=fa;else delete t.fx[fkey]}
   s.emit('toast',`Обмен: ты получил «${p.card[fkey]}»`);to(t,`${p.name} тайно поменялся с тобой. Теперь у тебя: «${t.card[fkey]}»`)}
  else if(id==='hide'){if(!p.open[fkey])return err('Эта карта и так закрыта');p.open[fkey]=false;log(r,`🙈 ${p.name} спрятал одну из карт`)}
  else if(id==='immune'){p.imm=V;log(r,`🛡 ${p.name} получил иммунитет в ближайшем голосовании`)}
  else if(id==='double'){p.dbl=V;log(r,`⚖ ${p.name}: двойной голос в ближайшем голосовании`)}
  else if(id==='silence'){t.muted=V;log(r,`🤐 ${t.name} не голосует в ближайшем голосовании`);to(t,'Тебе заткнули рот: в ближайшем голосовании голосовать нельзя')}
  else if(id==='reroll'){const o=fkey==='bio'?bio():fkey.startsWith('fact')?pick(C.factsGood.concat(C.factsBad)):pick(C[fkey]);p.card[fkey]=o;p.open[fkey]=false;if(p.fx)delete p.fx[fkey];s.emit('toast',`Новая карта: «${o}»`);log(r,`🎲 ${p.name} переродился`)}
  else if(id==='wipe'){if(!t.open[fkey]||t.fakes.some(f=>f.key===fkey))return err('Эта карта у него не открыта');t.open[fkey]=false;log(r,`🧽 ${p.name} стёр открытую карту у ${t.name}`)}
  else if(id==='extra'){if(p.open[fkey])return err('Эта карта уже открыта');p.open[fkey]=true;show(r,p,fkey);log(r,`➕ ${p.name} открыл вне очереди (${fkey}): ${p.card[fkey]}`);fire(r,p,fkey)}
  else if(['stoic','tyrant','allseeing'].includes(id)){p.perm=id;if(id==='allseeing'){p.open.phobia=true;show(r,p,'phobia')}log(r,'⚙ Кто-то активировал постоянную способность')}
  else if(id==='condensed'){p.imm=V;p.mark='🍯';const cl=left(p);if(cl.length){const k=pick(cl);p.open[k]=true;show(r,p,k);fire(r,p,k)}log(r,`🍯 ${p.name} съел всю спущенку бункера! Иммунитет в ближайшем голосовании, одна карта раскрыта`)}
  else if(id==='gamble'){const d=1+rnd(6);dice(r,'Азартная игра',[{name:p.name,v:d}]);if(d>=5){p.imm=V;p.dbl=V}else if(d<=2)p.muted=V;log(r,`🎲 ${p.name} бросил кубик: ${d}. ${d>=5?'Удача: иммунитет и двойной голос':d<=2?'Провал: не голосует':'Ничего'}`)}
  else if(id==='duel'){const a=1+rnd(6),b=1+rnd(6),w=a>b?p:b>a?t:null,l=a>b?t:b>a?p:null;let m='Ничья, ничего не меняется';dice(r,'Дуэль на кубиках',[{name:p.name,v:a},{name:t.name,v:b}]);
   if(w){l.muted=V;m=`${w.name} побеждает, ${l.name} не голосует в ближайшем голосовании`;if(Math.max(a,b)>=5){const g=pick(C.abx.filter(x=>x.id!=='duel')),sl=['ab1','ab2'].find(k=>w.used[k]);
    if(sl){w.card[sl]=g.t;w.abid[sl]=g.id;w.used[sl]=false;w.open[sl]=false;to(w,'Трофей дуэли: '+g.t);m+=' и получает новую способность'}else{w.imm=V;m+=' и иммунитет'}}}
   log(r,`⚔ Дуэль ${p.name} (${a}) против ${t.name} (${b}): ${m}`)}
  else if(id==='lightning'){const d=1+rnd(6),o=d===6?t:d===1?p:null;dice(r,'Молния Зевса',[{name:p.name,v:d}]);if(o){left(o).sort(()=>Math.random()-.5).slice(0,2).forEach(k=>{o.open[k]=true;show(r,o,k);fire(r,o,k)})}log(r,`⚡ ${p.name} метнул молнию (кубик ${d}). ${o?o.name+' открывает две карты':'Мимо'}`)}
  else if(id==='candidate'){t.cand=V;log(r,`📌 ${p.name} назначил кандидатом на изгнание: ${t.name} (+2 голоса против него)`)}
  else if(id==='shield'){t.imm=V;log(r,`🛡 ${p.name} защитил ${t.id===p.id?'себя':t.name} в ближайшем голосовании`)}
  else if(id==='gift'){t.bonus=V;p.muted=V;log(r,`🎁 ${p.name} отдал голос игроку ${t.name}: его голос считается на 1 больше, а сам ${p.name} не голосует`)}
  else if(id==='tost'){bc(r,`🥂 ${p.name} требует: ${t.name} должен сказать тост за бункер!`);log(r,`🥂 ${t.name} должен сказать тост (требует ${p.name})`)}
  else if(id==='grill'){bc(r,`❓ ${p.name} допрашивает ${t.name}: отвечай честно!`);log(r,`❓ ${p.name} допрашивает ${t.name}`)}
  else if(id==='frame'){if(!text)return err('Напиши текст карточки');t.fakes.push({key:fkey,text:String(text).slice(0,80),exp:r.round});log(r,`🎭 У ${t.name} появилась карта (${fkey}): ${String(text).slice(0,80)}`)}
  else if(id==='rumor'){if(!text)return err('Напиши слух');bc(r,`🗣 Ходят слухи про ${t.name}: «${String(text).slice(0,100)}»`);log(r,`🗣 Слух про ${t.name}: «${String(text).slice(0,100)}»`)}
  else if(id==='insight'){s.emit('toast',`Проницательность: у ${t.name} «${fkey}»: ${t.card[fkey]}`);log(r,`🔎 ${p.name} кого-то изучает`)}
  else if(id==='mirror'){p.mirror=r.round;log(r,`🪞 ${p.name} поставил зеркало до конца раунда`)}
  else if(id==='wheel'){const d=1+rnd(6);dice(r,'Колесо судьбы',[{name:p.name,v:d}]);let m='ничего';
   if(d===1){p.muted=V;m='не голосует'}else if(d===2){const cl=left(p);if(cl.length){const k=pick(cl);p.open[k]=true;show(r,p,k);fire(r,p,k)}m='открывает карту'}else if(d===4){p.imm=V;m='иммунитет'}else if(d===5){p.dbl=V;m='двойной голос'}
   else if(d===6){const sl=['ab1','ab2'].find(k=>k!==key&&p.used[k]);if(sl){p.used[sl]=false;m='перезарядка способности'}else{p.imm=V;m='иммунитет'}}
   log(r,`🎡 ${p.name} крутит колесо судьбы (${d}): ${m}`)}
  else if(id==='coin'){const h=Math.random()<.5,o=h?t:p,cl=left(o);if(cl.length){const k=pick(cl);o.open[k]=true;show(r,o,k);fire(r,o,k)}log(r,`🪙 ${p.name} подбросил монету: ${h?'орёл':'решка'}, карту открывает ${o.name}`)}
  else if(id==='recall'){const sl=['ab1','ab2'].find(k=>k!==key&&p.used[k]);if(!sl)return err('Нет использованной способности для перезарядки');p.used[sl]=false;log(r,`🔁 ${p.name} перезарядил способность`)}
  else if(id==='ballot'){r.secret=V;log(r,'🗳 Ближайшее голосование будет тайным')}
  else if(id==='jam'){t.jam=r.round;log(r,`📡 ${t.name} заглушён: способности недоступны до конца раунда`);to(t,'Тебя заглушили: способности недоступны до конца раунда')}
  else if(id==='lucky'){p.lucky=V;log(r,`🍀 ${p.name} надеется на удачу в ближайшем голосовании`)}
  else if(id==='hood'){if(t.sock)io.to(t.sock).emit('fx',{type:'blind',by:'кто-то'});log(r,`🧺 На ${t.name} накинули мешок`)}
  else if(id==='reverse'){if(r.phase==='reveal'){r.order=r.order.slice(0,r.ti).concat(r.order.slice(r.ti).reverse())}else r.nextReverse=true;log(r,'🔄 Порядок ходов развёрнут')}
  else if(id==='pass'){if(!(r.phase==='reveal'&&r.order[r.ti]===p.id))return err('Пас работает только в твой ход');r.ti++;skip(r);log(r,`⏭ ${p.name} пропустил ход`)}
  else log(r,`✨ ${p.name} применил способность`);
  if(!['spy','swap','reroll','insight'].includes(id))s.emit('toast','✅ Применено: '+String(p.card[key]).split(':')[0]);
  p.used[key]=true;if(!left(p).length&&r.phase==='reveal'&&r.order[r.ti]===p.id)skip(r);push(r)});
 s.on('newq',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='discuss')return;r.q=pick(C.questions);push(r)});
 s.on('restart',()=>{const r=R();if(!r||r.host!==s.data.pid)return;
  Object.keys(r.players).forEach(id=>{const p=r.players[id];if(!p.online)delete r.players[id];else r.players[id]={id,name:p.name,sock:p.sock,online:true,alive:true,open:{},used:{},rr:0,fakes:[]}});
  Object.assign(r,{phase:'lobby',round:0,votes:{},log:[],cat:[],rooms:[],events:[],pop:null,tbl:[],order:[],ti:0,deadline:null,q:null,disaster:null,bunker:null});log(r,'Новая игра: все на местах');push(r)});
 if(process.env.BUNKER_TEST)s.on('_t',({abid,card})=>{const p=P();if(p){Object.assign(p.abid,abid||{});Object.assign(p.card,card||{});p.used={};p.perm=null;p.muted=0;p.imm=0}});
 s.on('extend',m=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='discuss')return;r.deadline+=(m===2?120000:60000);push(r)});
 s.on('enddiscuss',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='discuss')return;afterDiscuss(r);push(r)});
 s.on('vote',t=>{const r=R(),p=P();if(!r||r.phase!=='vote'||!p.alive||t===p.id||!r.players[t]||!r.players[t].alive)return;if(p.muted===r.round)return err('У тебя кляп: голосовать нельзя');r.votes[p.id]=t;if(alive(r).every(x=>r.votes[x.id]||x.muted===r.round))tally(r);push(r)});
 s.on('tally',()=>{const r=R();if(!r||r.host!==s.data.pid||r.phase!=='vote')return;tally(r);push(r)});
 s.on('disconnect',()=>{const p=P();if(p){p.online=false;p.sock=null;push(R())}});
});
srv.listen(process.env.PORT||3000,()=>console.log('Бункер Диониса запущен'));
