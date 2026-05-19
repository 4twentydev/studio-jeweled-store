import { put } from "@vercel/blob";

export async function uploadFileToBlob(file: File, folder: string) {
  const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true
  });

  return blob;
}

export async function uploadStyledBufferToBlob(filename: string, buffer: Uint8Array, contentType: string) {
  const blob = await put(`styled/${Date.now()}-${filename}`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType
  });

  return blob;
}
