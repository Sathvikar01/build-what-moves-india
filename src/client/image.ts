/** Re-encode browser-selected evidence so EXIF and original filenames never leave the device. */
export async function sanitizeEvidence(file:File,maxBytes=5*1024*1024){
  if(file.size>maxBytes)throw new Error("Image must be 5 MB or smaller.");
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPEG, PNG or WebP.");
  const bitmap=await createImageBitmap(file);const maxEdge=1024;const scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext("2d");if(!context)throw new Error("Image processing is unavailable.");context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",.72));if(!blob)throw new Error("Could not prepare image.");if(blob.size>maxBytes)throw new Error("Prepared image is still over 5 MB; choose a smaller photo.");return new File([blob],"evidence.webp",{type:blob.type,lastModified:Date.now()});
}
