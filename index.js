require('dotenv/config');
const { Client, IntentsBitField } = require('discord.js');
const { CommandHandler } = require('djs-commander');
const mongoose = require('mongoose');
const path = require('path');

// Initialize the Discord client with necessary intents
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions,
    ],
});

// Initialize the command handler with the path to commands and events
new CommandHandler({
    client,
    eventsPath: path.join(__dirname, 'events'),
    commandsPath: path.join(__dirname, 'commands'),
});

// Connect to MongoDB and handle potential errors
(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to database.');
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }

    // Log in to Discord and handle potential errors
    try {
        await client.login(process.env.TOKEN);
        console.log('Logged in to Discord.');
    } catch (error) {
        console.error('Error logging in to Discord:', error);
    }
})();

// Event listener for logging unhandled promise rejections (optional but recommended)
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
