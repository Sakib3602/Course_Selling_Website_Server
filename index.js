const express = require("express");
const cors = require("cors");

require("dotenv").config();
const axios = require("axios");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const moment = require("moment");
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://check102.netlify.app",
      "https://bengalrice.net",
    ],
    credentials: true,
  }),
);
app.use(express.json());
// Parse form-encoded payloads (bank gateway callbacks usually post this)
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.b5jufhp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//
// const varifyToken = (req,res,next)=>{
//   console.log("varify token called -----------------------------")
//   const tkn = req.cookies?.token;
//   if(!tkn){
//     return res.status(401).json({message:"Unauthorized access"});
//   }
//   jwt.verify(tkn , process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
//     if(err){
//       return res.status(403).json({message:"Forbidden access"});
//     }

//     req.user = decoded;
//     console.log(req.user.data.email)
//     next();

//   })
// }

// /

async function run() {
  try {
    // Ensure DB connection established before queries
    await client.connect();
    const CoursesAll = client.db("COURSE").collection("courses");
    const UsersAll = client.db("COURSE").collection("users");
    const OrdersAll = client.db("COURSE").collection("orders");
    const SupportAll = client.db("COURSE").collection("support");
    const MeetingAll = client.db("COURSE").collection("meeting");
    const TaskAll = client.db("COURSE").collection("tasks");
    const ReplyTasksAll = client.db("COURSE").collection("ReplyTasks");
    const AnnouncementsAll = client.db("COURSE").collection("announcements");
    // ================= SEBL Credentials =================

    // bank end erl
    const PUBLIC_BASE_URL =
      process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

    //
    // JJJJJJJJJJWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTT

    // generate jwt token
    // app.post("/jwt", async (req, res) => {
    //   const user = req.body;
    //   console.log(user);
    //   const token = jwt.sign(
    //     {
    //       data: user,
    //     },
    //     process.env.ACCESS_TOKEN_SECRET,
    //     { expiresIn: "1h" }
    //   );

    //   res
    //     .cookie("token", token, {
    //       httpOnly: true,
    //       secure: false, // local MUST be false
    //       sameSite: "lax", // local MUST NOT be "none"
    //     })
    //     .send({ success: true });
    // });

    // ================= ADMIN DASHBOARD STATS =================

    // surjo payment gateway work
    const generateOrderId = () => {
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const time = Date.now().toString().slice(-5);

      return `SP${yyyy}${mm}${dd}${time}`;
    };

    app.post("/api/payment/pay", async (req, res) => {
      try {
        // 1️⃣ Frontend থেকে data নেওয়া
        const {
          amount,
          customer_name,
          customer_phone,
          customer_address,
          customer_city,
          customer_post_code,
          customer_country,
          courses,
          totalAmount,
          paymentStatus,
          email,
          orderDate,
          link,
        } = req.body;

       
        const currency =
          customer_country === "Bangladesh" || customer_country === "BD"
            ? "BDT"
            : "USD";

        // 2️⃣ Backend এ unique order id বানানো
        const order_id = generateOrderId();

        // 3️⃣ Insert order data into OrdersAll
        const orderData = {
          order_id,
          customer_name,
          customer_phone,
          customer_address,
          customer_city,
          customer_post_code,
          amount,
          currency,
          courses,
          totalAmount,
          paymentStatus,
          email,
          orderDate,
          link,
        };

        const orderResult = await OrdersAll.insertOne(orderData);
        console.log("✅ Order saved to database:", orderResult);

        // 4️⃣ Shurjopay token নেওয়া
        console.log("🔐 Requesting token from:", process.env.SP_ENDPOINT);
        const tokenRes = await axios.post(
          process.env.SP_ENDPOINT + "/api/get_token",
          {
            username: process.env.SP_USERNAME,
            password: process.env.SP_PASSWORD,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (!tokenRes.data.token || !tokenRes.data.store_id) {
          console.error("❌ Token request failed:", tokenRes.data);
          return res.status(400).json({
            message:
              "Payment gateway authentication failed. Please contact support.",
            error: tokenRes.data.message || "Invalid credentials",
          });
        }

        const { token, store_id } = tokenRes.data;
        console.log("✅ Token extracted successfully");

        // 4️⃣ Payment create করা
        const paymentRes = await axios.post(
          process.env.SP_ENDPOINT + "/api/secret-pay",
          {
            token,
            store_id,
            prefix: "SP",
            order_id,
            amount,
            currency,

            return_url: "https://x-z9vw.onrender.com/api/payment/success",
            // return_url: "http://localhost:3000/api/payment/success",
            cancel_url: "https://x-z9vw.onrender.com/api/payment/cancel",
            // cancel_url: "http://localhost:3000/api/payment/cancel",

            customer_name,
            customer_phone,
            customer_address,
            customer_city,
            customer_postcode: customer_post_code,
            customer_country,
            client_ip: req.ip,
          },
        );

        console.log(
          "💳 Full Payment Response:",
          JSON.stringify(paymentRes.data, null, 2),
        );

        if (paymentRes.data.checkout_url) {
          res.json({
            checkout_url: paymentRes.data.checkout_url,
          });
        } else {
          console.error("❌ checkout_url missing from response");
          res.status(400).json({
            message: "Checkout URL not found",
            data: paymentRes.data,
          });
        }
      } catch (error) {
        console.error(
          "❌ Payment Init Error:",
          error.response?.data || error.message,
        );
        console.error("Error stack:", error.stack);
        res.status(500).json({
          message: "Payment initiation failed",
          error: error.response?.data || error.message,
        });
      }
    });

    app.all("/api/payment/success", async (req, res) => {
      try {
        const sp_order_id = req.query.order_id;

        if (!sp_order_id) {
          return res.status(400).send("Order ID missing");
        }

        const tokenRes = await axios.post(
          process.env.SP_ENDPOINT + "/api/get_token",
          {
            username: process.env.SP_USERNAME,
            password: process.env.SP_PASSWORD,
          },
        );
        const { token } = tokenRes.data;

        // ২. পেমেন্ট ভেরিফাই করুন
        const verifyRes = await axios.post(
          process.env.SP_ENDPOINT + "/api/verification",
          { token, order_id: sp_order_id },
          { headers: { "Content-Type": "application/json" } },
        );

        const paymentInfo = verifyRes.data[0];
        const apiKey = process.env.BRAVO_API_KEY;
        const uri = process.env.BRAVO_URI;
        const orderForEmail = await OrdersAll.findOne({
          order_id: paymentInfo.customer_order_id,
        });
        const recipientEmail = orderForEmail?.email;
        const emailData = recipientEmail
          ? {
              sender: {
                name: "Payment Successful - Bengal Rice",
                email: "bornorahman1971@gmail.com",
              },
              to: [{ email: "sakibsarker6969@gmail.com" }],
              // to: [{ email: recipientEmail }],
              subject: "Payment Confirmation",
              htmlContent: `<html>
          <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
            <div style='max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;'>
              
              <div style='text-align: center; margin-bottom: 10px;'>
                <img src='https://res.cloudinary.com/dpwuivub7/image/upload/v1770397076/11_wd9tcc.png' alt='Logo' style='width: 250px;'>
              </div>

              <h2 style='color: #2ecc71; text-align: center;'>Payment Successful!</h2>
              <p>Hello,</p>
              <p>Thank you for your purchase. Your payment has been successfully processed. Here are your transaction details:</p>

              <table style='width: 100%; border-collapse: collapse; margin-top: 20px;'>
                <tr style='background-color: #f9f9f9;'>
                  <td style='padding: 10px; border: 1px solid #ddd;'><strong>Order ID:</strong></td>
                  <td style='padding: 10px; border: 1px solid #ddd;'>${paymentInfo.customer_order_id}</td>
                </tr>
                <tr>
                  <td style='padding: 10px; border: 1px solid #ddd;'><strong>Transaction ID:</strong></td>
                  <td style='padding: 10px; border: 1px solid #ddd;'>${paymentInfo.bank_trx_id}</td>
                </tr>
                <tr style='background-color: #f9f9f9;'>
                  <td style='padding: 10px; border: 1px solid #ddd;'><strong>Amount:</strong></td>
                  <td style='padding: 10px; border: 1px solid #ddd;'>${paymentInfo.amount} ${paymentInfo.currency}</td>
                </tr>
                <tr>
                  <td style='padding: 10px; border: 1px solid #ddd;'><strong>Payment Method:</strong></td>
                  <td style='padding: 10px; border: 1px solid #ddd;'>${paymentInfo.card_type || paymentInfo.method || 'Online Payment'}</td>
                </tr>
                <tr style='background-color: #f9f9f9;'>
                  <td style='padding: 10px; border: 1px solid #ddd;'><strong>Date:</strong></td>
                  <td style='padding: 10px; border: 1px solid #ddd;'>${new Date().toLocaleString()}</td>
                </tr>
              </table>

              <p style='margin-top: 20px;'>If you have any questions, feel free to contact our support team.</p>
              
              <div style='margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #2ecc71; border-radius: 5px;'>
                <h3 style='color: #333; margin-top: 0;'>Refund Policy:</h3>
                <p style='margin: 10px 0;'>Due to the digital nature of this product, all sales are final. Refund requests will only be considered within 48 hours for verified technical access issues, subject to review and approval by Bengal Rice.</p>
                <p style='margin: 10px 0;'>For billing-related queries, contact us at <a href='mailto:billing@bengalrice.net' style='color: #2ecc71;'>billing@bengalrice.net</a></p>
                <p style='margin: 10px 0 0 0;'><strong>Best regards,</strong><br>Bengal Rice</p>
              </div>
              
              <div style='text-align: center; margin-top: 30px; font-size: 12px; color: #888;'>
                <p>&copy; 2026 Course Support. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>`,
            }
          : null;

        if (paymentInfo.sp_code === "1000") {
          const myOrderId = paymentInfo.customer_order_id;
          const updateResult = await OrdersAll.updateOne(
            { order_id: myOrderId },
            {
              $set: {
                paymentStatus: "paid",
                sp_order_id: paymentInfo.sp_order_id,
                transaction_id: paymentInfo.bank_trx_id,
                updatedAt: new Date(),
              },
            },
          );
          try {
            if (!apiKey) {
              console.warn("Email not sent: BRAVO_API_KEY is missing");
            } else if (!emailData) {
              console.warn("Email not sent: order email is missing");
            } else {
              const response = await axios.post(uri, emailData, {
                headers: {
                  "Content-Type": "application/json",
                  "api-key": apiKey,
                },
              });
              console.log("Email sent successfully:", response.data);
            }
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }

          res.redirect("https://bengalrice.net/success");
          // res.redirect("http://localhost:5173/success");
        } else {
          // Send failed payment email
          const myOrderId = paymentInfo.customer_order_id;
          const failedOrder = await OrdersAll.findOne({ order_id: myOrderId });
          
          if (failedOrder && failedOrder.email && apiKey) {
            const failedEmailData = {
              sender: {
                name: "Bengal Rice Billing Team",
                email: "bornorahman1971@gmail.com",
              },
              to: [{ email: "sakibsarker6969@gmail.com" }],
              // to: [{ email: failedOrder.email }],
              subject: "Payment Failed - Action Required",
              htmlContent: `<html>
          <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
            <div style='max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;'>
              
              <div style='text-align: center; margin-bottom: 10px;'>
                <img src='https://res.cloudinary.com/dpwuivub7/image/upload/v1770397076/11_wd9tcc.png' alt='Logo' style='width: 250px;'>
              </div>

              <h2 style='color: #e74c3c; text-align: center;'>Payment Failed</h2>
              <p>Hello ${failedOrder.customer_name || 'Customer'},</p>
              <p>We noticed that your recent payment attempt was unsuccessful.</p>

              <div style='background-color: #fee; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; border-radius: 5px;'>
                <h3 style='margin-top: 0; color: #e74c3c;'>❌ Payment Details</h3>
                <p style='margin: 5px 0;'><strong>Order ID:</strong> ${failedOrder.order_id}</p>
                <p style='margin: 5px 0;'><strong>Amount:</strong> ${failedOrder.amount} ${failedOrder.currency}</p>
              </div>

              <p>No worries — this can happen due to:</p>
              <ul style='line-height: 1.8;'>
                <li>Insufficient balance</li>
                <li>Network interruption</li>
                <li>Card/bank authorization issues</li>
              </ul>

              <div style='background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 5px;'>
                <h3 style='margin-top: 0; color: #2e7d32;'>🔁 What You Can Do</h3>
                <ul style='margin: 10px 0; padding-left: 20px;'>
                  <li>Retry the payment using the same or a different payment method</li>
                  <li>Ensure your card/bank details are correct</li>
                </ul>
               
              </div>

              <p style='margin-top: 20px;'>If the issue continues, please contact us at <a href='mailto:billing@bengalrice.net' style='color: #2ecc71;'>billing@bengalrice.net</a> and we'll assist you right away.</p>
              
              <p style='margin-top: 20px;'><strong>Regards,</strong><br>Bengal Rice Billing Team</p>
              
              <div style='text-align: center; margin-top: 30px; font-size: 12px; color: #888;'>
                <p>&copy; 2026 Bengal Rice. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>`,
            };

            try {
              await axios.post(uri, failedEmailData, {
                headers: {
                  "Content-Type": "application/json",
                  "api-key": apiKey,
                },
              });
              console.log("Failed payment email sent successfully");
            } catch (emailError) {
              console.error("Error sending failed payment email:", emailError);
            }
          }
          
          res.redirect("https://bengalrice.net/fail");
          // res.redirect("http://localhost:5173/fail");
        }
      } catch (error) {
        console.error("❌ Error verifying payment:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.all("/api/payment/cancel", async (req, res) => {
      try {
        const sp_order_id = req.query.order_id;
        const apiKey = process.env.BRAVO_API_KEY;
        const uri = process.env.BRAVO_URI;

        if (sp_order_id) {
          // Get order information
          const cancelledOrder = await OrdersAll.findOne({ order_id: sp_order_id });
          
          if (cancelledOrder && cancelledOrder.email && apiKey) {
            const cancelEmailData = {
              sender: {
                name: "Bengal Rice Billing Team",
                email: "bornorahman1971@gmail.com",
              },
              to: [{ email: "sakibsarker6969@gmail.com" }],
              // to: [{ email: cancelledOrder.email }],
              subject: "Payment Cancelled - We're Here to Help",
              htmlContent: `<html>
          <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
            <div style='max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;'>
              
              <div style='text-align: center; margin-bottom: 10px;'>
                <img src='https://res.cloudinary.com/dpwuivub7/image/upload/v1770397076/11_wd9tcc.png' alt='Logo' style='width: 250px;'>
              </div>

              <h2 style='color: #ff9800; text-align: center;'>Payment Cancelled</h2>
              <p>Hello ${cancelledOrder.customer_name || 'Customer'},</p>
              <p>We noticed that your recent payment attempt was cancelled.</p>

              <div style='background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 5px;'>
                <h3 style='margin-top: 0; color: #ff9800;'>❌ Payment Details</h3>
                <p style='margin: 5px 0;'><strong>Order ID:</strong> ${cancelledOrder.order_id}</p>
                <p style='margin: 5px 0;'><strong>Amount:</strong> ${cancelledOrder.amount} ${cancelledOrder.currency}</p>
              </div>

              <p>No worries — this can happen due to:</p>
              <ul style='line-height: 1.8;'>
                <li>Insufficient balance</li>
                <li>Network interruption</li>
                <li>Card/bank authorization issues</li>
              </ul>

              <div style='background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 5px;'>
                <h3 style='margin-top: 0; color: #2e7d32;'>🔁 What You Can Do</h3>
                <ul style='margin: 10px 0; padding-left: 20px;'>
                  <li>Retry the payment using the same or a different payment method</li>
                  <li>Ensure your card/bank details are correct</li>
                </ul>
                
              </div>

              <p style='margin-top: 20px;'>If the issue continues, please contact us at <a href='mailto:billing@bengalrice.net' style='color: #2ecc71;'>billing@bengalrice.net</a> and we'll assist you right away.</p>
              
              <p style='margin-top: 20px;'><strong>Regards,</strong><br>Bengal Rice Billing Team</p>
              
              <div style='text-align: center; margin-top: 30px; font-size: 12px; color: #888;'>
                <p>&copy; 2026 Bengal Rice. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>`,
            };

            try {
              await axios.post(uri, cancelEmailData, {
                headers: {
                  "Content-Type": "application/json",
                  "api-key": apiKey,
                },
              });
              console.log("Cancelled payment email sent successfully");
            } catch (emailError) {
              console.error("Error sending cancelled payment email:", emailError);
            }
          }
        }
      } catch (error) {
        console.error("Error in cancel endpoint:", error);
      }
      
      res.redirect("https://bengalrice.net/cancel");
      // res.redirect("http://localhost:5173/cancel");
    });

    // end-===========

  

    // end-===========

    app.delete("/delSup/:id", async (req, res) => {
      const { id } = req.params;
      const result = await SupportAll.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.get("/admin/stats", async (req, res) => {
      try {
        const [
          totalUsers,
          totalInstructors,
          totalCourses,
          totalOrders,
          pendingSupport,
          revenueData,
        ] = await Promise.all([
          // 1. Count all users
          UsersAll.countDocuments(),

          // 2. Count only instructors
          UsersAll.countDocuments({ role: "instructor" }),

          // 3. Count total courses
          CoursesAll.countDocuments(),

          // 4. Count total orders placed
          OrdersAll.countDocuments(),

          // 5. Count pending support tickets
          SupportAll.countDocuments({ status: "Pending" }),

          // 6. Calculate Total Revenue (Sum of all order prices)
          OrdersAll.aggregate([
            {
              $group: {
                _id: null,
                // We use $toDouble just in case the price is stored as a string "100"
                // Change "$price" to whatever field name you use for money in orders
                totalAmount: { $sum: { $toDouble: "$price" } },
              },
            },
          ]).toArray(),
        ]);

        // Extract revenue from the aggregation result (handle case if no orders exist)
        const totalRevenue =
          revenueData.length > 0 ? revenueData[0].totalAmount : 0;

        // Send the summary object to the frontend
        res.send({
          totalUsers,
          totalInstructors,
          totalStudents: totalUsers - totalInstructors, // Estimate students
          totalCourses,
          totalOrders,
          totalRevenue,
          pendingSupport,
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
        res.status(500).send({ message: "Failed to load dashboard stats" });
      }
    });

    //
    app.get("/usersss", async (req, res) => {
      console.log("usersss called -----------------------------");
      const result = await UsersAll.find().toArray();
      res.send(result);
    });
    // announcement work
    app.post("/announcements", async (req, res) => {
      const body = req.body;
      const result = await AnnouncementsAll.insertOne(body);
      res.send(result);
    });
    app.get("/announcements", async (req, res) => {
      const result = await AnnouncementsAll.find().toArray();
      res.send(result);
    });
    app.delete("/announcements/:id", async (req, res) => {
      const { id } = req.params;
      const result = await AnnouncementsAll.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // reply task
    app.get("/replyAllTask", async (req, res) => {
      const result = await ReplyTasksAll.find().toArray();
      res.send(result);
    });
    app.put("/submark/:id", async (req, res) => {
      const body = req.body;
      console.log(body, "bodyyy");
      const { id } = req.params;
      console.log(id, "iddd");
      const result = await ReplyTasksAll.updateOne(
        { taskId: id },
        { $set: body },
      );
      res.send({ result, message: "✅ Task reply updated successfully" });
    });

    // task
    app.get("/tasks", async (req, res) => {
      const result = await TaskAll.find().toArray();
      res.send(result);
    });

    app.post("/replyTask", async (req, res) => {
      const body = req.body;
      const result = await ReplyTasksAll.insertOne(body);
      res.send(result);
    });
    app.put("/replyTask/:id", async (req, res) => {
      const body = req.body;

      const { id } = req.params;
      console.log(id, "iddd");
      const result = await TaskAll.updateOne(
        { _id: new ObjectId(id) },
        { $set: body },
      );
      res.send({ result, message: "✅ Task reply updated successfully" });
    });

    // instractor workl
    app.get("/insCourse", async (req, res) => {
      const result = await CoursesAll.find(
        {},
        { projection: { title: 1, _id: 1 } },
      ).toArray();
      console.log(result);
      res.send(result);
    });

    app.post("/tasks", async (req, res) => {
      const body = req.body;
      const result = await TaskAll.insertOne(body);
      res.send(result);
    });

    // meeting work
    app.post("/setMeeting", async (req, res) => {
      const body = req.body;
      const result = await MeetingAll.insertOne(body);
      res.send(result);
    });
    app.delete("/setMeeting/:id", async (req, res) => {
      const { id } = req.params;
      const result = await MeetingAll.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.put("/setMeetings/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      console.log(updateData, id);
      const result = await MeetingAll.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.send({ result, message: "✅ Meeting updated successfully" });
    });
    app.get("/setMeetings", async (req, res) => {
      const result = await MeetingAll.find().toArray();
      res.send(result);
    });
    app.get("/setMeeting/:email", async (req, res) => {
      const result = await MeetingAll.find({
        email: req.params.email,
      }).toArray();
      res.send(result);
    });

    // premium work
    app.get("/premium/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const result = await UsersAll.findOne({ email: email });
      console.log(result, "[][][][]");
      res.send(result);
    });

    app.patch("/premium/:email", async (req, res) => {
      const { email } = req.params;
      const resp = await UsersAll.updateOne(
        { email: email },
        { $set: { Premium: true } },
      );
      res.send({ resp, message: "✅ User upgraded to premium successfully" });
    });
    // all order
    app.get("/allStudents", async (req, res) => {
      const result = await OrdersAll.find().toArray();
      res.send(result);
    });
    // user work
    app.patch("/updateUser/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const updateData = req.body;

      const UpdateU = await UsersAll.updateOne(
        { email: email },
        { $set: updateData },
      );
      res.send({ ...UpdateU, message: "✅ User updated successfully" });
    });

    app.get("/userP/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const result = await UsersAll.findOne({ email: email });
      res.send(result);
    });
    // order enrolled user course
    app.get("/enrolled/:email", async (req, res) => {
      const { email } = req.params;

      console.log(email, "pppp");
      const orders = await OrdersAll.find({ email: email }).toArray();
      console.log(orders, "orderss");
      const courses = orders.flatMap((order) => {
        const courseList = Array.isArray(order.courses) ? order.courses : [];

        // Inject parent order metadata into each course entry
        return courseList.map((course) => ({
          ...course,
          orderId: order._id?.toString(),
          status: course.status,
          downloadLink: course.downloadLink,
        }));
      });

      console.log(courses, "ooo");
      res.send(courses);
    });
    // admin pendings
    app.get("/pendings", async (req, res) => {
      const orders = await OrdersAll.find().toArray();
      const courses = orders.flatMap((order) => {
        const courseList = Array.isArray(order.courses) ? order.courses : [];

        return courseList.map((course) => ({
          ...course,
          orderId: order._id?.toString(),
          status: course.status,
          downloadLink: order.link,
          paymentStatus: order.paymentStatus,
        }));
      });

      console.log(courses, "ooo");
      const filterC = courses.filter((c) => c.status === "pending");
      console.log(filterC, "filtered");
      res.send(filterC);
    });
    app.patch("/admin/update-course-link", async (req, res) => {
      try {
        const { orderId, courseId, link } = req.body;
        console.log(link);

        const filter = {
          _id: new ObjectId(orderId),
          "courses.id": courseId,
        };

        //  Update only the matched course ($)
        const updateDoc = {
          $set: {
            "courses.$.downloadLink": link,
            "courses.$.status": "completed",
          },
        };

        const result = await OrdersAll.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating link:", error);
        res.status(500).send({ message: "Failed to update link" });
      }
    });
    // manage courses
    app.get("/manage-courses", async (req, res) => {
      const result = await CoursesAll.find().toArray();
      res.send(result);
    });
    app.delete("/manage-courses/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await CoursesAll.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch("/manage-courses/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const updateData = req.body;
      console.log(updateData);
      const result = await CoursesAll.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.send({ result, message: "✅ Course updated successfully" });
    });

    // support section user
    app.post("/support", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await SupportAll.insertOne(body);
      res.send(result);
    });

    app.get("/supportAll", async (req, res) => {
      console.log(
        "support all called -----------------------------",
        req.query.email,
      );

      const result = await SupportAll.find({ status: "Pending" }).toArray();
      res.send(result);
    });

    app.get("/support/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const result = await SupportAll.find({ userEmail: email }).toArray();
      res.send(result);
    });
    app.patch("/support-reply/:id", async (req, res) => {
      const { id } = req.params;
      const { replyText } = req.body;
      console.log(
        "Replying to support ID:",
        id,
        "with text:",
        replyText,
        "date:",
        moment().format("LLLL"),
      );

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          reply: replyText, // Inserts the reply text
          status: "Resolved", // Updates existing status to 'Resolved'
          replyDate: moment().format("LLLL"), // Inserts the current date
        },
      };

      const result = await SupportAll.updateOne(filter, updateDoc);
      res.send({ result, message: "✅ Support updated successfully" });
    });

    // all course show
    app.get("/courses", async (req, res) => {
      const result = await CoursesAll.find().toArray();
      res.send(result);
    });
    // add courses
    app.post("/addCourse", async (req, res) => {
      const body = req.body;
      const result = await CoursesAll.insertOne(body);
      res.send(result);
    });
    // single data
    app.get("/single/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid course id" });
      }

      const result = await CoursesAll.findOne({ _id: new ObjectId(id) });
      if (!result) return res.status(404).json({ error: "Course not found" });

      res.send(result);
    });

    // users
    app.post("/users", async (req, res) => {
      const body = req.body;
      if (!body?.email) {
        return res.status(400).json({ message: "Email is required" });
      }
      if (await UsersAll.findOne({ email: body.email })) {
        return res.status(409).json({ message: "User already exists" });
      }
      const result = await UsersAll.insertOne(body);
      return res.status(201).json({ insertedId: result.insertedId });
    });

    // GET Onlyusers - return users, optionally filtered by role
    // Example: GET /Onlyusers?role=instructor
    app.get("/Onlyusers", async (req, res) => {
      try {
        console.log("tokennn", req.cookies.token);
        const role = req.query.role;
        const filter = {};
        if (role) filter.role = role;
        const users = await UsersAll.find(filter).toArray();
        return res.json(users);
      } catch (err) {
        console.error("GET /Onlyusers error:", err.message || err);
        return res.status(500).json({ message: "Unable to fetch users" });
      }
    });

    // only user
    app.get("/Onlyusers", async (req, res) => {
      const { params } = req.body;
      console.log(params);
      const result = await UsersAll.find({ role: "user" }).toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const { email } = req.params;
      const result = await UsersAll.findOne({ email: email });
      if (!result) {
        return res.status(404).json({ message: "User not found" });
      }
      res.send(result);
    });

    // role change
    app.patch("/roleChange/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const updateRole = req.body;
      console.log(updateRole.role);

      const result = await UsersAll.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: updateRole.role } },
      );
      res.send({ result, message: "✅ Role updated successfully" });
    });
    // update user from details order id add
    app.patch("/updateUser/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const updateData = req.body;
      console.log(updateData);

      const UpdateU = await UsersAll.updateOne(
        { email: email },
        { $set: updateData },
      );

      res.send({ ...UpdateU, message: "✅ User updated successfully" });
    });

    // order start
    app.post("/finalorders", async (req, res) => {
      const data = req.body;
      const result = await OrdersAll.insertOne(data);

      return res
        .status(201)
        .json({ insertedId: result.insertedId, message: "Order saved" });
    });
    // order end

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
