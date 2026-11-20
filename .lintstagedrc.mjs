// Staged files only: formatting and a quick lint before every commit.
// Each part uses the tools installed in its own folder (backend/ and frontend/ have separate node_modules);
// they are started with node directly (scripts/run-tool.mjs) — `npm exec` from a hook fails on Windows.
const quote = (files) => files.map((f) => JSON.stringify(f)).join(' ');
const tool = (part, name, args) => `node scripts/run-tool.mjs ${part} ${name} ${args}`;

export default {
  'frontend/src/**/*.{ts,html,css,scss,json}': (files) => tool('frontend', 'prettier', `--write ${quote(files)}`),
  'backend/{src,scripts}/**/*.ts': (files) => [
    tool('backend', 'prettier', `--write ${quote(files)}`),
    tool('backend', 'oxlint', quote(files)),
  ],
};
