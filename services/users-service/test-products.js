const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env.docker' });
const token = jwt.sign({ sub: 1, correo_usu: 'test@test.com', id_rol: 1 }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
const https = require('https');
const options = {
    hostname: 'api.kiorapp.xyz',
    path: '/api/products/low-stock',
    method: 'GET',
    headers: {
        'Origin': 'https://www.kiorapp.xyz',
        'Authorization': `Bearer ${token}`
    }
};
const req = https.request(options, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
    res.setEncoding('utf8');
    res.on('data', (chunk) => console.log('BODY:', chunk));
});
req.on('error', (e) => console.error(e));
req.end();
