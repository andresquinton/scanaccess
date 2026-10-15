import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function post(path,body,auth=true){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin:base,...auth?{cookie}:{}},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const made=await post('/api/event',{name:'Prueba correcciones',people:[{name:'Invitada de prueba',code:''},{name:'Persona con código',code:'35060'},{name:'Otro invitado',code:''}]});assert.equal(made.status,200);const event=made.data.id;
const roster=await (await fetch(base+'/api/event?id='+event)).json();assert.equal(roster.people.length,3);const guest=roster.people.find(p=>p.name==='Invitada de prueba');assert.ok(guest.code.startsWith('guest:'));assert.equal(new Set(roster.people.map(p=>p.code)).size,3);
const body={event,code:guest.code,revision:0,attending:true,device:'Manual QA'};
assert.equal((await post('/api/attendance',body,false)).status,401);
const together=await Promise.all([post('/api/attendance',body),post('/api/attendance',body)]);assert.equal(together.filter(r=>r.status===200).length,1);assert.equal(together.filter(r=>r.status===409).length,1);
const marked=together.find(r=>r.status===200).data.person;assert.ok(marked.arrived);assert.equal(marked.revision,1);
const cleared=await post('/api/attendance',{...body,revision:1,attending:false});assert.equal(cleared.status,200);assert.equal(cleared.data.person.arrived,null);assert.equal(cleared.data.person.device,null);assert.equal(cleared.data.person.revision,2);
const restored=await post('/api/attendance',{...body,revision:2,attending:true});assert.equal(restored.status,200);
const scan=await post('/api/scan',{event,code:'S35060E',device:'Cámara'});assert.equal(scan.data.status,'ok');assert.equal(scan.data.person.revision,1);
assert.equal((await post('/api/attendance',{event,code:'35060',revision:0,attending:false})).status,409);
assert.equal((await post('/api/attendance',{event,code:'35060',revision:1,attending:false})).status,200);
assert.equal((await post('/api/scan',{event,code:'35060',device:'Cámara'})).data.status,'ok');
console.log('PASS: invitados sin código, identificación única, sesión obligatoria, registro concurrente, anular/restaurar, corrección obsoleta rechazada y reescaneo tras anulación.');
