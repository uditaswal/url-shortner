import express from 'express';
import { handleUserSignup, handleUserLogin, handleUserLogout } from '../controller/user.controller.js'
const userRouter = express.Router();

userRouter.route('/').post(handleUserSignup);
userRouter.route("/login").post(handleUserLogin)
userRouter.route("/logout").post(handleUserLogout)

userRouter.route('/signup').get((req, res) => {
    return res.render('signup')
})



export default userRouter;
