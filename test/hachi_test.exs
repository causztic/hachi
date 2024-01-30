defmodule HachiTest do
  use ExUnit.Case
  doctest Hachi

  test "greets the world" do
    assert Hachi.hello() == :world
  end
end
