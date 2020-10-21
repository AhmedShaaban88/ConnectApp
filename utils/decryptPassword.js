const bcrypt = require("bcryptjs");

async function decryptPassword(password, decryptedPassword) {
    return await bcrypt.compare(password, decryptedPassword);
}

module.exports = decryptPassword;