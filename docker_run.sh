#!/bin/bash

docker kill lighthouse
docker run -i -t -d -P --rm --name lighthouse -v "$PWD/app:/home/node/app" -v "$PWD/output:/home/node/data" lighthouse ./server.js -i input.json -o ../data/queue
