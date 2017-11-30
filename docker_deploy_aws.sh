#!/bin/bash

docker save lighthouse | bzip2 | pv | ssh ubuntu@ec2-18-195-70-12.eu-central-1.compute.amazonaws.com 'bunzip2 | docker load'