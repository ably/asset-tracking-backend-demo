const express = require('express');
const cors = require('cors');

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

const {
  fail,
  STATUS_CODE_INTERNAL_SERVER_ERROR,
  ABLY_API_KEY_CUSTOMERS,
  ABLY_API_KEY_RIDERS,
  HASHING_SECRET,
  USER_TYPE_ADMIN,
} = require('./common');

const {
  createOrder,
  assignOrder,
  deleteOrder,
  getGoogleMaps,
  getMapbox,
  getAbly,
  createUser,
} = require('./Handlers');

const {
  authorizeMiddleware,
  userIsOfTypeMiddleware,
} = require('./auth');

const SECRET_NAMES = [
  ABLY_API_KEY_RIDERS,
  ABLY_API_KEY_CUSTOMERS,
  HASHING_SECRET,
  'MAPBOX_ACCESS_TOKEN',
  'GOOGLE_MAPS_API_KEY',
];

const errorHandlingMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    // per: https://expressjs.com/en/guide/error-handling.html
    // We have to fallback to the default handler if headers have already been sent.
    next(err);
    return;
  }
  fail(res, STATUS_CODE_INTERNAL_SERVER_ERROR, err.message);
};

const app = express();

// Automatically allow cross-origin requests.
app.use(cors({ origin: true }));

// Add middleware to check credentials supplied via HTTP Basic auth.
app.use(authorizeMiddleware);

// TODO Understand why we _don't_ appear to need `app.use(express.json());`. This works without it.

// Our Express API.
app.get('/', (req, res) => res.send({ })); // returns empty object, as JSON, by way of auth confirmation

app.post('/orders/', createOrder);
app.put('/orders/:orderId', assignOrder);
app.delete('/orders/:orderId', deleteOrder);
app.get('/googleMaps', getGoogleMaps);
app.get('/mapbox', getMapbox);
app.get('/ably', getAbly);

app.post('/admin/user', createUser, userIsOfTypeMiddleware(USER_TYPE_ADMIN));

// Our custom error handler, which must be defined here, after other app.use() and routes calls.
app.use(errorHandlingMiddleware);

// Expose Express API as a single Cloud Function.
exports.deliveryService = functions
  .region('europe-west2')
  .runWith({ secrets: SECRET_NAMES })
  .https
  .onRequest(app);
