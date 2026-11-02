// Staged files only: formatting and a quick lint before every commit.
// Each part uses the tools installed in its own folder (backend/ and frontend/ have separate node_modules).
const quote = (files) => files.map((f) => JSON.stringify(f)).join(' ');

export default {
  'frontend/src/**/*.{ts,html,css,scss,json}': (files) => `npm --prefix frontend exec -- prettier --write ${quote(files)}`,
  'backend/{src,scripts}/**/*.ts': (files) => [
    `npm --prefix backend exec -- prettier --write ${quote(files)}`,
    `npm --prefix backend exec -- oxlint ${quote(files)}`,
  ],
};
