import { z } from "zod";

import { assetTypeSchema } from "@/lib/api";
import { getGenerationModel, writeGenerationLog } from "@/lib/generation";
import { callLLMTextAPI } from "@/lib/llm-api";

export const steeringSchema = z.object({
  steering: z.string().max(4000).optional().default(""),
});

export const assetDraftSteeringSchema = steeringSchema.extend({
  assetType: assetTypeSchema.optional(),
});

type DraftTarget = "workspace" | "asset" | "project" | "scene";

const fallbackDrafts: Record<DraftTarget, Record<string, string>> = {
  workspace: {
    name: "Generated workspace",
    description: "Workspace context generated from the steering note. Configure OPENROUTER_API_KEY for live output.",
  },
  asset: {
    type: "character",
    title: "Generated asset",
    description: "Asset description generated from workspace and project context.",
    text: "Continuity notes, usage constraints, and visual references for this asset.",
    audioUrl: "",
    audioMimeType: "",
  },
  project: {
    title: "Generated project",
    logline: "A concise project logline generated from the supplied workspace context.",
    scenes: "[]",
    assets: "[]",
  },
  scene: {
    title: "Generated scene",
    description: "Scene description generated from the project, assets, images, and neighboring scenes.",
    action: "Beat-by-beat action for the scene.",
    look: "Visual treatment, framing, lighting, and continuity notes.",
  },
};

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
  }
}

function normalizeDraft(
  target: DraftTarget,
  payload: Record<string, unknown>,
  fields: string[],
  options: { assetType?: z.infer<typeof assetTypeSchema> } = {},
) {
  const fallback = fallbackDrafts[target];
  return Object.fromEntries(
    fields.map((key) => {
      const value = payload[key];
      if (key === "type" && target === "asset" && options.assetType) {
        return [key, options.assetType];
      }
      if (typeof value === "string") {
        return [key, value];
      }
      if (value !== undefined && value !== null) {
        return [key, JSON.stringify(value)];
      }
      return [key, fallback[key] ?? ""];
    }),
  );
}

export async function generateFormDraft(input: {
  target: DraftTarget;
  steering: string;
  context: Record<string, unknown>;
  fields: string[];
  assetType?: z.infer<typeof assetTypeSchema>;
}) {
  const model = getGenerationModel("text", "openai/gpt-4o-mini");
  const requestPayload = {
    target: input.target,
    model,
    steering: input.steering,
    fields: input.fields,
    assetType: input.assetType,
    context: input.context,
  };

  if (!process.env.OPENROUTER_API_KEY) {
    const draft = normalizeDraft(input.target, {}, input.fields, { assetType: input.assetType });
    const logPath = await writeGenerationLog({ request: requestPayload, response: draft, createdAt: new Date().toISOString() });
    return { draft, logPath, mode: "stub" };
  }

  try {
    const json = await callLLMTextAPI({
      model,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Fill a create/edit form for an AI content studio.",
            "Return only JSON with exactly the requested field names.",
            "Use the supplied workspace, project, asset, image, and scene context.",
            "For project drafts, generate a `scenes` array of objects (each with title, description, action, look) and an `assets` array of objects (each with type, title, description, text).",
            "When project context includes existing assets, treat those assets as already present in the workspace and do not duplicate them in the generated `assets` array.",
            "If a project needs additional resources, generate only new assets that do not already exist, and use `character`, `scene`, and `style` as valid asset types when relevant.",
            "For asset drafts, use the supplied `assetType` or existing asset type as the fixed asset class; do not invent a different class.",
            "For character assets, focus on identity, appearance, wardrobe, behavior, relationships, and continuity constraints.",
            "For scene assets, focus on reusable locations, environments, set details, props, geography, mood, and continuity constraints.",
            "For style assets, focus on visual language, lighting, color, lensing, texture, composition, references, and constraints.",
            "For audio assets, focus on sound source, mood, usage, timing, transcript or cue notes, mix constraints, and audio reference metadata when requested.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify(requestPayload) },
      ],
    });
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const draft = normalizeDraft(input.target, safeParseJson(String(content)), input.fields, { assetType: input.assetType });
    const logPath = await writeGenerationLog({ request: requestPayload, response: json, draft, createdAt: new Date().toISOString() });
    return { draft, logPath, mode: "openrouter" };
  } catch (error) {
    const logPath = await writeGenerationLog({
      request: requestPayload,
      error: error instanceof Error ? error.message : error,
      createdAt: new Date().toISOString(),
    });
    throw Object.assign(error instanceof Error ? error : new Error("OpenRouter request failed"), { logPath });
  }
}
