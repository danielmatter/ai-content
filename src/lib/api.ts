import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";

export const assetTypeSchema = z.enum(["scene", "character", "style", "audio"]);

export const workspaceSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(140).optional().default(""),
  description: z.string().max(1200).optional().default(""),
});

export const assetSchema = z.object({
  type: assetTypeSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(2400).optional().default(""),
  text: z.string().max(10000).optional().default(""),
  imageUrls: z.array(z.string().url().or(z.string().startsWith("/"))).optional().default([]),
  audioUrl: z.string().url().or(z.string().startsWith("/")).or(z.literal("")).optional().default(""),
  audioMimeType: z.string().max(120).optional().default(""),
});

export const projectSchema = z.object({
  title: z.string().min(1).max(160),
  logline: z.string().max(1200).optional().default(""),
  scenes: z.array(z.any()).optional(),
  assets: z.array(z.any()).optional(),
  assetIds: z.array(z.string()).optional().default([]),
});

const timelineAnchorSchema = z.object({
  type: z.enum(["seconds", "track-end", "scene"]),
  trackType: z.enum(["video", "audio"]).optional(),
  trackIndex: z.number().int().min(0).optional(),
  sceneId: z.string().optional(),
  edge: z.enum(["start", "end"]).optional(),
  offset: z.number().min(-3600).max(3600).optional().default(0),
}).optional();

export const timelineStateSchema = z.object({
  sceneClips: z.array(z.object({
    sceneId: z.string(),
    start: z.number().min(0).default(0),
    duration: z.number().min(0.1).max(600).default(4),
    speed: z.number().min(0.1).max(4).default(1),
    fadeIn: z.number().min(0).max(30).default(0),
    fadeOut: z.number().min(0).max(30).default(0),
    trackIndex: z.number().int().min(0).optional(),
    anchor: timelineAnchorSchema,
  })).default([]),
  audioClips: z.array(z.object({
    assetId: z.string(),
    start: z.number().min(0).default(0),
    duration: z.number().min(0.1).max(3600).optional(),
    volume: z.number().min(0).max(2).default(1),
    fadeIn: z.number().min(0).max(30).default(0),
    fadeOut: z.number().min(0).max(30).default(0),
    trackIndex: z.number().int().min(0).optional(),
    anchor: timelineAnchorSchema,
  })).default([]),
});

export const projectSceneSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(6000).optional().default(""),
  action: z.string().max(6000).optional().default(""),
  look: z.string().max(6000).optional().default(""),
  firstFrameUrl: z.string().max(2000).optional().default(""),
  lastFrameUrl: z.string().max(2000).optional().default(""),
  firstFrameDescription: z.string().max(10000).optional().default(""),
  lastFrameDescription: z.string().max(10000).optional().default(""),
  assetIds: z.array(z.string()).optional().default([]),
  position: z.number().int().min(0).optional(),
});

export async function getCurrentUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user?.id ?? null;
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}

export function apiError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}

export function requireWorkspace(workspaceId: string, userId: string) {
  const workspace = db
    .prepare("SELECT * FROM workspaces WHERE id = ? AND user_id = ?")
    .get(workspaceId, userId);

  if (!workspace) {
    return null;
  }

  return workspace as Record<string, unknown>;
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "workspace";
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}
