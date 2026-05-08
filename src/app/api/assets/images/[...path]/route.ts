import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { getCurrentUserId } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: pathParts } = await params;

  // Validate path to prevent directory traversal
  // Expecting path like ["images", "img_xxx.png"] or ["thumbnails", "img_xxx_thumb.png"]
  if (pathParts.length < 2) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  // Only allow "images" and "thumbnails" as root folders
  if (pathParts[0] !== "images" && pathParts[0] !== "thumbnails") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Prevent any ".." or other traversal tricks in the rest of the path
  const sanitizedPath = pathParts.join(path.sep);
  if (sanitizedPath.includes("..") || sanitizedPath.startsWith("/") || sanitizedPath.includes("~")) {
    return new NextResponse("Invalid path content", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "storage", "uploads", sanitizedPath);
  const assetPath = `/api/assets/images/${pathParts.join("/")}`;
  const ownedImage = db
    .prepare(
      `SELECT images.id
       FROM images
       INNER JOIN workspaces ON workspaces.id = images.workspace_id
       WHERE workspaces.user_id = ? AND (images.source_url = ? OR images.thumbnail_url = ?)
       LIMIT 1`,
    )
    .get(userId, assetPath, assetPath);

  if (!ownedImage) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);

    // Determine content type based on extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".gif") contentType = "image/gif";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to serve image:", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}
