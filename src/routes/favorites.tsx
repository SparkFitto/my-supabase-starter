import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorites — RAWL" }] }),
  component: () => <ComingSoon title="Favorites" description="Your favorite series and chapters." />,
});
