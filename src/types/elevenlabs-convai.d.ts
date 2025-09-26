import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        "agent-id"?: string;
        variant?: string;
        "action-text"?: string;
        "start-call-text"?: string;
        "end-call-text"?: string;
        "listening-text"?: string;
        "speaking-text"?: string;
        "override-first-message"?: string;
        "dynamic-variables"?: string;
      };
    }
  }
}

export {};
