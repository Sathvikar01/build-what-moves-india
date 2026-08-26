import { fail } from "../../../../src/server/http";
import { getUploadedAsset } from "../../../../src/server/store";

export const dynamic="force-dynamic";
// Serves previously uploaded evidence to signed-in demo roles so the loop can
// close visually: citizens see the collector's before/after proof and BBMP
// sees report evidence in the audit. Access still requires a demo role header
// (the demo guard, not real authentication) exactly like every other endpoint.
export async function GET(request:Request,{params}:{params:Promise<{assetId:string}>}){
  // <img> elements cannot attach custom headers, so same-origin document
  // embeds are authenticated by referer instead of x-demo-role. Direct
  // cross-origin fetches/hotlinks still get 403 (demo guard, not real auth).
  const role=request.headers.get("x-demo-role");
  let authorized=role==="citizen"||role==="bbmp"||role==="collector";
  if(!authorized){
    const referer=request.headers.get("referer");
    try{authorized=new URL(referer??"" ).origin===new URL(request.url).origin}catch{authorized=false}
  }
  if(!authorized)return fail(403,"DEMO_ROLE_FORBIDDEN","Evidence requires a demo role header or a same-origin embed.");
  const {assetId}=await params;
  const key=decodeURIComponent(assetId);
  const id=key.startsWith("evidence/")?key:`evidence/${key}`;
  const asset=getUploadedAsset(id);
  if(!asset)return fail(404,"ASSET_NOT_FOUND","That evidence asset is not in the demo store. It may have been reset or evicted.");
  return new Response(asset.bytes as BodyInit,{
    status:200,
    headers:{
      "content-type":asset.contentType,
      "cache-control":"private,max-age=300",
      "content-disposition":"inline",
      "x-evidence-privacy":"private-demo-store",
    },
  });
}
