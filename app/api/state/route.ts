import { getState } from "../../../src/server/store";import { ok,requireRole } from "../../../src/server/http";
export const dynamic="force-dynamic";export async function GET(request:Request){const denied=requireRole(request,["citizen","bbmp","collector"]);if(denied)return denied;return ok(getState(),200,getState().events.at(-1)?.cursor)}
