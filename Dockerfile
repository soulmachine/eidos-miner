FROM soulmachine/nodejs:latest
MAINTAINER soulmachine


WORKDIR /root

COPY index.js index.js
COPY package.json package.json

RUN npm install && npm link && rm -rf *

ENTRYPOINT  ["eidos-miner"]
