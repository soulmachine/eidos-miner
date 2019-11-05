FROM soulmachine/nodejs:latest
MAINTAINER soulmachine


WORKDIR /root

RUN mkdir eidos-miner
COPY index.js /root/eidos-miner/index.js
COPY package.json /root/eidos-miner/package.json

RUN cd /root/eidos-miner && npm install && \
  npm i nexe -g && nexe -t linux-x64 index.js && \
  mv ./eidos-miner /usr/local/bin && mv ./node_modules /usr/local/bin && rm -rf /root/eidos-miner

ENTRYPOINT  ["eidos-miner"]
