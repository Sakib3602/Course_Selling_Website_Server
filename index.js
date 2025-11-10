const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Parse form-encoded payloads (bank gateway callbacks usually post this)
app.use(express.urlencoded({ extended: true }));

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

async function run() {
  try {
    // Ensure DB connection established before queries
    await client.connect();
    const CoursesAll = client.db("COURSE").collection("courses");
    const UsersAll = client.db("COURSE").collection("users");
    const OrdersAll = client.db("COURSE").collection("orders");
    // ================= SEBL Credentials =================
  
    const SEBL_MERCHANT_ID = process.env.SEBL_MERCHANT_ID || "demoSEBL001";
    const SEBL_MERCHANT_PASS = process.env.SEBL_MERCHANT_PASS || "123456";

    // bank end erl
    const PUBLIC_BASE_URL =
      process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

    // ================= Initiate Payment Route =================
    app.post("/api/initiate-payment", async (req, res) => {
      const { amount, currency = "BDT" } = req.body;

      if (!amount) {
        return res.status(400).json({ message: "amount is required" });
      }

      // ========== Data ==========
     
      const data = {
        store_id: SEBL_MERCHANT_ID, // Bank merchant ID
        store_passwd: SEBL_MERCHANT_PASS, // Bank merchant password
        total_amount: amount,
        currency,
        tran_id: "TXN" + Date.now(), // unique transaction ID
        success_url: `${PUBLIC_BASE_URL}/api/payment/success`,
        fail_url: `${PUBLIC_BASE_URL}/api/payment/fail`,
        cancel_url: `${PUBLIC_BASE_URL}/api/payment/cancel`,
        cus_name: "Sakib Sarkar Emon",
        cus_email: "sakib@example.com",
        cus_add1: "Dhaka",
        cus_phone: "017xxxxxxxx",
      };

      try {
        // ==========  SEBL API calll ==========
        const SEBL_API_URL =
          process.env.SEBL_API_URL ||
          "https://sandbox.seblpg.com/api/v1/payment/initiate";

        const payload = new URLSearchParams(data).toString();

        const response = await axios.post(SEBL_API_URL, payload, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        });

        console.log("Gateway init response:", response.data);

        // GatewayPageURL আসলে user redirect হবে bank page এ
        const { GatewayPageURL } = response.data;

        if (GatewayPageURL) {
          return res.json({ url: GatewayPageURL });
        }

        // যদি কোন error হয়
        return res
          .status(400)
          .json({
            message: "Failed to create payment",
            response: response.data,
          });
      } catch (error) {
        console.error(
          "Payment Initiate Error:",
          error?.response?.data || error.message
        );

        // 🔹 Fallback: mock checkout for demo/test
        const mockGatewayURL = `http://localhost:5173/mock-checkout?orderId=${data.tran_id}`;
        return res.json({ url: mockGatewayURL });
      }
    });

    // ================= Success Callback =================
    app.post("/api/payment/success", (req, res) => {
      console.log("✅ Payment Successful:", req.body);
      // এখানে database update করতে পারো
      return res.redirect("http://localhost:5173/payment-success");
    });

    // ================= Fail Callback =================
    app.post("/api/payment/fail", (req, res) => {
      console.log("❌ Payment Failed:", req.body);
      return res.redirect("http://localhost:5173/payment-fail");
    });

    // ================= Cancel Callback =================
    app.post("/api/payment/cancel", (req, res) => {
      console.log("⚠️ Payment Canceled:", req.body);
      return res.redirect("http://localhost:5173/payment-fail");
    });
    //
    //
    // SEBl WORK END
    //
    //

    // all course show
    app.get("/courses", async (req, res) => {
      const result = await CoursesAll.find().toArray();
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
    // update user from details order id add
    app.patch("/updateUser/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const updateData = req.body;
      console.log(updateData);

      const UpdateU = await UsersAll.updateOne(
        { email: email },
        { $set: updateData }
      );

      res.send({ ...UpdateU, message: "✅ User updated successfully" });
    });

    // order start
    app.post("/orders", async (req, res) => {
      const data = req.body || {};
      const result = await OrdersAll.insertOne(data);

      return res
        .status(201)
        .json({ insertedId: result.insertedId, message: "Order saved" });
    });
    // order end

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
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
