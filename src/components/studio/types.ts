import { Brush, Clapperboard, Music, UserRound } from "lucide-react";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export type AssetType = "scene" | "character" | "style" | "audio";

export type Asset = {
  id: string;
  type: AssetType;
  title: string;
  description: string;
  text: string;
  imageUrls?: string[];
  audioUrl?: string;
  audioMimeType?: string;
};

export type Project = {
  id: string;
  title: string;
  logline: string;
  assetIds?: string[];
  timelineState?: TimelineState;
};

export type TimelineSceneClip = {
  sceneId: string;
  start: number;
  duration: number;
  speed: number;
  fadeIn: number;
  fadeOut: number;
  trackIndex?: number;
  anchor?: TimelineAnchor;
};

export type TimelineAudioClip = {
  assetId: string;
  start: number;
  duration?: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  trackIndex?: number;
  anchor?: TimelineAnchor;
};

export type TimelineAnchor = {
  type: "seconds" | "track-end" | "scene";
  trackType?: "video" | "audio";
  trackIndex?: number;
  sceneId?: string;
  edge?: "start" | "end";
  offset?: number;
};

export type TimelineState = {
  sceneClips: TimelineSceneClip[];
  audioClips: TimelineAudioClip[];
};

export type ProjectScene = {
  id: string;
  position: number;
  title: string;
  description: string;
  action: string;
  look: string;
  first_frame_url: string;
  last_frame_url: string;
  first_frame_description?: string;
  last_frame_description?: string;
  assetIds?: string[];
};

export type LibraryImage = {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  thumbnailUrl: string;
  mimeType: string;
};

export const assetMeta = {
  scene: { label: "Scene Asset", icon: Clapperboard },
  character: { label: "Character", icon: UserRound },
  style: { label: "Visual Style", icon: Brush },
  audio: { label: "Audio Clip", icon: Music },
} satisfies Record<AssetType, { label: string; icon: typeof Clapperboard }>;

export interface RenderJob {
  id: string;
  workspace_id: string;
  project_id: string;
  scene_id: string;
  kind: "video" | "image" | "timeline";
  asset_id: string | null;
  frame_type: "first" | "last" | null;
  description: string;
  image_id: string | null;
  image_url: string | null;
  status: "pending" | "processing" | "completed" | "downloaded" | "failed";
  progress: number;
  video_url: string | null;
  error: string | null;
  openrouter_job_id: string | null;
  openrouter_polling_url: string | null;
  last_queried: string | null;
  last_query_status: string | null;
  created_at: string;
  updated_at: string;
}

export type StudioRoute =
  | { type: "project"; id: string }
  | { type: "scene"; projectId: string; sceneId: string }
  | { type: "asset"; id: string }
  | { type: "image"; id: string }
  | { type: "job"; id: string };

export type StudioTab = "projects" | "assets" | "images" | "jobs";
