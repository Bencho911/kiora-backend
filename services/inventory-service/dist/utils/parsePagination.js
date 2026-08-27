'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
    const page = Math.max(1, parseInt(query.page || 1, 10));
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit || defaultLimit, 10)));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};
exports.default = parsePagination;
