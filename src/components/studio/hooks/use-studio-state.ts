import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Asset, AssetType, Project, ProjectScene, Workspace, StudioRoute, StudioTab } from "../types";

export function tabForRoute(route?: StudioRoute): StudioTab {
  if (route?.type === "asset") return "assets";
  if (route?.type === "image") return "images";
  if (route?.type === "job") return "jobs";
  return "projects";
}

import { useWorkspaces, useWorkspaceData, useProjectData, useImages, useJobs } from "../hooks";

export function useStudioState({
  initialWorkspaceId = "",
  initialRoute,
  initialTab,
}: {
  initialWorkspaceId?: string;
  initialRoute?: StudioRoute;
  initialTab?: StudioTab;
}) {
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user;

  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId || "");
  const [projectId, setProjectId] = useState(
    initialRoute?.type === "project" ? initialRoute.id : initialRoute?.type === "scene" ? initialRoute.projectId : ""
  );

  const { workspaces } = useWorkspaces();
  const { workspace: activeWorkspace, assets, projects, isLoading: loadingWorkspace } = useWorkspaceData(workspaceId);
  const { images } = useImages(workspaceId);
  const { project: activeProject, scenes, isLoading: loadingProject } = useProjectData(workspaceId, projectId);
  const { jobs } = useJobs(workspaceId);

  const loading = !user ? false : (loadingWorkspace || loadingProject);

  const groupedAssets = useMemo(
    () => ({
      scene: assets.filter((asset) => asset.type === "scene"),
      character: assets.filter((asset) => asset.type === "character"),
      style: assets.filter((asset) => asset.type === "style"),
      audio: assets.filter((asset) => asset.type === "audio"),
    }),
    [assets],
  );

  const [busy, setBusy] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [assetDialogType, setAssetDialogType] = useState<AssetType | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [newProjectAssetIds, setNewProjectAssetIds] = useState<string[]>([]);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingScene, setEditingScene] = useState<ProjectScene | null>(null);
  const [editingProjectAssetIds, setEditingProjectAssetIds] = useState<string[]>([]);
  const [frameGeneratorOpen, setFrameGeneratorOpen] = useState(false);
  const [frameGeneratorType, setFrameGeneratorType] = useState<"first" | "last">("first");
  const [frameGeneratorScene, setFrameGeneratorScene] = useState<
    { id?: string; title: string; description: string; action: string; look: string } | undefined
  >();
  const [newSceneFirstFrameUrl, setNewSceneFirstFrameUrl] = useState("");
  const [newSceneLastFrameUrl, setNewSceneLastFrameUrl] = useState("");
  const [routeTarget, setRouteTarget] = useState<StudioRoute | undefined>(initialRoute);
  const [assetImageReview, setAssetImageReview] = useState<Asset | null>(null);
  const [videoReviewScene, setVideoReviewScene] = useState<ProjectScene | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab ?? tabForRoute(initialRoute));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const workspaceCreateRef = useRef<HTMLFormElement>(null);
  const workspaceEditRef = useRef<HTMLFormElement>(null);
  const assetEditRef = useRef<HTMLFormElement>(null);
  const projectCreateRef = useRef<HTMLFormElement>(null);
  const projectEditRef = useRef<HTMLFormElement>(null);
  const sceneCreateRef = useRef<HTMLFormElement>(null);
  const sceneEditRef = useRef<HTMLFormElement>(null);
  const routeTargetRef = useRef<StudioRoute | undefined>(initialRoute);

  useEffect(() => {
    if (initialWorkspaceId) setWorkspaceId(initialWorkspaceId);
    if (initialRoute?.type === "project") setProjectId(initialRoute.id);
    if (initialRoute?.type === "scene") setProjectId(initialRoute.projectId);
  }, [initialRoute, initialWorkspaceId, setProjectId, setWorkspaceId]);

  useEffect(() => {
    routeTargetRef.current = routeTarget;
  }, [routeTarget]);

  useEffect(() => {
    if (!workspaceId && workspaces.length > 0) {
      const nextWorkspaceId = initialWorkspaceId || workspaces[0]?.id || "";
      if (nextWorkspaceId) {
        setWorkspaceId(nextWorkspaceId);
        if (!initialWorkspaceId) {
          router.replace(`/dashboard/${nextWorkspaceId}`);
        }
      }
    }
    setProjectDetailOpen(routeTarget?.type === "project" || routeTarget?.type === "scene");
  }, [initialWorkspaceId, router, workspaces, workspaceId, routeTarget?.type]);

  function selectWorkspace(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId);
    setRouteTarget(undefined);
    setActiveTab("projects");
    setProjectDetailOpen(false);
    setEditingAsset(null);
    setMobileNavOpen(false);
    router.push(nextWorkspaceId ? `/dashboard/${nextWorkspaceId}` : "/dashboard");
  }

  function workspacePath() {
    return workspaceId ? `/dashboard/${workspaceId}` : "/dashboard";
  }

  function sectionPath(tab: StudioTab) {
    const basePath = workspacePath();
    if (tab === "assets") return `${basePath}/assets`;
    if (tab === "images") return `${basePath}/images`;
    if (tab === "jobs") return `${basePath}/render-jobs`;
    return basePath;
  }

  function openWorkspaceHome() {
    setRouteTarget(undefined);
    setActiveTab("projects");
    setProjectDetailOpen(false);
    setEditingAsset(null);
    setMobileNavOpen(false);
    router.push(workspacePath());
  }

  function openProject(projectId: string) {
    setProjectId(projectId);
    setProjectDetailOpen(true);
    setRouteTarget({ type: "project", id: projectId });
    setActiveTab("projects");
    setMobileNavOpen(false);
    router.push(`${workspacePath()}/project/${projectId}`);
  }

  function openScene(scene: ProjectScene) {
    const currentProjectId = activeProject?.id || projectId;
    if (!currentProjectId) return;
    setProjectId(currentProjectId);
    setRouteTarget({ type: "scene", projectId: currentProjectId, sceneId: scene.id });
    setActiveTab("projects");
    setProjectDetailOpen(true);
    router.push(`${workspacePath()}/project/${currentProjectId}/scene/${scene.id}`);
  }

  function openAsset(asset: Asset) {
    setEditingAsset(asset);
    setRouteTarget({ type: "asset", id: asset.id });
    setActiveTab("assets");
    router.push(`${workspacePath()}/assets/${asset.id}`);
  }

  function openImage(imageId: string) {
    setRouteTarget({ type: "image", id: imageId });
    setActiveTab("images");
    router.push(`${workspacePath()}/images/${imageId}`);
  }

  function openJob(jobId: string) {
    setRouteTarget({ type: "job", id: jobId });
    setActiveTab("jobs");
    router.push(`${workspacePath()}/render-jobs/${jobId}`);
  }

  function changeTab(value: string) {
    const nextTab = value as StudioTab;
    setActiveTab(nextTab);
    setRouteTarget(undefined);
    setProjectDetailOpen(false);
    setEditingAsset(null);
    setMobileNavOpen(false);
    router.push(sectionPath(nextTab));
  }

  function openFrameGenerator(
    type: "first" | "last",
    scene?: { id?: string; title: string; description: string; action: string; look: string },
  ) {
    setFrameGeneratorType(type);
    setFrameGeneratorScene(scene);
    setFrameGeneratorOpen(true);
  }

  function readSceneCreateDraft() {
    const form = sceneCreateRef.current;
    if (!form) return undefined;
    const data = new FormData(form);
    return {
      title: String(data.get("title") || ""),
      description: String(data.get("description") || ""),
      action: String(data.get("action") || ""),
      look: String(data.get("look") || ""),
    };
  }

  return {
    workspaceId, setWorkspaceId,
    projectId, setProjectId,
    busy, setBusy,
    generationStatus, setGenerationStatus,
    workspaceDialogOpen, setWorkspaceDialogOpen,
    assetDialogType, setAssetDialogType,
    projectDialogOpen, setProjectDialogOpen,
    sceneDialogOpen, setSceneDialogOpen,
    newProjectAssetIds, setNewProjectAssetIds,
    projectDetailOpen, setProjectDetailOpen,
    editingWorkspace, setEditingWorkspace,
    editingProject, setEditingProject,
    editingAsset, setEditingAsset,
    editingScene, setEditingScene,
    editingProjectAssetIds, setEditingProjectAssetIds,
    frameGeneratorOpen, setFrameGeneratorOpen,
    frameGeneratorType, setFrameGeneratorType,
    frameGeneratorScene, setFrameGeneratorScene,
    newSceneFirstFrameUrl, setNewSceneFirstFrameUrl,
    newSceneLastFrameUrl, setNewSceneLastFrameUrl,
    routeTarget, setRouteTarget,
    assetImageReview, setAssetImageReview,
    videoReviewScene, setVideoReviewScene,
    activeTab, setActiveTab,
    mobileNavOpen, setMobileNavOpen,
    workspaceCreateRef, workspaceEditRef,
    assetEditRef, projectCreateRef,
    projectEditRef, sceneCreateRef, sceneEditRef,
    selectWorkspace, openWorkspaceHome, openProject, openScene,
    openAsset, openImage, openJob, changeTab, openFrameGenerator,
    readSceneCreateDraft, sectionPath,
    user, loading, workspaces, activeWorkspace, assets, projects, images, activeProject, scenes, jobs, groupedAssets
  };
}
