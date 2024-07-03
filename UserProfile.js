const { Schema, model } = require('mongoose');

const userProfileSchema = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
    },
     balance: {
        type: Number,
        default: 0,
    },
    lastDailyCollected: {
        type: Date,
    },
    lastWin: {
        type: Date,
    },
    lastBlackjack: {
        type: Date,
    },
    lastCoinGamble: {
        type: Date,
    },
    lastBlackjackGame: {
        type: Date,
    },
    lastInterestApplied: {
        type: Date,
        default: Date.now,
    },
    inventory: {
        woodStack: { type: Number, default: 0 },
        leafStack: { type: Number, default: 0 },
        coalStack: { type: Number, default: 0 },
        stoneStack: { type: Number, default: 0 },
        hideStack: { type: Number, default: 0 },
        rawIronStack: { type: Number, default: 0 },
        rawBluesteelStack: { type: Number, default: 0 },
        ironBarStack: { type: Number, default: 0 },
        steelBarStack: { type: Number, default: 0 },
        darksteelBarStack: { type: Number, default: 0 },
        bluesteelBarStack: { type: Number, default: 0 },
        ironNailStack: { type: Number, default: 0 },
        steelNailStack: { type: Number, default: 0 },
        bluesteelNailStack: { type: Number, default: 0 },
        heartyStewStack: { type: Number, default: 0 },
        whaleStack: { type: Number, default: 0 },
        spicyRibMealStack: { type: Number, default: 0 },
        cabbageStack: { type: Number, default: 0 },
        carrotsStack: { type: Number, default: 0 },
        peppersStack: { type: Number, default: 0 },
        wheatStack: { type: Number, default: 0 },
        bricksStack: { type: Number, default: 0 },
        shinglesStack: { type: Number, default: 0 },
        arrowsStack: { type: Number, default: 0 },
    },
}, { timestamps: true });

module.exports = model('UserProfile', userProfileSchema);
