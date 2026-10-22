const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  opportunity: "M8 3h8v4H8z M8 5H5v16h14V5h-3 M8 12h8 M8 16h5",
  documents: "M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6",
  simulator: "M4 6h16 M4 18h16 M8 3v6 M16 15v6 M4 12h16 M12 9v6",
  report: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
  plan: "M3 6h18v13H3z M3 10h18 M7 15h3",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5",
  check: "M5 12l4 4L19 6",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  shield: "M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6",
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
