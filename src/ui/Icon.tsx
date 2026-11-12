import type { SVGProps } from 'react';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5',
  notes: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  canvas: 'M4 5h7v6H4zM13 13h7v6h-7zM11 8h3a2 2 0 0 1 2 2v3',
  tasks: 'M4 6.5 6 8.5 9 5M4 14.5l2 2 3-3.5M12 7h8M12 15h8',
  graph: 'M6 7a2 2 0 1 0 0-.01M18 5a2 2 0 1 0 0-.01M17 18a2 2 0 1 0 0-.01M7.5 8.5 15.8 6M16.5 7.5l.5 9M7 9l8.5 8',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  chevD: 'M5 9l7 7 7-7',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7',
  folder: 'M3 6h6l2 2h10v11H3z',
  folderOpen: 'M3 19V6h6l2 2h8v3M3 19l3-8h16l-3 8z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  hash: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  history: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4 4 0 0 1 17 18z',
  refresh: 'M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4',
  sidebar: 'M4 5h16v14H4zM9 5v14',
  panel: 'M4 5h16v14H4zM15 5v14',
  command: 'M9 9V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9a1 1 0 1 0 0-.01',
  zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8.5 11h5M11 8.5v5',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  check: 'M5 12.5l4.5 4.5L19 7',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  code: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  group: 'M4 4h16v16H4zM4 9h6',
  text: 'M5 6h14M12 6v13M9 19h6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  sticky: 'M5 4h14v11l-5 5H5zM14 20v-5h5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  logout: 'M10 4H4v16h6M16 8l4 4-4 4M20 12H9',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  repeat: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M10 5h8M6 19h8M14 5 10 19',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  strike: 'M5 12h14M16 7a4 3 0 0 0-4-2c-2.5 0-4 1.2-4 3M8 16c0 1.8 1.6 3 4 3s4-1.2 4-3',
  highlighter: 'M15 4l5 5-9.5 9.5H6v-4.5zM4 21h6',
  textColor: 'M6 17 12 4l6 13M8.5 12h7M5 21h14',
  listOl: 'M10 6h10M10 12h10M10 18h10M4.5 4.5v3M4 12.5h2.5M4 17.5h2.5l-2.5 3h2.5',
  quote: 'M5 6v12M9 9h10M9 15h7',
  table: 'M4 5h16v14H4zM4 10h16M10 5v14',
  footnote: 'M5 19 10 7l5 12M7 15h6M17 4v5M15 5.5l4 2M19 5.5l-4 2',
  alignL: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignC: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignR: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  alignJ: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  indent: 'M4 6h16M12 10h8M12 14h8M4 18h16M4 9l4 3-4 3z',
  outdent: 'M4 6h16M12 10h8M12 14h8M4 18h16M8 9l-4 3 4 3z',
  sup: 'M4 18 11 8M11 18 4 8M15 7h5l-5 6h5',
  sub: 'M4 6l7 10M11 6 4 16M15 16h5l-5 5h5',
  eraser: 'M4 16 14 5l6 6-8 8H7zM9 11l6 6',
  heading: 'M6 5v14M18 5v14M6 12h12',
  spacing: 'M8 5h12M8 12h12M8 19h12M4 5v14M2 7l2-2 2 2M2 17l2 2 2-2',
  textSize: 'M4 18 9 6l5 12M6 14h6M16 18l2.5-6 2.5 6M17 16.5h3',
  hr: 'M3 12h18M7 7h10M7 17h10',
  scissors: 'M6 7a2 2 0 1 0 0-.01M6 17a2 2 0 1 0 0-.01M8 8l12 9M8 16 20 7',
  paste: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  layers: 'M12 4 3 9l9 5 9-5zM3 14l9 5 9-5',
  chevRsm: 'M10 7l5 5-5 5',
};

export type IconName = keyof typeof P;

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}
