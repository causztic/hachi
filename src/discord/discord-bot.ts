import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type Message,
  type TextBasedChannel
} from "discord.js";
import {
  buildThreadName,
  decideThreadAction
} from "./thread-manager";

export type ManagedDiscordMessage = {
  channelId: string;
  content: string;
  guildId: string;
  messageId: string;
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
    message: Message
  ): Promise<TextBasedChannel | null> {
    const hasMention = client.user ? message.mentions.has(client.user.id) : false;
    const existingThreadId = message.channel.isThread() ? message.channel.id : null;
    const decision = decideThreadAction({
      existingThreadId,
      hasMention,
      isThread: message.channel.isThread()
    });

    if (decision.kind === "use-current-thread") {
      return message.channel;
    }

    if (
      decision.kind === "create-thread" &&
      config.threadAutoCreate &&
      message.channel.type === ChannelType.GuildText
    ) {
      return message.startThread({
        name: buildThreadName(message.author.displayName ?? message.author.username)
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

    await handlers.onManagedMessage({
      channelId: targetChannel.id,
      content: message.content,
      guildId: message.guildId,
      messageId: message.id,
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
