import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between glass border-b border-border-subtle px-6 md:px-12 py-4">
      {/* Logo/Wordmark */}
      <Link
        href="/"
        className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
      >
        <span className="text-gradient">Surveyor</span>
      </Link>

      {/* Return button */}
      <Button
        variant="secondary"
        size="sm"
        asChild
        className="rounded-full"
      >
        <Link href="/return">Returning? Enter PIN</Link>
      </Button>
    </header>
  );
}
