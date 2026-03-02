// src/lib/storageUpload.ts
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

function safeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-_]/g, "");
}

export async function uploadProductImage(
  file: File,
  folder: string = "products",
): Promise<{ url: string; path: string }> {
  const fileName = `${Date.now()}-${safeName(file.name || "img.jpg")}`;
  const path = `${folder}/${fileName}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg",
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

export async function deleteImageByPath(path: string): Promise<void> {
  if (!path) return;
  await deleteObject(ref(storage, path));
}