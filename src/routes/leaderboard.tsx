import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — RAWL" }] }),
  component: () => <ComingSoon title="Leaderboard" description="Top readers, translators, and commenters." />,
});
