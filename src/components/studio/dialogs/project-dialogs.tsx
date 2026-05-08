import { FormEvent, RefObject } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Asset, Project, Workspace } from "../types";
import { GenerateButton } from "../generate-button";
import { AssetChecklist } from "../asset-checklist";

export function ProjectCreateDialog({
  workspaceId,
  activeWorkspace,
  open,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
  assets,
  newProjectAssetIds,
  setNewProjectAssetIds,
}: {
  workspaceId: string;
  activeWorkspace?: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
  assets: Asset[];
  newProjectAssetIds: string[];
  setNewProjectAssetIds: (ids: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-2xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Add it to {activeWorkspace?.name ?? "this workspace"}.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="contents">
          <div className="dialog-body-scrollable grid gap-3">
            <Textarea name="steering" placeholder="Optional generation note" rows={2} />
            <GenerateButton busy={busy} onClick={onGenerateDraft} />
            <Input name="title" placeholder="Project title" required />
            <Textarea name="logline" placeholder="Logline" rows={3} />
            <Textarea name="scenes" placeholder="Scenes JSON array" rows={4} className="font-mono text-xs" />
            <Textarea name="assets" placeholder="Assets JSON array" rows={4} className="font-mono text-xs" />
            <div className="grid gap-2">
              <Label>Workspace assets</Label>
              <AssetChecklist assets={assets} value={newProjectAssetIds} onChange={setNewProjectAssetIds} />
            </div>
          </div>
          <div className="dialog-footer-fixed">
            <Button disabled={!workspaceId || busy} type="submit">
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Save project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectEditDialog({
  project,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
  assets,
  editingProjectAssetIds,
  setEditingProjectAssetIds,
}: {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
  assets: Asset[];
  editingProjectAssetIds: string[];
  setEditingProjectAssetIds: (ids: string[]) => void;
}) {
  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-2xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Keep the project brief, screenplay, and linked assets current.</DialogDescription>
        </DialogHeader>
        {project ? (
          <form ref={formRef} onSubmit={onSubmit} className="contents">
            <div className="dialog-body-scrollable grid gap-3">
              <Textarea name="steering" placeholder="Optional generation note" rows={2} />
              <GenerateButton busy={busy} onClick={onGenerateDraft} />
              <Input name="title" defaultValue={project.title} placeholder="Project title" required />
              <Textarea name="logline" defaultValue={project.logline} placeholder="Logline" rows={3} />
              <div className="grid gap-2">
                <Label>Workspace assets</Label>
                <AssetChecklist assets={assets} value={editingProjectAssetIds} onChange={setEditingProjectAssetIds} />
              </div>
            </div>
            <div className="dialog-footer-fixed">
              <Button disabled={busy} type="submit">
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                Save changes
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
