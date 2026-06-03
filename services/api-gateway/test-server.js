const http = require('http');
http.createServer((req, res) => {
    console.log('--- RECEIVED PROXY REQUEST ---');
    console.log(req.method, req.url);
    console.log(req.headers);
    res.end('Fake response');
}).listen(9999, '0.0.0.0', () => console.log('Listening on 9999'));
