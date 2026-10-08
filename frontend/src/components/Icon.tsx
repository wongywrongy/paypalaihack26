import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z",
  search: "m21 21-4.4-4.4 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  bag: "M5 7h14l1 14H4L5 7ZM9 7V5a3 3 0 0 1 6 0v2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  truck:
    "M1 5h13v12H1V5Zm13 4h4l4 4v4h-8M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  spark: "m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z",
  minus: "M5 12h14",
  plus: "M5 12h14M12 5v14",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
  logo: "M18 5a8 8 0 1 0 0 14M7 12h14",
};
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
