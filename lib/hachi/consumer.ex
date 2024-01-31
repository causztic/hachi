defmodule Hachi.Consumer do
  use Nostrum.Consumer
  require Logger

  alias Nostrum.Api
  alias Nostrum.Voice
  alias Nostrum.Struct.Interaction
  alias Nostrum.Cache.GuildCache

  # Compile-time helper for defining Discord Application Command options
  opt = fn type, name, desc, opts ->
    %{type: type, name: name, description: desc}
    |> Map.merge(Enum.into(opts, %{}))
  end

  @commands [
    {"ping", "ping", []},
    {"summon", "Summon bot to your voice channel", []},
    {"play", "Play a song", [
      opt.(1, "url", "Play a URL from a common service",
        options: [opt.(3, "url", "URL to play", required: true)]
      )
    ]},
    {"server", "Server-related commands", [
      opt.(1, "start", "Start a server",
        options: [
          opt.(3, "name", "The name of the server", required: true, choices: [
           %{ name: "palworld", value: "palworld" }
        ])]
      )
    ]},
    {"leave", "Tell bot to leave your voice channel", []},
    {"stop", "Stop the playing sound", []},
    {"pause", "Pause the playing sound", []},
    {"resume", "Resume the paused sound", []}
  ]

  def create_commands(guild_id) do
    Enum.each(@commands, fn {name, description, options} ->
      Api.create_guild_application_command(guild_id, %{
        name: name,
        description: description,
        options: options
      })
    end)
  end

  def get_voice_channel_of_interaction(%{guild_id: guild_id, user: %{id: user_id}} = _interaction) do
    guild_id
    |> GuildCache.get!()
    |> Map.get(:voice_states)
    |> Enum.find(%{}, fn v -> v.user_id == user_id end)
    |> Map.get(:channel_id)
  end

  def handle_event({:READY, %{guilds: guilds} = _event, _ws_state}) do
    guilds
    |> Enum.map(fn guild -> guild.id end)
    |> Enum.each(&create_commands/1)
  end

  def handle_event({:INTERACTION_CREATE, %Interaction{data: %{name: "ping"}} = interaction, _ws_state}) do
    response = %{
      type: 4,  # ChannelMessageWithSource
      data: %{
        content: "pong"
      }
    }

    Api.create_interaction_response(interaction, response)
  end

  def handle_event({:INTERACTION_CREATE, interaction, _ws_state}) do
    # Run the command, and check for a response message, or default to a checkmark emoji
    message =
      case do_command(interaction) do
        {:msg, msg} -> msg
        _ -> ":white_check_mark:"
      end

    Api.create_interaction_response(interaction, %{type: 4, data: %{content: message}})
  end

  def handle_event({:VOICE_SPEAKING_UPDATE, payload, _ws_state}) do
    Logger.debug("VOICE SPEAKING UPDATE #{inspect(payload)}")
  end

  # Default event handler, if you don't include this, your consumer WILL crash if
  # you don't have a method definition for each event type.
  def handle_event(_event) do
    :noop
  end

  def do_command(%{guild_id: guild_id, data: %{name: "leave"}}) do
    Voice.leave_channel(guild_id)
    {:msg, "See you later :wave:"}
  end

  def do_command(%{guild_id: guild_id, data: %{name: "pause"}}), do: Voice.pause(guild_id)

  def do_command(%{guild_id: guild_id, data: %{name: "resume"}}), do: Voice.resume(guild_id)

  def do_command(%{guild_id: guild_id, data: %{name: "stop"}}), do: Voice.stop(guild_id)

  def do_command(%{guild_id: guild_id, data: %{name: "play", options: [%{name: "url", options: [%{value: url}]}]}}) do
    if Voice.ready?(guild_id) do
      Voice.play(guild_id, url, :ytdl)
    else
      {:msg, "I must be in a voice channel before playing audio"}
    end
  end

  def do_command(%{data: %{name: "server", options: [%{name: "start", options: [%{value: "palworld"}]}]}}) do
    System.cmd("docker", ["run", "palworld", "-d"])
  end

  def do_command(%{guild_id: guild_id, data: %{name: "summon"}} = interaction) do
    case get_voice_channel_of_interaction(interaction) do
      nil ->
        {:msg, "You must be in a voice channel to summon me"}

      voice_channel_id ->
        Voice.join_channel(guild_id, voice_channel_id)
    end
  end
end
