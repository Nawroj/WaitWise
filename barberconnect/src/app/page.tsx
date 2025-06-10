import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 dark:bg-slate-900">
      <main className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
          BarberConnect
        </h1>
        <p className="max-w-xl mx-auto text-lg text-muted-foreground">
          The smartest way to manage your barbershop queue. No more waiting rooms, just happy clients.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/#">
            {/* This button is a placeholder for a future "Browse Shops" or "Find a Barber" page.
              For now, it demonstrates the primary customer action.
            */}
            <Button size="lg">Join a Queue</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Owner Login
            </Button>
          </Link>
        </div>
      </main>
      <footer className="absolute bottom-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} BarberConnect. All rights reserved.
      </footer>
    </div>
  );
}
