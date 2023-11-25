const jwt = require('jsonwebtoken');
require('dotenv').config();

const createAccessToken = async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res.send({ token });
}
module.exports = createAccessToken