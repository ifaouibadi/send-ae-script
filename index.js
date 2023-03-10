const {
    AeSdkWallet,
    getHdWalletAccountFromSeed,
    MemoryAccount,
    Node,
    WALLET_TYPE,
    Tag,
    unpackTx,
} = require("@aeternity/aepp-sdk");
const WebSocketClient = require("websocket").client;

const SELECTED_NETWORK = process.argv[2];
const SENDER_SEED_PHRASE = process.argv[3];
const RECIPIENT_ADDRESS = process.argv[4];
let SENDER_ADDRESS = null;

const { mnemonicToSeed } = require("@aeternity/bip39");

const WS_URL = `wss://${SELECTED_NETWORK}.aeternity.io/mdw/websocket`;

const aeSdk = new AeSdkWallet({
    compilerUrl: "https://compiler.aepps.com",
    nodes: [
        {
            name: SELECTED_NETWORK,
            instance: new Node(`https://${SELECTED_NETWORK}.aeternity.io`),
        },
    ],
    id: "node",
    type: WALLET_TYPE.extension,
    name: "Wallet Node",
    // Hook for sdk registration
    onConnection(aeppId, params) {
        console.info("========================");
        console.info("onConnection ::", aeppId, params);
        console.info("========================");
    },
    onDisconnect(msg, client) {
        console.info("========================");
        console.info("onDisconnect ::", msg, client);
        console.info("========================");
    },
    onSubscription(aeppId) {
        console.info("========================");
        console.info("onSubscription ::", aeppId);
        console.info("========================");
    },
    onSign(aeppId, params) {
        console.info("========================");
        console.info("onSign ::", aeppId, params);
        console.info("========================");
    },
    onAskAccounts(aeppId) {
        console.info("========================");
        console.info("onAskAccounts ::", aeppId);
        console.info("========================");
    },
    onMessageSign(aeppId, params) {
        console.info("========================");
        console.info("onMessageSign ::", aeppId, params);
        console.info("========================");
    },
});

async function connectWallet() {
    const { publicKey, secretKey } = getHdWalletAccountFromSeed(
        mnemonicToSeed(SENDER_SEED_PHRASE),
        0
    );

    const account = new MemoryAccount({
        keypair: { publicKey: publicKey, secretKey },
    });
    await aeSdk.addAccount(account, { select: true });
    SENDER_ADDRESS = await account.address();
    console.info("========================");
    console.info("connected wallet ::", SENDER_ADDRESS);
    console.info("========================");
}

async function checkAddressBalance(_address) {
    const balance = await aeSdk.getBalance(_address);
    console.log(`Balance of ${_address}: ${balance} aettos`);
    return balance;
}

async function sendCoins() {
    const balance = await checkAddressBalance(SENDER_ADDRESS);
    console.log("RECIPIENT_ADDRESS ::", RECIPIENT_ADDRESS);
    if (balance > 0) {
        const spendTx = await aeSdk.buildTx(Tag.SpendTx, {
            senderId: SENDER_ADDRESS,
            recipientId: RECIPIENT_ADDRESS,
            amount: balance,
        });

        const {
            tx: { fee },
        } = unpackTx(spendTx, Tag.SpendTx);

        const finalAmount = balance - fee;

        if (finalAmount > 0) {
            const tx = await aeSdk.spend(finalAmount, RECIPIENT_ADDRESS);
            console.info("========================");
            console.info("final sent amount ::", finalAmount);
            console.info("Transaction mined ::", tx);
            console.info("========================");
        } else {
            console.info("========================");
            console.info("no enough balance ::", finalAmount);
            console.info("========================");
        }
    } else {
        console.info("========================");
        console.info("no balance ::", balance);
        console.info("========================");
    }

    await checkAddressBalance(RECIPIENT_ADDRESS);
}

// listen for new block generation
async function listenForNewBlocGeneration() {
    const wsClient = new WebSocketClient();

    wsClient.on("connectFailed", function (error) {
        console.log("Connect Error: " + error.toString());
    });

    wsClient.on("connect", function (connection) {
        console.log("WebSocket Client Connected");
        connection.on("error", function (error) {
            console.log("Connection Error: " + error.toString());
        });
        connection.on("close", function () {
            console.log("echo-protocol Connection Closed");
        });
        connection.on("message", function (message) {
            if (message.type === "utf8") {
                console.info("========================");
                console.info("New KeyBlocks Send sendCoins() ::");
                console.info("========================");

                sendCoins();
            }
        });

        connection.sendUTF('{"op":"Subscribe", "payload": "KeyBlocks"}');
    });

    wsClient.connect(WS_URL);
}
async function init() {
    await connectWallet();
    await listenForNewBlocGeneration();
}

init();
// keep script alive
(function keepProcessRunning() {
    setTimeout(keepProcessRunning, 1 << 30);
})();
