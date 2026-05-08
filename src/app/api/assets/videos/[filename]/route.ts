import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/api";
import { db } from "@/lib/db/client";

function getContentType(filename: string) {
    const extension = path.extname(filename).toLowerCase();

    if (extension === ".webm") return "video/webm";
    if (extension === ".mov") return "video/quicktime";
    if (extension === ".mkv") return "video/x-matroska";
    return "video/mp4";
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { filename } = await params;

    if (!filename || filename !== path.basename(filename) || filename.includes("..")) {
        return new NextResponse("Invalid path", { status: 400 });
    }

    const filePath = path.join(process.cwd(), "storage", "uploads", "videos", filename);
    const assetUrl = `/api/assets/videos/${filename}`;
    const ownedVideo = db
        .prepare(
            `SELECT render_jobs.id
             FROM render_jobs
             INNER JOIN workspaces ON workspaces.id = render_jobs.workspace_id
             WHERE workspaces.user_id = ? AND render_jobs.video_url = ?
             LIMIT 1`,
        )
        .get(userId, assetUrl);

    if (!ownedVideo) {
        return new NextResponse("Not Found", { status: 404 });
    }

    try {
        const fileStat = await stat(filePath);
        const rangeHeader = _request.headers.get("range");
        const headers: Record<string, string> = {
            "Content-Type": getContentType(filename),
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
        };

        if (rangeHeader) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

            if (!match) {
                return new NextResponse("Invalid range", {
                    status: 416,
                    headers: {
                        ...headers,
                        "Content-Range": `bytes */${fileStat.size}`,
                    },
                });
            }

            const start = match[1] ? Number.parseInt(match[1], 10) : 0;
            const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;

            if (!Number.isFinite(start) || !Number.isFinite(requestedEnd) || start < 0 || requestedEnd < start) {
                return new NextResponse("Invalid range", {
                    status: 416,
                    headers: {
                        ...headers,
                        "Content-Range": `bytes */${fileStat.size}`,
                    },
                });
            }

            const end = Math.min(requestedEnd, fileStat.size - 1);
            const contentLength = end - start + 1;
            const stream = createReadStream(filePath, { start, end });

            return new NextResponse(Readable.toWeb(stream) as BodyInit, {
                status: 206,
            headers: {
                    ...headers,
                    "Content-Length": String(contentLength),
                    "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
                },
            });
        }

        const stream = createReadStream(filePath);

        return new NextResponse(Readable.toWeb(stream) as BodyInit, {
            status: 200,
            headers: {
                ...headers,
                "Content-Length": String(fileStat.size),
            },
        });
    } catch (error) {
        console.error("Failed to serve video:", error);
        return new NextResponse("Not Found", { status: 404 });
    }
}
