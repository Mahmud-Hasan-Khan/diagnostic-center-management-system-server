const express = require('express');
const createAccessToken = require('../../api/authentication/controller/createAccessToken');
const router = express.Router()


router.post('/jwt', createAccessToken);

module.exports = router;