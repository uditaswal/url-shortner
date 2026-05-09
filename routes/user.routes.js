import express from "express";
import {
    handleUserLogin,
    handleUserLogout,
    handleUserSignup
} from "../controller/user.controller.js";
import { authRateLimiter } from "../middleware/rateLimiter.middleware.js";

function asJson(req, _res, next) {
    req.responseMode = "json";
    next();
}

function asHtml(req, _res, next) {
    req.responseMode = "html";
    next();
}

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User signup, login, and logout APIs.
 *
 * components:
 *   schemas:
 *     SignupInput:
 *       type: object
 *       required:
 *         - name
 *         - username
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           example: Test User
 *         username:
 *           type: string
 *           example: test_user
 *         password:
 *           type: string
 *           example: StrongPass1
 *     LoginInput:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *         password:
 *           type: string
 *     AuthUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         username:
 *           type: string
 *         isAdmin:
 *           type: boolean
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/AuthUser'
 */
const apiUserRouter = express.Router();
const uiUserRouter = express.Router();
const legacyUserRouter = express.Router();

apiUserRouter.use(asJson);
uiUserRouter.use(asHtml);
legacyUserRouter.use(asHtml);

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Create a user account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupInput'
 *     responses:
 *       201:
 *         description: User created and authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       409:
 *         description: Username already taken.
 *
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Log a user in.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid username or password.
 *
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Log the current user out.
 *     responses:
 *       200:
 *         description: Logout successful.
 */
apiUserRouter.post("/auth/signup", authRateLimiter, handleUserSignup);
apiUserRouter.post("/auth/login", authRateLimiter, handleUserLogin);
apiUserRouter.post("/auth/logout", handleUserLogout);

uiUserRouter.post("/auth/signup", authRateLimiter, handleUserSignup);
uiUserRouter.post("/auth/login", authRateLimiter, handleUserLogin);
uiUserRouter.post("/auth/logout", handleUserLogout);

legacyUserRouter.post("/user", authRateLimiter, handleUserSignup);
legacyUserRouter.post("/user/login", authRateLimiter, handleUserLogin);
legacyUserRouter.post("/user/logout", handleUserLogout);
legacyUserRouter.get("/user/signup", (req, res) => res.render("signup"));

export { apiUserRouter, uiUserRouter, legacyUserRouter };
