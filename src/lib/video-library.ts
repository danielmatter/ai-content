import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getExtensionFromUrl(sourceUrl: string) {
    const extension = path.extname(new URL(sourceUrl, "http://localhost").pathname).replace(".", "").toLowerCase();

    if (["mp4", "webm", "mov", "mkv"].includes(extension)) {
        return extension;
    }

    return null;
}

export async function ensureVideoUploadDir() {
    const baseDir = path.join(process.cwd(), "storage", "uploads");
    const videoDir = path.join(baseDir, "videos");
    await mkdir(videoDir, { recursive: true });
    return { videoDir };
}

export function getVideoUrl(filename: string) {
    return `/api/assets/videos/${filename}`;
}

export async function saveDownloadedVideo(input: {
    jobId: string;
    sourceUrl: string;
}) {
    const { videoDir } = await ensureVideoUploadDir();
    const extensionGuess = getExtensionFromUrl(input.sourceUrl) ?? "mp4";
    const filename = `${input.jobId}.${extensionGuess}`;
    const filePath = path.join(videoDir, filename);

    const { stdout } = await execFileAsync(
        "curl",
        [
            input.sourceUrl,
            "-H",
            "accept: video/mp4",
            "-H",
            `Authorization: Bearer ${process.env.OPENROUTER_API_KEY}`,
            "--output",
            filePath,
            "--silent",
            "--show-error",
            "--write-out",
            "%{http_code}",
        ],
        { maxBuffer: 1024 * 1024 },
    );

    const statusCode = Number(stdout.trim());

    if (statusCode === 401) {
        return null;
    }

    if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) {
        throw new Error(`Failed to download video: HTTP ${Number.isFinite(statusCode) ? statusCode : "unknown"}`);
    }

    return {
        filePath,
        publicUrl: getVideoUrl(filename),
    };
}