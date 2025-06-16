import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <main className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
          WaitWise
        </h1>
        <p className="max-w-xl mx-auto text-lg text-muted-foreground">
          Great service starts before they arrive. Join the queue online and let your customers know when it's their turn.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/shops">
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
        © {new Date().getFullYear()} WaitWise. All rights reserved.
      </footer>
    </div>
  );
}
