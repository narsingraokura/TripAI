import Link from "next/link"

export default function LandingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">TripAI</h1>
        <p className="mt-2 text-muted-foreground">
          Plan smarter. Travel lighter.
        </p>
        <Link
          href="/trip"
          className="mt-6 inline-block rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          View demo trip →
        </Link>
      </div>
    </main>
  )
}
