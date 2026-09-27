/* Route-level loading state for /hub/tasks (server fetch in flight). */
export default function MyTasksLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading tasks">
      <div className="pj-skel pj-skel--title" />
      <div className="pj-skel pj-skel--toolbar" />
      <div className="pj-chips" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span className="pj-skel pj-skel--chip" key={i} />
        ))}
      </div>
      <div className="tk-list tk-list--page">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="pj-skel-card" key={i}>
            <span className="pj-skel pj-skel--pill" />
            <span className="pj-skel pj-skel--line w80" />
            <span className="pj-skel pj-skel--line w60" />
            <span className="pj-skel pj-skel--line w90" />
          </div>
        ))}
      </div>
    </div>
  );
}
