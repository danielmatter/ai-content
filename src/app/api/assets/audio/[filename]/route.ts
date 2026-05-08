import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

function getContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".wav") return "audio/wav";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".aac") return "audio/aac";
  if (extension === ".flac") return "audio/flac";
  return "audio/mpeg";
}

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (!filename || filename !== path.basename(filename) || filename.includes("..")) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "storage", "uploads", "audio", filename);

  try {
    const fileStat = await stat(filePath);
    const rangeHeader = request.headers.get("range");
    const headers: Record<string, string> = {
      "Content-Type": getContentType(filename),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        return new NextResponse("Invalid range", {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${fileStat.size}` },
        });
      }

      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;
      if (!Number.isFinite(start) || !Number.isFinite(requestedEnd) || start < 0 || requestedEnd < start) {
        return new NextResponse("Invalid range", {
          status: 416,
          headers: { ...headers, "Content-Range": `bytes */${fileStat.size}` },
        });
      }

      const end = Math.min(requestedEnd, fileStat.size - 1);
      const stream = createReadStream(filePath, { start, end });
      return new NextResponse(Readable.toWeb(stream) as BodyInit, {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
        },
      });
    }

    const stream = createReadStream(filePath);
    return new NextResponse(Readable.toWeb(stream) as BodyInit, {
      headers: { ...headers, "Content-Length": String(fileStat.size) },
    });
  } catch (error) {
    console.error("Failed to serve audio:", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}
