import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-end bg-warm-cream/95 backdrop-blur-sm px-6 md:px-12 py-4 border-b border-light-gray/40">
      <Button variant="outline" asChild className="rounded-full px-6 py-2.5 text-sm font-medium bg-white/80 border border-light-gray/50 text-charcoal hover:bg-white hover:border-light-gray transition-all duration-300 shadow-sm">
        <Link href="/return">Returning? Click here to input PIN</Link>
      </Button>
    </header>
  );
}
