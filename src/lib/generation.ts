import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";
import { generationModelConfigs } from "@/lib/generation-options";

export const generationKindSchema = z.enum(["text", "image", "video"]);
export { generationModelConfigs };

export type GenerationKind = z.infer<typeof generationKindSchema>;

export const defaultGenerationModels: Record<GenerationKind, string> = {
  text: generationModelConfigs.text[0].id,
  image: generationModelConfigs.image[0].id,
  video: generationModelConfigs.video[0].id,
};

export function getGenerationModel(kind: GenerationKind, model?: string) {
  const configs = generationModelConfigs[kind];
  return configs.find((config) => config.id === model)?.id ?? defaultGenerationModels[kind];
}

export async function writeGenerationLog(payload: unknown) {
  const logsDir = path.join(process.cwd(), "logs");
  await mkdir(logsDir, { recursive: true });
  const fileName = `generation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(logsDir, fileName);
  await writeFile(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}
