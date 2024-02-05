defmodule Hachi.Palworld do
  require Logger
  use GenServer

  defmodule State do
    defstruct ~w|pid status|a
  end

  def start_link(default) do
    GenServer.start_link(__MODULE__, %State{}, default)
  end

  def start(pid) do
    GenServer.call(pid, :start)
  end

  @impl true
  def init(options \\ []) do
    {:ok, options}
  end

  @impl true
  def handle_call(:start, _from, state = %State{ status: :running }) do
    {:reply, {:error, "server already started"}, state}
  end

  @impl true
  def handle_call(:start, _from, state) do
    logger = fn (_device, _pid, binary) -> Logger.info(binary) end

    case Exexec.run_link(
      "docker compose up",
      [
        {:cd, "servers/palworld"},
        {:stdout, logger},
        {:stderr, logger}
      ]
    ) do
      {:ok, pid, _} -> {:reply, {:ok, "server started"}, %State{ state | pid: pid, status: :running}}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end
end
