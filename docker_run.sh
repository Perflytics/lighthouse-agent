#!/bin/bash

docker kill lighthouse
docker run -d -p 8080:8080 --rm --name lighthouse -v "$PWD/app:/home/node/app" -v "$PWD/output:/home/node/data" lighthouse ./server.js -i input.json -o ../data/queue