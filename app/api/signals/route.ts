import { z } from "zod";
import { createSignal, idempotent } from "../../../src/server/store";
import { fail, jsonBody, ok, requireIdempotency, requireRole } from "../../../src/server/http";

const schema=z.object({clientSignalId:z.string().regex(/^sig-citizen-[a-z0-9-]{8,80}$/).optional(),type:z.enum(["have_waste","waste_outside"]),category:z.string().min(1).max(40).default("mixed"),amountBand:z.enum(["small","medium","large"]).default("small"),location:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)})});
export async function POST(request:Request){
  const denied=requireRole(request,["citizen"]);if(denied)return denied;
  const idem=requireIdempotency(request);if(!idem)return fail(400,"IDEMPOTENCY_REQUIRED","Provide a valid idempotency-key header.");
  const parsed=schema.safeParse(await jsonBody(request));if(!parsed.success)return fail(422,"VALIDATION_FAILED","Invalid waste signal.",parsed.error.flatten());
  try{return ok(idempotent(idem.key,()=>createSignal(parsed.data)),201)}catch{return fail(409,"DUPLICATE_SIGNAL_ID","This citizen case already exists.")}
}
