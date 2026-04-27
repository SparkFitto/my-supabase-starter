import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — RAWL" }] }),
  component: () => <ComingSoon title="Settings" description="Account and preferences will live here." />,
});
