export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight">WFM Labs Hub</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        The practitioner workspace for workforce management.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/admin"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Admin Panel
        </a>
      </div>
    </div>
  )
}
