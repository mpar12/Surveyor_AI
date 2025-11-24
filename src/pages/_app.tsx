import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { SessionProvider } from "@/contexts/SessionContext";
import "@/styles/globals.css";

const PATHS_WITHOUT_HEADER = new Set(["/assistant"]);

export default function App({ Component, pageProps }: AppProps) { // Sets up App
  const router = useRouter(); // Use Router to route to different pages 
  const hideHeader = PATHS_WITHOUT_HEADER.has(router.pathname); // HideHeader on this page

  return ( // Returns Session Provider and Header if hideHeader is false
    <SessionProvider>
      {!hideHeader ? <Header /> : null} 
      <Component {...pageProps} />
    </SessionProvider>
  );
}
