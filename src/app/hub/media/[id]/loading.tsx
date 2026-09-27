/* Route-level loading state for /hub/media/[id] (server fetch in flight). */
export default function MediaDetailLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading media">
      <div className="pj-skel pj-skel--title" />
      <div className="pj-skel-card" aria-hidden="true">
        <span className="pj-skel pj-skel--thumb" />
        <span className="pj-skel pj-skel--line w80" />
        <span className="pj-skel pj-skel--line w60" />
      </div>
    </div>
  );
}
