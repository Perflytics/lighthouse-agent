FROM klingac/lighthouse-agent
#FROM node:9.2-alpine
#FROM debian:sid
#FROM ubuntu:latest

#ADD entrypoint.sh /
#ADD lighthouse-script.sh /

ADD ./app/ /home/node/app/
ADD ./node_modules/ /home/node/node_modules

CMD [ "npm", "start" ]