import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use a local test server');
if(!process.env.TEST_ADMIN_PASSWORD)throw Error('Set TEST_ADMIN_PASSWORD');
const login=await fetch(base+'/api/auth',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({role:'admin',password:process.env.TEST_ADMIN_PASSWORD})});
assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin:base,cookie},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const p=[{name:'Ana Prueba',code:'35060'},{name:'Luis Prueba',code:'8412345678912'}];
const invalid=await post('/api/event',{name:'Prueba',people:[p[0],p[0]]});assert.equal(invalid.status,400);
const created=await post('/api/event',{name:'Verificación local',people:p});assert.equal(created.status,200,JSON.stringify(created));const event=created.data.id;
const scans=await Promise.all(Array.from({length:12},(_,i)=>post('/api/scan',{event,code:i%2?'S35060E':p[0].code,device:'Puesto '+i})));
assert.equal(scans.filter(s=>s.data.status==='ok').length,1);assert.equal(scans.filter(s=>s.data.status==='duplicate').length,11);
assert.equal((await post('/api/scan',{event,code:'999'})).data.status,'unknown');
const data=await (await fetch(base+'/api/event?id='+event,{headers:{cookie}})).json();assert.equal(data.people.filter(p=>p.arrived).length,1);assert.equal(data.people.length,2);
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(p.map(p=>({Nombre:p.name,Codigo:p.code}))),'Personas');const binary=XLSX.write(wb,{type:'array',bookType:'xlsx'});const re=XLSX.read(binary);const rows=XLSX.utils.sheet_to_json(re.Sheets.Personas);assert.equal(rows[0].Codigo,'35060');
console.log('PASS: validación de duplicados, 12 escaneos simultáneos → 1 entrada, código desconocido, persistencia, Excel y código numérico.');
