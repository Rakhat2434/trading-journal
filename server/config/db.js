const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');

const ensureJournalIndexes = async () => {
  const collection = mongoose.connection.collection('journalentries');

  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch (_error) {
    console.warn('Could not read journalentries indexes');
    return;
  }

  const hasLegacyDateUnique = indexes.some(
    (idx) => idx.name === 'date_1' && idx.unique === true
  );

  if (hasLegacyDateUnique) {
    try {
      await collection.dropIndex('date_1');
      console.log('Dropped legacy index journalentries.date_1');
    } catch (error) {
      if (!String(error.message || '').includes('index not found')) {
        throw error;
      }
    }
  }

  await JournalEntry.syncIndexes();
  console.log('JournalEntry indexes synced');
};

/**
 * Connect to MongoDB Atlas
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await ensureJournalIndexes();
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
