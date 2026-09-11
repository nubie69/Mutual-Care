const path = require('node:path');
module.exports = {
  host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3000),
  publicDir: path.resolve(__dirname, '../public'),
  dataFile: path.resolve(process.env.DATA_FILE || path.join(__dirname, '../data/store.json')),
  production: process.env.NODE_ENV === 'production', sessionTtl: 604800000,
};
