# EIDOS-miner

EIDOS miner, 1000 times faster than your phone!

## Start mining

    npx eidos-miner --account your_eos_account --private_key your_private_key

## Mine faster

Since the EIDOS smart contract distributes 20 EIDSO per second, so fast will not help your get more, ideally, you should let your CPU consuming speed be equal to recover speed.

This miner sends a transaction per second, with 5 actions by default.

If you have huge CPU, you can make it faster by increasing `num_actions`(default 5):

    npx eidos-miner --account your_eos_account --private_key your_private_key --num_actions 14

## Help

    npx eidos-miner -h

## Donation

    This tool will donate 5% of mined EIDOS to the author by default, if you don't want to donate, you can disable it by passing `--donation false`.
