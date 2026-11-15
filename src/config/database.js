const mongoose = require('mongoose');

async function connectDatabase() {
  if (!process.env.DATABASE) {
    throw new Error('DATABASE não está definida no arquivo .env');
  }

  await mongoose.connect(process.env.DATABASE, {
    dbName: process.env.DB_NAME
  });

  console.log(`MongoDB conectado ao banco ${mongoose.connection.name}`);
}

module.exports = connectDatabase;
