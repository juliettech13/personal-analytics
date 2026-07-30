// One letter per retro accent -- HELLO happens to be exactly as long as the
// chart palette, so each letter gets its own color from the original :root set.
const LETTERS = [
  { char: "H", className: "text-reel" },
  { char: "E", className: "text-feed" },
  { char: "L", className: "text-retro-gold" },
  { char: "L", className: "text-retro-teal" },
  { char: "O", className: "text-retro-purple" },
];

export function Hello() {
  return (
    <div className="mb-3 rounded-[7px] border-2 border-foreground bg-card px-3 py-3 shadow-[4px_4px_0_rgba(0,0,0,0.28)]">
      <h1
        aria-label="Hello"
        className="flex items-center justify-center gap-[0.06em] font-pixel text-[clamp(56px,13vw,152px)] leading-[0.85] tracking-[0.16em] select-none"
      >
        {LETTERS.map(({ char, className }, i) => (
          <span
            key={i}
            aria-hidden
            className={`${className} [text-shadow:3px_3px_0_rgba(0,0,0,0.2)]`}
          >
            {char}
          </span>
        ))}
        <span
          aria-hidden
          className="ml-[0.3em] inline-block h-[0.62em] w-[0.08em] animate-[blink_1.1s_step-end_infinite] bg-foreground/70"
        />
      </h1>
      <p className="mt-2 text-center font-retro-mono text-[10px] tracking-[0.35em] text-muted-foreground uppercase">
        welcome back
      </p>
    </div>
  );
}
