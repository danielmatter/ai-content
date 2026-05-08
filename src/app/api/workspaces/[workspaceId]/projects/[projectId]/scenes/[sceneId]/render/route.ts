import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { getCurrentUserId, requireProject, requireScene, requireWorkspace } from "@/lib/api";
import { nanoid } from "nanoid";
import { generationModelConfigs, getGenerationModel } from "@/lib/generation";
import { parseJsonArray } from "@/lib/db/client";
import { callLLMVideoAPI } from "@/lib/llm-api";

function getMimeType(sourceUrl: string, contentType?: string | null) {
  if (contentType?.startsWith("image/")) {
    return contentType.split(";")[0];
  }

  const lower = sourceUrl.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";

  return "image/png";
}

async function imageUrlToBase64(url: string) {
  if (!url) {
    return null;
  }

  if (url.startsWith("data:")) {
    return url;
  }

  if (url.startsWith("/api/assets/images/")) {
    const relativePath = url.replace("/api/assets/images/", "").split("/").join(path.sep);
    const filePath = path.join(process.cwd(), "storage", "uploads", relativePath);
    try {
      const buffer = await readFile(filePath);
      return `data:${getMimeType(url)};base64,${buffer.toString("base64")}`;
    } catch (error) {
      console.error(`Failed to read local image (dynamic): ${url}`, error);
      return null;
    }
  }

  if (url.startsWith("/uploads/")) {
    try {
      const filePath = path.join(process.cwd(), "public", url);
      const buffer = await readFile(filePath);
      return `data:${getMimeType(url)};base64,${buffer.toString("base64")}`;
    } catch (error) {
      console.error(`Failed to read local image (static): ${url}`, error);
      return null;
    }
  }

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${getMimeType(url, response.headers.get("content-type"))};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error(`Failed to fetch remote image: ${url}`, error);
    return null;
  }
}

async function imageUrlToFrameImage(url: string, frameType: "first_frame" | "last_frame") {
  const dataUrl = await imageUrlToBase64(url);
  if (!dataUrl) {
    return null;
  }

  return {
    type: "image_url",
    image_url: {
      url: dataUrl,
    },
    frame_type: frameType,
  };
}

async function imageUrlToInputReference(url: string) {
  const dataUrl = await imageUrlToBase64(url);
  if (!dataUrl) {
    return null;
  }

  return {
    type: "image_url",
    image_url: {
      url: dataUrl,
    },
  };
}

type ProjectRow = Record<string, unknown> & {
  title: string;
  logline?: string;
};

type SceneRow = Record<string, unknown> & {
  title: string;
  asset_ids: string;
  first_frame_url: string;
  last_frame_url: string;
};

type AssetRow = Record<string, unknown> & {
  title: string;
  type: string;
  description: string;
  text?: string;
};

function serializeAsset(asset: Record<string, unknown>): AssetRow {
  return { ...asset, imageUrls: parseJsonArray(asset.image_urls) } as unknown as AssetRow;
}

type OpenRouterSubmitResponse = {
  id?: string;
  polling_url?: string | null;
};

