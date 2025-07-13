"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[260px] p-5">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
        </SheetHeader>

        {/* Optional logo/name at top */}
        <div className="flex items-center gap-2 mb-6">
          <Image
            src="/Logo.svg"
            alt="Logo"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="text-lg font-semibold text-foreground">WaitWise</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-3">
          <Link
            href="/pricing"
            className="block px-4 py-2 rounded-lg text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            Pricing
          </Link>

          <Link
    href="/login"
    className="block px-4 py-2 rounded-lg text-base font-medium text-foreground hover:bg-muted transition-colors"
  >
    Login
  </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
