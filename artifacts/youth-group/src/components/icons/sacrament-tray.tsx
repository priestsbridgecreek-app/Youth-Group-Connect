import { type SVGProps } from "react";

export function SacramentTrayIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Tray base */}
      <ellipse cx="12" cy="20" rx="9" ry="2" />
      <path d="M3 20 Q3 18 12 18 Q21 18 21 20" />

      {/* Center cup */}
      <path d="M10.5 10 L11 18 L13 18 L13.5 10 Z" />
      <path d="M10 10 Q12 9 14 10" />

      {/* Left cup */}
      <path d="M5 11.5 L5.4 17 L7 17 L7.4 11.5 Z" />
      <path d="M4.7 11.5 Q6.2 10.8 7.7 11.5" />

      {/* Right cup */}
      <path d="M16.6 11.5 L17 17 L18.6 17 L19 11.5 Z" />
      <path d="M16.3 11.5 Q17.8 10.8 19.3 11.5" />

      {/* Upper-left cup */}
      <path d="M5.5 6.5 L5.9 11 L7.3 11 L7.7 6.5 Z" />
      <path d="M5.2 6.5 Q6.6 5.8 8 6.5" />

      {/* Upper-right cup */}
      <path d="M16.3 6.5 L16.7 11 L18.1 11 L18.5 6.5 Z" />
      <path d="M16 6.5 Q17.4 5.8 18.8 6.5" />

      {/* Top cup */}
      <path d="M10.5 3 L10.9 7 L13.1 7 L13.5 3 Z" />
      <path d="M10.2 3 Q12 2.2 13.8 3" />
    </svg>
  );
}
