'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from 'lucide-react';
import Link from 'next/link';

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[250px] p-4">
        <SheetHeader className="text-left">
          <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full pt-4"> {/* Added some top padding for spacing */}
          {/* --- REMOVED: Logo / App Name and Separator --- */}

          {/* Navigation Links */}
          <nav className="flex flex-col gap-2">
            <Link 
              href="/pricing" 
              className="text-base font-medium text-left text-foreground p-3 rounded-md hover:bg-muted transition-colors"
            >
              Pricing
            </Link>
            <Link 
              href="/shops" 
              className="text-base font-medium text-left text-foreground p-3 rounded-md hover:bg-muted transition-colors"
            >
              Join a Queue
            </Link>
            <Link 
              href="/login" 
              className="text-base font-medium text-left text-foreground p-3 rounded-md hover:bg-muted transition-colors"
            >
              Owner Login
            </Link>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}