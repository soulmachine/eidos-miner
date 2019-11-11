# EIDOS-miner

EIDOS miner, 1000 times faster than your phone!

## Start mining

    npx eidos-miner --account your_eos_account --private_key your_private_key

## How to mine faster

This miner automatically adjusts its speed, so you don't need to worry about the performance.

If you do want to specify `num_actions` by yourself, set it as the following:

    npx eidos-miner --account your_eos_account --private_key your_private_key --num_actions 8

Under the hood, this miner sends one transaction with several(let's say `num_actions`) actions per second. The larger `num_actions` the faster it mines. But large `num_actions` is **NOT** always good, for example, if you use all your CPU in a very shot time, you do get a lot of coins very quickly, but you're not able to send any transaction in the next few hours, which means you lose the chance to play the game until your CPU recover.

Since the EIDOS smart contract distributes EIDOS in constant speed, i.e., 20 EIDOS to miners per second, **ideally** you should also spend your CPU in a constant speed, so that you can participate in the game every second.

**Note**: Before you run this miner, your CPU rate is `73%`, and after you run this miner for a few hours, if you see your CPU rate is still `73%`, it doesn't mean that you only used only `73%`, in contrast, it means that the CPU utilization rate is 100%! EOS mainnet releases your CPU linearly along the time and all of your CPU is used, nothing more and nothing less, that's why you see the CPU rate is still `73%`.

## Help

    npx eidos-miner -h

## Donation

This tool will donate 5% of mined EIDOS to the author by default, if you don't want to donate, you can disable it by passing `--donation false`.
