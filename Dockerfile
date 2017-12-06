FROM klingac/lighthouse-agent as builder
#FROM node:9.2-alpine
#FROM debian:sid
#FROM ubuntu:latest

#ADD entrypoint.sh /
#ADD lighthouse-script.sh /

WORKDIR /home/node/
COPY package.json yarn.lock ./
RUN yarn install --production

FROM klingac/lighthouse-agent
WORKDIR /home/node/
COPY --from=builder /home/node/node_modules/ ./node_modules/
ADD ./app/ /home/node/app/
CMD [ "npm", "start" ]