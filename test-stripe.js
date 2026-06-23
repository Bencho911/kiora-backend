const stripe = require('stripe')(require('dotenv').config({path: './services/orders-service/.env.local'}).parsed.STRIPE_SECRET_KEY);
(async () => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'cop',
                    product_data: { name: 'Test' },
                    unit_amount: 1000,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'http://localhost/success',
            cancel_url: 'http://localhost/cancel',
        });
        console.log("SUCCESS:", session.url);
    } catch(e) {
        console.error("ERROR:", e.message);
    }
})();
