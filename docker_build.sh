#!/bin/bash
docker build --no-cache -f Dockerfile -t lighthouse . 
#docker run -d -p 8080:8080 --rm --name lighthouse -v "$PWD/app:/home/node/app" -v "$PWD/output:/home/node/data" lighthouse yarn install --production