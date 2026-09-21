import { useState } from "react";

// Squishy 3D-style sun/moon icons — hand-drawn SVG with radial gradients and
// a gloss highlight, no icon-library shapes.
function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="sunFill" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFF3C4" />
          <stop offset="45%" stopColor="#FFC94D" />
          <stop offset="100%" stopColor="#EF9619" />
        </radialGradient>
      </defs>
      <g stroke="#F5A623" strokeWidth="2.4" strokeLinecap="round">
        <line x1="12" y1="2.4" x2="12" y2="4.6" />
        <line x1="12" y1="19.4" x2="12" y2="21.6" />
        <line x1="2.4" y1="12" x2="4.6" y2="12" />
        <line x1="19.4" y1="12" x2="21.6" y2="12" />
        <line x1="5.2" y1="5.2" x2="6.8" y2="6.8" />
        <line x1="17.2" y1="17.2" x2="18.8" y2="18.8" />
        <line x1="18.8" y1="5.2" x2="17.2" y2="6.8" />
        <line x1="6.8" y1="17.2" x2="5.2" y2="18.8" />
      </g>
      <circle cx="12" cy="12" r="5.4" fill="url(#sunFill)" />
      <ellipse cx="10.1" cy="9.9" rx="2.4" ry="1.5" fill="#FFFFFF" opacity="0.6" transform="rotate(-28 10.1 9.9)" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="moonFill" cx="35%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#F6F3FF" />
          <stop offset="55%" stopColor="#CFC8F7" />
          <stop offset="100%" stopColor="#8F86D9" />
        </radialGradient>
        <mask id="crescent">
          <rect width="24" height="24" fill="black" />
          <circle cx="12" cy="12.5" r="7.2" fill="white" />
          <circle cx="17" cy="8.6" r="6.2" fill="black" />
        </mask>
      </defs>
      <circle cx="12" cy="12.5" r="7.2" fill="url(#moonFill)" mask="url(#crescent)" />
      <ellipse cx="9.2" cy="14.6" rx="1.9" ry="1.2" fill="#FFFFFF" opacity="0.65" transform="rotate(-30 9.2 14.6)" />
      <path d="M18.6 14.2 l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6 z" fill="#FFE9A8" />
      <circle cx="20.4" cy="11.2" r="0.7" fill="#FFE9A8" />
    </svg>
  );
}

export default function ThemeToggle({ onToggle }: { onToggle: () => void }) {
  const [theme, setTheme] = useState<"dark" | "light">(
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const flip = () => {
    onToggle();
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  };
  return (
    <button
      className="theme-btn"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={flip}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
