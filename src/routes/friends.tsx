import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Friends — RAWL" }] }),
  component: () => <ComingSoon title="Friends" description="Manage friends and friend requests." />,
});
