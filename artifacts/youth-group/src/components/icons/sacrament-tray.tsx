import { type SVGProps } from "react";

export function SacramentTrayIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Arch handle rising from center top of tray */}
      <path d="M9 13 Q9 7 12 7 Q15 7 15 13" />

      {/* Tray top face (slightly perspective — wider at bottom) */}
      <rect x="2" y="13" width="20" height="7" rx="1.5" />

      {/* Cup holes — two rows of dots */}
      <circle cx="6"  cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="16" r="1" fill="currentColor" stroke="none" />

      <circle cx="6"  cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
