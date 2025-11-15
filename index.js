require("./settings");
const fs = require('fs');
const chalk = require("chalk");
const {
  handleMessages,
  handleGroupParticipantUpdate,
  handleStatus
} = require("./main");
const PhoneNumber = require('awesome-phonenumber');
const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid
} = require('./lib/exif');
const {
  smsg,
  isUrl,
  generateMessageTag,
  getBuffer,
  getSizeMedia,
  fetch,
  await,
  sleep,
  reSize
} = require('./lib/myfunc');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  downloadContentFromMessage,
  jidDecode,
  proto,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const {
  rmSync,
  existsSync
} = require('fs');
const store = require("./lib/lightweight_store");
store.readFromFile();
const settings = require("./settings");
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 0x2710);
setInterval(() => {
  if (global.gc) {
    global.gc();
    console.log("🧹 Garbage collection completed");
  }
}, 0xea60);
setInterval(() => {
  const memoryUsage = process.memoryUsage().rss / 0x400 / 0x400;
  if (memoryUsage > 0x190) {
    console.log("⚠️ RAM too high (>400MB), restarting bot...");
    process.exit(0x1);
  }
}, 0x7530);
let owner = JSON.parse(fs.readFileSync("./data/owner.json"));
global.botname = "HOWLER BOT";
global.themeemoji = '•';
const pairingCode = true || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");
const rl = process.stdin.isTTY ? readline.createInterface({
  'input': process.stdin,
  'output': process.stdout
}) : null;
const question = promptText => {
  return rl ? new Promise(resolve => rl.question(promptText, resolve)) : Promise.resolve(settings.ownerNumber || "923414812972");
};
async function startXeonBotInc() {
  let {
    version: baileysVersion,
    isLatest: isLatestVersion
  } = await fetchLatestBaileysVersion();
  const {
    state: authState,
    saveCreds: saveCredentials
  } = await useMultiFileAuthState("./session");
  const msgRetryCache = new NodeCache();
  const sock = makeWASocket({
    'version': baileysVersion,
    'logger': pino({
      'level': 'silent'
    }),
    'printQRInTerminal': !pairingCode,
    'browser': ["Ubuntu", "Chrome", "20.0.04"],
    'auth': {
      'creds': authState.creds,
      'keys': makeCacheableSignalKeyStore(authState.keys, pino({
        'level': "fatal"
      }).child({
        'level': "fatal"
      }))
    },
    'markOnlineOnConnect': true,
    'generateHighQualityLinkPreview': true,
    'syncFullHistory': true,
    'getMessage': async messageKey => {
      let jid = jidNormalizedUser(messageKey.remoteJid);
      let msg = await store.loadMessage(jid, messageKey.id);
      return msg?.["message"] || '';
    },
    'msgRetryCounterCache': msgRetryCache,
    'defaultQueryTimeoutMs': undefined
  });
  store.bind(sock.ev);
  sock.ev.on('messages.upsert', async chatUpdate => {
    try {
      const message = chatUpdate.messages[0x0];
      if (!message.message) {
        return;
      }
      message.message = Object.keys(message.message)[0x0] === "ephemeralMessage" ? message.message.ephemeralMessage.message : message.message;
      if (message.key && message.key.remoteJid === "status@broadcast") {
        await handleStatus(sock, chatUpdate);
        return;
      }
      if (!sock["public"] && !message.key.fromMe && chatUpdate.type === "notify") {
        return;
      }
      if (message.key.id.startsWith("BAE5") && message.key.id.length === 0x10) {
        return;
      }
      if (sock?.["msgRetryCounterCache"]) {
        sock.msgRetryCounterCache.clear();
      }
      try {
        await handleMessages(sock, chatUpdate, true);
      } catch (error) {
        console.error("Error in handleMessages:", error);
        if (message.key && message.key.remoteJid) {
          await sock.sendMessage(message.key.remoteJid, {
            'text': "❌ An error occurred while processing your message.",
            'contextInfo': {
              'forwardingScore': 0x1,
              'isForwarded': true,
              'forwardedNewsletterMessageInfo': {
                'newsletterJid': "120363417002426604@newsletter",
                'newsletterName': "𝐍𝐈𝐆𝐇𝐓-𝐇𝐎𝐖𝐋𝐄𝐑....!!™",
                'serverMessageId': -0x1
              }
            }
          })["catch"](console.error);
        }
      }
    } catch (error) {
      console.error("Error in messages.upsert:", error);
    }
  });
  sock.decodeJid = jid => {
    if (!jid) {
      return jid;
    }
    if (/:\d+@/gi.test(jid)) {
      let decoded = jidDecode(jid) || {};
      return decoded.user && decoded.server && decoded.user + '@' + decoded.server || jid;
    } else {
      return jid;
    }
  };
  sock.ev.on('contacts.update', contactsUpdate => {
    for (let contact of contactsUpdate) {
      let jid = sock.decodeJid(contact.id);
      if (store && store.contacts) {
        store.contacts[jid] = {
          'id': jid,
          'name': contact.notify
        };
      }
    }
  });
  sock.getName = (jid, withoutContact = false) => {
    id = sock.decodeJid(jid);
    withoutContact = sock.withoutContact || withoutContact;
    let contact;
    if (id.endsWith("@g.us")) {
      return new Promise(async resolve => {
        contact = store.contacts[id] || {};
        if (!(contact.name || contact.subject)) {
          contact = sock.groupMetadata(id) || {};
        }
        resolve(contact.name || contact.subject || PhoneNumber('+' + id.replace("@s.whatsapp.net", '')).getNumber("international"));
      });
    } else {
      contact = id === "0@s.whatsapp.net" ? {
        'id': id,
        'name': "WhatsApp"
      } : id === sock.decodeJid(sock.user.id) ? sock.user : store.contacts[id] || {};
    }
    return (withoutContact ? '' : contact.name) || contact.subject || contact.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
  };
  sock["public"] = true;
  sock.serializeM = message => smsg(sock, message, store);
  if (pairingCode && !sock.authState.creds.registered) {
    if (useMobile) {
      throw new Error("Cannot use pairing code with mobile api");
    }
    let phoneNumber;
    if (!!global.phoneNumber) {
      phoneNumber = global.phoneNumber;
    } else {
      phoneNumber = await question(chalk.bgBlack(chalk.greenBright("Please type your WhatsApp number To connect 𓆩𓆪𝖧𝖮𝖶𝖫𝖤𝖱-𝖡𝖮𝖳💀\nFormat: 92XXXXXXXXX (without + or spaces) : ")));
    }
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    const PhoneNumberValidator = require("awesome-phonenumber");
    if (!PhoneNumberValidator('+' + phoneNumber).isValid()) {
      console.log(chalk.red("Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, etc.) without + or spaces."));
      process.exit(0x1);
    }
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.["match"](/.{1,4}/g)?.["join"]('-') || code;
        console.log(chalk.black(chalk.bgGreen("Your Pairing Code : ")), chalk.black(chalk.white(code)));
        console.log(chalk.yellow("\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap \"Link a Device\"\n4. Enter the code shown above"));
      } catch (error) {
        console.error("Error requesting pairing code:", error);
        console.log(chalk.red("Failed to get pairing code. Please check your phone number and try again."));
      }
    }, 0xbb8);
  }
  sock.ev.on("connection.update", async connectionUpdate => {
    const {
      connection: connectionState,
      lastDisconnect: lastDisconnectInfo
    } = connectionUpdate;
    if (connectionState == "open") {
      console.log(chalk.magenta(" "));
      console.log(chalk.yellow("🌿Connected to => " + JSON.stringify(sock.user, null, 0x2)));
      const ownerJid = sock.user.id.split(':')[0x0] + "@s.whatsapp.net";
      await sock.sendMessage(ownerJid, {
        'text': "🤖HOWLER Bot Connected Successfully!\n\n⏰ Time: " + new Date().toLocaleString() + "\n✅ Status: Online and Ready!\n                \n✅Make sure to join below channel",
        'contextInfo': {
          'forwardingScore': 0x1,
          'isForwarded': true,
          'forwardedNewsletterMessageInfo': {
            'newsletterJid': '120363417002426604@newsletter',
            'newsletterName': '𝐍𝐈𝐆𝐇𝐓-𝐇𝐎𝐖𝐋𝐄𝐑....!!™',
            'serverMessageId': -0x1
          }
        }
      });
      await delay(0x7cf);
      console.log(chalk.yellow("\n\n                  " + chalk.bold.blue("[𝐍𝐈𝐆𝐇𝐓-𝐇𝐎𝐖𝐋𝐄𝐑....!!™]") + "\n\n"));
      console.log(chalk.cyan("< ================================================== >"));
      console.log(chalk.magenta("\n" + (global.themeemoji || '•') + " YT CHANNEL: https://youtube.com/@team_night-howler"));
      console.log(chalk.magenta((global.themeemoji || '•') + " TELEGRAM : @NIGHTHOWLERARMY"));
      console.log(chalk.magenta((global.themeemoji || '•') + " WA NUMBER: " + owner));
      console.log(chalk.magenta((global.themeemoji || '•') + " CREDIT: 𝐇𝐎𝐖𝐋𝐄𝐑....!!™"));
      console.log(chalk.green((global.themeemoji || '•') + " 🤖HOWLER Bot Connected Successfully! ✅"));
      console.log(chalk.blue("Bot Version: " + settings.version));
    }
    if (connectionState === "close") {
      const statusCode = lastDisconnectInfo?.['error']?.["output"]?.['statusCode'];
      if (statusCode === DisconnectReason.loggedOut || statusCode === 0x191) {
        try {
          rmSync("./session", {
            'recursive': true,
            'force': true
          });
        } catch {}
        console.log(chalk.red("Session logged out. Please re-authenticate."));
        startXeonBotInc();
      } else {
        startXeonBotInc();
      }
    }
  });
  const blockedCallers = new Set();
  sock.ev.on("call", async callEvents => {
    try {
      const {
        readState: getAnticallState
      } = require('./commands/anticall');
      const anticallState = getAnticallState();
      if (!anticallState.enabled) {
        return;
      }
      for (const callEvent of callEvents) {
        const callerId = callEvent.from || callEvent.peerJid || callEvent.chatId;
        if (!callerId) {
          continue;
        }
        try {
          try {
            if (typeof sock.rejectCall === "function" && callEvent.id) {
              await sock.rejectCall(callEvent.id, callerId);
            } else if (typeof sock.sendCallOfferAck === 'function' && callEvent.id) {
              await sock.sendCallOfferAck(callEvent.id, callerId, "reject");
            }
          } catch {}
          if (!blockedCallers.has(callerId)) {
            blockedCallers.add(callerId);
            setTimeout(() => blockedCallers["delete"](callerId), 0xea60);
            await sock.sendMessage(callerId, {
              'text': "📵 Anticall is enabled. Your call was rejected and you will be blocked."
            });
          }
        } catch {}
        setTimeout(async () => {
          try {
            await sock.updateBlockStatus(callerId, 'block');
          } catch {}
        }, 0x320);
      }
    } catch (error) {}
  });
  sock.ev.on("creds.update", saveCredentials);
  sock.ev.on("group-participants.update", async participantsUpdate => {
    await handleGroupParticipantUpdate(sock, participantsUpdate);
  });
  sock.ev.on("messages.upsert", async chatUpdate => {
    if (chatUpdate.messages[0x0].key && chatUpdate.messages[0x0].key.remoteJid === "status@broadcast") {
      await handleStatus(sock, chatUpdate);
    }
  });
  sock.ev.on("status.update", async statusUpdate => {
    await handleStatus(sock, statusUpdate);
  });
  sock.ev.on('messages.reaction', async reactionUpdate => {
    await handleStatus(sock, reactionUpdate);
  });
  return sock;
}
startXeonBotInc()["catch"](error => {
  console.error("Fatal error:", error);
  process.exit(0x1);
});
process.on('uncaughtException', error => {
  console.error("Uncaught Exception:", error);
});
process.on("unhandledRejection", error => {
  console.error("Unhandled Rejection:", error);
});
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright("Update " + __filename));
  delete require.cache[file];
  require(file);
});
