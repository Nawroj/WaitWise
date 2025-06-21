import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground">
      {/* Header with navigation remains the same */}
      <header className="w-full p-4 flex justify-between items-center max-w-6xl mx-auto">
        <h1 className="text-xl font-bold">WaitWise</h1>
        <nav className="flex items-center gap-4">
          <Link href="/pricing">
            <Button variant="ghost">Pricing</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Owner Login</Button>
          </Link>
          <Link href="/shops">
            <Button>Join a Queue</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-grow flex items-center justify-center text-center space-y-6 p-4">
        <div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter">
            The Smart Way to Manage Your Waitlist
          </h2>
          <p className="max-w-xl mx-auto text-lg text-muted-foreground mt-4">
            Great service starts before they arrive. Ditch the paper and give your customers the freedom to join the queue from anywhere.
          </p>
          
          {/* --- UPDATED BUTTON SECTION --- */}
          <div className="mt-8">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 text-lg">
                Create Your Shop
              </Button>
            </Link>
          </div>
          
        </div>
      </main>

      <footer className="w-full text-center p-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} WaitWise. All rights reserved.
      </footer>
    </div>
  );
}