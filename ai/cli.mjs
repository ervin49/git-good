import { readFile } from "node:fs/promises";
import { generateProcedureDraft } from "./processor.mjs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Utilizare: node ai/cli.mjs <export.json>");
  process.exitCode = 2;
} else {
  try {
    const input = JSON.parse(await readFile(inputPath, "utf8"));
    const draft = await generateProcedureDraft(input);
    process.stdout.write(`${JSON.stringify(draft, null, 2)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
