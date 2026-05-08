"use client";

import useSWR from "swr";
import { api, readImageUrls } from "./utils";
import { Asset, LibraryImage, Project, Workspace, RenderJob, ProjectScene } from "./types";

const fetcher = (url: string) => api<any>(url);

export function useWorkspaces() {
  const { data, error, isLoading, mutate } = useSWR<{ workspaces: Workspace[] }>("/api/workspaces", fetcher);
  return { workspaces: data?.workspaces ?? [], isLoading, isError: error, mutate };
}

export function useWorkspaceData(workspaceId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ workspace: Workspace, assets: Asset[]; projects: Project[] }>(
    workspaceId ? `/api/workspaces/${workspaceId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const assets = data?.assets?.map((asset) => ({ ...asset, imageUrls: readImageUrls(asset) })) ?? [];
  return { workspace: data?.workspace, assets, projects: data?.projects ?? [], isLoading, isError: error, mutate };
}

export function useImages(workspaceId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ images: LibraryImage[] }>(
    workspaceId ? `/api/workspaces/${workspaceId}/images` : null,
    fetcher
  );
  return { images: data?.images ?? [], isLoading, isError: error, mutate };
}

export function useProjectData(workspaceId?: string, projectId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ project: Project; scenes: ProjectScene[] }>(
    workspaceId && projectId ? `/api/workspaces/${workspaceId}/projects/${projectId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  return { project: data?.project, scenes: data?.scenes ?? [], isLoading, isError: error, mutate };
}

export function useJobs(workspaceId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ jobs: RenderJob[] }>(
    workspaceId ? `/api/workspaces/${workspaceId}/jobs` : null,
    fetcher,
    { refreshInterval: 3000 }
  );
  return { jobs: data?.jobs ?? [], isLoading, isError: error, mutate };
}
