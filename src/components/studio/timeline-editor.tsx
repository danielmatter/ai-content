"use client";

import {
  AudioLines,
  Film,
  Loader2,
  Pause,
  Play,
  Save,
  SkipBack,
  Upload,
  Video,
  X,
} from "lucide-react";
import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Asset, ProjectScene, RenderJob, TimelineAnchor, TimelineAudioClip, TimelineSceneClip, TimelineState } from "./types";
import { api } from "./utils";

interface TimelineEditorProps {
  workspaceId: string;
  projectId: string;
  scenes: ProjectScene[];
  assets: Asset[];
  jobs: RenderJob[];
  timelineState?: TimelineState;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onStatusChange: (status: string) => void;
  onTimelineChange: (timelineState: TimelineState) => void;
  onAssetsChange: (assets: Asset[]) => void;
  onJobsRefresh: () => Promise<RenderJob[]>;
}

type Selection = { kind: "scene"; id: string } | { kind: "audio"; index: number } | null;
type ClipSelection = Exclude<Selection, null>;
type DragClipSnapshot = {
  kind: "scene" | "audio";
  id: string;
  start: number;
  duration: number;
  trackIndex: number;
};
type DragState = {
  mode: "move" | "resize-start" | "resize-end";
  startPointer: number;
  primary: DragClipSnapshot;
  clips: DragClipSnapshot[];
  minStart: number;
  videoTrackCount: number;
  audioTrackCount: number;
};
type MarqueeState = {
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
};
type OverviewDragMode = "start" | "end" | "window";

const PX_PER_SECOND = 72;
const MIN_CLIP_DURATION = 0.3;
const LABEL_WIDTH = 136;
const TIMELINE_HEADER_HEIGHT = 32;
const TRACK_HEIGHT = 96;
const CLIP_HEIGHT = 66;
const CLIP_TOP_OFFSET = 12;

function defaultSceneClips(scenes: ProjectScene[]): TimelineSceneClip[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const clip = { sceneId: scene.id, start: cursor, duration: 4, speed: 1, fadeIn: 0, fadeOut: 0, trackIndex: 0 };
    cursor += clip.duration;
    return clip;
  });
}

function normalizeTimeline(state: TimelineState | undefined, scenes: ProjectScene[]) {
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const existing = state?.sceneClips?.filter((clip) => sceneIds.has(clip.sceneId)) ?? [];
  const missing = scenes.filter((scene) => !existing.some((clip) => clip.sceneId === scene.id));
  const lastEnd = existing.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);

  return {
    sceneClips:
      existing.length || missing.length
        ? [
          ...existing,
          ...missing.map((scene, index) => ({
            sceneId: scene.id,
            start: lastEnd + index * 4,
            duration: 4,
            speed: 1,
            fadeIn: 0,
            fadeOut: 0,
            trackIndex: 0,
          })),
        ]
        : defaultSceneClips(scenes),
    audioClips: state?.audioClips ?? [],
  };
}

