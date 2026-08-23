import { NextResponse } from "next/server";

export type DemoRole="citizen"|"bbmp"|"collector";
export function ok<T>(data:T,status=200,cursor?:number){return NextResponse.json({data,meta:{requestId:crypto.randomUUID(),generatedAt:new Date().toISOString(),...(cursor!==undefined?{cursor}:{})}}, {status});}
export function fail(status:number,code:string,message:string,details?:unknown){return NextResponse.json({data:null,meta:{requestId:crypto.randomUUID(),generatedAt:new Date().toISOString()},error:{code,message,details}}, {status});}
export function requireRole(request:Request,allowed:DemoRole[]){const role=request.headers.get("x-demo-role") as DemoRole|null;return role&&allowed.includes(role)?null:fail(403,"DEMO_ROLE_FORBIDDEN",`This demo endpoint requires role: ${allowed.join(" or ")}.`)}
export function requireIdempotency(request:Request){const key=request.headers.get("idempotency-key")??request.headers.get("x-idempotency-key");return key&&/^[a-zA-Z0-9:_-]{8,100}$/.test(key)?{key}:null}
export async function jsonBody(request:Request){try{return await request.json()}catch{return null}}
