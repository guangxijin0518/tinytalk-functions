const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// get user with a phone number
exports.getUserByPhoneNumber = async (phoneNumber) => {
  const userList = await db.collection('users').where('phoneNumber', '==', phoneNumber)
    .get()
    .then(value => {
      return value.docs.filter(user => !user.get('deletedAt'))
        .map(user => {
          const data = user.data();
          data.id = user.ref.id;
          return data;
        });
    }).catch(e => {
      functions.logger.error('Error in getUserByPhoneNumber: ', e);
      return [];
    });
  if (userList.length > 0) {
    return userList[0];
  }
  return null;
};

// get user by user id
exports.getUserById = async (userId) => {
  const user = await db.doc('users/' + userId).get()
    .then(value => {
      const data = value.data();
      data.id = value.ref.id;
      if (!data.deletedAt) {
        return data;
      } else {
        return null;
      }
    })
    .catch(e => {
      functions.logger.error("Error in getUserById: ", e);
      return null;
    });
  return user;
}

exports.getUsersByPhoneContact = async phoneNumber => {
  const userPromises = await db.collectionGroup("phoneContactNumbers")
    .where('phoneNumber', '==', phoneNumber)
    .get()
    .then(value => {
      return value.docs.map(pc => pc.ref.parent.parent.get())
    })
    .catch(e => {
      functions.logger.error("Error in getUsersByPhoneContact: ", e);
      return [];
    });

  if (userPromises.length === 0) {
    return [];
  }
  const userList = await Promise.all(userPromises).then(values => {
    return values.map(value => {
      const data = value.data();
      data.id = value.ref.id;
      return data;
    });
  }).catch(e => {
    functions.logger.error("Error in getUsersByPhoneContact: ", e);
    return [];
  });

  if (userList.length === 0) {
    return [];
  }

  return userList.filter((user, index) =>
    user && !user.deletedAt && userList.findIndex(element => element.id === user.id) === index
  );
};

// background trigger for user creation
exports.userCreated = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const phoneNumber = snap.data().phoneNumber;
    const userId = context.params.userId;
    const currentUser = snap.data();
    currentUser.id = userId;
    const usersWithNumbers = await this.getUsersByPhoneContact(phoneNumber);
    if (usersWithNumbers.length === 0) {
      return;
    }

    const promises = usersWithNumbers.map(user => {
      return new Promise(resolve => {
        db.collection("users/" + user.id + "/contacts").add({
          groupId: "5",
          userId: userId,
          phoneNumber: phoneNumber,
          reverseGroupId: "",
          contactUserInfo: currentUser
        })
        .then(value => resolve(value))
        .catch(e => {
          functions.logger.error("Error in creating contact in phoneContactCreated: ", e);
          resolve(null);
        });
      });
    });

    await Promise.all(promises).catch(e => {
      functions.logger.error("Error in userCreated: ", e);
    });
  });

// background trigger for user creation
exports.userUpdated = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const phoneNumber = change.after.data().phoneNumber;
    const userId = context.params.userId;
    const currentUser = change.after.data();
    currentUser.id = userId;
    const contactRefs = await db.collectionGroup("contacts").where('phoneNumber', '==', phoneNumber)
      .get().then(value => value.docs.map(doc => doc.ref))
      .catch(e => {
        functions.logger.error("Error in userUpdated: ", e);
        return [];
      });
    if (contactRefs.length === 0) {
      return;
    }

    const promises = contactRefs.map(ref => {
      return new Promise(resolve => {
        if (currentUser.deletedAt) {
          ref.delete().then(value => resolve(value))
            .catch(e => {
              functions.logger.error("Error in userUpdated -> deleteContact: ", e);
              resolve(null);
            });
        } else {
          ref.update({ contactUserInfo: currentUser })
            .then(value => resolve(value))
            .catch(e => {
              functions.logger.error("Error in userUpdated -> updateContact: ", e);
              resolve(null);
            });
        }
      });
    });

    await Promise.all(promises).catch(e => {
      functions.logger.error("Error in userUpdated: ", e);
    });
  });