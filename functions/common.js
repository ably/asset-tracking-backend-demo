// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');

admin.initializeApp();

exports.firestore = admin.firestore();
