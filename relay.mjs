import {randomUUID} from 'node:crypto';
import Answers from './answer-comments.cjs';
export function normalizeId(value){const id=String(value||'').trim().replace(/^[@＠]/,'').toLowerCase();if(!/^[a-z0-9._]{2,24}$/.test(id))throw Error('invalid-id');return id}
export function eventTime(raw,now=Date.now()){const value=raw?.common?.createTime??raw?.createTime??raw?.timestamp;if(value==null)return now;const n=Number(value);return Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):null}
export function upstreamFailure(error){
 const e=error?.exception||error,message=String(e?.message||'');
 const kind=/isn.t online|not online|offline/i.test(message)?'offline':/rate.?limit|too many requests/i.test(message)?'rate-limit':/sign|api.?key|unauthori[sz]ed/i.test(message)?'signing':/timeout|timed out/i.test(message)?'timeout':'connection';
 const type=String(e?.name||e?.constructor?.name||'Error').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);
 return {kind,type};
}
// Room connections are shared only for the same ID. No usernames, avatars or chat history are stored.
export function createRelay({createConnection,now=Date.now,timeoutMs=20000,maxRooms=32,maxClients=128,maxStartsPerMinute=30,onDiagnostic=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const rooms=new Map(),clients=new Set();let stopped=false,startWindow=now(),starts=0;
 const send=(client,payload)=>{if(client.socket.readyState!==1)return;if(client.socket.bufferedAmount>65536){client.socket.close(1013,'slow client');return}client.socket.send(JSON.stringify({...payload,subscriptionId:client.subscriptionId}))};
 const status=(client,state,extra={})=>send(client,{type:'status',state,...extra});
 const release=(client)=>{const room=client.room;client.room=null;if(!room)return;room.clients.delete(client);if(room.clients.size)return;room.closed=true;clearTimer(room.timer);if(rooms.get(room.id)===room)rooms.delete(room.id);Promise.resolve().then(()=>room.connection.disconnect()).catch(()=>{})};
 const end=(room,state)=>{if(room.closed)return;room.closed=true;clearTimer(room.timer);if(rooms.get(room.id)===room)rooms.delete(room.id);for(const c of room.clients){c.room=null;status(c,state,{terminal:true})}room.clients.clear();Promise.resolve().then(()=>room.connection.disconnect()).catch(()=>{})};
 const failure=(room,error)=>{if(room.closed)return;const diagnostic=upstreamFailure(error);try{onDiagnostic(diagnostic)}catch{}end(room,diagnostic.kind==='offline'?'指定した配信者は現在配信中ではありません。配信開始後に接続してください':'LIVEに接続できません。配信状態を確認して再接続してください')};
 const subscribe=(client,payload)=>{
  let id;try{id=normalizeId(payload.tiktokId)}catch{status(client,'TikTok IDを確認してください',{terminal:true});return}
  if(client.subscriptions++>=8){status(client,'接続先の変更が多すぎます。接続し直してください',{terminal:true});return}
  release(client);client.subscriptionId=String(payload.subscriptionId||randomUUID()).slice(0,80);client.joinedAt=now();client.roundStartedAt=client.joinedAt;
  let room=rooms.get(id);
  if(!room){
   if(rooms.size>=maxRooms){status(client,'LIVE接続が混み合っています',{terminal:true});return}
   if(now()-startWindow>=60000){startWindow=now();starts=0}if(starts>=maxStartsPerMinute){status(client,'接続要求が混み合っています。1分後に接続し直してください',{terminal:true});return}starts++;
   let connection;try{connection=createConnection(id)}catch{status(client,'LIVE接続を開始できません',{terminal:true});return}
   room={id,connection,clients:new Set(),closed:false,ready:false,seen:new Set(),startedAt:now(),timer:null};rooms.set(id,room);
   connection.on('error',error=>failure(room,error));
   connection.on('disconnected',()=>end(room,'LIVEから切断されました。再接続してください'));
   connection.on('streamEnd',()=>end(room,'LIVE配信が終了しました'));
   connection.on('chat',raw=>{
    if(room.closed||!room.ready)return;
    const comment=String(raw?.content??raw?.comment??'').trim();if(!Answers.parse(comment))return;
    const timestamp=eventTime(raw,now());if(timestamp===null||timestamp<room.startedAt||timestamp>now()+60000)return;
    const eventId=String(raw.msgId??raw.common?.msgId??raw.eventId??randomUUID());if(room.seen.has(eventId))return;room.seen.add(eventId);if(room.seen.size>512)room.seen.delete(room.seen.values().next().value);
    for(const c of room.clients)if(timestamp>=c.joinedAt&&timestamp>=c.roundStartedAt)send(c,{type:'chat',comment,eventId,timestamp});
   });
   // Register the subscriber before connect() can synchronously emit events.
   client.room=room;room.clients.add(client);status(client,'TikTok LIVEに接続中…');
   room.timer=setTimer(()=>end(room,'LIVEへの接続がタイムアウトしました。再接続してください'),timeoutMs);
   Promise.resolve().then(()=>connection.connect()).then(()=>{if(room.closed){return Promise.resolve(connection.disconnect()).catch(()=>{})}room.ready=true;clearTimer(room.timer);for(const c of room.clients)status(c,'LIVE接続済み：コメントを待機中')}).catch(error=>failure(room,error));
  }else{client.room=room;room.clients.add(client);status(client,room.ready?'LIVE接続済み：コメントを待機中':'TikTok LIVEに接続中…')}
 };
 function attach(socket){
  if(stopped||clients.size>=maxClients){socket.close(1013,'capacity');return}
  const client={socket,room:null,subscriptionId:'',subscriptions:0,joinedAt:now(),roundStartedAt:now()};clients.add(client);
  const handshake=setTimer(()=>{if(!client.room)socket.close(1008,'subscription required')},10000);
  socket.on('message',bytes=>{
   let payload;try{payload=JSON.parse(String(bytes))}catch{return}
   if(payload?.type==='subscribe'){clearTimer(handshake);subscribe(client,payload)}
   else if(payload?.type==='round'&&client.room&&payload.subscriptionId===client.subscriptionId){client.roundStartedAt=now()}
  });
  const dispose=()=>{clearTimer(handshake);release(client);clients.delete(client)};socket.on('close',dispose);socket.on('error',dispose);
 }
 return {attach,stats:()=>({rooms:rooms.size,clients:clients.size}),close:()=>{stopped=true;for(const client of [...clients]){release(client);client.socket.close(1001,'shutdown')}clients.clear()}};
}
