import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-12 lg:px-16 py-5 bg-black/80 backdrop-blur-sm">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity duration-200"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-lg font-semibold tracking-tight">SURVEYOR</span>
      </Link>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-8">
        <span className="text-sm text-[#888] hover:text-white transition-colors duration-200 cursor-pointer tracking-wide">
          RESEARCH
        </span>
      </nav>

      {/* Empty right side for balance - can add buttons later */}
      <div className="w-[100px]" />
    </header>
  );
}
