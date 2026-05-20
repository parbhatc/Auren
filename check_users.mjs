import Database from './server/src/config/Database.js';

async function checkUsers() {
  try {
    await Database.initialize();
    const users = await Database.query('SELECT id, username, email FROM users');
    console.log('Users in database:');
    users.forEach(user => {
      console.log(`- ${user.username} (${user.email})`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    Database.close();
  }
}

checkUsers();
