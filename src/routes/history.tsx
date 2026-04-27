import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Reading History — RAWL" }] }),
  component: () => <ComingSoon title="Reading History" description="Chapters you've recently opened." />,
});
