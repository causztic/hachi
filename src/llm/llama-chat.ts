export type LlamaChatMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export type LlamaChatClientConfig = {
  baseUrl: string;
  model: string;
};

export function createLlamaChatClient(config: LlamaChatClientConfig) {
  return {
    async reply(messages: LlamaChatMessage[]): Promise<string> {
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        body: JSON.stringify({
          messages,
          model: config.model,
          stream: false
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`llama.cpp request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      return payload.choices?.[0]?.message?.content ?? "";
    }
  };
}
