import resolve from "@rollup/plugin-node-resolve";

export default {
  plugins: [
    resolve({ exportConditions: ["node", "default", "module", "import"] }),
  ],
};
