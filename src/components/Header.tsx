import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 lg:px-16 py-4">
      {/* Logo/Wordmark */}
      <Link
        href="/"
        className="text-xl font-semibold text-white hover:text-[#FF6B35] transition-colors duration-200"
      >
        Surveyor
      </Link>

      {/* Navigation */}
      <nav className="flex items-center gap-8">
        <span className="text-sm font-medium text-[#a1a1a1] hover:text-white transition-colors duration-200 cursor-default">
          Research
        </span>
      </nav>
    </header>
  );
}
