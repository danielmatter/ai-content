import "@/lib/db/migrate";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { db, makeId, now, parseJsonArray } from "@/lib/db/client";
import { generationModelConfigs } from "@/lib/generation-options";
import { ensureUploadDirs, getImageUrl, getThumbnailUrl, insertImage, serializeImage } from "@/lib/image-library";
import { callLLMImageAPI } from "@/lib/llm-api";

type ImageJobRow = {
  id: string;
  workspace_id: string;
  kind: "image";
  project_id: string;
  scene_id: string;
  asset_id: string | null;
  frame_type: "first" | "last" | null;
  description: string;
  image_id: string | null;
  image_url: string | null;
  reference_image_urls?: string;
  generation_model?: string | null;
  generation_options?: string | null;
  status: "pending" | "processing" | "completed" | "downloaded" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
};

const globalForImageWorkers = globalThis as unknown as {
  runningImageWorkers?: Set<string>;
};

function getRunningImageWorkers() {
  if (!globalForImageWorkers.runningImageWorkers) {
    globalForImageWorkers.runningImageWorkers = new Set<string>();
  }
  return globalForImageWorkers.runningImageWorkers;
}

function escapeSvgText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getMimeType(sourceUrl: string) {
  const lower = sourceUrl.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

async function imageUrlToDataUrl(url: string) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  if (url.startsWith("/api/assets/images/")) {
    const relativePath = url.replace("/api/assets/images/", "").split("/").join(path.sep);
    const filePath = path.join(process.cwd(), "storage", "uploads", relativePath);
    const buffer = await readFile(filePath).catch(() => null);
    return buffer ? `data:${getMimeType(url)};base64,${buffer.toString("base64")}` : null;
  }

  if (url.startsWith("/uploads/")) {
    const buffer = await readFile(path.join(process.cwd(), "public", url)).catch(() => null);
    return buffer ? `data:${getMimeType(url)};base64,${buffer.toString("base64")}` : null;
  }

  return /^https?:\/\//i.test(url) ? url : null;
}

async function getReferenceImages(projectId: string, sceneId: string, selectedUrls: string[] = []) {
  const scene = db.prepare("SELECT asset_ids FROM project_scenes WHERE id = ?").get(sceneId) as { asset_ids?: string } | undefined;
  const sceneAssetIds = parseJsonArray(scene?.asset_ids);
  const assets = sceneAssetIds.length
    ? db.prepare(`SELECT image_urls FROM assets WHERE id IN (${sceneAssetIds.map(() => "?").join(",")})`).all(...sceneAssetIds)
    : db
      .prepare(
        `SELECT assets.image_urls FROM assets
           INNER JOIN project_assets ON project_assets.asset_id = assets.id
           WHERE project_assets.project_id = ?`,
      )
      .all(projectId);

  const urls = [
    ...selectedUrls,
    ...assets.flatMap((asset) => parseJsonArray((asset as { image_urls?: string }).image_urls).slice(0, 1)),
  ];
  const dataUrls = await Promise.all(urls.map(imageUrlToDataUrl));
  return dataUrls.filter(Boolean) as string[];
}

