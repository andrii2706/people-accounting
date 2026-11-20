/**
 * Local development: the API of «Військовий облік» listens on 3400 (backend/.env PORT=3400), not on the usual 3000 —
 * other projects on the same computer (Next.js, React, Node) take 3000 and 4200. In containers and in Google
 * Cloud the address always comes from API_INTERNAL_URL / SSR_API_BASE.
 */
export const LOCAL_API_URL = 'http://localhost:3400';
