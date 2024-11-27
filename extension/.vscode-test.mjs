import { defineConfig } from "@vscode/test-cli"

export default defineConfig({
  files: "out/test/**/*.test.js",
})

// export default defineConfig({
//   files: "test/**/*.test.ts",
//   mocha: {
//     ui: "bdd",
//     timeout: 20000,
//     require: ["tsx/cjs"],
//     extension: [".ts", ".tsx"],
//     "node-option": ["--loader=tsx"]
//   }
// })