function numberValue(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

function clipTrackIndex(clip: { trackIndex?: number }) {
  return Math.max(0, Math.floor(clip.trackIndex ?? 0));
}

function anchorOffset(anchor: TimelineAnchor | undefined) {
  const offset = anchor?.offset;
  return Number.isFinite(offset) ? offset ?? 0 : 0;
}

function sceneAnchorValue(anchor: TimelineAnchor | undefined) {
  if (anchor?.type !== "scene" || !anchor.sceneId) return "seconds";
  return `scene:${anchor.edge ?? "end"}:${anchor.sceneId}`;
}

function clipKey(selection: ClipSelection) {
  return selection.kind === "scene" ? `scene:${selection.id}` : `audio:${selection.index}`;
}

function isClipSelection(value: Selection): value is ClipSelection {
  return value !== null;
}

function rectanglesIntersect(
  left: number,
  top: number,
  width: number,
  height: number,
  selectionLeft: number,
  selectionTop: number,
  selectionRight: number,
  selectionBottom: number,
) {
  return left < selectionRight && left + width > selectionLeft && top < selectionBottom && top + height > selectionTop;
}

export function TimelineEditor({
  workspaceId,
  projectId,
  scenes,
  assets,
  jobs,
  timelineState,
  busy,
  onBusyChange,
  onStatusChange,
  onTimelineChange,
  onAssetsChange,
  onJobsRefresh,
}: TimelineEditorProps) {
  const [draft, setDraft] = useState<TimelineState>(() => normalizeTimeline(timelineState, scenes));
  const [selection, setSelection] = useState<Selection>(null);
  const [selectedClipKeys, setSelectedClipKeys] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 540 });
  const [pixelsPerSecond, setPixelsPerSecond] = useState(PX_PER_SECOND);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [viewWindow, setViewWindow] = useState({ start: 0, end: 12 });
  const [overviewDragMode, setOverviewDragMode] = useState<OverviewDragMode | null>(null);
  const [dragTrackCounts, setDragTrackCounts] = useState<{ video: number; audio: number } | null>(null);
  const [sceneSourceDurations, setSceneSourceDurations] = useState<Record<string, number>>({});
  const [audioSourceDurations, setAudioSourceDurations] = useState<Record<string, number>>({});
  const uploadRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const currentTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const playbackSessionRef = useRef<{ startTime: number; startTimestamp: number } | null>(null);
  const sceneVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const audioRefs = useRef(new Map<number, HTMLAudioElement>());

  const audioAssets = useMemo(() => assets.filter((asset) => asset.type === "audio" && asset.audioUrl), [assets]);
  const latestTimelineJob = jobs.find((job) => job.project_id === projectId && job.kind === "timeline" && job.video_url);
  const sceneById = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);
  const audioById = useMemo(() => new Map(audioAssets.map((asset) => [asset.id, asset])), [audioAssets]);
  const latestSceneVideos = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      if (job.kind === "video" && job.video_url && (job.status === "completed" || job.status === "downloaded") && !map.has(job.scene_id)) {
        map.set(job.scene_id, job.video_url);
      }
    }
    return map;
  }, [jobs]);

  const getAudioTrueLength = useCallback((clip: TimelineAudioClip) => {
    const source = audioSourceDurations[clip.assetId];
    if (Number.isFinite(source) && source > 0) return source;
    return Math.max(MIN_CLIP_DURATION, clip.duration ?? 8);
  }, [audioSourceDurations]);

  const getSceneTrueLength = useCallback((clip: TimelineSceneClip) => {
    const source = sceneSourceDurations[clip.sceneId];
    if (Number.isFinite(source) && source > 0) return source;
    return Math.max(MIN_CLIP_DURATION * Math.max(clip.speed, 0.1), clip.duration * Math.max(clip.speed, 0.1));
  }, [sceneSourceDurations]);

  const resolveAnchors = useCallback((state: TimelineState): TimelineState => {
    const sceneClips = state.sceneClips.map((clip) => ({ ...clip }));
    const audioClips = state.audioClips.map((clip) => ({ ...clip }));

    function trackEnd(anchor: TimelineAnchor, fallbackType: "video" | "audio", fallbackTrack: number, currentIndex: number) {
      const trackType = anchor.trackType ?? fallbackType;
      const trackIndex = anchor.trackIndex ?? fallbackTrack;
      const sceneEnd = trackType === "video"
        ? sceneClips.slice(0, currentIndex).reduce((end, clip) => clipTrackIndex(clip) === trackIndex ? Math.max(end, clip.start + clip.duration) : end, 0)
        : 0;
      const audioEnd = trackType === "audio"
        ? audioClips.slice(0, currentIndex).reduce((end, clip) => clipTrackIndex(clip) === trackIndex ? Math.max(end, clip.start + getAudioTrueLength(clip)) : end, 0)
        : 0;
      return Math.max(sceneEnd, audioEnd);
    }

    function sceneBoundary(anchor: TimelineAnchor, currentSceneId?: string) {
      if (!anchor.sceneId || anchor.sceneId === currentSceneId) return undefined;
      const clip = sceneClips.find((item) => item.sceneId === anchor.sceneId);
      if (!clip) return undefined;
      return (anchor.edge ?? "end") === "start" ? clip.start : clip.start + clip.duration;
    }

    function anchoredStart(
      anchor: TimelineAnchor | undefined,
      fallbackType: "video" | "audio",
      fallbackTrack: number,
      currentIndex: number,
      currentSceneId?: string,
    ) {
      if (!anchor || anchor.type === "seconds") return undefined;
      const base = anchor.type === "scene"
        ? sceneBoundary(anchor, currentSceneId)
        : trackEnd(anchor, fallbackType, fallbackTrack, currentIndex);
      return base === undefined ? undefined : snap(Math.max(0, base + anchorOffset(anchor)));
    }

    const iterations = Math.max(3, sceneClips.length + audioClips.length);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      sceneClips.forEach((clip, index) => {
        const start = anchoredStart(clip.anchor, "video", clipTrackIndex(clip), index, clip.sceneId);
        if (start !== undefined) clip.start = start;
      });
      audioClips.forEach((clip, index) => {
        const start = anchoredStart(clip.anchor, "audio", clipTrackIndex(clip), index);
        if (start !== undefined) clip.start = start;
      });
    }

    return { sceneClips, audioClips };
  }, [getAudioTrueLength]);

  const resolvedDraft = useMemo(() => resolveAnchors(draft), [draft, resolveAnchors]);

  const timelineDuration = useMemo(() => {
    const sceneEnd = resolvedDraft.sceneClips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
    const audioEnd = resolvedDraft.audioClips.reduce((end, clip) => Math.max(end, clip.start + getAudioTrueLength(clip)), 0);
    return Math.max(10, Math.ceil(Math.max(sceneEnd, audioEnd) + 1));
  }, [getAudioTrueLength, resolvedDraft.audioClips, resolvedDraft.sceneClips]);

  const timelineWidth = timelineDuration * pixelsPerSecond;
  const selectedScene = selection?.kind === "scene" ? resolvedDraft.sceneClips.find((clip) => clip.sceneId === selection.id) : null;
  const selectedAudio = selection?.kind === "audio" ? resolvedDraft.audioClips[selection.index] : null;
  const draftVideoTrackCount = Math.max(1, ...draft.sceneClips.map((clip) => clipTrackIndex(clip) + 1)) + 1;
  const draftAudioTrackCount = Math.max(1, ...draft.audioClips.map((clip) => clipTrackIndex(clip) + 1)) + 1;
  const videoTrackCount = dragTrackCounts?.video ?? draftVideoTrackCount;
  const audioTrackCount = dragTrackCounts?.audio ?? draftAudioTrackCount;
  const totalTrackHeight = (videoTrackCount + audioTrackCount) * TRACK_HEIGHT;

  const setSingleSelection = useCallback((next: Selection) => {
    setSelection(next);
    setSelectedClipKeys(isClipSelection(next) ? [clipKey(next)] : []);
  }, []);

  const isClipSelected = useCallback((key: string) => selectedClipKeys.includes(key), [selectedClipKeys]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, Math.round(entry.contentRect.width));
      setCanvasSize({ width, height: Math.round((width * 9) / 16) });
    });
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const setPreviewTime = useCallback((time: number) => {
    const next = clamp(time, 0, timelineDuration);
    currentTimeRef.current = next;
    setCurrentTime(next);
  }, [timelineDuration]);

  const drawPreview = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#09090b";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const active = resolvedDraft.sceneClips
      .filter((clip) => time >= clip.start && time <= clip.start + clip.duration)
      .sort((a, b) => a.start - b.start)
      .at(-1);

    if (!active) {
      context.fillStyle = "#a1a1aa";
      context.font = "14px system-ui, sans-serif";
      context.fillText("No scene at playhead", 24, 34);
      return;
    }

    const video = sceneVideoRefs.current.get(active.sceneId);
    if (video && video.readyState >= 2) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      context.fillStyle = "#18181b";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    const scene = sceneById.get(active.sceneId);
    context.fillStyle = "rgba(0,0,0,0.58)";
    context.fillRect(0, canvas.height - 48, canvas.width, 48);
    context.fillStyle = "#fafafa";
    context.font = "14px system-ui, sans-serif";
    context.fillText(scene?.title ?? "Missing scene", 18, canvas.height - 19);
  }, [resolvedDraft.sceneClips, sceneById]);

  const syncMedia = useCallback((time: number, playing: boolean) => {
    for (const clip of resolvedDraft.sceneClips) {
      const video = sceneVideoRefs.current.get(clip.sceneId);
      if (!video) continue;
      const active = time >= clip.start && time <= clip.start + clip.duration;
      video.muted = true;
      video.playbackRate = clip.speed;
      if (!active) {
        if (!video.paused) video.pause();
        continue;
      }
      const target = Math.max(0, (time - clip.start) * clip.speed);
      if (Number.isFinite(target) && Math.abs(video.currentTime - target) > 0.15) {
        video.currentTime = Math.min(target, video.duration || target);
      }
      if (playing) {
        if (video.paused) void video.play().catch(() => undefined);
      } else if (!video.paused) {
        video.pause();
      }
    }

    resolvedDraft.audioClips.forEach((clip, index) => {
      const audio = audioRefs.current.get(index);
      if (!audio) return;
      const limit = getAudioTrueLength(clip);
      const local = time - clip.start;
      const active = local >= 0 && local <= limit;
      if (!active) {
        if (!audio.paused) audio.pause();
        return;
      }
      if (Math.abs(audio.currentTime - local) > 0.25) {
        audio.currentTime = Math.max(0, local);
      }
      const fadeInVolume = clip.fadeIn > 0 ? clamp(local / clip.fadeIn, 0, 1) : 1;
      const fadeOutVolume = clip.fadeOut > 0 ? clamp((limit - local) / clip.fadeOut, 0, 1) : 1;
      audio.volume = clamp(clip.volume * Math.min(fadeInVolume, fadeOutVolume), 0, 1);
      if (playing) {
        if (audio.paused) void audio.play().catch(() => undefined);
      } else if (!audio.paused) {
        audio.pause();
      }
    });
  }, [getAudioTrueLength, resolvedDraft.audioClips, resolvedDraft.sceneClips]);

  useEffect(() => {
    if (isPlaying) return;
    drawPreview(currentTime);
    syncMedia(currentTime, false);
  }, [currentTime, drawPreview, isPlaying, syncMedia]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      playbackSessionRef.current = null;
      syncMedia(currentTimeRef.current, false);
      return;
    }

    playbackSessionRef.current = { startTime: currentTimeRef.current, startTimestamp: performance.now() };

    function tick(timestamp: number) {
      const session = playbackSessionRef.current;
      if (!session) return;
      const next = session.startTime + (timestamp - session.startTimestamp) / 1000;
      if (next >= timelineDuration) {
        setIsPlaying(false);
        setPreviewTime(timelineDuration);
        syncMedia(timelineDuration, false);
        drawPreview(timelineDuration);
        playbackSessionRef.current = null;
        rafRef.current = null;
        return;
      }
      setPreviewTime(next);
      syncMedia(next, true);
      drawPreview(next);
      rafRef.current = window.requestAnimationFrame(tick);
    }

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [drawPreview, isPlaying, setPreviewTime, syncMedia, timelineDuration]);

  const reconcileSceneClip = useCallback((clip: TimelineSceneClip, patch: Partial<TimelineSceneClip>) => {
    const next = { ...clip, ...patch };
    const trueLength = getSceneTrueLength(clip);

    if (patch.speed !== undefined && patch.duration === undefined) {
      const speed = clamp(patch.speed, 0.1, 4);
      next.speed = snap(speed);
      next.duration = snap(clamp(trueLength / speed, MIN_CLIP_DURATION, 600));
    }

    if (patch.duration !== undefined && patch.speed === undefined) {
      const requestedDuration = clamp(patch.duration, MIN_CLIP_DURATION, 600);
      const speed = clamp(trueLength / requestedDuration, 0.1, 4);
      next.speed = snap(speed);
      next.duration = snap(clamp(trueLength / speed, MIN_CLIP_DURATION, 600));
    }

    next.start = snap(Math.max(0, next.start));
    next.fadeIn = snap(clamp(next.fadeIn, 0, next.duration));
    next.fadeOut = snap(clamp(next.fadeOut, 0, next.duration));
    return next;
  }, [getSceneTrueLength]);

  const reconcileAudioClip = useCallback((clip: TimelineAudioClip, patch: Partial<TimelineAudioClip>) => {
    const next = { ...clip, ...patch };
    next.start = snap(Math.max(0, next.start));
    next.duration = snap(clamp(getAudioTrueLength(next), MIN_CLIP_DURATION, 3600));
    next.fadeIn = snap(clamp(next.fadeIn, 0, next.duration));
    next.fadeOut = snap(clamp(next.fadeOut, 0, next.duration));
    return next;
  }, [getAudioTrueLength]);

  const updateSceneClip = useCallback((sceneId: string, patch: Partial<TimelineSceneClip>) => {
    setDraft((current) => ({
      ...current,
      sceneClips: current.sceneClips.map((clip) => (clip.sceneId === sceneId ? reconcileSceneClip(clip, patch) : clip)),
    }));
  }, [reconcileSceneClip]);

  const updateAudioClip = useCallback((index: number, patch: Partial<TimelineAudioClip>) => {
    setDraft((current) => ({
      ...current,
      audioClips: current.audioClips.map((clip, clipIndex) => (clipIndex === index ? reconcileAudioClip(clip, patch) : clip)),
    }));
  }, [reconcileAudioClip]);

  const buildSceneAnchor = useCallback((value: string, current?: TimelineAnchor): TimelineAnchor => {
    if (value === "seconds") return { type: "seconds" };
    const [, edge, sceneId] = value.split(":");
    return { type: "scene", edge: edge === "start" ? "start" : "end", sceneId, offset: anchorOffset(current) };
  }, []);

  const setSceneAnchor = useCallback((sceneId: string, value: string) => {
    setDraft((current) => ({
      ...current,
      sceneClips: current.sceneClips.map((clip) => (
        clip.sceneId === sceneId ? reconcileSceneClip(clip, { anchor: buildSceneAnchor(value, clip.anchor) }) : clip
      )),
    }));
  }, [buildSceneAnchor, reconcileSceneClip]);

  const setSceneAnchorOffset = useCallback((sceneId: string, offset: number) => {
    setDraft((current) => ({
      ...current,
      sceneClips: current.sceneClips.map((clip) => (
        clip.sceneId === sceneId && clip.anchor?.type === "scene"
          ? reconcileSceneClip(clip, { anchor: { ...clip.anchor, offset: snap(offset) } })
          : clip
      )),
    }));
  }, [reconcileSceneClip]);

  const setAudioAnchor = useCallback((index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      audioClips: current.audioClips.map((clip, clipIndex) => (
        clipIndex === index ? reconcileAudioClip(clip, { anchor: buildSceneAnchor(value, clip.anchor) }) : clip
      )),
    }));
  }, [buildSceneAnchor, reconcileAudioClip]);

  const setAudioAnchorOffset = useCallback((index: number, offset: number) => {
    setDraft((current) => ({
      ...current,
      audioClips: current.audioClips.map((clip, clipIndex) => (
        clipIndex === index && clip.anchor?.type === "scene"
          ? reconcileAudioClip(clip, { anchor: { ...clip.anchor, offset: snap(offset) } })
          : clip
      )),
    }));
  }, [reconcileAudioClip]);

  const addAudioClip = useCallback((assetId: string) => {
    setDraft((current) => ({
      ...current,
      audioClips: [
        ...current.audioClips,
        reconcileAudioClip({
          assetId,
          start: currentTimeRef.current,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          trackIndex: Math.max(0, ...current.audioClips.map((clip) => clipTrackIndex(clip))),
        }, {}),
      ],
    }));
  }, [reconcileAudioClip]);

  const applySceneSourceDuration = useCallback((sceneId: string, duration: number) => {
    setSceneSourceDurations((current) => current[sceneId] === duration ? current : { ...current, [sceneId]: duration });
    setDraft((current) => {
      let changed = false;
      const sceneClips = current.sceneClips.map((clip) => {
        if (clip.sceneId !== sceneId) return clip;
        const speed = clamp(clip.speed, 0.1, 4);
        const nextDuration = snap(clamp(duration / speed, MIN_CLIP_DURATION, 600));
        if (Math.abs(nextDuration - clip.duration) < 0.05 && Math.abs(speed - clip.speed) < 0.05) return clip;
        changed = true;
        return { ...clip, speed: snap(speed), duration: nextDuration };
      });
      return changed ? { ...current, sceneClips } : current;
    });
  }, []);

  const applyAudioSourceDuration = useCallback((assetId: string, duration: number) => {
    setAudioSourceDurations((current) => current[assetId] === duration ? current : { ...current, [assetId]: duration });
    setDraft((current) => {
      let changed = false;
      const audioClips = current.audioClips.map((clip) => {
        if (clip.assetId !== assetId) return clip;
        const nextDuration = snap(clamp(duration, MIN_CLIP_DURATION, 3600));
        if (Math.abs(nextDuration - (clip.duration ?? 0)) < 0.05) return clip;
        changed = true;
        return { ...clip, duration: nextDuration };
      });
      return changed ? { ...current, audioClips } : current;
    });
  }, []);

  function secondsFromPointer(clientX: number) {
    const timeline = timelineRef.current;
    if (!timeline) return 0;
    const rect = timeline.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left + timeline.scrollLeft - LABEL_WIDTH) / pixelsPerSecond);
  }

  function contentPointFromPointer(clientX: number, clientY: number) {
    const timeline = timelineRef.current;
    const content = timelineContentRef.current;
    if (!timeline || !content) return { x: 0, y: 0 };
    const rect = content.getBoundingClientRect();
    return {
      x: clientX - rect.left + timeline.scrollLeft,
      y: clientY - rect.top,
    };
  }

  function trackIndexFromPointer(kind: "scene" | "audio", clientY: number, trackCounts = { video: videoTrackCount, audio: audioTrackCount }) {
    const point = contentPointFromPointer(0, clientY);
    const trackY = point.y - TIMELINE_HEADER_HEIGHT;

    if (kind === "scene") {
      const row = Math.floor(clamp(trackY, 0, trackCounts.video * TRACK_HEIGHT - 1) / TRACK_HEIGHT);
      return trackCounts.video - row - 1;
    }

    const audioY = trackY - trackCounts.video * TRACK_HEIGHT;
    const row = Math.floor(clamp(audioY, 0, trackCounts.audio * TRACK_HEIGHT - 1) / TRACK_HEIGHT);
    return trackCounts.audio - row - 1;
  }

  function findDragClip(selectionTarget: ClipSelection): DragClipSnapshot {
    if (selectionTarget.kind === "scene") {
      const clip = draft.sceneClips.find((item) => item.sceneId === selectionTarget.id);
      return {
        kind: "scene",
        id: selectionTarget.id,
        start: clip?.start ?? 0,
        duration: clip?.duration ?? MIN_CLIP_DURATION,
        trackIndex: clipTrackIndex(clip ?? {}),
      };
    }
    const clip = draft.audioClips[selectionTarget.index];
    return {
      kind: "audio",
      id: String(selectionTarget.index),
      start: clip?.start ?? 0,
      duration: clip ? getAudioTrueLength(clip) : MIN_CLIP_DURATION,
      trackIndex: clipTrackIndex(clip ?? {}),
    };
  }

  function selectedDragClips(primary: ClipSelection, selectedKeysOverride?: string[]) {
    const primaryKey = clipKey(primary);
    const keys = selectedKeysOverride ?? (selectedClipKeys.includes(primaryKey) ? selectedClipKeys : [primaryKey]);
    return keys
      .map((key) => {
        if (key.startsWith("scene:")) {
          const id = key.slice("scene:".length);
          const clip = draft.sceneClips.find((item) => item.sceneId === id);
          return clip ? { kind: "scene" as const, id, start: clip.start, duration: clip.duration, trackIndex: clipTrackIndex(clip) } : null;
        }
        const index = Number(key.slice("audio:".length));
        const clip = draft.audioClips[index];
        return clip ? { kind: "audio" as const, id: String(index), start: clip.start, duration: getAudioTrueLength(clip), trackIndex: clipTrackIndex(clip) } : null;
      })
      .filter((item): item is DragClipSnapshot => item !== null);
  }

  function startDrag(event: PointerEvent, primary: ClipSelection, mode: DragState["mode"], selectedKeysOverride?: string[]) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const trackCounts = { video: videoTrackCount, audio: audioTrackCount };
    setDragTrackCounts(trackCounts);
    const primaryClip = findDragClip(primary);
    const clips = mode === "move" ? selectedDragClips(primary, selectedKeysOverride) : [primaryClip];
    dragRef.current = {
      mode,
      primary: primaryClip,
      clips,
      minStart: Math.min(...clips.map((clip) => clip.start)),
      startPointer: secondsFromPointer(event.clientX),
      videoTrackCount: trackCounts.video,
      audioTrackCount: trackCounts.audio,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag) {
      event.preventDefault();
      const delta = secondsFromPointer(event.clientX) - drag.startPointer;
      if (drag.mode === "move") {
        const clampedDelta = snap(Math.max(delta, -drag.minStart));
        const stableTrackCounts = { video: drag.videoTrackCount, audio: drag.audioTrackCount };
        const primaryTrack = trackIndexFromPointer(drag.primary.kind, event.clientY, stableTrackCounts);
        const trackDelta = primaryTrack - drag.primary.trackIndex;
        const sceneTrackDelta = drag.primary.kind === "scene" ? trackDelta : 0;
        const audioTrackDelta = drag.primary.kind === "audio" ? trackDelta : 0;
        setDraft((current) => ({
          ...current,
          sceneClips: current.sceneClips.map((clip) => {
            const snapshot = drag.clips.find((item) => item.kind === "scene" && item.id === clip.sceneId);
            return snapshot
              ? {
                ...clip,
                start: snap(snapshot.start + clampedDelta),
                trackIndex: clamp(snapshot.trackIndex + sceneTrackDelta, 0, drag.videoTrackCount - 1),
                anchor: { type: "seconds" },
              }
              : clip;
          }),
          audioClips: current.audioClips.map((clip, index) => {
            const snapshot = drag.clips.find((item) => item.kind === "audio" && item.id === String(index));
            return snapshot
              ? reconcileAudioClip(clip, {
                start: snapshot.start + clampedDelta,
                trackIndex: clamp(snapshot.trackIndex + audioTrackDelta, 0, drag.audioTrackCount - 1),
                anchor: { type: "seconds" },
              })
              : clip;
          }),
        }));
      } else {
        const patch =
          drag.mode === "resize-start"
            ? {
              start: snap(Math.min(drag.primary.start + delta, drag.primary.start + drag.primary.duration - MIN_CLIP_DURATION)),
              duration: snap(Math.max(MIN_CLIP_DURATION, drag.primary.duration - delta)),
            }
            : { duration: snap(Math.max(MIN_CLIP_DURATION, drag.primary.duration + delta)) };

        if (drag.primary.kind === "scene") updateSceneClip(drag.primary.id, patch);
      }
      return;
    }

    if (!marquee) return;
    const point = contentPointFromPointer(event.clientX, event.clientY);
    setMarquee((current) => (current ? { ...current, currentX: point.x, currentY: point.y } : current));
  }

  function stopDrag(event?: PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      dragRef.current = null;
      setDragTrackCounts(null);
    }
    if (!marquee) return;
    const nextMarquee = marquee;
    setMarquee(null);

    const left = Math.min(nextMarquee.startX, nextMarquee.currentX);
    const right = Math.max(nextMarquee.startX, nextMarquee.currentX);
    const top = Math.min(nextMarquee.startY, nextMarquee.currentY);
    const bottom = Math.max(nextMarquee.startY, nextMarquee.currentY);
    const width = Math.abs(nextMarquee.currentX - nextMarquee.startX);
    const height = Math.abs(nextMarquee.currentY - nextMarquee.startY);

    if (width < 4 && height < 4) {
      if (event) setPreviewTime(secondsFromPointer(event.clientX));
      return;
    }

    const nextSelection = [
      ...resolvedDraft.sceneClips.flatMap((clip) => {
        const clipWidth = Math.max(48, clip.duration * pixelsPerSecond);
        const clipLeft = LABEL_WIDTH + clip.start * pixelsPerSecond;
        const clipTop = TIMELINE_HEADER_HEIGHT + clipTrackIndex(clip) * TRACK_HEIGHT + CLIP_TOP_OFFSET;
        return rectanglesIntersect(clipLeft, clipTop, clipWidth, CLIP_HEIGHT, left, top, right, bottom)
          ? [{ kind: "scene" as const, id: clip.sceneId }]
          : [];
      }),
      ...resolvedDraft.audioClips.flatMap((clip, index) => {
        const clipWidth = Math.max(48, getAudioTrueLength(clip) * pixelsPerSecond);
        const clipLeft = LABEL_WIDTH + clip.start * pixelsPerSecond;
        const clipTop = TIMELINE_HEADER_HEIGHT + (videoTrackCount + clipTrackIndex(clip)) * TRACK_HEIGHT + CLIP_TOP_OFFSET;
        return rectanglesIntersect(clipLeft, clipTop, clipWidth, CLIP_HEIGHT, left, top, right, bottom)
          ? [{ kind: "audio" as const, index }]
          : [];
      }),
    ];

    setSelectedClipKeys(nextSelection.map((item) => clipKey(item)));
    setSelection(nextSelection.at(0) ?? null);
  }

  function handleTimelinePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-clip='true']") || target.closest("[data-resize-handle='true']")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = contentPointFromPointer(event.clientX, event.clientY);
    setSelection(null);
    setSelectedClipKeys([]);
    setMarquee({ startX: point.x, currentX: point.x, startY: point.y, currentY: point.y });
  }

  function overviewSecond(clientX: number) {
    const overview = overviewRef.current;
    if (!overview) return 0;
    const rect = overview.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * timelineDuration, 0, timelineDuration);
  }

  function handleOverviewPointerDown(event: PointerEvent<HTMLElement>, mode: OverviewDragMode) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setOverviewDragMode(mode);
  }

  function handleOverviewPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!overviewDragMode) return;
    const second = overviewSecond(event.clientX);
    setViewWindow((current) => {
      const width = current.end - current.start;
      if (overviewDragMode === "start") return { ...current, start: snap(clamp(second, 0, current.end - 1)) };
      if (overviewDragMode === "end") return { ...current, end: snap(clamp(second, current.start + 1, timelineDuration)) };
      const nextStart = snap(clamp(second - width / 2, 0, Math.max(0, timelineDuration - width)));
      return { start: nextStart, end: snap(nextStart + width) };
    });
  }

  function stopOverviewDrag() {
    setOverviewDragMode(null);
  }

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const visibleSeconds = Math.max(1, viewWindow.end - viewWindow.start);
    const availableWidth = Math.max(360, timeline.clientWidth - LABEL_WIDTH);
    setPixelsPerSecond(availableWidth / visibleSeconds);
    timeline.scrollLeft = viewWindow.start * (availableWidth / visibleSeconds);
  }, [viewWindow]);

  const lastSavedDraft = useRef(JSON.stringify(resolveAnchors(draft)));
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDraftStr = JSON.stringify(resolveAnchors(draft));
      if (currentDraftStr !== lastSavedDraft.current) {
        lastSavedDraft.current = currentDraftStr;
        api<{ timelineState: TimelineState }>(`/api/workspaces/${workspaceId}/projects/${projectId}/timeline`, {
          method: "PUT",
          body: currentDraftStr,
        })
          .then((data) => {
            onTimelineChange(data.timelineState);
          })
          .catch((error) => console.error("Auto-save failed", error));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [draft, resolveAnchors, workspaceId, projectId, onTimelineChange]);

  async function saveTimeline() {
    onBusyChange(true);
    try {
      const data = await api<{ timelineState: TimelineState }>(`/api/workspaces/${workspaceId}/projects/${projectId}/timeline`, {
        method: "PUT",
        body: JSON.stringify(resolveAnchors(draft)),
      });
      onTimelineChange(data.timelineState);
      onStatusChange("Timeline saved.");
    } finally {
      onBusyChange(false);
    }
  }

  async function uploadAudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onBusyChange(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/audio/upload`, { method: "POST", body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Audio upload failed");
      }
      const data = (await response.json()) as { asset: Asset };
      onAssetsChange([data.asset, ...assets]);
      addAudioClip(data.asset.id);
      uploadRef.current?.reset();
      onStatusChange("Audio clip uploaded.");
    } finally {
      onBusyChange(false);
    }
  }

  async function renderTimeline() {
    onBusyChange(true);
    onStatusChange("Starting timeline render...");
    try {
      await saveTimeline();
      await api<{ jobId: string; videoUrl?: string }>(`/api/workspaces/${workspaceId}/projects/${projectId}/timeline/render`, {
        method: "POST",
      });
      await onJobsRefresh();
      onStatusChange("Timeline render completed.");
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : "Timeline render failed.");
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy || !scenes.length} onClick={() => void saveTimeline()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save timeline
        </Button>
        <Button type="button" disabled={busy || !draft.sceneClips.length} onClick={() => void renderTimeline()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
          Render timeline
        </Button>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Render preview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {latestTimelineJob?.video_url ? <video src={latestTimelineJob.video_url} controls className="w-full rounded-md border" /> : null}
            <div ref={previewRef} className="overflow-hidden rounded-md border bg-black">
              <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="block w-full" />
            </div>
            <div className="hidden">
              {draft.sceneClips.map((clip) => {
                const videoUrl = latestSceneVideos.get(clip.sceneId);
                return videoUrl ? (
                  <video
                    key={clip.sceneId}
                    ref={(node) => {
                      if (node) sceneVideoRefs.current.set(clip.sceneId, node);
                      else sceneVideoRefs.current.delete(clip.sceneId);
                    }}
                    src={videoUrl}
                    preload="auto"
                    playsInline
                    muted
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration;
                      if (Number.isFinite(duration) && duration > 0) {
                        applySceneSourceDuration(clip.sceneId, duration);
                      }
                    }}
                  />
                ) : null;
              })}
              {draft.audioClips.map((clip, index) => {
                const asset = audioById.get(clip.assetId);
                return asset?.audioUrl ? (
                  <audio
                    key={`${clip.assetId}-${index}`}
                    ref={(node) => {
                      if (node) audioRefs.current.set(index, node);
                      else audioRefs.current.delete(index);
                    }}
                    src={asset.audioUrl}
                    preload="auto"
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration;
                      if (Number.isFinite(duration) && duration > 0) {
                        applyAudioSourceDuration(clip.assetId, duration);
                      }
                    }}
                  />
                ) : null;
              })}
            </div>
            {!draft.sceneClips.some((clip) => latestSceneVideos.has(clip.sceneId)) ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Render individual scenes first to enable canvas preview and final rendering.</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setPreviewTime(0)}>
                <SkipBack className="size-4" />
                <span className="sr-only">Jump to start</span>
              </Button>
              <Button type="button" size="sm" onClick={() => setIsPlaying((value) => !value)}>
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Input
                className="min-w-48 flex-1"
                type="range"
                min={0}
                max={timelineDuration}
                step={0.05}
                value={currentTime}
                onChange={(event) => {
                  setIsPlaying(false);
                  setPreviewTime(numberValue(event.target.value, currentTime));
                }}
              />
              <span className="w-16 text-right text-xs text-muted-foreground">{currentTime.toFixed(1)}s</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="size-4" />
              Timeline editor
            </CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline">{timelineDuration.toFixed(1)}s</Badge>
              <div
                ref={overviewRef}
                className="relative h-8 w-[min(360px,55vw)] touch-none rounded-md border bg-muted"
                onPointerMove={handleOverviewPointerMove}
                onPointerUp={stopOverviewDrag}
                onPointerCancel={stopOverviewDrag}
              >
                <div className="absolute inset-y-2 left-2 right-2 rounded bg-background" />
                <div
                  className="absolute top-1 h-6 cursor-grab rounded border border-primary bg-primary/15 active:cursor-grabbing"
                  style={{
                    left: `${(viewWindow.start / timelineDuration) * 100}%`,
                    width: `${((viewWindow.end - viewWindow.start) / timelineDuration) * 100}%`,
                  }}
                  onPointerDown={(event) => handleOverviewPointerDown(event, "window")}
                >
                  <button
                    type="button"
                    className="absolute -left-1 top-0 h-full w-3 cursor-ew-resize rounded bg-primary"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      handleOverviewPointerDown(event, "start");
                    }}
                  />
                  <button
                    type="button"
                    className="absolute -right-1 top-0 h-full w-3 cursor-ew-resize rounded bg-primary"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      handleOverviewPointerDown(event, "end");
                    }}
                  />
                </div>
              </div>
              <span className="w-24 text-right text-xs text-muted-foreground">{viewWindow.start.toFixed(1)}-{viewWindow.end.toFixed(1)}s</span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div
              className="overflow-x-auto rounded-md border bg-background select-none"
              ref={timelineRef}
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
            >
              <div ref={timelineContentRef} className="relative min-w-full" style={{ width: LABEL_WIDTH + timelineWidth }}>
                <div className="sticky left-0 z-20 grid h-8 w-full grid-cols-[136px_1fr] border-b bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <div className="border-r px-3 py-2">Tracks</div>
                  <div className="relative">
                    {Array.from({ length: timelineDuration + 1 }).map((_, second) => (
                      <div key={second} className="absolute top-0 h-full border-l px-1 py-2" style={{ left: second * pixelsPerSecond }}>
                        {second}s
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-[136px_1fr] border-b">
                  <div className="sticky left-0 z-10 border-r bg-card">
                    {Array.from({ length: videoTrackCount }).map((_, offset) => {
                      const track = videoTrackCount - offset - 1;
                      return <div key={track} className="flex h-24 items-center px-3 text-sm font-medium text-blue-900">Video {track + 1}</div>;
                    })}
                  </div>
                  <div className="relative" style={{ width: timelineWidth, height: videoTrackCount * TRACK_HEIGHT }}>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]" style={{ backgroundSize: `${pixelsPerSecond}px 100%` }} />
                    {Array.from({ length: videoTrackCount }).map((_, offset) => <div key={offset} className="absolute left-0 right-0 border-b" style={{ top: offset * TRACK_HEIGHT }} />)}
                    {resolvedDraft.sceneClips.map((clip, index) => {
                      const scene = sceneById.get(clip.sceneId);
                      const hasVideo = latestSceneVideos.has(clip.sceneId);
                      const currentSelection = { kind: "scene" as const, id: clip.sceneId };
                      const key = clipKey(currentSelection);
                      const track = clipTrackIndex(clip);
                      const row = videoTrackCount - track - 1;
                      return (
                        <div
                          key={clip.sceneId}
                          data-clip="true"
                          className={cn(
                            "absolute flex h-16.5 cursor-grab touch-none items-center gap-2 overflow-hidden rounded-md border px-2 text-left shadow-sm active:cursor-grabbing",
                            isClipSelected(key)
                              ? "border-blue-700 bg-blue-100 text-blue-950"
                              : hasVideo
                                ? "border-blue-300 bg-blue-50 text-blue-950 hover:bg-blue-100"
                                : "border-blue-200 bg-blue-50/60 text-blue-800 opacity-70",
                          )}
                          style={{ left: clip.start * pixelsPerSecond, top: row * TRACK_HEIGHT + CLIP_TOP_OFFSET, width: Math.max(48, clip.duration * pixelsPerSecond), zIndex: track + 1 }}
                          onPointerDown={(event) => {
                            const selectedKeys = isClipSelected(key) ? selectedClipKeys : [key];
                            setSelection(currentSelection);
                            setSelectedClipKeys(selectedKeys);
                            startDrag(event, currentSelection, "move", selectedKeys);
                          }}
                        >
                          <button type="button" data-resize-handle="true" className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-blue-700/30" onPointerDown={(event) => { event.stopPropagation(); setSingleSelection(currentSelection); startDrag(event, currentSelection, "resize-start", [key]); }} />
                          <div className="min-w-0 flex-1 pl-1">
                            <div className="truncate text-sm font-medium">{scene?.title ?? `Scene ${index + 1}`}</div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-blue-800">
                              <span>{clip.duration.toFixed(1)}s</span>
                              <span>{clip.speed.toFixed(1)}x</span>
                              {!hasVideo ? <span>No render</span> : null}
                            </div>
                          </div>
                          <button type="button" data-resize-handle="true" className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-blue-700/30" onPointerDown={(event) => { event.stopPropagation(); setSingleSelection(currentSelection); startDrag(event, currentSelection, "resize-end", [key]); }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-[136px_1fr]">
                  <div className="sticky left-0 z-10 border-r bg-card">
                    {Array.from({ length: audioTrackCount }).map((_, offset) => {
                      const track = audioTrackCount - offset - 1;
                      return <div key={track} className="flex h-24 items-center px-3 text-sm font-medium text-emerald-900">Audio {track + 1}</div>;
                    })}
                  </div>
                  <div className="relative" style={{ width: timelineWidth, height: audioTrackCount * TRACK_HEIGHT }}>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]" style={{ backgroundSize: `${pixelsPerSecond}px 100%` }} />
                    {Array.from({ length: audioTrackCount }).map((_, offset) => <div key={offset} className="absolute left-0 right-0 border-b" style={{ top: offset * TRACK_HEIGHT }} />)}
                    {resolvedDraft.audioClips.map((clip, index) => {
                      const asset = audioById.get(clip.assetId);
                      const duration = getAudioTrueLength(clip);
                      const currentSelection = { kind: "audio" as const, index };
                      const key = clipKey(currentSelection);
                      const track = clipTrackIndex(clip);
                      const row = audioTrackCount - track - 1;
                      return (
                        <div
                          key={`${clip.assetId}-${index}`}
                          data-clip="true"
                          className={cn(
                            "absolute flex h-16.5 cursor-grab touch-none items-center overflow-hidden rounded-md border px-2 active:cursor-grabbing",
                            isClipSelected(key) ? "border-emerald-700 bg-emerald-100" : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100",
                          )}
                          style={{ left: clip.start * pixelsPerSecond, top: row * TRACK_HEIGHT + CLIP_TOP_OFFSET, width: Math.max(48, duration * pixelsPerSecond), zIndex: track + 1 }}
                          onPointerDown={(event) => {
                            const selectedKeys = isClipSelected(key) ? selectedClipKeys : [key];
                            setSelection(currentSelection);
                            setSelectedClipKeys(selectedKeys);
                            startDrag(event, currentSelection, "move", selectedKeys);
                          }}
                        >
                          <div className="grid h-8 flex-1 grid-cols-12 items-end gap-0.5 px-2">
                            {Array.from({ length: 24 }).map((_, bar) => (
                              <span key={bar} className="rounded-t bg-emerald-500/70" style={{ height: 5 + ((bar * 17 + index * 11) % 26) }} />
                            ))}
                          </div>
                          <div className="absolute bottom-2 left-3 right-3 truncate text-xs text-emerald-900">{asset?.title ?? "Missing audio"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {marquee ? (
                  <div
                    className="pointer-events-none absolute z-20 rounded-sm border border-primary/70 bg-primary/10"
                    style={{
                      left: Math.min(marquee.startX, marquee.currentX),
                      top: Math.min(marquee.startY, marquee.currentY),
                      width: Math.abs(marquee.currentX - marquee.startX),
                      height: Math.abs(marquee.currentY - marquee.startY),
                    }}
                  />
                ) : null}

                <div
                  className="pointer-events-none absolute top-8 z-30 w-px bg-primary"
                  style={{ left: LABEL_WIDTH + currentTime * pixelsPerSecond, height: totalTrackHeight }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setPreviewTime(0)}>
                <SkipBack className="size-4" />
                <span className="sr-only">Jump to start</span>
              </Button>
              <Button type="button" size="sm" onClick={() => setIsPlaying((value) => !value)}>
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Input
                className="min-w-48 flex-1"
                type="range"
                min={0}
                max={timelineDuration}
                step={0.05}
                value={currentTime}
                onChange={(event) => {
                  setIsPlaying(false);
                  setPreviewTime(numberValue(event.target.value, currentTime));
                }}
              />
              <span className="w-16 text-right text-xs text-muted-foreground">{currentTime.toFixed(1)}s</span>
            </div>

            {!draft.sceneClips.length ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Add scenes before editing the timeline.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspector</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {selectedScene ? (
              <>
                <div>
                  <Label>Scene</Label>
                  <p className="mt-1 truncate text-sm font-medium">{sceneById.get(selectedScene.sceneId)?.title ?? "Missing scene"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Start" value={selectedScene.start} min={0} step={0.1} disabled={selectedScene.anchor?.type !== undefined && selectedScene.anchor.type !== "seconds"} onChange={(value) => updateSceneClip(selectedScene.sceneId, { start: value })} />
                  <NumberField label="Duration" value={selectedScene.duration} min={MIN_CLIP_DURATION} step={0.1} onChange={(value) => updateSceneClip(selectedScene.sceneId, { duration: value })} />
                  <NumberField label="Track" value={clipTrackIndex(selectedScene) + 1} min={1} step={1} onChange={(value) => updateSceneClip(selectedScene.sceneId, { trackIndex: Math.max(0, Math.round(value) - 1) })} />
                  <NumberField label="Speed" value={selectedScene.speed} min={0.1} max={4} step={0.1} onChange={(value) => updateSceneClip(selectedScene.sceneId, { speed: value })} />
                  <NumberField label="Fade in" value={selectedScene.fadeIn} min={0} step={0.1} onChange={(value) => updateSceneClip(selectedScene.sceneId, { fadeIn: value })} />
                  <NumberField label="Fade out" value={selectedScene.fadeOut} min={0} step={0.1} onChange={(value) => updateSceneClip(selectedScene.sceneId, { fadeOut: value })} />
                </div>
                <AnchorField
                  label="Start anchor"
                  value={sceneAnchorValue(selectedScene.anchor)}
                  offset={anchorOffset(selectedScene.anchor)}
                  scenes={scenes}
                  excludeSceneId={selectedScene.sceneId}
                  onChange={(value) => setSceneAnchor(selectedScene.sceneId, value)}
                  onOffsetChange={(offset) => setSceneAnchorOffset(selectedScene.sceneId, offset)}
                />
              </>
            ) : selectedAudio ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Label>Audio</Label>
                    <p className="mt-1 truncate text-sm font-medium">{audioById.get(selectedAudio.assetId)?.title ?? "Missing audio"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (selection?.kind !== "audio") return;
                      setDraft((current) => ({ ...current, audioClips: current.audioClips.filter((_, index) => index !== selection.index) }));
                      setSelection(null);
                      setSelectedClipKeys([]);
                    }}
                  >
                    <X className="size-4" />
                    <span className="sr-only">Remove audio clip</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Start" value={selectedAudio.start} min={0} step={0.1} disabled={selectedAudio.anchor?.type !== undefined && selectedAudio.anchor.type !== "seconds"} onChange={(value) => selection?.kind === "audio" && updateAudioClip(selection.index, { start: value })} />
                  <NumberField label="Duration" value={getAudioTrueLength(selectedAudio)} min={MIN_CLIP_DURATION} step={0.1} disabled />
                  <NumberField label="Track" value={clipTrackIndex(selectedAudio) + 1} min={1} step={1} onChange={(value) => selection?.kind === "audio" && updateAudioClip(selection.index, { trackIndex: Math.max(0, Math.round(value) - 1) })} />
                  <NumberField label="Volume" value={selectedAudio.volume} min={0} max={2} step={0.1} onChange={(value) => selection?.kind === "audio" && updateAudioClip(selection.index, { volume: value })} />
                  <NumberField label="Fade in" value={selectedAudio.fadeIn} min={0} step={0.1} onChange={(value) => selection?.kind === "audio" && updateAudioClip(selection.index, { fadeIn: value })} />
                  <NumberField label="Fade out" value={selectedAudio.fadeOut} min={0} step={0.1} onChange={(value) => selection?.kind === "audio" && updateAudioClip(selection.index, { fadeOut: value })} />
                </div>
                <AnchorField
                  label="Start anchor"
                  value={sceneAnchorValue(selectedAudio.anchor)}
                  offset={anchorOffset(selectedAudio.anchor)}
                  scenes={scenes}
                  onChange={(value) => selection?.kind === "audio" && setAudioAnchor(selection.index, value)}
                  onOffsetChange={(offset) => selection?.kind === "audio" && setAudioAnchorOffset(selection.index, offset)}
                />
              </>
            ) : (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Select a clip to edit timing, speed, fades, and volume.</p>
            )}

            <div className="grid gap-2 border-t pt-4">
              <Label>Add audio</Label>
              <div className="flex flex-wrap gap-2">
                {audioAssets.map((asset) => (
                  <Button key={asset.id} type="button" size="sm" variant="outline" onClick={() => addAudioClip(asset.id)}>
                    <AudioLines className="size-4" />
                    {asset.title}
                  </Button>
                ))}
              </div>
            </div>

            <form ref={uploadRef} onSubmit={uploadAudio} className="grid gap-3 border-t pt-4">
              <Label>Upload audio</Label>
              <Input name="file" type="file" accept="audio/*" required />
              <Input name="title" placeholder="Clip title" />
              <Textarea name="description" placeholder="Notes" rows={3} />
              <Button type="submit" disabled={busy || !workspaceId}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Upload
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(numberValue(event.target.value, value))}
      />
    </div>
  );
}

function AnchorField({
  excludeSceneId,
  label,
  onChange,
  offset,
  onOffsetChange,
  scenes,
  value,
}: {
  excludeSceneId?: string;
  label: string;
  onChange: (value: string) => void;
  offset: number;
  onOffsetChange: (value: number) => void;
  scenes: ProjectScene[];
  value: string;
}) {
  const anchorScenes = scenes.filter((scene) => scene.id !== excludeSceneId);
  const hasSceneAnchor = value.startsWith("scene:");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
      <div className="grid gap-1.5">
        <Label>{label}</Label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="seconds">Seconds</option>
          {anchorScenes.map((scene) => (
            <option key={`${scene.id}-end`} value={`scene:end:${scene.id}`}>
              End of {scene.title}
            </option>
          ))}
          {anchorScenes.map((scene) => (
            <option key={`${scene.id}-start`} value={`scene:start:${scene.id}`}>
              Start of {scene.title}
            </option>
          ))}
        </select>
      </div>
      <NumberField
        label="Offset"
        value={offset}
        step={0.1}
        disabled={!hasSceneAnchor}
        onChange={onOffsetChange}
      />
    </div>
  );
}
