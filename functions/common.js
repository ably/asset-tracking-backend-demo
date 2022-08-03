// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');

admin.initializeApp();

exports.firestore = admin.firestore();

exports.STATUS_CODE_OK = 200;
exports.STATUS_CODE_CREATED = 201;
exports.STATUS_CODE_BAD_REQUEST = 400;
exports.STATUS_CODE_UNAUTHORIZED = 401;
exports.STATUS_CODE_NOT_FOUND = 404;
exports.STATUS_CODE_CONFLICT = 409;
exports.STATUS_CODE_INTERNAL_SERVER_ERROR = 500;

exports.USER_TYPE_CUSTOMER = 'customer';
exports.USER_TYPE_RIDER = 'rider';
exports.USER_TYPE_ADMIN = 'admin';

exports.ABLY_API_KEY_RIDERS = 'ABLY_API_KEY_RIDERS';
exports.ABLY_API_KEY_CUSTOMERS = 'ABLY_API_KEY_CUSTOMERS';

exports.INITIAL_USER_PASSWORD = 'INITIAL_USER_PASSWORD';

exports.isUserType = (value) => {
  switch (value) {
    case this.USER_TYPE_CUSTOMER:
    case this.USER_TYPE_RIDER:
    case this.USER_TYPE_ADMIN:
      return true;

    default:
      return false;
  }
};

exports.fail = (res, statusCode, message) => {
  res
    .status(statusCode)
    .send({ error: { message } });
};
