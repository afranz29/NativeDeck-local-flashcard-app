/** Small hand-rolled SVG line chart. Points are plotted on a 0-100 x/y grid
 * (caller normalizes) so this stays a dumb renderer with no scaling logic. */
export function LineChart({ points }: { points: { x: number; y: number }[] }) {
  const width = 100;
  const height = 100;
  const padding = 6;

  const toSvgX = (x: number) => padding + (x / 100) * (width - padding * 2);
  const toSvgY = (y: number) => height - padding - (y / 100) * (height - padding * 2);

  const path = points.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-48"
      preserveAspectRatio="none"
    >
      {[0, 25, 50, 75, 100].map((gy) => (
        <line
          key={gy}
          x1={padding}
          x2={width - padding}
          y1={toSvgY(gy)}
          y2={toSvgY(gy)}
          className="stroke-gray-200 dark:stroke-gray-800"
          strokeWidth="0.5"
        />
      ))}
      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          className="stroke-sky-500"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={toSvgX(p.x)}
          cy={toSvgY(p.y)}
          r="1.5"
          className="fill-sky-500"
        />
      ))}
    </svg>
  );
}
