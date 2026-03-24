import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // SPA mode required for static hosting (e.g. GitHub Pages)
  ssr: false,
  basename: "/bearingsweeper/",
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
