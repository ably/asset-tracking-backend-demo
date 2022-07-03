// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');

admin.initializeApp();

exports.firestore = admin.firestore();

exports.STATUS_CODE_CREATED = 201;
exports.STATUS_CODE_BAD_REQUEST = 400;
exports.STATUS_CODE_UNAUTHORIZED = 401;
exports.STATUS_CODE_NOT_FOUND = 404;
exports.STATUS_CODE_CONFLICT = 409;

exports.USER_TYPE_CUSTOMER = 'customer';
exports.USER_TYPE_RIDER = 'rider';

exports.isUserType = (value) => {
  switch (value) {
    case this.USER_TYPE_CUSTOMER:
    case this.USER_TYPE_RIDER:
      return true;

    default:
      return false;
  }
};
