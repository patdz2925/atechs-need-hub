/* Route-level loading state for /hub/reports/[id] (server fetch in flight). */
export default function ReportDetailLoading() {
  return (
    <div className="pj-loading" aria-busy="true" aria-label="Loading report">
      <div className="pj-skel pj-skel--title" />
      <div className="pj-skel-card" aria-hidden="true">
        <span className="pj-skel pj-skel--pill" />
        <span className="pj-skel pj-skel--line w80" />
        <span className="pj-skel pj-skel--line w60" />
        <span className="pj-skel pj-skel--line w90" />
      </div>
    </div>
  );
}
