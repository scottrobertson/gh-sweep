import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node20",
  bundle: true,
  noExternal: [/@octokit/],
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
