import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/bookmarks")({
  head: () => ({ meta: [{ title: "Reading List — RAWL" }] }),
  component: () => <ComingSoon title="Reading List" description="Your bookmarked series, organized by status." />,
});