const inputSchema = z.object({
  prompt: z.string().optional(),
  firstFrameUrl: z.string().optional(),
  lastFrameUrl: z.string().optional(),
  referenceImageUrls: z.array(z.string()).optional().default([]),
  model: z.string().optional(),
  settings: z.object({
    size: z.string().optional(),
    duration: z.number().optional(),
    generateAudio: z.boolean().optional(),
  }).optional().default({}),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string; sceneId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { workspaceId, projectId, sceneId } = await params;

  // Validate workspace access
  const workspace = requireWorkspace(workspaceId, userId);
  if (!workspace) return new NextResponse("Workspace not found", { status: 404 });

  const project = requireProject(workspaceId, projectId) as ProjectRow | null;
  if (!project) return new NextResponse("Project not found", { status: 404 });

  const scene = requireScene(workspaceId, projectId, sceneId) as SceneRow | null;
  if (!scene) return new NextResponse("Scene not found", { status: 404 });
  const input: z.infer<typeof inputSchema> = await request.json().then((value) => inputSchema.parse(value)).catch(() => ({ referenceImageUrls: [], settings: {} }));

  const sceneAssetIds = parseJsonArray(scene.asset_ids);
  const sceneAssets = sceneAssetIds.length
    ? db
      .prepare(`SELECT * FROM assets WHERE workspace_id = ? AND id IN (${sceneAssetIds.map(() => "?").join(",")})`)
      .all(workspaceId, ...sceneAssetIds)
      .map((asset) => serializeAsset(asset as Record<string, unknown>))
    : [];

  const generationModel = getGenerationModel("video", input.model ?? "google/veo-3.1-lite");
  const videoConfig =
    generationModelConfigs.video.find((config) => config.id === generationModel) ?? generationModelConfigs.video[0];
  const duration = input.settings.duration && videoConfig.durations.includes(input.settings.duration)
    ? input.settings.duration
    : videoConfig.durations[0] ?? 4;
  const size = input.settings.size && videoConfig.sizes.includes(input.settings.size)
    ? input.settings.size
    : videoConfig.sizes[0] ?? "1280x720";
  const generateAudio = typeof input.settings.generateAudio === "boolean" && videoConfig.generateAudio.includes(input.settings.generateAudio)
    ? input.settings.generateAudio
    : videoConfig.generateAudio[0] ?? false;

  const frameImages = (await Promise.all([
    imageUrlToFrameImage(input.firstFrameUrl ?? scene.first_frame_url, "first_frame"),
    imageUrlToFrameImage(input.lastFrameUrl ?? scene.last_frame_url, "last_frame"),
  ])).filter(Boolean);
  const inputReferences = (await Promise.all(
    input.referenceImageUrls.map((url) => imageUrlToInputReference(url)),
  )).filter(Boolean);

  const jobId = nanoid();
  const now = new Date().toISOString();

  const videoPromptParts = [
    `Video Generation for Scene: "${scene.title}"`,
    `Project: "${project.title}"`,
    `Project Tagline: ${project.logline || ""}`,
    "",
    "SCENE CONTEXT:",
    `Summary: ${scene.description}`,
    `Action (What happens): ${scene.action}`,
    `Visual Style: ${scene.look}`,
    "",
    "SCENE ASSETS:",
    ...sceneAssets.map((asset) => (
      `Asset: ${asset.title} [Type: ${asset.type}]\nDescription: ${asset.description}\n${asset.text ? `Details: ${asset.text}` : ""}`
    ))
  ].filter(Boolean);

  const defaultVideoPrompt = videoPromptParts.join("\n").trim();
  const videoPrompt = input.prompt?.trim() || defaultVideoPrompt;

  try {
    const data = (await callLLMVideoAPI({
      model: generationModel,
      prompt: videoPrompt,
      duration,
      size,
      frameImages,
      inputReferences,
      generateAudio,
    })) as OpenRouterSubmitResponse;
    const openrouterJobId = data.id ?? null;
    const openrouterPollingUrl = data.polling_url ?? null;

    db.prepare(`
      INSERT INTO render_jobs (id, workspace_id, project_id, scene_id, description, generation_model, generation_options, status, progress, openrouter_job_id, openrouter_polling_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', 0, ?, ?, ?, ?)
    `).run(
      jobId,
      workspaceId,
      projectId,
      sceneId,
      `${scene.title} video render`,
      generationModel,
      JSON.stringify({ size, duration, generateAudio }),
      openrouterJobId,
      openrouterPollingUrl,
      now,
      now,
    );

    return NextResponse.json({ jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render trigger failed";
    console.error("Render trigger failed:", error);
    return new NextResponse(message, { status: 500 });
  }
}
