"use client";

import { createContext, ReactNode, useContext } from "react";
import type { useAssetActions } from "./hooks/use-asset-actions";
import type { useProjectActions } from "./hooks/use-project-actions";
import type { useSceneActions } from "./hooks/use-scene-actions";
import type { useSharedActions } from "./hooks/use-shared-actions";
import type { useStudioMutations } from "./hooks/use-mutations";
import type { useStudioState } from "./hooks/use-studio-state";
import type { AssetType } from "./types";

type StudioContextValue = {
  state: ReturnType<typeof useStudioState>;
  projectActions: ReturnType<typeof useProjectActions>;
  sceneActions: ReturnType<typeof useSceneActions>;
  assetActions: ReturnType<typeof useAssetActions>;
  sharedActions: ReturnType<typeof useSharedActions>;
  mutations: ReturnType<typeof useStudioMutations>;
  assetCreateTypes: AssetType[];
};

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: StudioContextValue;
}) {
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);

  if (!value) {
    throw new Error("useStudio must be used within StudioProvider");
  }

  return value;
}
