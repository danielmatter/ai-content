"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles, CheckCircle2, XCircle, ImageIcon, Video, Clock } from "lucide-react";
import { ProjectScene, RenderJob } from "./types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface OngoingGenerationsProps {
  jobs: RenderJob[];
  scenes?: ProjectScene[];
  workspaceId: string;
}

export function OngoingGenerations({ jobs, scenes = [] }: OngoingGenerationsProps) {
  const [isMinimized, setIsMinimized] = useState(true);
  const [now, setNow] = useState(0);

  // Update "now" every minute to refresh the "last 5 mins" filter
  useEffect(() => {
    const timeout = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const FIVE_MINUTES = 5 * 60 * 1000;

  const relevantJobs = jobs.filter((job) => {
    const isOngoing = job.status === "pending" || job.status === "processing";
    const updatedAt = new Date(job.updated_at).getTime();
    const isRecent = (job.status === "completed" || job.status === "downloaded" || job.status === "failed") && (now - updatedAt < FIVE_MINUTES);
    return isOngoing || isRecent;
  });

  const ongoingCount = jobs.filter(j => j.status === "pending" || j.status === "processing").length;

  if (relevantJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="pointer-events-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 group"
        >
          <div className="relative">
            <Sparkles className="size-4 animate-pulse" />
            {ongoingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-violet-600 text-[10px] font-bold size-4 flex items-center justify-center rounded-full border border-violet-600">
                {ongoingCount}
              </span>
            )}
          </div>
          <span className="text-sm font-medium">
            {ongoingCount > 0 ? `${ongoingCount} generation${ongoingCount > 1 ? "s" : ""} ongoing` : "Recent generations"}
          </span>
          <ChevronUp className="size-4 opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
      ) : (
        <div className="pointer-events-auto w-80 bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-900/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[50vh] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-violet-600 text-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <h3 className="font-semibold text-sm">Generations</h3>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {relevantJobs.map((job) => {
              const isFinished = job.status === "completed" || job.status === "downloaded" || job.status === "failed";
              const isFailed = job.status === "failed";
              
              return (
                <div
                  key={job.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all duration-300",
                    isFailed 
                      ? "bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30" 
                      : isFinished
                        ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30"
                        : "bg-violet-50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/30 animate-pulse-subtle"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      isFailed ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
                      isFinished ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" :
                      "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
                    )}>
                      {job.kind === "video" ? <Video className="size-4" /> : <ImageIcon className="size-4" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                          {job.kind} {job.frame_type ? `(${job.frame_type} frame)` : ""}
                        </span>
                        {isFinished ? (
                          isFailed ? <XCircle className="size-3 text-red-500" /> : <CheckCircle2 className="size-3 text-emerald-500" />
                        ) : (
                          <Loader2 className="size-3 animate-spin text-violet-600" />
                        )}
                      </div>
                      
                      <p className="text-sm font-medium truncate mb-1 text-zinc-900 dark:text-zinc-100">
                        {generationTitle(job, scenes)}
                      </p>
                      
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-4 px-1 leading-none border-none",
                          isFailed ? "text-red-600" : isFinished ? "text-emerald-600" : "text-violet-600"
                        )}>
                          {job.status}
                        </Badge>
                      </div>
                      
                      {!isFinished && job.progress > 0 && (
                        <div className="mt-2 w-full bg-violet-200 dark:bg-violet-900/30 rounded-full h-1 overflow-hidden">
                          <div 
                            className="bg-violet-600 h-full transition-all duration-500 ease-out"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-pulse-subtle {
          animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8b5cf6;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #7c3aed;
        }
      `}</style>
    </div>
  );
}

function generationTitle(job: RenderJob, scenes: ProjectScene[]) {
  const scene = scenes.find((item) => item.id === job.scene_id);
  if (job.kind === "image" && scene && job.frame_type) {
    return `${scene.title} - ${job.frame_type === "first" ? "First" : "Last"} Frame`;
  }
  if (job.kind === "video" && scene) {
    return job.description || `${scene.title} video render`;
  }
  return job.description || "Generation";
}
