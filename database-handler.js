import mongoose from 'mongodb';
import dotenv from 'dotenv';
import * as plaidFunctions from './plaid-setup.js';
dotenv.config();

const MongoClient = mongoose.MongoClient;
const url = `mongodb+srv://dbUser:${process.env.DB_PASS}@cluster0.u5bz6.mongodb.net/userdb?retryWrites=true&w=majority`;

let _db;

export function connectToServer(callback) {
    MongoClient.connect(url, { useUnifiedTopology: true, useNewUrlParser: true, }, (err, client) => {
        if (err) console.log('MongoDb Error: ', err);
        _db = client.db('userdb');
        return callback(err);
    })
}

export async function createUserAccount(profile) {
    const data = {
        id: profile.id,
        name: profile.displayName,
        balance: 0,
        roundedBalance: 0,
        access_token: null,
        item_id: null
    };

    _db.collection('userdb').insertOne(data);
    return await data;
}

export async function getUserAccount(profile) {
    const query = {
        id: profile.id
    };

    let account = await _db.collection('userdb').find(query).toArray();
    return await account[0];
}

export async function getUserAccountByID(user_id) {
    const query = {
        id: user_id
    }

    let account = await _db.collection('userdb').find(query).toArray();
    return await account[0];
}

export async function updateUserLinkTokens(user_id, access_token, item_id) {
    const query = {
        id: user_id
    }
    const updatedValues = {
        $set: { access_token: access_token, item_id: item_id }
    }
    await _db.collection('userdb').updateOne(query, updatedValues, (err, res) => {
        if (err) throw err;
    })
}

export async function calculateBalance(user_id) {
    const transactions = await plaidFunctions.getTransactionData(user_id);
    let balance = 0;
    let roundedBalance = 0;
    if (transactions == null) return [0, 0];
    for (let transaction of transactions) {
        if (transaction.amount < 0) continue;
        balance = balance + transaction.amount;
        roundedBalance = roundedBalance + Math.ceil(transaction.amount);
    }

    const query = {
        id: user_id
    }
    const updatedValues = {
        $set: { balance: balance, roundedBalance: roundedBalance }
    }
    await _db.collection('userdb').updateOne(query, updatedValues, (err, res) => {
        if (err) throw err;
    })

    return [balance, roundedBalance];
}
