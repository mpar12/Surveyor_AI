import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { SessionProvider } from "@/contexts/SessionContext";
import "@/styles/globals.css";

const PATHS_WITHOUT_HEADER = new Set(["/assistant"]);

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideHeader = PATHS_WITHOUT_HEADER.has(router.pathname);

  return (
    <SessionProvider>
      {!hideHeader ? <Header /> : null}
      <Component {...pageProps} />
    </SessionProvider>
  );
}
