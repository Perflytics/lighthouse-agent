#!/bin/bash

docker save lighthouse | bzip2 | pv | ssh etndevel@etn-perflytics-node-1.mit.etn.cz 'bunzip2 | sudo docker load'