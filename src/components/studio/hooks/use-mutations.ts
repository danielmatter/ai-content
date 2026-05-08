import { mutate } from "swr";
import { Asset, LibraryImage, Project, ProjectScene, RenderJob, Workspace } from "../types";

export function useStudioMutations(workspaceId: string, projectId: string) {
  const setAssets = (value: Asset[] | ((current: Asset[]) => Asset[])) => mutate(workspaceId ? `/api/workspaces/${workspaceId}` : null);
  const setProjects = (value: Project[] | ((current: Project[]) => Project[])) => mutate(workspaceId ? `/api/workspaces/${workspaceId}` : null);
  const setScenes = (value: ProjectScene[] | ((current: ProjectScene[]) => ProjectScene[])) => mutate(workspaceId && projectId ? `/api/workspaces/${workspaceId}/projects/${projectId}` : null);
  const setImages = (value: LibraryImage[] | ((current: LibraryImage[]) => LibraryImage[])) => mutate(workspaceId ? `/api/workspaces/${workspaceId}/images` : null);
  const setJobs = (value: RenderJob[] | ((current: RenderJob[]) => RenderJob[])) => mutate(workspaceId ? `/api/workspaces/${workspaceId}/jobs` : null);
  const setWorkspaces = (value: Workspace[] | ((current: Workspace[]) => Workspace[])) => mutate("/api/workspaces");
  const refreshJobs = () => mutate(workspaceId ? `/api/workspaces/${workspaceId}/jobs` : null);

  return { setAssets, setProjects, setScenes, setImages, setJobs, setWorkspaces, refreshJobs };
}
