#!/usr/bin/env node

const assert = require('assert');
const fetch = require('node-fetch'); // node only; not needed in browsers
const chalk = require('chalk');
const figlet = require('figlet');
const yargs = require('yargs');

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig'); // development only
const { TextEncoder, TextDecoder } = require('util'); // node only; native TextEncoder/Decoder
const { isValidPrivate, privateToPublic } = require('eosjs-ecc');

const { argv } = yargs
  .options({
    account: {
      description: 'Your EOS account, must be 12 letters',
      type: 'string',
      demandOption: true,
    },
    private_key: {
      description: 'Your private key',
      type: 'string',
      demandOption: true,
    },
    num_actions: {
      description: 'The number of actions per transaction, 0 means automatic',
      type: 'number',
      default: 0,
    },
    donation: {
      description: 'Donate 5% of mined EIDOS to the author',
      type: 'boolean',
      default: true,
    },
  })
  .check(function(argv) {
    if (isValidPrivate(argv.private_key)) {
      return true;
    } else {
      throw new Error('Error: private_key is invalid!');
    }
  });

const account = argv.account;
const signatureProvider = new JsSignatureProvider([argv.private_key]);

const BP_SEED_LIST = [
  'https://mainnet.meet.one',
  'https://eos.newdex.one',
  'https://node.betdice.one',
  'https://api.redpacketeos.com',
  'https://api.eoseoul.io',
  'https://eos.infstones.io',
  'https://bp.whaleex.com',
  'https://api.helloeos.com.cn',
  'https://bp.cryptolions.io',
  'https://api.eosn.io',
];

const APIs = BP_SEED_LIST.map(function(url) {
  const rpc = new JsonRpc(url, { fetch });
  const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });
  return api;
});

function get_random_api() {
  const index = Math.floor(Math.random() * APIs.length);
  return APIs[index];
}

/**
 * @param {string} account - EOS account, 12 letters.
 * @param {JsonRpc} rpc - JsonRpc.
 */
async function query_eos_balance(account, rpc) {
  const balance_info = await rpc.get_currency_balance('eosio.token', account, 'EOS');
  const balance = parseFloat(balance_info[0].split(' ')[0]);
  return balance;
}

/**
 * @param {string} account - EOS account, 12 letters.
 * @param {JsonRpc} rpc - JsonRpc.
 */
async function query_eidos_balance(account, rpc) {
  const balance_info = await rpc.get_currency_balance('eidosonecoin', account, 'EIDOS');
  const balance = parseFloat(balance_info[0].split(' ')[0]);
  return balance;
}

/**
 * @param {string} account - EOS account, 12 letters.
 * @param {JsonRpc} rpc - JsonRpc.
 */
async function get_cpu_rate(account, rpc) {
  const info = await rpc.get_account(account);
  return info.cpu_limit.used / info.cpu_limit.max;
}

/**
 * @param {number} cpu_rate - CPU ultilization rate.
 */
function format_cpu_rate(cpu_rate) {
  return (Math.floor(cpu_rate * 10000) / 100).toFixed(2);
}

/**
 * @param {string} account - EOS account, 12 letters.
 * @param {string} quantity - EOS quantity.
 * @returns {Object}
 */
function create_action(account, quantity = '0.0003') {
  assert(typeof quantity === 'string');

  return {
    account: 'eosio.token',
    name: 'transfer',
    authorization: [
      {
        actor: account,
        permission: 'active',
      },
    ],
    data: {
      from: account,
      to: 'eidosonecoin',
      quantity: quantity + ` EOS`,
      memo: '',
    },
  };
}

/**
 * @param {string} from - EOS account, 12 letters.
 * @param {string} to - EOS account, 12 letters.
 * @param {string} quantity - EIDOS quantity.
 * @param {string} memo - memo.
 */
async function send_eidos(from, to, quantity, memo = '') {
  assert(typeof quantity === 'string');
  const action = {
    account: 'eidosonecoin',
    name: 'transfer',
    authorization: [
      {
        actor: from,
        permission: 'active',
      },
    ],
    data: {
      from: from,
      to: to,
      quantity: quantity + ` EIDOS`,
      memo: memo,
    },
  };
  const api = get_random_api();
  return await run_transaction([action], api);
}

let prev_eidos_balance = 0;

async function donate() {
  const DONATION_RATIO = 0.05; // 5%
  const current_eidos_balance = await query_eidos_balance(account, get_random_api().rpc, { fetch });
  const increased = current_eidos_balance - prev_eidos_balance;
  if (increased > 50) {
    // It's impossible to mine over 50 EIDOS in 10 seconds, so
    // this must be a new deposit coming in
    return;
  }
  const eidos_to_donate = increased * DONATION_RATIO;
  if (eidos_to_donate < 0.0001) {
    // too small
    return;
  }
  const eidos_to_donate_str = eidos_to_donate.toFixed(4);
  await send_eidos(account, 'thinkmachine', eidos_to_donate_str, 'donated from ' + account);
  console.info('Donated ' + eidos_to_donate_str + ' EIDOS to the author.');
  prev_eidos_balance = await query_eidos_balance(account, get_random_api().rpc, {
    fetch,
  });
}

/**
 * @param {number} num_actions - Number of actions.
 * @param {string} account - EOS account, 12 letters.
 * @returns {Array<Object>}
 */
function create_actions(num_actions, account) {
  const quantities = Array(num_actions)
    .fill(0.0)
    .map(() => Math.ceil(Math.random() * 3) * 0.0001)
    .map(x => x.toFixed(4));
  return quantities.map(quantity => create_action(account, quantity));
}

let cpu_usage_exceeded = false;

