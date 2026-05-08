import { FormEvent, RefObject } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Workspace } from "../types";
import { GenerateButton } from "../generate-button";

export function WorkspaceCreateDialog({
  open,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>Workspaces are private to your signed-in account.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="contents">
          <div className="dialog-body-scrollable grid gap-3">
            <Textarea name="steering" placeholder="Optional generation note" rows={2} />
            <GenerateButton busy={busy} onClick={onGenerateDraft} />
            <Input name="name" placeholder="Solar Pilot" required />
            <Textarea name="description" placeholder="Audience, format, creative constraints" rows={4} />
          </div>
          <div className="dialog-footer-fixed">
            <Button disabled={busy} type="submit">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create workspace
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WorkspaceEditDialog({
  workspace,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
}: {
  workspace: Workspace | null;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
}) {
  return (
    <Dialog open={Boolean(workspace)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>Update the workspace name and production context.</DialogDescription>
        </DialogHeader>
        {workspace ? (
          <form ref={formRef} onSubmit={onSubmit} className="contents">
            <div className="dialog-body-scrollable grid gap-3">
              <Textarea name="steering" placeholder="Optional generation note" rows={2} />
              <GenerateButton busy={busy} onClick={onGenerateDraft} />
              <Input name="name" defaultValue={workspace.name} placeholder="Workspace name" required />
              <Textarea name="description" defaultValue={workspace.description} placeholder="Audience, format, creative constraints" rows={4} />
            </div>
            <div className="dialog-footer-fixed">
              <Button disabled={busy} type="submit">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save changes
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
