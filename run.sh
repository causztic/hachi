#! /bin/bash

rm -rf _build/prod/rel
MIX_ENV=prod mix release && _build/prod/rel/hachi/bin/hachi start