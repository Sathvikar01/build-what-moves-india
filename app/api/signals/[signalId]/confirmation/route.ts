import { z } from "zod";
import { confirmSignal, idempotent } from "../../../../../src/server/store";
import { fail, jsonBody, ok, requireIdempotency, requireRole } from "../../../../../src/server/http";

const schema=z.object({outcome:z.enum(["cleaned","partial","still_present"])});
export async function POST(request:Request,{params}:{params:Promise<{signalId:string}>}){
  const denied=requireRole(request,["citizen"]);if(denied)return denied;
  const idem=requireIdempotency(request);if(!idem)return fail(400,"IDEMPOTENCY_REQUIRED","Provide idempotency-key.");
  const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return fail(422,"VALIDATION_FAILED","Invalid confirmation.",parsed.error.flatten());
  try{const {signalId}=await params;return ok(idempotent(idem.key,()=>confirmSignal(signalId,parsed.data.outcome)))}catch(error){return fail(error instanceof Error&&error.message==="NOT_FOUND"?404:409,"INVALID_STATUS_TRANSITION","Signal proof must be accepted before citizen confirmation.")}
}
