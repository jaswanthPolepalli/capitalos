import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { zipSync } from "fflate";

const TEMPLATE_PATH = resolve("project-template-1.0.0.json");
const requestedOutput = process.argv[2] ?? "capitalos-stage1.zip";
const OUTPUT_PATH = resolve(requestedOutput.endsWith(".zip") ? requestedOutput : `${requestedOutput}.zip`);

async function createArchive(): Promise<void> {
  const template = await readFile(TEMPLATE_PATH);
  const archive = zipSync({ [basename(TEMPLATE_PATH)]: template }, { level: 9 });
  await writeFile(OUTPUT_PATH, archive);

  console.log(`Created ${OUTPUT_PATH}`);
}

await createArchive();