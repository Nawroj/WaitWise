import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MobileNav } from "@/components/ui/MobileNav";
import { BarChart2, QrCode, Users, Clock, ThumbsUp, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground">
      {/* --- HEADER --- */}
      <header className="w-full p-4 flex justify-between items-center max-w-6xl mx-auto">
        <h1 className="text-xl font-bold">WaitWise</h1>
        <nav className="hidden md:flex items-center gap-4">
          <Link href="/pricing"><Button variant="ghost">Pricing</Button></Link>
          <Link href="/login"><Button variant="outline">Owner Login</Button></Link>
          <Link href="/shops"><Button>Join a Queue</Button></Link>
        </nav>
        <div className="md:hidden"><MobileNav /></div>
      </header>

      <main className="flex-grow w-full">
        {/* --- HERO SECTION --- */}
        <section className="w-full py-20 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              The Smart Way to Manage Your Waitlist
            </h2>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl mt-4">
              Great service starts before they arrive. Ditch the paper and give your customers the freedom to join the queue from anywhere.
            </p>
            <div className="mt-8">
              <Link href="/login">
                <Button size="lg">Create Your Shop</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* --- HOW IT WORKS SECTION --- */}
        <section id="how-it-works" className="w-full py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h3 className="text-3xl font-bold">How It Works</h3>
              <p className="mt-2 text-muted-foreground">
                Get up and running in three simple steps.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl items-start gap-8 text-left md:grid-cols-3 lg:gap-12">
              <div className="flex items-start gap-4">
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-lg">Set Up Your Shop</h4>
                  <p className="text-muted-foreground">Create your account and add your business details, services, and staff members in minutes.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                  <h4 className="font-bold text-lg">Customers Join Online</h4>
                  <p className="text-muted-foreground">Customers scan a QR code or visit your public page to join the queue and see real-time wait estimates.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                <div>
                  <h4 className="font-bold text-lg">Manage the Flow</h4>
                  <p className="text-muted-foreground">Use your live dashboard to manage the queue, update customer statuses, and keep everything running smoothly.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- KEY FEATURES SECTION --- */}
        <section id="features" className="w-full py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h3 className="text-3xl font-bold">Everything You Need to Manage Your Waitlist</h3>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3 lg:gap-12 text-center">
              <div className="flex flex-col items-center gap-2 p-4">
                <Users className="h-10 w-10 text-primary" />
                <h4 className="font-bold text-lg mt-2">Live Queue Management</h4>
                <p className="text-muted-foreground">View and manage separate queues for each barber in real-time. Mark customers as &quot;in progress,&quot; &quot;done,&quot; or &quot;no-show.&quot;</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4">
                <QrCode className="h-10 w-10 text-primary" />
                <h4 className="font-bold text-lg mt-2">Custom QR Code</h4>
                <p className="text-muted-foreground">Generate a unique QR code for your shop that customers can scan to instantly access your queue page.</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4">
                <BarChart2 className="h-10 w-10 text-primary" />
                <h4 className="font-bold text-lg mt-2">Daily Analytics</h4>
                <p className="text-muted-foreground">Track key metrics like revenue and clients per barber with simple, clear charts to understand your daily performance.</p>
              </div>
            </div>
          </div>
        </section>

        {/* --- BENEFITS SECTION --- */}
        <section id="benefits" className="w-full py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h3 className="text-3xl font-bold">Boost Efficiency and Customer Satisfaction</h3>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3 lg:gap-12 text-center">
              <div className="flex flex-col items-center gap-2 p-4">
                <TrendingUp className="h-10 w-10 text-primary" />
                <h4 className="font-bold text-lg mt-2">Reduce Walk-outs</h4>
                <p className="text-muted-foreground">Give customers the freedom to wait wherever they want, reducing perceived wait times and keeping them from leaving.</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4">
                <ThumbsUp className="h-10 w-10 text-primary" />
                <h4 className="font-bold text-lg mt-2">Improve Customer Experience</h4>
                <p className="text-muted-foreground">A transparent, modern queuing process shows you value your customers&apos; time, improving their overall satisfaction.</p>
              </div>
              <div className="flex flex-col items-center gap-2 p-4">
                <Clock className="h-10 w-10 text-primary" />
                <h4 className="font-bold text-lg mt-2">Increase Staff Efficiency</h4>
                <p className="text-muted-foreground">Your staff can focus on providing great service instead of managing a crowded waiting area and answering &quot;how much longer?&quot;</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="w-full p-8 border-t">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-4">
            <nav className="flex justify-center gap-6">
              <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
              <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
            </nav>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} WaitWise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}