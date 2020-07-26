import express from 'express';
import passport from 'passport';
import cookieSession from 'cookie-session';
import passportSetup from './passport-setup.js';
import dotenv from 'dotenv';
import * as plaidFunctions from './plaid-setup.js';
import * as databaseFunctions from './database-handler.js';

dotenv.config();
passportSetup();

// MONGODB SERVER CONNECTION
databaseFunctions.connectToServer((err) => {
    if (err) console.log(err);
    console.log('Connected to MongoDb');
})

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// For an actual app you should configure this with an experation time, better keys, proxy and secure
app.use(cookieSession({
    name: 'acornclone-session',
    keys: ['key1', 'key2']
}));

// Initializes passport and passport sessions
app.use(passport.initialize());
app.use(passport.session());

// Auth middleware that checks if the user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.sendStatus(401);
    }
}

// Example protected and unprotected routes
app.get('/home', isLoggedIn, async (req, res) => {
    console.log(req.user.displayName);
    const transactions = await plaidFunctions.getTransactionData(req.user.id);
    const balances = await databaseFunctions.calculateBalance(req.user.id);

    let difference = balances[1] - balances[0];
    difference = Math.floor(difference * 100) / 100;

    const data = {
        name: req.user.displayName,
        transactions: transactions,
        balance: balances[0],
        roundedBalance: balances[1],
        difference: difference
    }

    res.render('home.ejs', { data: data });
});

app.get('/failed', (req, res) => res.send('You Failed to log in!'));

// GET /google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve
//   redirecting the user to google.com.  After authorization, Google
//   will redirect the user back to this application at /auth/google/callback
app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// GET /google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/failed' }),
    function (req, res) {
        res.redirect('/home');
    });

app.get('/logout', (req, res) => {
    req.session = null;
    req.logout();
    res.redirect('/');
})

app.get('/login', (req, res) => {
    res.render('login.ejs');
});

// PLAID LINK TOKEN
app.post('/create_link_token', isLoggedIn, async (req, res, next) => {
    plaidFunctions.createLinkToken(req, res);
});

// ACCEPT PUBLIC TOKEN AND EXCHANGE FOR ACCESS TOKEN
app.post('/get_access_token', isLoggedIn, async (req, res, next) => {
    await plaidFunctions.getAccessToken(req, res);
    console.log('redirecting');
    res.redirect(req.originalUrl);
});

// DEFAULT LANDING PAGE
app.get('/', (req, res) => res.send('./index.html'));

// LISTEN TO PORT
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}/`));