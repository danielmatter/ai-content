import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ workspaceId: string; imageId: string }>;
};

export default async function ImageDashboardPage({ params }: Props) {
  const { workspaceId, imageId } = await params;

  redirect(`/dashboard/${workspaceId}/images/${imageId}`);
}
