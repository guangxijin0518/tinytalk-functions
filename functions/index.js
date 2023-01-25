const functions = require('firebase-functions');

// The Firebase Admin SDK to access Cloud Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const auth = require('./src/auth');
const contacts = require("./src/contacts");
const users = require("./src/users");

// check if a user with a phone number exists
exports.checkPhoneNumberExists = auth.checkPhoneNumberExists;
// get contact group name
exports.getContactGroupName = contacts.getContactGroupName;
// background trigger - when phone contact number is added
exports.phoneContactCreated = contacts.phoneContactCreated;
// background trigger for user creation
exports.userCreated = users.userCreated;
// background trigger for user update
exports.userUpdated = users.userUpdated;
// background trigger for contact updaate - group change
exports.contactUpdated = contacts.contactUpdated;

// Take the text parameter passed to this HTTP endpoint and insert it into 
// Cloud Firestore under the path /messages/:documentId/original
exports.addMessage = functions.https.onRequest(async (req, res) => {
  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into Cloud Firestore using the Firebase Admin SDK.
  const writeResult = await admin.firestore().collection('messages').add({original: original});
  // Send back a message that we've succesfully written the message
  res.json({result: `Message with ID: ${writeResult.id} added.`});
});

// Listens for new messages added to /messages/:documentId/original and creates an
// uppercase version of the message to /messages/:documentId/uppercase
exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
  .onCreate((snap, context) => {
    // Grab the current value of what was written to Cloud Firestore.
    const original = snap.data().original;

    // Access the parameter `{documentId}` with `context.params`
    functions.logger.log('Uppercasing', context.params.documentId, original);
    
    const uppercase = original.toUpperCase();
    
    // You must return a Promise when performing asynchronous tasks inside a Functions such as
    // writing to Cloud Firestore.
    // Setting an 'uppercase' field in Cloud Firestore document returns a Promise.
    return snap.ref.set({uppercase}, {merge: true});
  });

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
