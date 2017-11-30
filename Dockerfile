FROM node:9.2-alpine
#FROM debian:sid
#FROM ubuntu:latest

LABEL maintainer "Martin Krutak <devklingac@gmail.com>"

# Update apk repositories
# Install chromium
# Minimize size
RUN echo "http://dl-2.alpinelinux.org/alpine/edge/main" > /etc/apk/repositories \
    && echo "http://dl-2.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
    && echo "http://dl-2.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
    && apk -U --no-cache \
    --allow-untrusted add \
    zlib-dev \
    chromium \
    xvfb \
    wait4ports \
    xorg-server \
    dbus \
    ttf-freefont \
    mesa-dri-swrast \
    grep \
    udev \
    && apk del --purge --force linux-headers binutils-gold gnupg zlib-dev libc-utils \
    && rm -rf /var/lib/apt/lists/* \
    /var/cache/apk/* \
    /usr/share/man \
    /tmp/* \
    /usr/lib/node_modules/npm/man \
    /usr/lib/node_modules/npm/doc \
    /usr/lib/node_modules/npm/html \
    /usr/lib/node_modules/npm/scripts

# Add chrome user
#RUN groupadd -r chrome -g 1000 && useradd -u  1000 -r -g chrome -G audio,video chrome \
#    && mkdir -p /home/chrome/Downloads && chown -R chrome:chrome /home/chrome

RUN mkdir -p /home/node/data  #; chown -R chrome:chrome /home/chrome/data

#ADD entrypoint.sh /
#ADD lighthouse-script.sh /

ENV HOME=/home/node CHROME_PATH=/usr/lib/chromium CHROME_BIN=/usr/bin/chromium-browser\
    OUTPUT_PATH=/home/node/data/ OUTPUT_FORMAT=json OUTPUT_FILE=report.json \
    CHROME_FLAGS="--headless --no-sandbox --disable-gpu" LIGHTHOUSE_FLAGS="--perf --disable-device-emulation --no-enable-error-reporting" \
    URL="https://www.smartmeter.io" \
    NODE_ENV=production

#WORKDIR /home/node/app

#ENTRYPOINT  [ "/entrypoint.sh" ]
#ENTRYPOINT  [ "/lighthouse-script.sh" ]
#CMD [ "${URL}", "${OUTPUT_FORMAT}", "${OUTPUT_PATH}${OUTPUT_FILE}", "${CHROME_FLAGS}", "${LIGHTHOUSE_FLAGS}" ]
#CMD [ "https://www.smartmeter.io" ]

#CMD ["/bin/bash"]
#CMD sh
CMD [ "npm", "start" ]