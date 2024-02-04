import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { isAdmin, isAuth, isVendor } from '../utils.js';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// const upload = multer();

const uploadRouter = express.Router();

uploadRouter.post(
  '/',
  isAuth,
  isVendor,
  upload.single('file'),
  async (req, res) => {
    const originalname = req.file.originalname;
    // console.log(originalname,'4')
    // cloudinary.config({
    //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    //   api_key: process.env.CLOUDINARY_API_KEY,
    //   api_secret: process.env.CLOUDINARY_API_SECRET,
    // });
    // const streamUpload = (req) => {
    //   return new Promise((resolve, reject) => {
    //     const stream = cloudinary.uploader.upload_stream((error, result) => {
    //       if (result) {
    //         resolve(result);
    //       } else {
    //         reject(error);
    //       }
    //     });
    //     streamifier.createReadStream(req.file.buffer).pipe(stream);
    //   });
    // };
    // const result = await streamUpload(req);
    // res.send({result});
    res.send({secure_url:originalname});
  }
);
export default uploadRouter;
