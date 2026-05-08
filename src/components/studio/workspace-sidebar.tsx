"use client";

import { Cog, Film, FolderKanban, ImageIcon, Layers3, ListVideo, LogOut, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Project, Workspace } from "./types";

type WorkspaceSection = "projects" | "assets" | "images" | "jobs";

const workspaceSections = [
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "assets", label: "Workspace assets", icon: Layers3 },
  { id: "jobs", label: "Render jobs", icon: ListVideo },
  { id: "images", label: "Images", icon: ImageIcon },
] satisfies { id: WorkspaceSection; label: string; icon: typeof FolderKanban }[];

interface WorkspaceSidebarProps {
  user: { email: string };
  workspaces: Workspace[];
  projects: Project[];
  activeWorkspaceId: string;
  activeProjectId: string;
  activeSection: WorkspaceSection;
  onWorkspaceSelect: (id: string) => void;
  onProjectSelect: (id: string) => void;
  onSectionSelect: (section: WorkspaceSection) => void;
  onSignOut: () => void;
  onNewWorkspace: () => void;
  className?: string;
}

export function WorkspaceSidebar({
  user,
  workspaces,
  projects,
  activeWorkspaceId,
  activeProjectId,
  activeSection,
  onWorkspaceSelect,
  onProjectSelect,
  onSectionSelect,
  onSignOut,
  onNewWorkspace,
  className,
}: WorkspaceSidebarProps) {
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  return (
    <aside className={cn("sticky top-0 flex h-dvh min-h-dvh flex-col border-r bg-background/95 p-4", className)}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Film className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">AI Content Studio</h1>
          <p className="text-sm text-muted-foreground">Workspace dashboard</p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">Workspace</Label>
        <Button size="sm" variant="secondary" onClick={onNewWorkspace}>
          <Plus className="size-4" />
          New
        </Button>
      </div>

      {workspaces.length ? (
        <Select value={activeWorkspaceId} onValueChange={(value) => value && onWorkspaceSelect(value)}>
          <SelectTrigger className="mb-3 w-full">
            <SelectValue placeholder="Select workspace" />
          </SelectTrigger>
          <SelectContent align="start">
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="mb-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Create your first workspace to start a project.
        </p>
      )}


      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="grid gap-4">
          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium uppercase text-muted-foreground">Projects</Label>
              <span className="text-xs text-muted-foreground">{projects.length}</span>
            </div>
            <div className="grid gap-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onProjectSelect(project.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted",
                    project.id === activeProjectId && activeSection === "projects"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <FolderKanban className="size-4" />
                  <span className="truncate">{project.title}</span>
                </button>
              ))}
              {!projects.length ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No projects yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      </ScrollArea>

      <section className="mt-4 grid gap-1">
        {workspaceSections
          .filter((section) => section.id !== "projects")
          .map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionSelect(section.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted",
                  section.id === activeSection ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
      </section>

      <Separator className="my-4" />

      <div className="grid gap-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted"
        >
          <UserRound className="size-4" />
          <span className="min-w-0 flex-1 truncate">{user.email}</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted"
        >
          <Cog className="size-4" />
          <span className="truncate">Settings</span>
        </button>
        <Button size="sm" variant="ghost" className="justify-start px-2 text-muted-foreground" onClick={onSignOut}>
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
