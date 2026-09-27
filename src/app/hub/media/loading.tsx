/* Route-level loading state for /hub/media (server fetch in flight). */
export default function MediaLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading media">
      <div className="pj-skel pj-skel--title" />
      <div className="pj-skel pj-skel--toolbar" />
      <div className="mb-grid" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="pj-skel-card" key={i}>
            <span className="pj-skel pj-skel--thumb" />
            <span className="pj-skel pj-skel--line w80" />
            <span className="pj-skel pj-skel--line w60" />
          </div>
        ))}
      </div>
    </div>
  );
}
