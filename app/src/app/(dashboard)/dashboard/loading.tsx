export default function DashboardLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-lg bg-line/70" />
      <div className="mt-2 h-4 w-72 max-w-full rounded bg-line/50" />
      <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-xl border border-line bg-surface" />
    </div>
  );
}
