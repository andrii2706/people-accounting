// Smoke test of the IIT library: node iit/check.mjs (in the backend folder).
// The deploy runs it before building the image, so a broken library never reaches production.
import { createVerifier } from './iit-loader.mjs';

try {
  await createVerifier();
  console.log('ІІТ: бібліотеку ініціалізовано, перевірка КЕП працюватиме');
} catch (err) {
  console.error(`ІІТ: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