async function createImageBuffer(job: ImageJobRow) {
  const options = parseGenerationOptions(job.generation_options);
  const imageModelConfig =
    generationModelConfigs.image.find((config) => config.id === job.generation_model) ?? generationModelConfigs.image[0];
  const quality = imageModelConfig.qualities.includes(options.quality) ? options.quality : imageModelConfig.qualities[0];
  const imageSize = imageModelConfig.sizes.includes(options.imageSize) ? options.imageSize : imageModelConfig.sizes[0];

  if (job.asset_id) {
    const asset = db.prepare("SELECT * FROM assets WHERE workspace_id = ? AND id = ?").get(job.workspace_id, job.asset_id) as
      | { type: string; title: string; description: string; text: string }
      | undefined;
    if (!asset) throw new Error("Asset not found");

    const prompt = job.description || `Asset design for a ${asset.type}: ${asset.title}. ${asset.description}. ${asset.text ? `Continuity and visual notes: ${asset.text}` : ""}`.trim();
    const referenceImages = (await Promise.all(parseJsonArray(job.reference_image_urls).map(imageUrlToDataUrl))).filter(Boolean) as string[];
    const sourceBuffer = process.env.OPENROUTER_API_KEY
      ? await callLLMImageAPI({
        model: job.generation_model ?? undefined,
        prompt,
        aspectRatio: options.aspectRatio,
        imageSize,
        quality,
        referenceImages,
        modalities: imageModelConfig.modalities,
      })
      : await fetch(`https://picsum.photos/seed/${encodeURIComponent(asset.title || "asset")}/512/512`).then(async (response) =>
        Buffer.from(await response.arrayBuffer()),
      );

    const width = 512;
    const imageHeight = 512;
    const textHeight = 64;
    const svgText = `
      <svg width="${width}" height="${textHeight}">
        <rect width="100%" height="100%" fill="white" />
        <text x="50%" y="50%" font-family="sans-serif" font-size="24" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="middle">
          ${escapeSvgText(asset.title)}
        </text>
      </svg>`;

    const imageBuffer = await sharp(sourceBuffer)
      .resize(width, imageHeight)
      .extend({ bottom: textHeight, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .composite([{ input: Buffer.from(svgText), top: imageHeight, left: 0 }])
      .png()
      .toBuffer();

    return {
      imageBuffer,
      title: `${asset.title} (Generated)`,
      description: "Generated from asset description",
      thumbnailSize: { width: 256, height: 256 },
    };
  }

  const scene = (job.project_id && job.scene_id)
    ? db.prepare("SELECT title FROM project_scenes WHERE project_id = ? AND id = ?").get(job.project_id, job.scene_id) as { title: string } | undefined
    : undefined;
  const sceneTitle = scene?.title || "Untitled";
  const frameType = job.frame_type ?? "first";
  const prompt = job.description.startsWith("Visual for ")
    ? job.description
    : `Visual for ${frameType} frame of scene "${sceneTitle}".
Description: ${job.description}

Ensure visual consistency with the provided asset references if any.`.trim();
  const referenceImages = await getReferenceImages(job.project_id, job.scene_id, parseJsonArray(job.reference_image_urls));
  const sourceBuffer = process.env.OPENROUTER_API_KEY
    ? await callLLMImageAPI({
      model: job.generation_model ?? undefined,
      prompt,
      aspectRatio: options.aspectRatio,
      imageSize,
      quality,
      referenceImages,
      modalities: ["image"],
    })
    : await fetch(`https://picsum.photos/seed/${encodeURIComponent(sceneTitle + frameType)}/1024/576`).then(async (response) =>
      Buffer.from(await response.arrayBuffer()),
    );
  const imageBuffer = await sharp(sourceBuffer).resize(1024, 576, { fit: "cover" }).png().toBuffer();

  return {
    imageBuffer,
    title: `${sceneTitle} - ${frameType === "first" ? "First" : "Last"} Frame`,
    description: job.description,
    thumbnailSize: { width: 320, height: 180 },
  };
}

function parseGenerationOptions(value?: string | null) {
  if (!value) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function createAssetImageJob(input: {
  workspaceId: string;
  assetId: string;
  prompt?: string;
  referenceImageUrls?: string[];
  model?: string;
  settings?: Record<string, unknown>;
}) {
  const activeJob = db
    .prepare(
      `SELECT id FROM render_jobs
       WHERE workspace_id = ?
         AND kind = 'image'
         AND asset_id = ?
         AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(input.workspaceId, input.assetId) as { id: string } | undefined;

  if (activeJob) {
    return activeJob.id;
  }

  const asset = db.prepare("SELECT type, title, description, text FROM assets WHERE workspace_id = ? AND id = ?").get(
    input.workspaceId,
    input.assetId,
  ) as { type: string; title: string; description: string; text: string } | undefined;
  const description = input.prompt || (asset
    ? `Asset design for a ${asset.type}: ${asset.title}. ${asset.description}. ${asset.text ? `Continuity and visual notes: ${asset.text}` : ""}`.trim()
    : "");
  const jobId = makeId("job");
  const timestamp = now();
  db.prepare(
    `INSERT INTO render_jobs
      (id, workspace_id, project_id, scene_id, kind, asset_id, description, reference_image_urls, generation_model, generation_options, status, progress, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, 'image', ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
  ).run(
    jobId,
    input.workspaceId,
    input.assetId,
    description,
    JSON.stringify(input.referenceImageUrls ?? []),
    input.model ?? null,
    JSON.stringify(input.settings ?? {}),
    timestamp,
    timestamp,
  );
  return jobId;
}

export function createFrameImageJob(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  frameType: "first" | "last";
  description: string;
  referenceImageUrls?: string[];
  model?: string;
  settings?: Record<string, unknown>;
}) {
  const activeJob = db
    .prepare(
      `SELECT id FROM render_jobs
       WHERE workspace_id = ?
         AND project_id = ?
         AND scene_id = ?
         AND kind = 'image'
         AND frame_type = ?
         AND description = ?
         AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(input.workspaceId, input.projectId, input.sceneId, input.frameType, input.description) as { id: string } | undefined;

  if (activeJob) {
    return activeJob.id;
  }

  const jobId = makeId("job");
  const timestamp = now();
  const dbSceneId = input.sceneId === "new" ? null : input.sceneId;
  const dbProjectId = input.projectId === "" ? null : input.projectId;

  db.prepare(
    `INSERT INTO render_jobs
      (id, workspace_id, project_id, scene_id, kind, frame_type, description, reference_image_urls, generation_model, generation_options, status, progress, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
  ).run(
    jobId,
    input.workspaceId,
    dbProjectId,
    dbSceneId,
    input.frameType,
    input.description,
    JSON.stringify(input.referenceImageUrls ?? []),
    input.model ?? null,
    JSON.stringify(input.settings ?? {}),
    timestamp,
    timestamp,
  );
  return jobId;
}

export async function refreshImageJob(job: ImageJobRow) {
  if (job.kind !== "image" || job.status !== "pending") {
    return job;
  }

  const startedAt = now();
  const claimed = db
    .prepare("UPDATE render_jobs SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'pending'")
    .run(startedAt, job.id);

  if (claimed.changes !== 1) {
    return (db.prepare("SELECT * FROM render_jobs WHERE id = ?").get(job.id) as ImageJobRow | undefined) ?? job;
  }

  try {
    const { imageBuffer, title, description, thumbnailSize } = await createImageBuffer({ ...job, status: "processing" });
    const { uploadDir, thumbDir } = await ensureUploadDirs();
    const imageId = makeId("img");
    const filename = `${imageId}.png`;
    const thumbFilename = `${imageId}_thumb.png`;
    const filePath = path.join(uploadDir, filename);
    const thumbPath = path.join(thumbDir, thumbFilename);

    await writeFile(filePath, imageBuffer);
    await sharp(imageBuffer).resize(thumbnailSize.width, thumbnailSize.height, { fit: "cover" }).png().toFile(thumbPath);

    const image = insertImage({
      workspaceId: job.workspace_id,
      title,
      description,
      sourceUrl: getImageUrl(filename),
      thumbnailUrl: getThumbnailUrl(thumbFilename),
      filePath,
      mimeType: "image/png",
    });

    if (job.asset_id) {
      const current = db.prepare("SELECT image_urls FROM assets WHERE id = ?").get(job.asset_id) as { image_urls?: string } | undefined;
      db.prepare("UPDATE assets SET image_urls = ?, updated_at = ? WHERE id = ?").run(
        JSON.stringify([image.source_url, ...parseJsonArray(current?.image_urls)]),
        now(),
        job.asset_id,
      );
    } else if (job.scene_id && job.frame_type) {
      const urlField = job.frame_type === "first" ? "first_frame_url" : "last_frame_url";
      const descField = job.frame_type === "first" ? "first_frame_description" : "last_frame_description";
      db.prepare(`UPDATE project_scenes SET ${urlField} = ?, ${descField} = ?, updated_at = ? WHERE id = ?`).run(
        image.source_url,
        job.description,
        now(),
        job.scene_id,
      );
    }

    const finishedAt = now();
    db.prepare(
      `UPDATE render_jobs
       SET status = 'completed', progress = 100, image_id = ?, image_url = ?, error = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(image.id, image.source_url, finishedAt, job.id);

    return {
      ...job,
      status: "completed" as const,
      progress: 100,
      image_id: image.id,
      image_url: image.source_url,
      error: null,
      updated_at: finishedAt,
      image: serializeImage(image),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    db.prepare("UPDATE render_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(message, now(), job.id);
    return { ...job, status: "failed" as const, error: message };
  }
}

export async function refreshProcessingImageJobs(workspaceId: string) {
  const jobs = db
    .prepare(
      `SELECT * FROM render_jobs
       WHERE workspace_id = ? AND kind = 'image' AND status = 'pending'
       ORDER BY created_at ASC`,
    )
    .all(workspaceId) as ImageJobRow[];

  const results = [];
  for (const job of jobs) {
    results.push(await refreshImageJob(job));
  }
  return results;
}

export function kickImageJobWorker(workspaceId: string) {
  const runningWorkers = getRunningImageWorkers();
  if (runningWorkers.has(workspaceId)) {
    return;
  }

  runningWorkers.add(workspaceId);
  void (async () => {
    try {
      while (true) {
        const results = await refreshProcessingImageJobs(workspaceId);
        if (results.length === 0) {
          break;
        }
      }
    } catch (error) {
      console.error("Image job worker failed:", error);
    } finally {
      runningWorkers.delete(workspaceId);
    }
  })();
}
