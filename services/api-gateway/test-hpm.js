const { createProxyMiddleware } = require('http-proxy-middleware');
try {
    const proxy = createProxyMiddleware('/api/public/products', { target: 'http://localhost:3002' });
    console.log('Success string');
} catch(e) {
    console.log('Error string:', e.message);
}
try {
    const proxy2 = createProxyMiddleware({ target: 'http://localhost:3002', pathFilter: '/api/public/products' });
    console.log('Success options.pathFilter');
} catch(e) {
    console.log('Error options.pathFilter:', e.message);
}
