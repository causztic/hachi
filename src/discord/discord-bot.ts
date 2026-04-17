import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type Message,
  type PublicThreadChannel,
  type TextChannel
} from "discord.js";
import {
  buildThreadName,
  decideThreadAction
} from "./thread-manager";

export type ManagedDiscordMessage = {
  authorId: string;
  channelId: string;
  content: string;
  guildId: string;
  history(): Promise<Array<{ content: string; role: "assistant" | "user" }>>;
  messageId: string;
  roleIds: string[];
  reply(content: string): Promise<void>;
  threadId: string;
};

export type DiscordBotConfig = {
  allowedGuildIds: string[];
  threadAutoCreate: boolean;
  token: string;
};

export type DiscordBotHandlers = {
  onManagedMessage(message: ManagedDiscordMessage): Promise<void>;
};

export function createDiscordBot(
  config: DiscordBotConfig,
  handlers: DiscordBotHandlers
) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  async function resolveTargetChannel(
    message: Message<true>
  ): Promise<PublicThreadChannel<false> | TextChannel | null> {
    const hasMention = client.user ? message.mentions.has(client.user.id) : false;
    const existingThreadId = message.channel.isThread() ? message.channel.id : null;
    const decision = decideThreadAction({
      existingThreadId,
      hasMention,
      isThread: message.channel.isThread()
    });

    if (decision.kind === "use-current-thread") {
      return message.channel as PublicThreadChannel<false> | TextChannel;
    }

    if (
      decision.kind === "create-thread" &&
      config.threadAutoCreate &&
      message.channel.type === ChannelType.GuildText
    ) {
      return message.startThread({
        name: buildThreadName(message.member?.displayName ?? message.author.username)
      });
    }

    return null;
  }

  client.on("messageCreate", async (message) => {
    if (!message.inGuild() || message.author.bot) {
      return;
    }

    if (
      config.allowedGuildIds.length > 0 &&
      !config.allowedGuildIds.includes(message.guildId)
    ) {
      return;
    }

    const targetChannel = await resolveTargetChannel(message);

    if (!targetChannel) {
      return;
    }

    const botUserId = client.user?.id ?? "";

    await handlers.onManagedMessage({
      authorId: message.author.id,
      channelId: targetChannel.id,
      content: message.content,
      guildId: message.guildId,
      history: async () => {
        const recentMessages = await targetChannel.messages.fetch({ limit: 10 });

        return [...recentMessages.values()]
          .reverse()
          .filter(
            (entry) => entry.id !== message.id && entry.content.trim().length > 0
          )
          .map((entry) => ({
            content: entry.content,
            role: entry.author.id === botUserId ? "assistant" : "user"
          }));
      },
      messageId: message.id,
      roleIds: Array.from(message.member?.roles.cache.keys() ?? []),
      reply: async (content) => {
        await targetChannel.send(content);
      },
      threadId: targetChannel.id
    });
  });

  return {
    async start() {
      await client.login(config.token);
    },
    async stop() {
      client.destroy();
    }
  };
}
