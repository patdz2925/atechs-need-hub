/* Route-level loading state for /hub/tasks/[id]. */
export default function TaskDetailLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading task">
      <span className="pj-skel pj-skel--back" />
      <div className="panel pj-detail-head">
        <span className="pj-skel pj-skel--pill" />
        <span className="pj-skel pj-skel--title mt" />
        <span className="pj-skel pj-skel--line w70" />
        <div className="pj-facts">
          {Array.from({ length: 4 }).map((_, i) => (
            <span className="pj-skel pj-skel--fact" key={i} />
          ))}
        </div>
      </div>
      <div className="tk-detail">
        {Array.from({ length: 2 }).map((_, i) => (
          <div className="pj-skel-card" key={i}>
            <span className="pj-skel pj-skel--line w50" />
            <span className="pj-skel pj-skel--line w90" />
          </div>
        ))}
      </div>
    </div>
  );
}
