import jwt from "jsonwebtoken";
import mg from "mailgun-js";

export const baseUrl = () =>
  process.env.BASE_URL
    ? process.env.BASE_URL
    : process.env.NODE_ENV !== "production"
    ? "https://ittrkart.vercel.app"
    : "https://ittrkart.vercel.app";

export const generateToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isVendor: user.isVendor,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );
};

export const isAuth = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization) {
    const token = authorization.slice(7, authorization.length); // Bearer XXXXXX
    jwt.verify(token, process.env.JWT_SECRET, (err, decode) => {
      if (err) {
        res.status(401).send({ message: "Invalid Token" });
      } else {
        req.user = decode;
        next();
      }
    });
  } else {
    res.status(401).send({ message: "No Token" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401).send({ message: "Invalid Admin Token" });
  }
};

export const isVendor = (req, res, next) => {
  if (req.user && req.user.isVendor) {
    next();
  } else if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401).send({ message: "Invalid Vendor Token" });
  }
};

export const mailgun = () =>
  mg({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMIAN,
  });

export const vendorOrderEmailTemplate = (vendor,order) =>{
  return `
  <h1 style="text-align: center; color: #333;">New Order for Fulfillment</h1>
  <p>Hi ${vendor.name},</p>
  <p>You have a new order to fulfill on behalf of IttrKart:</p>

  <h2 style="color: #555;">[Order ${order._id}] (${order.createdAt.toString().substring(0, 10)})</h2>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">Product</th>
        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">Quantity</th>
        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;" align="right">Price</th>
      </tr>
    </thead>
    <tbody>
      ${order.orderItems
        .map(
          (item) => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
            <td style="border: 1px solid #ddd; padding: 8px;" align="center">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px;" align="right">Rs.${item.price.toFixed(2)}</td>
          </tr>
        `
        )
        .join("\n")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">Items Price:</td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right">Rs.${order.itemsPrice.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">Shipping Price:</td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right">Rs.${order.shippingPrice.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;"><strong>Total Price:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right"><strong>Rs.${order.totalPrice.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">Payment Method:</td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right">${order.paymentMethod}</td>
      </tr>
    </tfoot>
  </table>

  <h2 style="color: #555;">Shipping address</h2>
  <p>
    ${order.shippingAddress.fullName},<br/>
    ${order.shippingAddress.address},<br/>
    ${order.shippingAddress.city},<br/>
    ${order.shippingAddress.country},<br/>
    ${order.shippingAddress.postalCode}<br/>
  </p>

  <hr/>

  <p>Please process this order for fulfillment as soon as possible.</p>

  <p>Thank you for partnering with IttrKart!</p>
`
};

export const payOrderEmailTemplate = (order) => {
  return `
  <h1 style="text-align: center; color: #333;">Thanks for shopping with us</h1>
  <p>Hi ${order.user.name},</p>
  <p>We have finished processing your order.</p>

  <h2 style="color: #555;">[Order ${order._id}] (${order.createdAt
    .toString()
    .substring(0, 10)})</h2>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">Product</th>
        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">Quantity</th>
        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;" align="right">Price</th>
      </tr>
    </thead>
    <tbody>
      ${order.orderItems
        .map(
          (item) => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
            <td style="border: 1px solid #ddd; padding: 8px;" align="center">${
              item.quantity
            }</td>
            <td style="border: 1px solid #ddd; padding: 8px;" align="right">Rs.${item.price.toFixed(
              2
            )}</td>
          </tr>
        `
        )
        .join("\n")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">Items Price:</td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right">Rs.${order.itemsPrice.toFixed(
          2
        )}</td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">Shipping Price:</td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right">Rs.${order.shippingPrice.toFixed(
          2
        )}</td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;"><strong>Total Price:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right"><strong>Rs.${order.totalPrice.toFixed(
          2
        )}</strong></td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #ddd; padding: 8px;">Payment Method:</td>
        <td style="border: 1px solid #ddd; padding: 8px;" align="right">${
          order.paymentMethod
        }</td>
      </tr>
    </tfoot>
  </table>

  <h2 style="color: #555;">Shipping address</h2>
  <p>
    ${order.shippingAddress.fullName},<br/>
    ${order.shippingAddress.address},<br/>
    ${order.shippingAddress.city},<br/>
    ${order.shippingAddress.country},<br/>
    ${order.shippingAddress.postalCode}<br/>
  </p>

  <hr/>

  <p>Thanks for shopping with us. Team IttrKart</p>
`;
};
