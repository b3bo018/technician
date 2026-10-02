import express from 'express';
import { Pool } from 'pg';
import { requireAuth, type AuthedRequest } from './auth.js';
const app=express();app.use(express.json({limit:'2mb'}));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
type AuthedRequest=express.Request&{user?:{sub:string;email?:string}};
function requireAuth(req:AuthedRequest,res:express.Response,next:express.NextFunction){const sub=req.header('x-user-id');if(!sub)return res.status(401).json({message:'Authentication required.'});req.user={sub,email:req.header('x-user-email')||undefined};next()}
app.get('/health',async(_req,res)=>{await pool.query('select 1');res.json({ok:true})});
app.post('/jobs/:id/arrival',requireAuth,async(req:AuthedRequest,res,next)=>{const client=await pool.connect();try{
 const {latitude,longitude,accuracy_m}=req.body||{};if(![latitude,longitude,accuracy_m].every(Number.isFinite)||Math.abs(latitude)>90||Math.abs(longitude)>180||accuracy_m<0)return res.status(400).json({message:'A valid location is required.'});
 await client.query('begin');const result=await client.query('select * from shifts where id=$1 for update',[req.params.id]);if(!result.rowCount){await client.query('rollback');return res.status(404).json({message:'This job is no longer available.'})}
 const row=result.rows[0],data=row.data||{};if(row.technician_id!==req.user!.sub){await client.query('rollback');return res.status(403).json({message:'This job is assigned to another technician.'})}
 if(row.status==='draft'){await client.query('rollback');return res.status(409).json({message:'An administrator must schedule this draft before arrival.'})}
 if(data.is_deleted||!['assigned','in_progress'].includes(row.status||'assigned')){await client.query('rollback');return res.status(409).json({message:'This job is no longer open for arrival.'})}
 const existing=await client.query('select id from attendance_logs where id=$1',[req.params.id]);if(existing.rowCount){await client.query('commit');return res.status(204).end()}
 if((row.status||'assigned')!=='assigned'){await client.query('rollback');return res.status(409).json({message:'This job has started but its arrival record is missing.'})}
 await client.query('insert into attendance_logs(id,technician_id,latitude,longitude,accuracy_m,created_at) values($1,$2,$3,$4,$5,now())',[req.params.id,req.user!.sub,latitude,longitude,accuracy_m]);
 await client.query("update shifts set status='in_progress',data=jsonb_set(jsonb_set(data,'{status}','\"in_progress\"'::jsonb),'{arrived_at}',to_jsonb(now())),updated_at=now() where id=$1",[req.params.id]);
 await client.query('commit');res.status(204).end();
 }catch(e){await client.query('rollback').catch(()=>{});next(e)}finally{client.release()}});
app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({message:'Server error.'})});
const port=Number(process.env.PORT||8080);app.listen(port,()=>console.log(`SecureTrack API listening on ${port}`));
