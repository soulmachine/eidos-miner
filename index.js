#!/usr/bin/env node

const fetch = require('node-fetch');  // node only; not needed in browsers
const sleep = require('sleep');  

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
const { isValidPrivate, privateToPublic } = require('eosjs-ecc');


const argv = require("yargs")
  .option("account", {
    description: "Your EOS account, must be 12 letters",
    type: "string"
  })
  .option("private_key", {
    description: "Your private key",
    type: "string"
  })
  .option("num_threads", {
    description: "The number of parallel threads",
    type: "number",
    default: 10
  })
  .option("donation", {
    description: "Donate 5% of mined EIDOS to the author",
    type: "boolean",
    default: true
  })
  .demandOption(['private_key', 'account'], 'Please provide both private_key and account')
  .check(function (argv) {
    if(isValidPrivate(argv.private_key)) {
      return true;
    } else {
      throw(new Error('Error: private_key is invalid!'));
    }
  })
  .argv;

const account = argv.account;
const publicKey = privateToPublic(argv.private_key);
const signatureProvider = new JsSignatureProvider([argv.private_key]);
// const rpc = new JsonRpc('https://mainnet.meet.one:443', { fetch });
// const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

const BP_SEED_LIST = [
  'https://mainnet.meet.one',
  'https://eos.newdex.one',
  'https://eospush.tokenpocket.pro',
  'https://node.betdice.one',
];

let prev_eidos_balance = 0;


async function get_producers() {
  const index = Math.floor(Math.random() * BP_SEED_LIST.length);
  const rpc = new JsonRpc(BP_SEED_LIST[index], { fetch });
  const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  });

  const response = await api.rpc.get_producers();
  const all_producers = response.rows;
  const active_producers = all_producers
    .filter(p => p.is_active)
    .filter(p => p.url.startsWith("https"))
    .map(p => p.url);

  let producers = [];
  for (const url of active_producers) {
    try {
      await rpc.get_currency_balance("eosio.token", account, "EOS");
      producers.push(url);
      console.error(url + " is OK")
    } catch (e) {
      console.error(url + " is BAD")
    }
  }
  return producers;
}

const APIs = BP_SEED_LIST.map(function (url) {
  const rpc = new JsonRpc(url, { fetch });
  const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  return api;
});

function getRandomAPI() {
  const index = Math.floor(Math.random() * APIs.length);
  return APIs[index];
}

async function queryEOSBalance(account, rpc) {
  const balance_info = await rpc.get_currency_balance('eosio.token', account, 'EOS');
  const balance = parseFloat(balance_info[0].split(' ')[0]);
  return balance;
}

async function queryEIDOSBalance(account, rpc) {
  const balance_info = await rpc.get_currency_balance('eidosonecoin', account, 'EIDOS');
  const balance = parseFloat(balance_info[0].split(' ')[0]);
  return balance;
}

async function getCPURate(account, rpc) {
  const info = await rpc.get_account(account);
  return info.cpu_limit.used / info.cpu_limit.max;
}

function createAction(account, quantity=0.0003) {
  quantity = quantity.toFixed(4);
  return {
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{
      actor: account,
      permission: 'active',
    }],
    data: {
      from: account,
      to: 'eidosonecoin',
      quantity: quantity + ` EOS`,
      memo: '',
    },
  };
}

async function sendEIDOS(from, to, quantity, memo='') {
  quantity = quantity.toFixed(4);
  const action = {
    account: 'eidosonecoin',
    name: 'transfer',
    authorization: [{
      actor: from,
      permission: 'active',
    }],
    data: {
      from: from,
      to: to,
      quantity: quantity + ` EIDOS`,
      memo: memo,
    },
  };
  const api = getRandomAPI();
  return await runTransaction([action], api);
}

async function donate() {
  const current_eidos_balance = await queryEIDOSBalance(
    account,
    getRandomAPI().rpc,
    { fetch }
  );
  const increased = current_eidos_balance - prev_eidos_balance;
  if (increased > 10) {
    const quantity = increased * 0.05;
    await sendEIDOS(account, "thinkmachine", quantity, 'donated from ' + account);
    console.info(
      `Newly mined ${increased.toFixed(4)} EIDOS, donated ${quantity.toFixed(
        4
      )} EIDOS to the author thinkmachine`
    );
    // prev_eidos_balance -= parseFloat(quantity.toFixed(4));
    prev_eidos_balance = await queryEIDOSBalance(account, getRandomAPI().rpc, {
      fetch
    });
  }
}

function createActions(numActions, account) {
  const quantities = Array(numActions).fill().map(() => (Math.ceil(Math.random() * 7)*0.0001))
  return quantities.map(quantity => createAction(account, quantity))
}

async function runTransaction(actions, api) {
  try {
    const result = await api.transact(
      {
        actions: actions
      },
      {
        blocksBehind: 3,
        expireSeconds: 300
      }
    );
    return result;
  } catch (e) {
    if (!e.toString().includes("duplicate transaction")) {
      console.log("\nCaught exception: " + e);
      if (e instanceof RpcError) {
        console.log(JSON.stringify(e.json, null, 2));
      } else {
        console.error(e);
      }
    }
  }
}

async function run() {
  const api = getRandomAPI();

  const cpuRate = await getCPURate(account, api.rpc);
  console.log(`CPU rate: ${cpuRate}`);
  if (cpuRate > 0.99) {
    console.warn('CPU is too busy, sleep for 15 seconds.')
    sleep.sleep(15);
    return;
  }

  actions = createActions(20, account);
  await runTransaction(actions, api);
  if (argv.donation) {
    await donate();
  }
}

async function main() {
  const eos_balance = await queryEOSBalance(account, getRandomAPI().rpc, { fetch });
  console.log(`EOS balance: ${eos_balance}`);

  const eidos_balance = await queryEIDOSBalance(account, getRandomAPI().rpc, { fetch });
  prev_eidos_balance = eidos_balance;
  console.log(`EIDOS balance: ${eidos_balance}`);

  if (eos_balance < 0.001) {
    console.error('Your EOS balance is too low, must be greater than 0.001 EOS, please deposit more EOS to your account.')
    sleep.sleep(60);  // wait for 1 minute so that you have time to deposit
    return;
  }

  while(true) {
    try {
      const promises = [];
      for (i = 0; i < argv.num_threads; i++) {
        promises.push(run());
      }
      await Promise.all(promises);
    } catch (e) {
      console.error(e);
    }
  }
}

(async () => {
  // let producers = await get_producers();
  // producers = producers.concat(BP_SEED_LIST);
  // console.log(producers);
  // APIs = producers.map(function (url) {
  //   const rpc = new JsonRpc(url, { fetch });
  //   const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  //   return api;
  // });

  await main();
})();
