/* Route-level loading state for /hub/projects/[id]. */
export default function ProjectDetailLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading project">
      <span className="pj-skel pj-skel--back" />
      <div className="panel pj-detail-head">
        <span className="pj-skel pj-skel--pill" />
        <span className="pj-skel pj-skel--title mt" />
        <span className="pj-skel pj-skel--line w70" />
        <span className="pj-skel pj-skel--line w50" />
        <div className="pj-facts">
          {Array.from({ length: 4 }).map((_, i) => (
            <span className="pj-skel pj-skel--fact" key={i} />
          ))}
        </div>
      </div>
      <div className="pj-overview">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="pj-skel-card" key={i}>
            <span className="pj-skel pj-skel--line w50" />
            <span className="pj-skel pj-skel--line w90" />
            <span className="pj-skel pj-skel--line w70" />
          </div>
        ))}
      </div>
    </div>
  );
}
