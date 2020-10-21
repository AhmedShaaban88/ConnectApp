const bcrypt = require("bcryptjs");

async function encryptPassword(password) {
    const salt = await bcrypt.genSalt(10);
    if(!salt) return new Error(salt);
    const hashed = bcrypt.hash(password, salt);
    if(!hashed) return new Error(hashed);
    return hashed;
}

module.exports = encryptPassword;