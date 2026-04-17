export type DefaultConfig = {
  codex: {
    allowEditsByDefault: boolean;
  };
  discord: {
    threadAutoCreate: boolean;
  };
  router: {
    explicitPrefixes: string[];
  };
};

export async function loadDefaultConfig(): Promise<DefaultConfig> {
  return {
    codex: {
      allowEditsByDefault: true
    },
    discord: {
      threadAutoCreate: true
    },
    router: {
      explicitPrefixes: ["/code", "!code"]
    }
  };
}
