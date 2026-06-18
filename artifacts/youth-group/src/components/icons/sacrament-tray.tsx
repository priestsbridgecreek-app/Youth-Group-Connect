import { type SVGProps } from "react";

export function SacramentTrayIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Tray body — shallow rectangular tray */}
      <path d="M3 9 Q3 7 5 7 L19 7 Q21 7 21 9 L21 15 Q21 17 19 17 L5 17 Q3 17 3 15 Z" />
      {/* Handle on the right side */}
      <path d="M21 11 Q24 11 24 13 Q24 15 21 15" />
    </svg>
  );
}
