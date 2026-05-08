import "@/lib/db/migrate";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getCurrentUserId, notFound, requireWorkspace, unauthorized } from "@/lib/api";
import { db, makeId, now } from "@/lib/db/client";

type Context = { params: Promise<{ workspaceId: string }> };

const allowedMimeTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac"]);

function extensionFor(file: File) {
  const fromName = path.extname(file.name).toLowerCase();
  if ([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"].includes(fromName)) {
    return fromName;
  }
  if (file.type === "audio/wav" || file.type === "audio/x-wav") return ".wav";
  if (file.type === "audio/ogg") return ".ogg";
  if (file.type === "audio/mp4") return ".m4a";
  if (file.type === "audio/aac") return ".aac";
  if (file.type === "audio/flac") return ".flac";
  return ".mp3";
}

export async function POST(request: Request, context: Context) {
  const { workspaceId } = await context.params;
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  if (!requireWorkspace(workspaceId, userId)) {
    return notFound("Workspace not found");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  if (file.type && !allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ error: "Unsupported audio file type" }, { status: 400 });
  }

  const assetId = makeId("ast");
  const filename = `${assetId}${extensionFor(file)}`;
  const uploadDir = path.join(process.cwd(), "storage", "uploads", "audio");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

  const createdAt = now();
  const title = String(form.get("title") || file.name.replace(/\.[^.]+$/, "") || "Audio clip");
  const description = String(form.get("description") || "");
  const audioUrl = `/api/assets/audio/${filename}`;
  const audioMimeType = file.type || "audio/mpeg";

  if (form.get("createAsset") === "false") {
    return NextResponse.json({ audioUrl, audioMimeType }, { status: 201 });
  }

  const asset = {
    id: assetId,
    workspace_id: workspaceId,
    type: "audio",
    title,
    description,
    text: "",
    image_urls: "[]",
    audio_url: audioUrl,
    audio_mime_type: audioMimeType,
    created_at: createdAt,
    updated_at: createdAt,
  };

  db.prepare(
    `INSERT INTO assets (id, workspace_id, type, title, description, text, image_urls, audio_url, audio_mime_type, created_at, updated_at)
     VALUES (@id, @workspace_id, @type, @title, @description, @text, @image_urls, @audio_url, @audio_mime_type, @created_at, @updated_at)`,
  ).run(asset);

  return NextResponse.json({
    asset: { ...asset, imageUrls: [], audioUrl, audioMimeType: asset.audio_mime_type },
  }, { status: 201 });
}
