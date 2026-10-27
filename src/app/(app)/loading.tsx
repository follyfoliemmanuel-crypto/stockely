export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Chargement de la page…</span>

      <div className="space-y-3">
        <div className="skeleton h-3 w-32 rounded-full" />
        <div className="skeleton h-10 w-64 max-w-full rounded-xl" />
        <div className="skeleton h-3 w-96 max-w-full rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-line/80 bg-white p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton h-3 w-24 rounded-full" />
              <div className="skeleton h-9 w-9 rounded-xl" />
            </div>
            <div className="skeleton mt-4 h-7 w-32 rounded-lg" />
            <div className="skeleton mt-3 h-3 w-40 max-w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-line/80 bg-white p-5 shadow-card">
            <div className="skeleton h-4 w-40 rounded-full" />
            <div className="skeleton mt-5 h-48 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-line/80 bg-white p-5 shadow-card">
            <div className="skeleton h-4 w-36 rounded-full" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="skeleton h-3 flex-1 rounded-full" />
                  <div className="skeleton h-3 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-line/80 bg-white p-5 shadow-card"
            >
              <div className="skeleton h-4 w-36 rounded-full" />
              <div className="skeleton mx-auto mt-5 h-32 w-32 rounded-full" />
              <div className="mt-5 space-y-2">
                <div className="skeleton h-3 w-full rounded-full" />
                <div className="skeleton h-3 w-4/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
