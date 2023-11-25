const express = require('express');
const applyMiddleware = require('./middlewares');
const connectDB = require('./db/connectDB');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

const authenticationRoutes = require('./routes/authentication/index')


applyMiddleware(app);

app.use(authenticationRoutes);

app.get('/health', (req, res) => {
    res.send('MediCare is running')
})

// server will never crashed, show error message: start
app.all("*", (req, res, next) => {
    const error = new Error(`The requested url is invalid: [${req.url}]`)
    error.status = 404
    next(error)
})

app.use((err, req, res, next) => {
    // console.log('from line 25');
    res.status(err.status || 500).json({ message: err.message })
})
// server will never crashed end

const main = async () => {
    await connectDB()
    app.listen(port, () => {
        console.log(`Car Doctor Server is running on port ${port}`);
    });
}

main()