/**
 * @param {Array<Object>} actions - Number of actions.
 * @param {Api} api - EOS account, 12 letters.
 * @returns {Promise<Object|undefined>}
 */
async function run_transaction(actions, api) {
  if (cpu_usage_exceeded) {
    cpu_usage_exceeded = false;
    return;
  }

  try {
    const result = await api.transact(
      {
        actions: actions,
      },
      {
        blocksBehind: 3,
        expireSeconds: 300,
      },
    );
    cpu_usage_exceeded = false;
    return result;
  } catch (e) {
    if (e instanceof RpcError) {
      console.log(JSON.stringify(e.json, null, 2));
      return;
    }

    if (
      e.toString().includes('is greater than the maximum billable CPU time for the transaction')
    ) {
      cpu_usage_exceeded = true;
      return;
    }
    console.error(e);
  }
}

const CPU_RATE_EXPECTATION = 0.95; // we expect to keep CPU rate at 95%
const CPU_RATE_RED = 0.99; // Stop mining if CPU rate > 99%
const NUM_ACTIONS_MIN = 2;
const NUM_ACTIONS_MAX = 256;
let num_actions = NUM_ACTIONS_MIN;
let cpu_rate_ema_slow = 0.0; // decay rate 0.999, recent 1000 data points
let cpu_rate_ema_fast = 0.0; // decay rate 0.5, recent 2 data points

function adjust_num_actions() {
  console.info(
    `cpu_rate_ema_fast=${format_cpu_rate(cpu_rate_ema_fast)}%, cpu_rate_ema_slow=${format_cpu_rate(
      cpu_rate_ema_slow,
    )}%, num_actions=${num_actions}`,
  );
  if (cpu_rate_ema_fast < CPU_RATE_EXPECTATION) {
    num_actions = Math.min(Math.ceil(num_actions * 2), NUM_ACTIONS_MAX);
    console.info('Doubled num_actions, now num_actions=' + num_actions.toFixed(0));
  } else if (cpu_rate_ema_fast > CPU_RATE_RED) {
    num_actions = Math.max(Math.ceil(num_actions / 2), NUM_ACTIONS_MIN);
    console.info('Halved num_actions, now num_actions=' + num_actions.toFixed(0));
    // cpu_rate_ema_fast is in range [CPU_RATE_EXPECTATION, CPU_RATE_RED]
  } else {
    // CPU rate changes over 0.5%
    if (Math.abs(cpu_rate_ema_fast - cpu_rate_ema_slow) / cpu_rate_ema_slow > 0.001) {
      if (cpu_rate_ema_fast > cpu_rate_ema_slow) {
        if (num_actions > NUM_ACTIONS_MIN) {
          num_actions -= 1;
          console.info('Decreased num_actions by 1, now num_actions=' + num_actions.toFixed(0));
        }
      } else {
        if (num_actions < NUM_ACTIONS_MAX) {
          num_actions += 1;
          console.info('Increased num_actions by 1, now num_actions=' + num_actions.toFixed(0));
        }
      }
    } else {
      // do nothing
      console.info('No need to adjust num_actions');
    }
  }
}

async function run() {
  try {
    const api = get_random_api();
    const cpu_rate = await get_cpu_rate(account, api.rpc);
    // update EMA
    cpu_rate_ema_fast = 0.5 * cpu_rate_ema_fast + 0.5 * cpu_rate;
    cpu_rate_ema_slow = 0.999 * cpu_rate_ema_slow + 0.001 * cpu_rate;
    if (
      cpu_rate > CPU_RATE_RED ||
      cpu_rate_ema_fast > CPU_RATE_RED ||
      cpu_rate_ema_slow > CPU_RATE_RED
    ) {
      // 1- (CPU Usage of one transaction / Total time rented)
      console.warn(chalk.red(`CPU is too busy, set num_actions = ${NUM_ACTIONS_MIN}.`));
      num_actions = NUM_ACTIONS_MIN;
    }

    const prev_balance = await query_eidos_balance(account, get_random_api().rpc, { fetch });

    const actions = create_actions(num_actions, account);
    await run_transaction(actions, api);

    const current_balance = await query_eidos_balance(account, get_random_api().rpc, { fetch });
    const increased = (current_balance - prev_balance).toFixed(4);
    if (increased != '0.0000' && !increased.startsWith('-')) {
      console.info(
        chalk.green('Mined ' + (current_balance - prev_balance).toFixed(4) + ' EIDOS !!!'),
      );
    }
  } catch (e) {
    console.error(e);
  }
}

(async () => {
  console.info(chalk.green(figlet.textSync('EIDOS  Miner')));

  const eos_balance = await query_eos_balance(account, get_random_api().rpc, {
    fetch,
  });
  console.info(`EOS balance: ${eos_balance}`);

  prev_eidos_balance = await query_eidos_balance(account, get_random_api().rpc, { fetch });
  console.info(`EIDOS balance: ${prev_eidos_balance}`);

  const cpu_rate = await get_cpu_rate(account, get_random_api().rpc);
  cpu_rate_ema_slow = cpu_rate;
  cpu_rate_ema_fast = cpu_rate;

  if (eos_balance < 0.001) {
    console.error(
      'Your EOS balance is too low, must be greater than 0.001 EOS, please deposit more EOS to your account.',
    );
    await new Promise(resolve => setTimeout(resolve, 60000)); // wait for 1 minute so that you have enough time to deposit EOS to your account
    return;
  }

  setInterval(run, 1000); // Mine EIDOS every second

  if (argv.num_actions <= 0) {
    setInterval(adjust_num_actions, 30000); // adjust num_actions every 60 seconds
  } else {
    num_actions = argv.num_actions;
  }

  if (argv.donation) {
    setInterval(donate, 30000); // 30 seconds
  }
})();
