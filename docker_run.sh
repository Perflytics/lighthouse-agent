#!/bin/bash

docker kill lighthouse
docker run -i -t -d -P --rm --name lighthouse -v "$PWD/app/input.json:/home/node/app/input.json" -v "$PWD/output:/home/node/data" lighthouse ./server.js -i input.json -o ../data/queue
#docker run -i -t -d -P --rm --name lighthouse -v "$PWD/app/input.json:/home/node/app/input.json" -v "$PWD/output:/home/node/data" lighthouse