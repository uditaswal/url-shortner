import express from 'express';
import { handleUserSignup, handleUserLogin, handleUserLogout } from '../controller/user.controller.js'
import { authRateLimiter } from '../middleware/rateLimiter.middleware.js';
const userRouter = express.Router();

userRouter.route('/').post(authRateLimiter, handleUserSignup);
userRouter.route("/login").post(authRateLimiter, handleUserLogin)
userRouter.route("/logout").post(handleUserLogout)

userRouter.route('/signup').get((req, res) => {
    return res.render('signup')
})



export default userRouter;
