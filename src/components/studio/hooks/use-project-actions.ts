import { FormEvent } from "react";
import { Project, ProjectScene, TimelineState, StudioRoute } from "../types";
import { api, parseJsonField } from "../utils";
import { useStudioMutations } from "./use-mutations";

export function useProjectActions({
  workspaceId,
  projectId,
  setBusy,
  newProjectAssetIds,
  setNewProjectAssetIds,
  setProjectDialogOpen,
  openProject,
  editingProject,
  setEditingProject,
  editingProjectAssetIds,
  setEditingProjectAssetIds,
  activeProject,
  setProjectId,
  setProjectDetailOpen,
  routeTarget,
  openWorkspaceHome,
}: any) {
  const { setProjects, setScenes, setJobs } = useStudioMutations(workspaceId, projectId);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const data = await api<{ project: Project }>(`/api/workspaces/${workspaceId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          logline: form.get("logline"),
          scenes: parseJsonField(form, "scenes"),
          assets: parseJsonField(form, "assets"),
          assetIds: newProjectAssetIds,
        }),
      });
      const project = { ...data.project, assetIds: newProjectAssetIds };
      setProjects((items) => [project, ...items]);
      setNewProjectAssetIds([]);
      formElement.reset();
      setProjectDialogOpen(false);
      openProject(data.project.id);
    } finally {
      setBusy(false);
    }
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProject) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const data = await api<{ project: Project }>(`/api/workspaces/${workspaceId}/projects/${editingProject.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.get("title"),
          logline: form.get("logline"),
          assetIds: editingProjectAssetIds,
        }),
      });
      setProjects((items) => items.map((project) => (project.id === data.project.id ? data.project : project)));
      setEditingProject(null);
      setEditingProjectAssetIds([]);
    } finally {
      setBusy(false);
    }
  }

  async function updateProjectAssets(assetIds: string[]) {
    if (!activeProject) return;
    const data = await api<{ assetIds: string[] }>(`/api/workspaces/${workspaceId}/projects/${activeProject.id}/assets`, {
      method: "PUT",
      body: JSON.stringify({ assetIds }),
    });
    setProjects((items) =>
      items.map((project) => (project.id === activeProject.id ? { ...project, assetIds: data.assetIds } : project)),
    );
  }

  function updateProjectTimeline(timelineState: TimelineState) {
    setProjects((items) => items.map((project) => (project.id === projectId ? { ...project, timelineState } : project)));
  }

  async function openProjectEditor(project: Project) {
    if (project.assetIds) {
      setEditingProject(project);
      setEditingProjectAssetIds(project.assetIds);
      return;
    }

    setBusy(true);
    try {
      const data = await api<{ project: Project; scenes: ProjectScene[] }>(
        `/api/workspaces/${workspaceId}/projects/${project.id}`,
      );
      setProjects((items) => items.map((item) => (item.id === project.id ? data.project : item)));
      if (project.id === projectId) setScenes(data.scenes);
      setEditingProject(data.project);
      setEditingProjectAssetIds(data.project.assetIds ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject(project: Project) {
    if (!workspaceId) return;
    if (!window.confirm(`Delete project "${project.title}"? This will remove its scenes.`)) {
      return;
    }

    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}/projects/${project.id}`, { method: "DELETE" });
      setProjects((items) => items.filter((item) => item.id !== project.id));
      setScenes((items) => (project.id === projectId ? [] : items));
      setJobs((items) => items.filter((job) => job.project_id !== project.id));
      if (project.id === projectId) {
        setProjectId("");
        setProjectDetailOpen(false);
      }
      if (routeTarget?.type === "project" && routeTarget.id === project.id) {
        openWorkspaceHome();
      }
      if (editingProject?.id === project.id) {
        setEditingProject(null);
        setEditingProjectAssetIds([]);
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    createProject,
    updateProject,
    updateProjectAssets,
    updateProjectTimeline,
    openProjectEditor,
    deleteProject,
  };
}
