import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — RAWL" }] }),
  component: () => <ComingSoon title="Messages" description="Direct messages with friends and other readers." />,
});
