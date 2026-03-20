const Datastore = require('@seald-io/nedb');
const path = require('path');

const initDB = () => {
    return {
        users: new Datastore({ filename: path.join(__dirname, 'data', 'users.db'), autoload: true }),
        posts: new Datastore({ filename: path.join(__dirname, 'data', 'posts.db'), autoload: true }),
        follows: new Datastore({ filename: path.join(__dirname, 'data', 'follows.db'), autoload: true }),
        notifications: new Datastore({ filename: path.join(__dirname, 'data', 'notifications.db'), autoload: true })
    };
};

module.exports = initDB;
