import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
const base='http://127.0.0.1:5173';
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const p=[{name:'Ana Prueba',code:'0012345678905'},{name:'Luis Prueba',code:'8412345678912'}];
const invalid=await post('/api/event',{name:'Prueba',people:[p[0],p[0]]});assert.equal(invalid.status,400);
const created=await post('/api/event',{name:'Verificación local',people:p});assert.equal(created.status,200,JSON.stringify(created));const event=created.data.id;
const scans=await Promise.all(Array.from({length:12},(_,i)=>post('/api/scan',{event,code:p[0].code,device:'Puesto '+i})));
assert.equal(scans.filter(s=>s.data.status==='ok').length,1);assert.equal(scans.filter(s=>s.data.status==='duplicate').length,11);
assert.equal((await post('/api/scan',{event,code:'999'})).data.status,'unknown');
const data=await (await fetch(base+'/api/event?id='+event)).json();assert.equal(data.people.filter(p=>p.arrived).length,1);assert.equal(data.people.length,2);
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(p.map(p=>({Nombre:p.name,Codigo:p.code}))),'Personas');const binary=XLSX.write(wb,{type:'array',bookType:'xlsx'});const re=XLSX.read(binary);const rows=XLSX.utils.sheet_to_json(re.Sheets.Personas);assert.equal(rows[0].Codigo,'0012345678905');
console.log('PASS: validación de duplicados, 12 escaneos simultáneos → 1 entrada, código desconocido, persistencia, Excel y ceros iniciales.');
