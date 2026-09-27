/* Route-level loading state for /hub/projects (server fetch in flight). */
export default function ProjectsLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading projects">
      <div className="pj-skel pj-skel--title" />
      <div className="pj-skel pj-skel--toolbar" />
      <div className="pj-chips" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span className="pj-skel pj-skel--chip" key={i} />
        ))}
      </div>
      <div className="pj-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="pj-skel-card" key={i}>
            <span className="pj-skel pj-skel--pill" />
            <span className="pj-skel pj-skel--line w80" />
            <span className="pj-skel pj-skel--line w60" />
            <span className="pj-skel pj-skel--line w90" />
            <span className="pj-skel pj-skel--bar" />
          </div>
        ))}
      </div>
    </div>
  );
}
