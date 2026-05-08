import { FormEvent, RefObject } from "react";
import { ImageIcon, Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Asset, LibraryImage, Project, ProjectScene } from "../types";
import { GenerateButton } from "../generate-button";
import { AssetChecklist } from "../asset-checklist";
import { ImagePicker } from "../image-picker";

export function SceneCreateDialog({
  activeProject,
  open,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
  scenes,
  images,
  newSceneFirstFrameUrl,
  setNewSceneFirstFrameUrl,
  newSceneLastFrameUrl,
  setNewSceneLastFrameUrl,
  latestCompletedRenderForScene,
  continueFromPreviousRender,
  onGenerateFirstFrame,
  onGenerateLastFrame,
}: {
  activeProject?: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
  scenes: ProjectScene[];
  images: LibraryImage[];
  newSceneFirstFrameUrl: string;
  setNewSceneFirstFrameUrl: (url: string) => void;
  newSceneLastFrameUrl: string;
  setNewSceneLastFrameUrl: (url: string) => void;
  latestCompletedRenderForScene: (sceneId: string) => any;
  continueFromPreviousRender: () => void;
  onGenerateFirstFrame: () => void;
  onGenerateLastFrame: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Create scene</DialogTitle>
          <DialogDescription>Scenes are saved inside {activeProject?.title}.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="contents">
          <div className="dialog-body-scrollable grid gap-3">
            <Textarea name="steering" placeholder="Optional generation note" rows={2} />
            <GenerateButton busy={busy} onClick={onGenerateDraft} />
            <Input name="title" placeholder="Scene title" required />
            <Textarea name="description" placeholder="What is in the scene" rows={3} />
            <Textarea name="action" placeholder="What happens" rows={4} />
            <Textarea name="look" placeholder="How it looks" rows={4} />
            <div className="grid-layout">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>First frame</Label>
                  {scenes.at(-1) && latestCompletedRenderForScene(scenes.at(-1)!.id) ? (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={continueFromPreviousRender}>
                      <ImageIcon className="size-4 mr-1" />
                      Continue previous
                    </Button>
                  ) : null}
                </div>
                <ImagePicker
                  label="First frame"
                  images={images}
                  value={newSceneFirstFrameUrl}
                  name="firstFrameUrl"
                  onChange={setNewSceneFirstFrameUrl}
                  onGenerate={onGenerateFirstFrame}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Last frame</Label>
                <ImagePicker
                  label="Last frame"
                  images={images}
                  value={newSceneLastFrameUrl}
                  name="lastFrameUrl"
                  onChange={setNewSceneLastFrameUrl}
                  onGenerate={onGenerateLastFrame}
                />
              </div>
            </div>
          </div>
          <div className="dialog-footer-fixed">
            <Button disabled={!activeProject || busy} type="submit">
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Save scene
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SceneEditDialog({
  scene,
  onOpenChange,
  formRef,
  onSubmit,
  busy,
  onGenerateDraft,
  scenes,
  images,
  assets,
  projectAssetIds,
  latestCompletedRenderForScene,
  continueFromPreviousRender,
  onChangeFirstFrameUrl,
  onChangeLastFrameUrl,
  onChangeAssetIds,
  onGenerateFirstFrame,
  onGenerateLastFrame,
}: {
  scene: ProjectScene | null;
  onOpenChange: (open: boolean) => void;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onGenerateDraft: () => void;
  scenes: ProjectScene[];
  images: LibraryImage[];
  assets: Asset[];
  projectAssetIds: string[];
  latestCompletedRenderForScene: (sceneId: string) => any;
  continueFromPreviousRender: (scene: ProjectScene) => void;
  onChangeFirstFrameUrl: (url: string) => void;
  onChangeLastFrameUrl: (url: string) => void;
  onChangeAssetIds: (ids: string[]) => void;
  onGenerateFirstFrame: () => void;
  onGenerateLastFrame: () => void;
}) {
  return (
    <Dialog open={Boolean(scene)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-2xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle>Edit scene</DialogTitle>
          <DialogDescription>Adjust the scene brief, action, look, and frame references.</DialogDescription>
        </DialogHeader>
        {scene ? (
          <form ref={formRef} onSubmit={onSubmit} className="contents">
            <div className="dialog-body-scrollable grid gap-3">
              <Textarea name="steering" placeholder="Optional generation note" rows={2} />
              <GenerateButton busy={busy} onClick={onGenerateDraft} />
              <Input name="title" defaultValue={scene.title} placeholder="Scene title" required />
              <Textarea name="description" defaultValue={scene.description} placeholder="What is in the scene" rows={3} />
              <Textarea name="action" defaultValue={scene.action} placeholder="What happens" rows={4} />
              <Textarea name="look" defaultValue={scene.look} placeholder="How it looks" rows={4} />
              <div className="grid-layout">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>First frame</Label>
                    {scenes[scenes.findIndex((s) => s.id === scene.id) - 1] &&
                      latestCompletedRenderForScene(scenes[scenes.findIndex((s) => s.id === scene.id) - 1].id) ? (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => continueFromPreviousRender(scene)}>
                        <ImageIcon className="size-4 mr-1" />
                        Continue previous
                      </Button>
                    ) : null}
                  </div>
                  <ImagePicker
                    label="First frame"
                    images={images}
                    name="firstFrameUrl"
                    value={scene.first_frame_url}
                    onChange={onChangeFirstFrameUrl}
                    onGenerate={onGenerateFirstFrame}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Last frame</Label>
                  <ImagePicker
                    label="Last frame"
                    images={images}
                    name="lastFrameUrl"
                    value={scene.last_frame_url}
                    onChange={onChangeLastFrameUrl}
                    onGenerate={onGenerateLastFrame}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Scene assets</Label>
                <AssetChecklist
                  assets={assets.filter((a) => projectAssetIds.includes(a.id))}
                  value={scene.assetIds || []}
                  onChange={onChangeAssetIds}
                />
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
