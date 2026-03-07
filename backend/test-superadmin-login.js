const axios = require('axios');

async function testLogin() {
    try {
        console.log('Sending login request to http://127.0.0.1:3001/api/auth/login...');
        const response = await axios.post('http://127.0.0.1:3001/api/auth/login', {
            email: 'admin@example.com',
            password: 'change_this_password'
        });
        console.log('Response status:', response.status);
        console.log('Response data:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error response status:', error.response.status);
            console.log('Error response data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
            if (error.code) console.error('Error code:', error.code);
        }
    }
}

testLogin();
