import "@/lib/db/migrate";

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { db, makeId, now } from "@/lib/db/client";

const execFileAsync = promisify(execFile);

export type LibraryImage = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  source_url: string;
  thumbnail_url: string;
  file_path: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
};

export function serializeImage(image: Record<string, unknown>) {
  return {
    id: String(image.id),
    workspaceId: String(image.workspace_id),
    title: String(image.title ?? ""),
    description: String(image.description ?? ""),
    sourceUrl: String(image.source_url ?? ""),
    thumbnailUrl: String(image.thumbnail_url ?? ""),
    mimeType: String(image.mime_type ?? ""),
    createdAt: String(image.created_at ?? ""),
    updatedAt: String(image.updated_at ?? ""),
  };
}

export function insertImage(input: {
  workspaceId: string;
  title: string;
  description?: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  filePath?: string;
  mimeType?: string;
}) {
  const createdAt = now();
  const image = {
    id: makeId("img"),
    workspace_id: input.workspaceId,
    title: input.title,
    description: input.description ?? "",
    source_url: input.sourceUrl,
    thumbnail_url: input.thumbnailUrl ?? input.sourceUrl,
    file_path: input.filePath ?? "",
    mime_type: input.mimeType ?? "",
    created_at: createdAt,
    updated_at: createdAt,
  };

  db.prepare(
    `INSERT INTO images
      (id, workspace_id, title, description, source_url, thumbnail_url, file_path, mime_type, created_at, updated_at)
     VALUES
      (@id, @workspace_id, @title, @description, @source_url, @thumbnail_url, @file_path, @mime_type, @created_at, @updated_at)`,
  ).run(image);

  return image;
}

export async function ensureUploadDirs() {
  const baseDir = path.join(process.cwd(), "storage", "uploads");
  const uploadDir = path.join(baseDir, "images");
  const thumbDir = path.join(baseDir, "thumbnails");
  await mkdir(uploadDir, { recursive: true });
  await mkdir(thumbDir, { recursive: true });
  return { uploadDir, thumbDir };
}

export function getImageUrl(filename: string) {
  return `/api/assets/images/images/${filename}`;
}

export function getThumbnailUrl(filename: string) {
  return `/api/assets/images/thumbnails/${filename}`;
}

function extensionForMime(type: string) {
  if (type === "image/jpeg") {
    return "jpg";
  }
  if (type === "image/webp") {
    return "webp";
  }
  if (type === "image/gif") {
    return "gif";
  }
  return "png";
}

function readDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function saveGeneratedImage(input: {
  workspaceId: string;
  title: string;
  description?: string;
  imageUrl: string;
}) {
  const dataUrl = readDataUrl(input.imageUrl);
  const response = dataUrl
    ? null
    : await fetch(input.imageUrl).catch(() => null);

  if (!dataUrl && (!response || !response.ok)) {
    return insertImage({
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description,
      sourceUrl: input.imageUrl,
      thumbnailUrl: input.imageUrl,
    });
  }

  const mimeType = dataUrl?.mimeType ?? response?.headers.get("content-type")?.split(";")[0] ?? "image/png";
  const bytes = dataUrl?.bytes ?? Buffer.from(await response!.arrayBuffer());
  const { uploadDir, thumbDir } = await ensureUploadDirs();
  const imageId = makeId("img");
  const extension = extensionForMime(mimeType);
  const filename = `${imageId}.${extension}`;
  const thumbFilename = `${imageId}.jpg`;
  const filePath = path.join(uploadDir, filename);
  const thumbPath = path.join(thumbDir, thumbFilename);

  await writeFile(filePath, bytes);
  await execFileAsync("magick", [filePath, "-auto-orient", "-thumbnail", "256x256^", "-gravity", "center", "-extent", "256x256", thumbPath]);

  return insertImage({
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description,
    sourceUrl: getImageUrl(filename),
    thumbnailUrl: getThumbnailUrl(thumbFilename),
    filePath,
    mimeType,
  });
}
