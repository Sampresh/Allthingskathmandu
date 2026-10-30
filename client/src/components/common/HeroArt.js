// Prayer flag colours, in their traditional order.
const FLAGS = ['#2f6fde', '#f4f1ea', '#e0402c', '#2fa866', '#f5c02e']

/** Flags along a sagging line from (x1, y1) to (x2, y2). */
function flagLine(x1, y1, x2, y2, sag, count) {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2 + sag
  const at = (t) => [
    (1 - t) ** 2 * x1 + 2 * (1 - t) * t * midX + t ** 2 * x2,
    (1 - t) ** 2 * y1 + 2 * (1 - t) * t * midY + t ** 2 * y2,
  ]
  return {
    line: `M${x1} ${y1}Q${midX} ${midY} ${x2} ${y2}`,
    flags: Array.from({ length: count }, (_, i) => at((i + 1) / (count + 1))),
  }
}

const STRINGS = [flagLine(300, 182, 640, 322, 34, 16), flagLine(300, 182, -20, 318, 30, 15)]

// Rooftops between the stupa and the pagoda: [x, width, height].
const HOUSES = [
  [430, 44, 38],
  [478, 30, 54],
  [512, 52, 30],
  [570, 36, 46],
  [610, 58, 34],
  [672, 34, 58],
  [710, 48, 40],
  [762, 40, 28],
  [806, 30, 50],
  [840, 56, 36],
  [900, 38, 56],
  [942, 46, 32],
  [1230, 44, 42],
  [1278, 34, 60],
  [1316, 56, 34],
  [1376, 40, 48],
  [20, 40, 34],
  [66, 34, 50],
  [104, 50, 30],
]

/**
 * The valley at dawn: Himalaya, hills, the Boudha stupa, a pagoda and prayer flags. Colours come
 * from --hero-* in globals.css, so night falls in dark mode. Plain SVG: no JavaScript.
 */
export function HeroArt({ className }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 360"
      preserveAspectRatio="xMidYMax slice"
      className={className}
    >
      <circle cx="1010" cy="156" r="62" fill="var(--hero-sun)" />
      <path
        fill="var(--hero-far)"
        d="M0 250 120 190l90 35 120-95 90 70 100-50 120 65 120-105 100 80 120-50 120 70 130-90 100 70 110-40v210H0Z"
      />
      <path
        fill="var(--hero-snow)"
        d="m330 130-36 28 18-5 16 13 16-13 22 8Zm430-20-44 39 22-6 20 14 20-13 26 9Zm470 10-40 33 20-6 18 13 18-12 24 7Z"
      />
      <path
        fill="var(--hero-mid)"
        d="M0 290c120-46 220-40 340-14s220 26 360-10 260-42 400-8 240 34 340 6v96H0Z"
      />
      <g fill="var(--hero-near)">
        <rect y="348" width="1440" height="12" />
        {HOUSES.map(([x, width, height]) => (
          <rect key={x} x={x} y={360 - height} width={width} height={height} rx="3" />
        ))}
        {/* Boudha stupa */}
        <path d="M196 340h208v20H196zM218 322h164v18H218zM238 322a62 62 0 0 1 124 0zM282 236h36v26h-36zM286 236l14-58 14 58z" />
        <circle cx="300" cy="174" r="5" />
        {/* Pagoda */}
        <path d="M1040 340h160v20h-160zM1060 322h120v18h-120zM1085 282h70v40h-70zM1095 242h50v22h-50zM1105 208h30v18h-30z" />
        <path d="M1058 286q27-2 42-24h40q15 22 42 24zM1074 246q21-2 32-22h28q11 20 32 22zM1088 210q17-2 25-20h14q8 18 25 20zM1117 190l3-28 3 28z" />
      </g>
      <path
        fill="var(--hero-eye)"
        d="M288 250q6-6 11 0-5 3-11 0Zm13 0q5-6 11 0-6 3-11 0Zm-3 6q2 3 4 0-2 5-4 0Z"
      />
      {STRINGS.map(({ line, flags }) => (
        <g key={line}>
          <path d={line} fill="none" stroke="var(--hero-near)" strokeWidth="1.5" />
          {flags.map(([x, y], i) => (
            <rect key={x} x={x - 7} y={y} width="14" height="19" fill={FLAGS[i % FLAGS.length]} />
          ))}
        </g>
      ))}
    </svg>
  )
}
