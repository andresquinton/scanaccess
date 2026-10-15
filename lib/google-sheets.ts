import {JWT} from 'google-auth-library';
let auth:JWT|undefined;
function googleAuth(){if(!process.env.GOOGLE_CLIENT_EMAIL||!process.env.GOOGLE_PRIVATE_KEY)throw Error('Configura GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY en Vercel y comparte la hoja con la cuenta de servicio.');return auth??=new JWT({email:process.env.GOOGLE_CLIENT_EMAIL,key:process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),scopes:['https://www.googleapis.com/auth/spreadsheets']});}
export function sheetsClient(){return {async invoke(_connector:string,action:string,args:any){try{
 const spreadsheet=process.env.GOOGLE_SPREADSHEET_ID;if(!spreadsheet)throw Error('Configura GOOGLE_SPREADSHEET_ID en Vercel.');
 const base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheet);
 let data:any;
 if(action==='get_spreadsheet_range'){const tab=process.env.GOOGLE_SHEET_NAME||'Worksheet';const range="'"+tab.replace(/'/g,"''")+"'!A1:F10000";data=(await googleAuth().request({url:base+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE',method:'GET',timeout:20000,retry:false})).data;}
 else if(action==='batch_update_spreadsheet'){const sheetId=Number(process.env.GOOGLE_SHEET_ID);if(!Number.isSafeInteger(sheetId)||!process.env.GOOGLE_SHEET_ID)throw Error('Configura GOOGLE_SHEET_ID en Vercel.');const requests=args.requests.map((r:any)=>({updateCells:{...r.updateCells,range:{...r.updateCells.range,sheetId}}}));data=(await googleAuth().request({url:base+':batchUpdate',method:'POST',data:{requests},timeout:20000,retry:false})).data;}
 else throw Error('Acción no permitida');
 return {status:'success',result:{structuredContent:data,content:[]}};
 }catch(e:any){const status=e?.response?.status;return {status:'google_error',message:status===403?'La cuenta de servicio no tiene permisos de edición o Sheets API no está habilitada.':status===429?'Google limita temporalmente las solicitudes. Vuelve a sincronizar en un minuto.':status?'No se pudo confirmar la operación en Google Sheets. Revisa la conexión antes de reintentar.':e.message};}}};}
