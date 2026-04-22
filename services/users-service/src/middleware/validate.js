const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        const messages = error.details.map((d) => d.message).join(', ');
        return res.status(400).json({ error: messages });
    }

    next();
};

module.exports = validate;
