// The SpoolStack mark as inline SVG: two empty filament spools of the same
// size, stacked face-on and touching exactly at the centre, each ring cut
// open on opposite sides so the pair reads as one S. Top spool cream, bottom
// spool orange, on the ink tile. Same geometry as the app icons in
// public/icons, on a 512 grid.
//
// Below 40px the spool hubs blur into the letter, so small marks drop them
// and show the plain S (the favicon does the same).

const TOP_ARC = 'M333.88 203.47A84 84 0 1 0 256.00 256.00';
// Starts 3 degrees early, tucked under the top stroke, so no hairline shows
// where the two colours meet.
const BOTTOM_ARC = 'M251.60 256.12A84 84 0 1 1 178.12 308.53';
const STROKE = 44;
const HUB_R = 25.2;
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
      <path d={BOTTOM_ARC} fill="none" stroke="#F26B1D" strokeWidth={STROKE} />
      <path d={TOP_ARC} fill="none" stroke="#F4F1EA" strokeWidth={STROKE} />
      {hubs ? (
        <>
          <circle cx="256" cy="172" r={HUB_R} fill="none" stroke="#F4F1EA" strokeWidth={HUB_STROKE} />
          <circle cx="256" cy="340" r={HUB_R} fill="none" stroke="#F26B1D" strokeWidth={HUB_STROKE} />
        </>
      ) : null}
    </svg>
  );
}
