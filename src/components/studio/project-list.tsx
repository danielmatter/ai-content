"use client";

import { FolderKanban, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Project } from "./types";

interface ProjectListProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}

export function ProjectList({ projects, onOpenProject, onEditProject, onDeleteProject }: ProjectListProps) {
  if (!projects.length) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Create a project inside this workspace before adding scenes.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {projects.map((project) => (
        <div
          key={project.id}
          className="interactive-card group cursor-pointer flex min-h-24 w-full flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <button type="button" onClick={() => onOpenProject(project.id)} className="grid min-w-0 flex-1 gap-2 text-left">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderKanban className="size-4" />
                Project
              </div>
              <h3 className="mt-1 font-medium">{project.title}</h3>
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{project.logline || "No logline"}</p>
          </button>
          <div className="flex shrink-0 items-center justify-end gap-1 md:opacity-0 md:transition md:group-hover:opacity-100">
            <Button type="button" size="sm" variant="ghost" onClick={() => onOpenProject(project.id)}>
              Open
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => onEditProject(project)}
            >
              <Pencil className="size-4" />
              <span className="sr-only">Edit project</span>
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="destructive"
              onClick={() => onDeleteProject(project)}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Delete project</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
