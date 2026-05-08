"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  busy: boolean;
  onClick: () => void;
  label?: string;
}

export function GenerateButton({ busy, onClick, label = "Generate fields" }: GenerateButtonProps) {
  return (
    <Button
      disabled={busy}
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {label}
    </Button>
  );
}
