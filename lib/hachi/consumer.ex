defmodule Hachi.Consumer do
  use Nostrum.Consumer
  require Logger

  alias Nostrum.Api
  alias Nostrum.Struct.Interaction

  @commands [
    {"ping", "ping", []}
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

  def handle_event({:READY, %{guilds: guilds} = _event, _ws_state}) do
    guilds
    |> Enum.map(fn guild -> guild.id end)
    |> Enum.each(&create_commands/1)
  end

  def handle_event({:INTERACTION_CREATE, %Interaction{} = interaction, _ws_state}) do
    response = %{
      type: 4,  # ChannelMessageWithSource
      data: %{
        content: "pong"
      }
    }

    Api.create_interaction_response(interaction, response)
  end

  # Default event handler, if you don't include this, your consumer WILL crash if
  # you don't have a method definition for each event type.
  def handle_event(_event) do
    :noop
  end
end
