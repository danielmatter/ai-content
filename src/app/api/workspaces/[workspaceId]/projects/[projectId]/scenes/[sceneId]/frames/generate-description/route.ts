import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, notFound, readJson, requireProject, requireScene, requireWorkspace, unauthorized } from "@/lib/api";
import { db, parseJsonArray } from "@/lib/db/client";
import { getGenerationModel, writeGenerationLog } from "@/lib/generation";
import { callLLMTextAPI } from "@/lib/llm-api";
import { z } from "zod";

const inputSchema = z.object({
  frameType: z.enum(["first", "last"]),
  steering: z.string().optional().default(""),
  scene: z.object({
    title: z.string(),
    description: z.string(),
    action: z.string(),
    look: z.string(),
  }).optional(),
});

type Context = { params: Promise<{ workspaceId: string; projectId: string; sceneId?: string }> };
type ProjectRow = {
  title: string;
  logline: string;
};
type SceneData = {
  title: string;
  description: string;
  action: string;
  look: string;
  asset_ids?: string;
  assetIds?: string[];
};
type AssetContext = {
  type: string;
  title: string;
  description: string;
  text: string;
};

export async function POST(request: Request, context: Context) {
  try {
    const { workspaceId, projectId, sceneId } = await context.params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const workspace = requireWorkspace(workspaceId, userId);
    if (!workspace) {
      return notFound("Workspace not found");
    }

    const project = requireProject(workspaceId, projectId) as ProjectRow | null;
    if (!project) {
      return notFound("Project not found");
    }

    const { frameType, steering, scene: sceneInput } = await readJson(request, inputSchema);

    let sceneData: SceneData | null = null;
    if (sceneId && sceneId !== "new") {
      sceneData = requireScene(workspaceId, projectId, sceneId) as SceneData | null;
    } else {
      sceneData = sceneInput ?? null;
    }

    if (!sceneData) {
      return notFound("Scene data not found");
    }

    // Fetch assets for the project or scene
    let assets: AssetContext[] = [];
    const sceneAssetIds = sceneData.assetIds ?? parseJsonArray(sceneData.asset_ids);
    if (sceneId && sceneAssetIds.length > 0) {
      assets = db
        .prepare(
          `SELECT assets.type, assets.title, assets.description, assets.text FROM assets
            WHERE assets.workspace_id = ? AND assets.id IN (${sceneAssetIds.map(() => "?").join(",")})
           ORDER BY assets.type ASC, assets.title ASC`,
        )
        .all(workspaceId, ...sceneAssetIds) as AssetContext[];
    } else {
      assets = db
        .prepare(
          `SELECT assets.type, assets.title, assets.description, assets.text FROM assets
           INNER JOIN project_assets ON project_assets.asset_id = assets.id
            WHERE project_assets.project_id = ? AND assets.workspace_id = ?
           ORDER BY assets.type ASC, assets.title ASC`,
        )
        .all(projectId, workspaceId) as AssetContext[];
    }

    const model = getGenerationModel("text", "openai/gpt-4o-mini");

    const systemPrompt = `You are a visual director for an AI film studio.
Your task is to generate a detailed textual description for the ${frameType} frame of a scene.
This description will be used by an image generation model.
Focus on composition, lighting, character placement, and visual details.
Ensure continuity with the project's logline and the scene's action/look.
Use the provided assets as reference.

Output ONLY the description, no JSON, no preamble.`;

    const userPrompt = `Project: ${project.title}
Logline: ${project.logline}

Scene: ${sceneData.title}
Description: ${sceneData.description}
Action: ${sceneData.action}
Look: ${sceneData.look}

Assets:
${assets.map((a) => `- ${a.title} (${a.type}): ${a.description} ${a.text}`).join("\n")}

Additional Steering: ${steering}

Generate the description for the ${frameType} frame:`;

    if (!process.env.OPENROUTER_API_KEY) {
      const draft = `[Stub] Detailed description for the ${frameType} frame of "${sceneData.title}".`;
      return NextResponse.json({ description: draft, mode: "stub" });
    }

    const json = await callLLMTextAPI({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const description = json.choices?.[0]?.message?.content?.trim() ?? "";

    await writeGenerationLog({
      target: `scene-${sceneId || 'new'}-${frameType}-frame-description`,
      request: { systemPrompt, userPrompt },
      response: json,
    });

    return NextResponse.json({ description });
  } catch (error) {
    return apiError(error);
  }
}
