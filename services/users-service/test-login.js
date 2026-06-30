const https = require('https');
const options = {
    hostname: 'api.kiorapp.xyz',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Origin': 'https://www.kiorapp.xyz',
        'Content-Type': 'application/json'
    }
};
const req = https.request(options, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('CORP:', res.headers['cross-origin-resource-policy']);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {});
});
req.write(JSON.stringify({ correo_usu: 'test@test.com', contrasena_usu: '123456' }));
req.on('error', (e) => console.error(e));
req.end();
