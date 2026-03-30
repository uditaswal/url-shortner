import mongoose, { mongo } from 'mongoose';

export default async function connectDB(dbURL, dbAppName) {

    return await mongoose.connect(`${dbURL}${dbAppName}`)
        .then(() => console.log(`mongodb connected on ${dbURL}${dbAppName} at ${new Date().toString()}`))
        .catch((err) => console.log(`Error while connecting to mongodb on ${dbURL}${dbAppName}`, err))
};