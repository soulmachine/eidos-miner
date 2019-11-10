# EIDOS-miner

EIDOS miner, 1000 times faster than your phone!

## Start mining

    npx eidos-miner --account your_eos_account --private_key your_private_key

## Mine faster

If you have huge CPU, you can make it faster by increasing `num_actions`(default 5), for example:

    npx eidos-miner --account your_eos_account --private_key your_private_key --num_actions 14

**Note**:

Since the EIDOS smart contract distributes 20 EIDOS per second, so sending more transactions will **NOT** help your mine more coins, **ideally**, your CPU consuming speed should be equal to recover speed, so that you can play the game in every second.

This miner sends a transaction with 5 actions per second.

## Help

    npx eidos-miner -h

## Donation

This tool will donate 5% of mined EIDOS to the author by default, if you don't want to donate, you can disable it by passing `--donation false`.
