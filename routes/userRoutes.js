import express from "express";
import bcrypt from "bcryptjs";
import expressAsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import sgMail from "@sendgrid/mail";

import {
  isAuth,
  isAdmin,
  generateToken,
  baseUrl,
  mailgun,
  isVendor,
} from "../utils.js";

sgMail.setApiKey(
  process.env.SGMAIL
);

const userRouter = express.Router();

userRouter.get(
  "/",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const users = await User.find({});
    res.send(users);
  })
);

userRouter.get(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      res.send(user);
    } else {
      res.status(404).send({ message: "User Not Found" });
    }
  })
);

userRouter.put(
  "/profile",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.password) {
        user.password = bcrypt.hashSync(req.body.password, 8);
      }

      const updatedUser = await user.save();
      res.send({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        isVendor: updatedUser.isVendor,
        token: generateToken(updatedUser),
      });
    } else {
      res.status(404).send({ message: "User not found" });
    }
  })
);

userRouter.post(
  "/forget-password",
  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });

    if (user) {
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "3h",
      });
      user.resetToken = token;
      await user.save();

      //reset link

      const msg = {
        to: user.email, // Change to your recipient
        from: "1908390100037@reck.ac.in", // Change to your verified sender
        subject: "IttrKart | Reset Password",
        html: `<p>Please Click the following link to reset your password:</p> 
        <a href="${baseUrl()}/reset-password/${token}"}>Reset Password</a>`,
      };

      await sgMail.send(msg);

      // mailgun()
      //   .messages()
      //   .send(
      //     {
      //       from: "manjeetkakran@gmail.com",
      //       to: `${user.name} <${user.email}>`,
      //       subject: `Reset Password`,
      //       html: `
      //        <p>Please Click the following link to reset your password:</p>
      //        <a href="${baseUrl()}/reset-password/${token}"}>Reset Password</a>
      //        `,
      //     },
      //     (error, body) => {
      //       console.log(error);
      //       console.log(body);
      //     }
      //   );
      res.send({ message: "We sent reset password link to your email." });
    } else {
      res.status(404).send({ message: "User not found" });
    }
  })
);

userRouter.post(
  "/reset-password",
  expressAsyncHandler(async (req, res) => {
    jwt.verify(req.body.token, process.env.JWT_SECRET, async (err, decode) => {
      if (err) {
        res.status(401).send({ message: "Invalid Token" });
      } else {
        const user = await User.findOne({ resetToken: req.body.token });
        if (user) {
          if (req.body.password) {
            user.password = bcrypt.hashSync(req.body.password, 8);
            await user.save();
            res.send({
              message: "Password reseted successfully",
            });
          }
        } else {
          res.status(404).send({ message: "User not found" });
        }
      }
    });
  })
);

userRouter.put(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.isAdmin = Boolean(req.body.isAdmin);
      user.isVendor = Boolean(req.body.isVendor);
      const updatedUser = await user.save();
      res.send({ message: "User Updated", user: updatedUser });
    } else {
      res.status(404).send({ message: "User Not Found" });
    }
  })
);

userRouter.delete(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.email === "manjeetsinghmzn2002@gmail.com") {
        res.status(400).send({ message: "Can Not Delete Admin User" });
        return;
      }
      await user.remove();
      res.send({ message: "User Deleted" });
    } else {
      res.status(404).send({ message: "User Not Found" });
    }
  })
);
userRouter.post(
  "/signin",
  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        res.send({
          _id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          isVendor: user.isVendor,
          token: generateToken(user),
        });
        return;
      }
    }
    res.status(401).send({ message: "Invalid email or password" });
  })
);

userRouter.post(
  "/signup",
  expressAsyncHandler(async (req, res) => {
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password),
    });
    const user = await newUser.save();
    res.send({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isVendor: user.isVendor,
      token: generateToken(user),
    });
  })
);

export default userRouter;
