import { StudioApp } from "@/components/studio/studio-app";

type Props = {
  params: Promise<{ workspaceId: string; imageId: string }>;
};

export default async function WorkspaceImagePage({ params }: Props) {
  const { workspaceId, imageId } = await params;

  return (
    <StudioApp
      key={`${workspaceId}:image:${imageId}`}
      initialWorkspaceId={workspaceId}
      initialRoute={{ type: "image", id: imageId }}
    />
  );
}
