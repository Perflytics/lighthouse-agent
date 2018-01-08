#!/bin/bash

docker kill lighthouse
#docker run -i -t -d -P --rm --shm-size="128m" --name lighthouse -v "$PWD/data/input.json:/home/node/input.json" -v "$PWD/data:/home/node/data" lighthouse ./app/server.js -i ./input.json -o ./data
docker run -i -t -d -P --rm --shm-size="128m" --name lighthouse -v "$PWD/input.json:/home/node/data/input.json" -v "$PWD/data:/home/node/data" lighthouse
#docker run -i -t -d -P --rm --shm-size="128m" --name lighthouse -v "$PWD/input.json:/home/node/data/input.json" -v "$PWD/data:/home/node/data" -v "$PWD/node_modules:/home/node/node_modules" lighthouse
#docker run -i -t -d -P --rm --shm-size="128m" --name lighthouse -v "$PWD/app/input.json:/home/node/app/input.json" -v "$PWD/output:/home/node/data" lighthouse