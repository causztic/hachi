defmodule Hachi do
  use Application

  def start(_type, _args) do
    Hachi.Supervisor.start_link([])
  end
end
