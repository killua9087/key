/** Copyright (C) 2024. Licensed under the MIT License; You may not use this file except in compliance with the License.

@project_name : CLASH-WA-BOT

@author      : TOXIC-KICHUX

@credits     : @author

@note        : you can copy this code but at least give credits! ❤️🙏🏼 **/


"use strict"; // Load environment variables require('dotenv').config();

const { default: makeWASocket, DisconnectReason, makeInMemoryStore, useMultiFileAuthState, generateWAMessageFromContent, getAggregateVotesInPollMessage } = require('@whiskeysockets/baileys');

const figlet = require('figlet'); const fs = require('fs'); const moment = require('moment'); const logg = require('pino'); const config = require('./config.js'); const path = require('path'); const { serialize } = require('./lib/serialize.js');

// Format timestamp const time = moment().format('HH:mm:ss DD/MM/YYYY');

// Display ASCII title function title() { console.clear(); console.log( figlet.textSync('CLASH-WA-BOT', { font: 'Standard', horizontalLayout: 'default', verticalLayout: 'default', width: 80, whitespaceBreak: false }) ); }

// Watch and uncache modules on change function nocache(module, cb = () => {}) { console.log(Module ${module} is being watched for changes); fs.watchFile(require.resolve(module), async () => { await uncache(require.resolve(module)); cb(module); }); }

function uncache(module = '.') { return new Promise((resolve, reject) => { try { delete require.cache[require.resolve(module)]; resolve(); } catch (e) { reject(e); } }); }

// In-memory message store const store = makeInMemoryStore({ logger: logg().child({ level: 'fatal', stream: 'store' }) });

async function fanStart() { // Inner connect function for reconnection const connectToWhatsApp = async () => { // Multi-file auth state stored under session/<SESSION_ID>.json const SESSION_ID = process.env.SESSION_ID || 'session'; const { state, saveCreds } = await useMultiFileAuthState(session/${SESSION_ID}.json);

// Create socket with pairing code instead of QR
const conn = makeWASocket({
  printQRInTerminal: false,
  pairingCode: true,
  sessionId: SESSION_ID,
  logger: logg({ level: 'fatal' }),
  auth: state,
  browser: ['CLASH-WA-BOT', 'Safari', '3.0'],
  getMessage: async key => ({})
});

title();
store.bind(conn.ev);

// Persist store every 30 seconds
setInterval(() => {
  store.writeToFile('./lib/database/store.json');
}, 30 * 1000);

// Auto-reload serializing and message handler
require('./lib/serialize.js');
require('./lib/message.js');
nocache('./lib/serialize.js', module => console.log(`[ CLASH-WA-BOT ] ${time} ${module} updated!`));
nocache('./lib/message.js', module => console.log(`[ CLASH-WA-BOT ] ${time} ${module} updated!`));

// Database sync and plugin loading
console.log('Syncing Database...');
config.DATABASE.sync();
console.log('⬇️ Installing Plugins...');
fs.readdirSync(path.join(__dirname, 'components')).forEach(plugin => {
  if (plugin.endsWith('.js')) require(path.join(__dirname, 'components', plugin));
});
console.log('✅ Plugins Installed!');

// Connection update events
conn.ev.on('connection.update', update => {
  const { connection, lastDisconnect, pairingCode } = update;
  if (pairingCode) {
    console.log('🔑 Pair this code in your WhatsApp client:', pairingCode);
  }
  if (connection === 'open') console.log('✅ Bot connected successfully!');
  if (connection === 'close' && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
    console.log('⚠️ Disconnected, reconnecting...');
    connectToWhatsApp();
  }
});

// Save credentials
conn.ev.on('creds.update', saveCreds);

// Message upsert handler
conn.ev.on('messages.upsert', async ({ messages }) => {
  if (!messages) return;
  let msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  // Clean context info
  try {
    if (msg.message.messageContextInfo) delete msg.message.messageContextInfo;
  } catch {}

  msg = serialize(conn, msg);
  msg.isBaileys = msg.key.id.startsWith('BAE5');
  require('./lib/message.js')(conn, msg, messages, store);
});

// Poll update handler (optional)
conn.ev.on('messages.update', async chatUpdate => {
  for (const { key, update } of chatUpdate) {
    if (update.pollUpdates && key.fromMe) {
      const pollCreation = await store.loadMessage(key.remoteJid, key.id);
      if (!pollCreation) continue;
      const pollUpdate = await getAggregateVotesInPollMessage({ message: pollCreation.message, pollUpdates: update.pollUpdates });
      const toCmd = pollUpdate.find(v => v.voters.length)?.name;
      if (toCmd) conn.appendTextMessage(toCmd, chatUpdate);
    }
  }
});

// Reply helper
conn.reply = (from, content, msg) => conn.sendMessage(from, { text: content }, { quoted: msg });
conn.sendMessageFromContent = async (jid, message, options = {}) => {
  const prepare = await generateWAMessageFromContent(jid, message, options);
  await conn.relayMessage(jid, prepare.message, { messageId: prepare.key.id });
  return prepare;
};

return conn;

};

// Start connection connectToWhatsApp().catch(err => console.error('Connection error:', err)); }

fanStart();



