import { Pool, type PoolClient } from 'pg';
let pool: Pool | undefined;
export function databasePool(){
 if(!process.env.DATABASE_URL)throw new Error('Falta configurar DATABASE_URL en Vercel.');
 return pool ??= new Pool({connectionString:process.env.DATABASE_URL,max:2,idleTimeoutMillis:20000,connectionTimeoutMillis:10000,statement_timeout:15000,ssl:process.env.DATABASE_SSL==='disable'?false:{rejectUnauthorized:true,...process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}:{} }});
}
// Compatibility at the query boundary; application values always stay parameterized.
export function postgresQuery(input:string){
 let i=0;let query=input.replace(/\?/g,()=>'$'+(++i)).replace(/AS INTEGER/g,'AS BIGINT');
 if(query.startsWith('INSERT OR IGNORE INTO '))query=query.replace('INSERT OR IGNORE INTO ','INSERT INTO ')+' ON CONFLICT DO NOTHING';
 return query;
}
class Statement{
 constructor(readonly query:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new Statement(this.query,values);}
 async execute(client?:PoolClient){return (client||databasePool()).query(postgresQuery(this.query),this.values);}
 async first<T=Record<string,unknown>>(){return ((await this.execute()).rows[0] as T|undefined)??null;}
 async all<T=Record<string,unknown>>(){return {results:(await this.execute()).rows as T[]};}
 async run(){const result=await this.execute();return {meta:{changes:result.rowCount}};}
}
export const database={prepare:(query:string)=>new Statement(query),async batch(statements:Statement[]){if(!statements.length)return [];const c=await databasePool().connect();try{await c.query('BEGIN');const results=[];for(const s of statements)results.push(await s.execute(c));await c.query('COMMIT');return results;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
