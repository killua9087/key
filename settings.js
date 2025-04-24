// settings.js
require('dotenv').config();

module.exports = {
  packname: 'Knight',
  author: 'Bot',
  botName: 'Knight Bot',
  botOwner: 'سمكة المطور',
  ownerNumber: process.env.OWNER_NUMBER,    // يُقرأ من .env
  commandMode: 'public',
  description: 'This is a bot for managing group commands and automating tasks.',
  version: '1.0.0',
};