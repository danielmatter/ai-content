"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wand2, Image as ImageIcon, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "./utils";
import { Asset, LibraryImage } from "./types";
import { GenerationReviewDialog, GenerationReviewValue } from "./generation-review-dialog";

interface FrameGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  sceneId?: string;
  scene?: { id?: string; title: string; description: string; action: string; look: string };
  frameType: "first" | "last";
  images: LibraryImage[];
  assets?: Asset[];
}

export function FrameGenerator({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  sceneId,
  scene,
  frameType,
  images,
  assets = [],
}: FrameGeneratorProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const generateDescription = async () => {
    setBusy(true);
    setStatus("Analyzing scene and assets...");
    try {
      const data = await api<{ description: string }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${sceneId || "new"}/frames/generate-description`,
        {
          method: "POST",
          body: JSON.stringify({ frameType, scene }),
        }
      );
      setDescription(data.description);
      setStep(2);
    } catch (error) {
      console.error(error);
      setStatus("Failed to generate description");
    } finally {
      setBusy(false);
    }
  };

  const [reviewOpen, setReviewOpen] = useState(false);

  const startImageGeneration = async (review: GenerationReviewValue) => {
    setBusy(true);
    setStatus("Queueing frame image job...");
    try {
      const data = await api<{ jobId: string }>(
        `/api/workspaces/${workspaceId}/projects/${projectId}/scenes/${sceneId || "new"}/frames/generate-image`,
        {
          method: "POST",
          body: JSON.stringify({
            description: review.prompt,
            frameType,
            referenceImageUrls: review.imageInputs.filter((input) => input.kind === "Reference").map((input) => input.url),
            model: review.settings.model,
            settings: review.settings,
            scene: { title: scene?.title || "" },
          }),
        }
      );
      setStatus(`Image job ${data.jobId} is running...`);
      
      // Auto-close after ~1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onOpenChange(false);
      reset();

    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  const openReview = () => {
    setReviewOpen(true);
  };

  const reset = () => {
    setStep(1);
    setDescription("");
    setStatus("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="sm:max-w-xl dialog-content-scrollable">
        <DialogHeader className="dialog-header-fixed">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Generate {frameType === "first" ? "First" : "Last"} Frame
          </DialogTitle>
          <DialogDescription>
            AI-powered frame generation with visual continuity.
          </DialogDescription>
        </DialogHeader>

        <div className="dialog-body-scrollable grid gap-6">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Wand2 className="size-8 text-primary" />
              </div>
              <div className="grid gap-1">
                <h4 className="font-semibold text-lg">Start with a description</h4>
                <p className="text-sm text-muted-foreground max-w-[300px]">
                  The AI will analyze your scene details and linked assets to create a visual prompt for the frame.
                </p>
              </div>
              <Button onClick={generateDescription} disabled={busy} className="mt-2 min-w-[200px]">
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                Generate Description
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="description">Frame Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The description generated for the frame..."
                  className="min-h-[200px] leading-relaxed"
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  You can refine this description before generating the image.
                </p>
              </div>
              <div className="flex justify-between items-center mt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} disabled={busy}>
                  Back
                </Button>
                <Button onClick={openReview} disabled={busy || !description} className="min-w-[150px]">
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ImageIcon className="mr-2 size-4" />}
                  Generate Image
                </Button>
              </div>
            </div>
          )}

          {status && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {status}
            </div>
          )}
        </div>
      </DialogContent>
      <GenerationReviewDialog
        key={`${sceneId || "new"}:${frameType}:${description}`}
        busy={busy}
        images={images}
        assets={assets}
        initialValue={{ prompt: description, imageInputs: [], settings: {} }}
        mode="image"
        open={reviewOpen}
        title={`Review ${frameType === "first" ? "First" : "Last"} Frame Image`}
        description="Review the raw prompt and image references before the image job starts."
        onOpenChange={setReviewOpen}
        onConfirm={(value) => {
          setReviewOpen(false);
          void startImageGeneration(value);
        }}
      />
    </Dialog>
  );
}
