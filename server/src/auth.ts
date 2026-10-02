import type { Request,Response,NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
const region=process.env.COGNITO_REGION||'',userPoolId=process.env.COGNITO_USER_POOL_ID||'',clientId=process.env.COGNITO_CLIENT_ID||'';
const verifier=userPoolId&&clientId?CognitoJwtVerifier.create({userPoolId,tokenUse:'access',clientId}):null;
export type AuthedRequest=Request&{user?:{sub:string;email?:string;groups:string[]}};
export async function requireAuth(req:AuthedRequest,res:Response,next:NextFunction){
 try{if(!verifier)return res.status(503).json({message:'Authentication is not configured.'});const raw=req.header('authorization')||'';if(!raw.startsWith('Bearer '))return res.status(401).json({message:'Authentication required.'});const payload=await verifier.verify(raw.slice(7));req.user={sub:payload.sub,email:typeof payload.email==='string'?payload.email:undefined,groups:Array.isArray(payload['cognito:groups'])?payload['cognito:groups'] as string[]:[]};next()}catch{return res.status(401).json({message:'Invalid or expired session.'})}
}
