import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string; jobId: string }>;
};

export default async function WorkspaceRenderJobPage({ params }: Props) {
  const { workspaceId, jobId } = await params;

  return (
    <StudioApp
      key={`${workspaceId}:render-job:${jobId}`}
      initialWorkspaceId={workspaceId}
      initialRoute={{ type: "job", id: jobId }}
    />
  );
}
