import { ProjectDetailPage } from "@/components/projects/ProjectDetailPage";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <ProjectDetailPage projectId={params.id} />;
}

