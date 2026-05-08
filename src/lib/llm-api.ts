import { getGenerationModel, writeGenerationLog } from "@/lib/generation";

type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

type TextContent = {
  type: "text";
  text: string;
};

type LLMMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
    }
  | {
      role: "user";
      content: Array<TextContent | ImageContent>;
    };

export type LLMTextAPI = {
  model?: string;
  messages: LLMMessage[];
  responseFormat?: unknown;
};

export type LLMImageAPI = {
  model?: string;
  prompt: string;
  aspectRatio: string;
  imageSize?: string;
  quality?: string;
  referenceImages?: string[];
};

export type LLMVideoAPI = {
  model?: string;
  prompt: string;
  duration: number;
  size: string;
  frameImages?: unknown[];
  inputReferences?: unknown[];
  generateAudio?: boolean;
};

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<string | { image_url?: { url?: string }; url?: string; data?: string }>;
    };
  }>;
};

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": "AI Content Studio",
  };
}

function extractBase64Image(data: OpenRouterImageResponse) {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.includes("base64,")) {
    return content.split("base64,")[1].split(/[")\s]/)[0];
  }

  const image = data.choices?.[0]?.message?.images?.[0];
  const source = typeof image === "string" ? image : image?.image_url?.url || image?.url || image?.data;
  if (!source) {
    return null;
  }

  if (source.includes("base64,")) {
    return source.split("base64,")[1].split(/[")\s]/)[0];
  }

  if (/^https?:\/\//i.test(source)) {
    return source;
  }

  return source;
}

export async function callLLMTextAPI(input: LLMTextAPI) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for text generation");
  }

  const model = getGenerationModel("text", input.model);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model,
      messages: input.messages,
      response_format: input.responseFormat,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter text generation failed: ${await response.text()}`);
  }

  return response.json();
}

export async function callLLMImageAPI(input: LLMImageAPI) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for image generation");
  }

  const model = getGenerationModel("image", input.model);
  const content: LLMMessage["content"] = input.referenceImages?.length
    ? [
        { type: "text", text: input.prompt },
        ...input.referenceImages.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ]
    : input.prompt;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
      quality: input.quality,
      image_config: {
        aspect_ratio: input.aspectRatio,
        quality: input.quality,
        image_size: input.imageSize ?? "1K",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    await writeGenerationLog({ prompt: input.prompt, model, error: { status: response.status, detail } });
    throw new Error(`OpenRouter image generation failed: ${detail}`);
  }

  const data = (await response.json()) as OpenRouterImageResponse;
  const imageSource = extractBase64Image(data);
  if (!imageSource) {
    await writeGenerationLog({ prompt: input.prompt, model, response: data });
    throw new Error("No image data found in OpenRouter response");
  }

  await writeGenerationLog({ prompt: input.prompt, model, success: true });

  if (/^https?:\/\//i.test(imageSource)) {
    const imageResponse = await fetch(imageSource);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image: ${imageResponse.status}`);
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  return Buffer.from(imageSource, "base64");
}

export async function callLLMVideoAPI(input: LLMVideoAPI) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for video generation");
  }

  const model = getGenerationModel("video", input.model);
  const response = await fetch("https://openrouter.ai/api/v1/videos", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      duration: input.duration,
      size: input.size,
      frame_images: input.frameImages ?? [],
      input_references: input.inputReferences ?? [],
      generate_audio: input.generateAudio ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter video generation failed: ${await response.text()}`);
  }

  return response.json();
}
