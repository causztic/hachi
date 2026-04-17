import { readFile } from "node:fs/promises";

export type PromptBundle = {
  persona: string;
  router: string;
};

export async function loadPromptBundle(): Promise<PromptBundle> {
  const [persona, router] = await Promise.all([
    readFile(new URL("../../prompts/persona.md", import.meta.url), "utf8"),
    readFile(new URL("../../prompts/router.md", import.meta.url), "utf8")
  ]);

  return {
    persona,
    router
  };
}
