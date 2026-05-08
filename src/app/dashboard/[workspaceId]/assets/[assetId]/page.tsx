import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string; assetId: string }>;
};

export default async function WorkspaceAssetPage({ params }: Props) {
  const { workspaceId, assetId } = await params;

  return (
    <StudioApp
      key={`${workspaceId}:asset:${assetId}`}
      initialWorkspaceId={workspaceId}
      initialRoute={{ type: "asset", id: assetId }}
    />
  );
}
