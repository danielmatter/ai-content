import "@/lib/db/migrate";

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, requireWorkspace, unauthorized } from "@/lib/api";
import { makeId } from "@/lib/db/client";
import { ensureUploadDirs, getImageUrl, getThumbnailUrl, insertImage, serializeImage } from "@/lib/image-library";

type Context = { params: Promise<{ workspaceId: string }> };

const execFileAsync = promisify(execFile);
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extensionFor(type: string) {
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

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    if (!requireWorkspace(workspaceId, userId)) {
      return notFound("Workspace not found");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const { uploadDir, thumbDir } = await ensureUploadDirs();
    const imageId = makeId("img");
    const extension = extensionFor(file.type);
    const filename = `${imageId}.${extension}`;
    const thumbFilename = `${imageId}.jpg`;
    const filePath = path.join(uploadDir, filename);
    const thumbPath = path.join(thumbDir, thumbFilename);

    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    await execFileAsync("magick", [filePath, "-auto-orient", "-thumbnail", "256x256^", "-gravity", "center", "-extent", "256x256", thumbPath]);

    const image = insertImage({
      workspaceId,
      title: String(form.get("title") || file.name || "Uploaded image"),
      description: String(form.get("description") || ""),
      sourceUrl: getImageUrl(filename),
      thumbnailUrl: getThumbnailUrl(thumbFilename),
      filePath,
      mimeType: file.type,
    });

    return NextResponse.json({ image: serializeImage(image) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
