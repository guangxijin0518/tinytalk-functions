const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// get contact group name
exports.getContactGroupName = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return "";
  }
  const groupName = await db.doc("users/" + data.userId + "/groups/" + data.groupId)
    .get()
    .then(value => {
      return value.get("name") || "";
    })
    .catch(e => {
      functions.logger.error("Error in checking PhoneNumberExists: ", e);
      return "";
    });
  return groupName;
});

exports.getUserContactByPhoneNumber = async (userId, phoneNumber) => {
  const contactList = await db.collection('users/' + userId + "/contacts")
    .where('phoneNumber', '==', phoneNumber)
    .limit(1)
    .get()
    .then(value => {
      return value.docs.map(contact => {
        const data = contact.data();
        data.id = contact.ref.id;
        return data;
      });
    }).catch(e => {
      functions.logger.error('Error in getUserContactByPhoneNumber: ', e);
      return [];
    });
  if (contactList.length > 0) {
    return contactList[0];
  }
  return null;
};

exports.phoneContactCreated = functions.firestore
  .document('users/{userId}/phoneContactNumbers/{phoneContactNumberId}')
  .onCreate(async (snap, context) => {
    const phoneNumber = snap.data().phoneNumber;
    const userId = context.params.userId;
    const currentUser = (await snap.ref.parent.parent.get()).data();
    currentUser.id = userId;
    const userInfo = await require('./users').getUserByPhoneNumber(phoneNumber);
    if (userInfo) {
      const reverseContact = await this.getUserContactByPhoneNumber(userInfo.id, currentUser.phoneNumber);
      const contact = await this.getUserContactByPhoneNumber(userId, phoneNumber);
      if (contact) {
        await db.doc("users/" + userId + "/contacts/" + contact.id)
          .update({
            contactUserInfo: userInfo,
            reverseGroupId: reverseContact ? reverseContact.groupId : "",
          }).catch(e => {
            functions.logger.error("Error in phoneContactCreated: ", e);
          });
      } else {
        await db.collection("users/" + userId + "/contacts").add({
          groupId: "5",
          userId: userInfo.id,
          phoneNumber: phoneNumber,
          reverseGroupId: reverseContact ? reverseContact.groupId : "",
          contactUserInfo: userInfo
        }).catch(e => {
          functions.logger.error("Error in creating contact in phoneContactCreated: ", e);
        });
      }
    }
  });

exports.contactUpdated = functions.firestore
  .document("users/{userId}/contacts/{contactId}")
  .onUpdate(async (change, context) => {
    const beforeContact = change.before.data();
    const afterContact = change.after.data();
    // If groupId didn't change, do nothing
    if (beforeContact.groupId === afterContact.groupId) {
      return;
    }

    const userId = context.params.userId;
    const currentUserSnap = await change.after.ref.parent.parent.get();
    const currentUser = currentUserSnap.data();
    currentUser.id = userId;
    const contactUserId = afterContact.userId;
    const contact = await this.getUserContactByPhoneNumber(contactUserId, currentUser.phoneNumber);
    if (!contact) {
      return;
    }
    await db.doc("users/" + contactUserId + "/contacts/" + contact.id).update({
      reverseGroupId: afterContact.groupId
    }).catch(e => {
      functions.logger.error("Error in contactUpdated: ", e);
    });
  });