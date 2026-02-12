import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["server/_core/index.ts"],
  platform: "node",
  packages: "external",
  bundle: true,
  format: "esm",
  outdir: "dist",
  // Mark the vite module as external so it's not bundled
  // In production, the dynamic import("./vite") path is never reached
  plugins: [
    {
      name: "exclude-vite-dev",
      setup(build) {
        // Exclude the vite.ts dev module entirely - replace with empty module
        build.onResolve({ filter: /\.\/vite$/ }, (args) => {
          if (args.importer.includes("index.ts")) {
            return { path: args.path, namespace: "vite-stub" };
          }
        });
        build.onLoad({ filter: /.*/, namespace: "vite-stub" }, () => {
          return {
            contents: `export function setupVite() { throw new Error("Vite dev server not available in production"); }
export function serveStatic() { throw new Error("Use inline static serving"); }`,
            loader: "js",
          };
        });
      },
    },
  ],
});

console.log("Server build complete");
