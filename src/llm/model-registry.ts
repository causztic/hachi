export type DefaultModel = {
  filename: string;
  name: string;
  url: string;
};

const DEFAULT_MODEL: DefaultModel = {
  filename: "Qwen3-14B-Q5_K_M.gguf",
  name: "qwen3-14b-q5-k-m",
  url: "https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q5_K_M.gguf?download=true"
};

export function getDefaultModel(): DefaultModel {
  return DEFAULT_MODEL;
}

export function buildLlamaServerCommand(input: {
  host: string;
  modelPath: string;
  port: number;
  serverBinary: string;
}) {
  return {
    args: [
      "--host",
      input.host,
      "--port",
      String(input.port),
      "--model",
      input.modelPath
    ],
    command: input.serverBinary
  };
}
