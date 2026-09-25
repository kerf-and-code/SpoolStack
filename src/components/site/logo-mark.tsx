// The SpoolStack mark as inline SVG: two empty filament spools stacked
// face-on, each ring cut open on opposite sides so the pair reads as one S.
// Top spool cream, bottom spool orange, on the ink tile. Same geometry as
// the app icons in public/icons, on a 512 grid.
//
// Below 40px the spool hubs blur into the letter, so small marks drop them
// and show the plain S (the favicon does the same).

const TOP_ARC = 'M328.3 199.2A78 78 0 1 0 256.0 248.0';
const BOTTOM_ARC = 'M256.0 244.0A88 88 0 1 1 174.4 299.0';
const STROKE = 44;
const HUB_STROKE = 18.5;

export function LogoMark({
  size = 28,
  className,
  detail,
}: {
  size?: number;
  className?: string;
  /** Show the spool hubs. Defaults to on at 40px and up. */
  detail?: boolean;
}) {
  const hubs = detail ?? size >= 40;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="512" height="512" rx="112" fill="#111111" />
      <path d={TOP_ARC} fill="none" stroke="#F4F1EA" strokeWidth={STROKE} />
      <path d={BOTTOM_ARC} fill="none" stroke="#F26B1D" strokeWidth={STROKE} />
      {hubs ? (
        <>
          <circle cx="256" cy="170" r="23.4" fill="none" stroke="#F4F1EA" strokeWidth={HUB_STROKE} />
          <circle cx="256" cy="332" r="26.4" fill="none" stroke="#F26B1D" strokeWidth={HUB_STROKE} />
        </>
      ) : null}
    </svg>
  );
}
