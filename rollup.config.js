import typescript from "rollup-plugin-typescript2";

export default {
    entry: "./src/index.ts",
    external: [
        "immutable",
    ],
    exports: "named",
	plugins: [
		typescript({
		tsconfig: "./src/tsconfig.json"
	})],
    targets: [
        { dest: "lib/index.js", format: "cjs" },
        { dest: "es/index.js", format: "es" },
  ]
}
