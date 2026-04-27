import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/updates")({
  head: () => ({ meta: [{ title: "What's New — RAWL" }] }),
  component: () => <ComingSoon title="What's New" description="The RAWL changelog." />,
});
