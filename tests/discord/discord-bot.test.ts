import { beforeEach, describe, expect, it, vi } from "vitest";

let registeredMessageCreateHandler:
  | ((message: Record<string, unknown>) => Promise<void>)
  | undefined;
const clientMock = {
  destroy: vi.fn(),
  login: vi.fn().mockResolvedValue(undefined),
  on: vi.fn((event: string, handler: (message: Record<string, unknown>) => Promise<void>) => {
    if (event === "messageCreate") {
      registeredMessageCreateHandler = handler;
    }
  }),
  user: { id: "bot-1" }
};

vi.mock("discord.js", () => ({
  ChannelType: {
    GuildText: 0
  },
  Client: class {
    destroy = clientMock.destroy;
    login = clientMock.login;
    on = clientMock.on;
    user = clientMock.user;
  },
  GatewayIntentBits: {
    GuildMessages: 1,
    Guilds: 2,
    MessageContent: 3
  }
}));

import { createDiscordBot } from "../../src/discord/discord-bot";

describe("createDiscordBot", () => {
  beforeEach(() => {
    registeredMessageCreateHandler = undefined;
    clientMock.destroy.mockClear();
    clientMock.login.mockClear();
    clientMock.on.mockClear();
  });

  it("passes author and role ids to managed messages", async () => {
    const onManagedMessage = vi.fn().mockResolvedValue(undefined);

    const bot = createDiscordBot(
      {
        allowedGuildIds: [],
        threadAutoCreate: true,
        token: "token"
      },
      {
        onManagedMessage
      }
    );

    await bot.start();

    expect(clientMock.login).toHaveBeenCalledWith("token");
    expect(registeredMessageCreateHandler).toBeDefined();

    await registeredMessageCreateHandler?.({
      author: {
        bot: false,
        id: "user-1",
        username: "user-1"
      },
      channel: {
        id: "thread-1",
        isThread: () => true
      },
      channelId: "thread-1",
      content: "/code fix it",
      guildId: "guild-1",
      id: "message-1",
      inGuild: () => true,
      mentions: {
        has: vi.fn().mockReturnValue(false)
      },
      member: {
        displayName: "User One",
        roles: {
          cache: new Map([
            ["role-1", { id: "role-1" }],
            ["role-2", { id: "role-2" }]
          ])
        }
      }
    });

    expect(onManagedMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "user-1",
        roleIds: ["role-1", "role-2"]
      })
    );

    await bot.stop();
    expect(clientMock.destroy).toHaveBeenCalled();
  });
});
