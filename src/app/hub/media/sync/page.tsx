import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireHubUser } from "@/lib/auth";
import MediaSyncPanel from "@/components/media/MediaSyncPanel";

export const metadata = {
  title: "Drive Sync — ATecHS Hub",
};

/* Drive sync administration — president only (UI gate; the sync API
   and media_sources RLS enforce it too). Non-presidents go back to
   the Bank: the existence of sync tooling is not their concern. */
export default async function MediaSyncPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");
  if (hub.profile.role !== "president") redirect("/hub/media");

  return (
    <>
      <div className="pj-head">
        <div>
          <Link href="/hub/media" className="pj-back pj-back--head">
            <ChevronLeft size={14} aria-hidden="true" /> Media Bank
          </Link>
          <h1>Drive sync</h1>
          <p className="pj-head-sub">
            Connect Google Drive roots and index them into the Bank.
          </p>
        </div>
      </div>

      <MediaSyncPanel />
    </>
  );
}
