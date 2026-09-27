import Navigation from "@/components/navigation/Navigation";
import Hero from "@/components/hero/Hero";
import Statement from "@/components/hero/Statement";
import StatsStrip from "@/components/hero/StatsStrip";
import CurrentEvents from "@/components/events/CurrentEvents";
import UpcomingEvents from "@/components/events/UpcomingEvents";
import PastWork from "@/components/events/PastWork";
import MediaBank from "@/components/media/MediaBank";
import Organization from "@/components/organization/Organization";
import Timeline from "@/components/timeline/Timeline";
import Evaluation from "@/components/evaluation/Evaluation";
import Footer from "@/components/navigation/Footer";
import { getFeaturedMedia, getMediaTypeCounts } from "@/lib/media/queries";

/* Homepage — server shells fetch shared data; the interactive event
   and media sections hydrate client-side. Media counts + featured
   rows are RLS-scoped: anonymous visitors see the curated empty
   state (same as events), signed-in school users see their slice. */
export default async function Home() {
  const [countsRes, featuredRes] = await Promise.all([
    getMediaTypeCounts(),
    getFeaturedMedia(4),
  ]);

  return (
    <>
      <Navigation />
      <main id="content">
        <Hero />
        <Statement />
        <StatsStrip />
        <CurrentEvents />
        <UpcomingEvents />
        <PastWork />
        <MediaBank counts={countsRes.counts} featured={featuredRes.items} />
        <Organization />
        <Timeline />
        <Evaluation />
      </main>
      <Footer />
    </>
  );
}