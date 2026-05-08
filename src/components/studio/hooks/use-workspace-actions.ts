import { FormEvent } from "react";
import { Workspace } from "../types";
import { api } from "../utils";
import { useStudioMutations } from "./use-mutations";

export function useWorkspaceActions({
  workspaceId,
  workspaces,
  setBusy,
  setWorkspaceDialogOpen,
  editingWorkspace,
  setEditingWorkspace,
  selectWorkspace,
  setProjectId,
  setProjectDetailOpen,
}: any) {
  const { setWorkspaces, setScenes, setProjects, setAssets, setImages, setJobs } = useStudioMutations(workspaceId, "");

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const data = await api<{ workspace: Workspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
        }),
      });
      setWorkspaces((items) => [data.workspace, ...items]);
      selectWorkspace(data.workspace.id);
      formElement.reset();
      setWorkspaceDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function updateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingWorkspace) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const data = await api<{ workspace: Workspace }>(`/api/workspaces/${editingWorkspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
        }),
      });
      setWorkspaces((items) => items.map((workspace) => (workspace.id === data.workspace.id ? data.workspace : workspace)));
      setEditingWorkspace(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkspace(workspace: Workspace) {
    if (!window.confirm(`Delete workspace "${workspace.name}"? This will remove its projects and assets.`)) {
      return;
    }

    setBusy(true);
    try {
      await api(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
      setWorkspaces((items) => items.filter((item) => item.id !== workspace.id));
      if (workspace.id === workspaceId) {
        const remaining = workspaces.filter((item: Workspace) => item.id !== workspace.id);
        selectWorkspace(remaining[0]?.id ?? "");
        setProjectId("");
        setScenes([]);
        setProjects([]);
        setAssets([]);
        setImages([]);
        setJobs([]);
        setProjectDetailOpen(false);
      }
      if (editingWorkspace?.id === workspace.id) {
        setEditingWorkspace(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return { createWorkspace, updateWorkspace, deleteWorkspace };
}
