import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — RAWL" }] }),
  component: () => <ComingSoon title="Notifications" description="Your alerts will appear here." />,
});
