import { getState } from "../../../../src/server/store";import { ok,requireRole } from "../../../../src/server/http";
export async function GET(request:Request){const denied=requireRole(request,["bbmp","collector"]);if(denied)return denied;return ok(getState().route)}
