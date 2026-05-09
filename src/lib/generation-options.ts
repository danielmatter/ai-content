export const generationModelConfigs = {
  text: [
    {
      id: "openai/gpt-5.4-mini",
      label: "GPT-5.4 Mini",
      structuredOutput: true,
    },
  ],
  image: [
    {
      id: "google/gemini-3.1-flash-image-preview",
      label: "Gemini 3.1 Flash Image Preview",
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] as string[],
      sizes: ["1K"] as string[],
      qualities: ["low", "medium", "high"] as string[],
      modalities: ["image", "text"] as string[],
    },
    {
      id: "recraft/recraft-v4",
      label: "Recraft V4",
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] as string[],
      sizes: ["1K"] as string[],
      qualities: ["low", "medium", "high"] as string[],
      modalities: ["image"] as string[],
    },
    {
      id: "black-forest-labs/flux.2-klein-4b",
      label: "Flux.2 Klein 4B",
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] as string[],
      sizes: ["1K"] as string[],
      qualities: ["low", "medium", "high"] as string[],
      modalities: ["image"] as string[],
    },
    {
      id: "bytedance-seed/seedream-4.5",
      label: "Seedream 4.5",
      aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] as string[],
      sizes: ["1K"] as string[],
      qualities: ["low", "medium", "high"] as string[],
      modalities: ["image"] as string[],
    }
  ],
  video: [
    {
      id: "google/veo-3.1",
      label: "Veo 3.1",
      sizes: ["1280x720", "1920x1080", "720x1280", "1080x1920"] as string[],
      // resolutions: ["720p", "1080p"] as string[],
      aspectRatios: ["16:9", "9:16", "1:1"] as string[],
      durations: [4, 6, 8] as number[],
      generateAudio: [true, false] as boolean[],
      frameTypes: ["first_frame", "last_frame"] as string[],
    },
    {
      id: "google/veo-3.1-lite",
      label: "Veo 3.1 Lite",
      sizes: ["1280x720", "1920x1080", "720x1280", "1080x1920"] as string[],
      // resolutions: ["720p"] as string[],
      aspectRatios: ["16:9"] as string[],
      durations: [4, 6, 8] as number[],
      generateAudio: [true, false] as boolean[],
      frameTypes: ["first_frame", "last_frame"] as string[],
    },
    {
      id: "google/veo-3.1-fast",
      label: "Veo 3.1 Fast",
      sizes: ["1280x720", "1920x1080", "720x1280", "1080x1920"] as string[],
      // resolutions: ["720p"] as string[],
      aspectRatios: ["16:9"] as string[],
      durations: [4, 6, 8] as number[],
      generateAudio: [true, false] as boolean[],
      frameTypes: ["first_frame", "last_frame"] as string[],
    },
  ],
} as const;

export type ImageGenerationSettings = {
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  quality?: string;
};

export type VideoGenerationSettings = {
  model?: string;
  size?: string;
  duration?: number;
  generateAudio?: boolean;
};

export type GenerationSettings = ImageGenerationSettings & VideoGenerationSettings;
