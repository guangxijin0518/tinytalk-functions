const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// check if there is a user
exports.checkPhoneNumberExists = functions.https.onCall(async (data, context) => {
  const userCount = await db.collection("users")
    .where("phoneNumber", "==", data.phoneNumber)
    .limit(1)
    .get()
    .then(value => {
      return value.docs.filter(u => {
        return !u.get('deletedAt');
      }).length;
    })
    .catch(e => {
      functions.logger.error("Error in checking PhoneNumberExists: ", e);
      return 0;
    });
  if (userCount > 0) {
    return true;
  } else {
    return false;
  }
});