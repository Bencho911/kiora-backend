import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import validate from '../middleware/validate';
import { loginSchema, registerSchema, updateUserSchema, updateRoleSchema, forgotPasswordSchema, verifyResetCodeSchema, resetPasswordSchema, changePasswordSchema } from '../validators/authValidators';
import * as authController from '../controllers/authController';

const router = express.Router();

const isTestEnv = process.env.NODE_ENV === 'test';
const createLimiter = (windowMs: number, max: number, message: string) =>
    rateLimit({
        windowMs,
        max: isTestEnv ? 10000 : max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
    });

const loginLimiter = createLimiter(
    15 * 60 * 1000,
    10,
    'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
);
const forgotPasswordLimiter = createLimiter(
    15 * 60 * 1000,
    5,
    'Demasiadas solicitudes de recuperación. Intenta de nuevo en 15 minutos.'
);
const verifyResetCodeLimiter = createLimiter(
    10 * 60 * 1000,
    10,
    'Demasiados intentos de verificación de código. Intenta de nuevo en 10 minutos.'
);
const resetPasswordLimiter = createLimiter(
    10 * 60 * 1000,
    5,
    'Demasiados intentos de restablecimiento. Intenta de nuevo en 10 minutos.'
);

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/register', verifyToken, isAdmin, validate(registerSchema), authController.register);
router.post('/refresh', authController.refresh);
router.post('/logout', verifyToken, authController.logout);
router.get('/users', verifyToken, isAdmin, authController.getUsers);

const internalOnly = (req: Request, res: Response, next: NextFunction): any => {
    const internalSecret = (req.headers['x-internal-secret'] as string);
    if (internalSecret === (process.env.INTERNAL_SECRET || 'kiora_internal_2024')) {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden internal route' });
};

router.get('/users/admins', internalOnly, authController.getAdminEmails);
router.patch('/users/:id/unlock', verifyToken, isAdmin, authController.unlockUser);
router.patch('/users/:id/block', verifyToken, isAdmin, authController.blockUser);
router.get('/me', verifyToken, authController.getMe);
router.patch('/users/:id/role', verifyToken, isAdmin, validate(updateRoleSchema), authController.updateRole);
router.patch('/users/:id', verifyToken, isAdmin, validate(updateUserSchema), authController.updateUser);
router.delete('/users/:id', verifyToken, isAdmin, authController.deleteUser);
router.patch('/users/:id/password', verifyToken, isAdmin, authController.adminResetPassword);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-reset-code', verifyResetCodeLimiter, validate(verifyResetCodeSchema), authController.verifyResetCode);
router.patch('/me/password', verifyToken, validate(changePasswordSchema), authController.changePassword);

export default router;
