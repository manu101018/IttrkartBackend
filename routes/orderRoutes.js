import express from "express";
import expressAsyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";
import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import {
  isAuth,
  isAdmin,
  mailgun,
  payOrderEmailTemplate,
  vendorOrderEmailTemplate,
} from "../utils.js";

const stripe = Stripe(
  process.env.STRIPE
);

sgMail.setApiKey(
  process.env.SGMAIL
);

const orderRouter = express.Router();

orderRouter.get(
  "/",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.find().populate("user", "name");
    res.send(orders);
  })
);

orderRouter.post(
  "/",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const newOrder = new Order({
      orderItems: req.body.orderItems.map((x) => ({ ...x, product: x._id })),
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      itemsPrice: req.body.itemsPrice,
      shippingPrice: req.body.shippingPrice,
      taxPrice: req.body.taxPrice,
      totalPrice: req.body.totalPrice,
      user: req.user._id,
    });

    const order = await newOrder.save();
    res.status(201).send({ message: "New Order Created", order });
  })
);

orderRouter.get(
  "/summary",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: null,
          numOrders: { $sum: 1 },
          totalSales: { $sum: "$totalPrice" },
        },
      },
    ]);
    const users = await User.aggregate([
      {
        $group: {
          _id: null,
          numUsers: { $sum: 1 },
        },
      },
    ]);
    const dailyOrders = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          sales: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const productCategories = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);
    res.send({ users, orders, dailyOrders, productCategories });
  })
);

orderRouter.get(
  "/mine",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.send(orders);
  })
);

orderRouter.get(
  "/:id",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      res.send(order);
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

orderRouter.put(
  "/:id/deliver",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      await order.save();
      res.send({ message: "Order Delivered" });
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

orderRouter.put(
  "/:id/pay",
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "email name"
    );
    const userDb = await User.findById(req.body.user);
    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: userDb.email,
      };

      const updatedOrder = await order.save();

      const msg = {
        to: order.user.email, // Change to your recipient
        from: "1908390100037@reck.ac.in", // Change to your verified sender
        subject: `IttrKart | New order ${order._id}`,
        html: payOrderEmailTemplate(order),
      };

      await sgMail.send(msg);

      let vendorUser = await User.findOne({ isVendor: true });

      const msgForVendor = {
        to: vendorUser.email, // Change to your recipient
        from: "1908390100037@reck.ac.in", // Change to your verified sender
        subject: `IttrKart | New order ${order._id}`,
        html: vendorOrderEmailTemplate(vendorUser, order),
      };

      await sgMail.send(msgForVendor);
      // mailgun()
      //   .messages()
      //   .send(
      //     {
      //       from: 'Amazona <amazona@mg.yourdomain.com>',
      //       to: `${order.user.name} <${order.user.email}>`,
      //       subject: `New order ${order._id}`,
      //       html: payOrderEmailTemplate(order),
      //     },
      //     (error, body) => {
      //       if (error) {
      //         console.log(error);
      //       } else {
      //         console.log(body);
      //       }
      //     }
      //   );

      res.send({ message: "Order Paid", order: updatedOrder });
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

orderRouter.delete(
  "/:id",
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      await order.remove();
      res.send({ message: "Order Deleted" });
    } else {
      res.status(404).send({ message: "Order Not Found" });
    }
  })
);

orderRouter.post("/create-checkout-session", async (req, res) => {
  try {
    // const customer = await stripe.customers.create({
    //   metadata: {
    //     userId: req.body.userId,
    //     cart: JSON.stringify(req.body.cartItems),
    //   },
    // });

    const line_items = req.body.cartItems.map((item) => {
      return {
        price_data: {
          currency: "inr",
          product_data: {
            name: item.name,
            images: [item.image],
            description: item.description,
            metadata: {
              id: item.id,
            },
          },
          unit_amount: (item.price)* 100,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      // payment_method_types: ["card"],
      // shipping_address_collection: {
      //   allowed_countries: ["US", "CA", "KE"],
      // },
      shipping_options: [
      //   {
      //     shipping_rate_data: {
      //       type: "fixed_amount",
      //       fixed_amount: {
      //         amount: 0,
      //         currency: "usd",
      //       },
      //       display_name: "Free shipping",
      //       // Delivers between 5-7 business days
      //       delivery_estimate: {
      //         minimum: {
      //           unit: "business_day",
      //           value: 5,
      //         },
      //         maximum: {
      //           unit: "business_day",
      //           value: 7,
      //         },
      //       },
      //     },
      //   },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 4000,
              currency: "inr",
            },
            display_name: "Deliver soon",
            // Delivers in exactly 1 business day
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 4,
              },
              maximum: {
                unit: "business_day",
                value: 6,
              },
            },
          },
        },
      ],
      // phone_number_collection: {
      //   enabled: true,
      // },
      line_items,
      mode: "payment",
      // customer: customer.id,
      success_url: `https://ittrkart.vercel.app/order/${req.body.OrderID}`,
      cancel_url: `https://ittrkart.vercel.app/cart`,
      // success_url: `${process.env.CLIENT_URL}/checkout-success`,
      // cancel_url: `${process.env.CLIENT_URL}/cart`,
    });

    console.log(session);

    // res.redirect(303, session.url);
    res.send({ url: session.url, session: session });
  } catch (er) {
    console.log(er);
    res.status(500).send({ message: "error at backend" });
  }
});

export default orderRouter;
