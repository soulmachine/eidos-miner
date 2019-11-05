# EIDOS-miner

EIDOS miner，无敌矿机，效率超越一千台手机，全网第一。

Start mining(启动挖矿):

    # Interactive mode
    docker run -it --rm --name eidos-miner soulmachine/eidos-miner --account your_account --private_key your_private_key
    # Daemon mode
    docker run -d--name eidos-miner soulmachine/eidos-miner --account your_account --private_key your_private_key

Stop mining(停止挖矿):

    docker stop eidos-miner


## Build docker image

    docker build -t soulmachine/eidos-miner .


## Run locally

    npm install
    node ./index.js --account your_account --private_key your_private_key
