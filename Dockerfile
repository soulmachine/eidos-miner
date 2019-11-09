FROM soulmachine/nodejs:latest
MAINTAINER soulmachine


RUN mkdir eidos-miner
COPY index.js ./eidos-miner/index.js
COPY package.json ./eidos-miner/package.json

RUN cd ./eidos-miner && npm install \
    && sudo npm i nexe -g && nexe -t linux-x64 index.js \
    && sudo mv ./eidos-miner /usr/local/bin && sudo mv ./node_modules /usr/local/bin && rm -rf ./eidos-miner

ENTRYPOINT  ["eidos-miner"]
