const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
app.use(
  cors({
    origin: ["http://localhost:5173" , "https://check102.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());
// Parse form-encoded payloads (bank gateway callbacks usually post this)
app.use(express.urlencoded({ extended: true }));
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
const varifyToken = (req,res,next)=>{
  console.log("varify token called -----------------------------")
  const tkn = req.cookies?.token;
  if(!tkn){
    return res.status(401).json({message:"Unauthorized access"});
  }
  jwt.verify(tkn , process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(403).json({message:"Forbidden access"});
    }

    req.user = decoded;
    console.log(req.user.data.email)
    next();

  })
} 




// /

async function run() {
  try {
    // Ensure DB connection established before queries
    await client.connect();
    const CoursesAll = client.db("COURSE").collection("courses");
    const UsersAll = client.db("COURSE").collection("users");
    const OrdersAll = client.db("COURSE").collection("orders");
    const SupportAll = client.db("COURSE").collection("support");
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
        return res.status(400).json({
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
    // JJJJJJJJJJWWWWWWWWWWWWWWWTTTTTTTTTTTTTTTTT

    // generate jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(
        {
          data: user,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false, // local MUST be false
          sameSite: "lax", // local MUST NOT be "none"
        })
        .send({ success: true });
    });
    // order enrolled user course
    app.get("/enrolled/:email", async (req, res) => {
      const { email } = req.params;
      
      console.log(email, "pppp");
      const result = await OrdersAll.find({ personEmail: email }).toArray();
      console.log(result);
      res.send(result);
    });
    // manage courses
    app.get("/manage-courses", async(req,res)=>{
      const result = await CoursesAll.find().toArray();
      res.send(result);
    })
    app.delete("/manage-courses/:id", async(req,res)=>{
      const {id} = req.params;
      console.log(id);
      const result = await CoursesAll.deleteOne({_id: new ObjectId(id)});
      res.send(result);
    })
    app.patch("/manage-courses/:id", async(req,res)=>{
      const {id} = req.params;
      console.log(id);
      const updateData = req.body;
      console.log(updateData);
      const result = await CoursesAll.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send({ result, message: "✅ Course updated successfully" });  
    })

    // support section user
    app.post("/support", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await SupportAll.insertOne(body);
      res.send(result);
    });

    app.get("/supportAll",varifyToken, async (req, res) => {
      console.log("support all called -----------------------------", req.query.email)
      if(req.query.email !== req.user.data.email){
        res.status(403).send({message:"forbidden access"})
      }
      const result = await SupportAll.find({ status: "Pending" }).toArray();
      res.send(result);
    });

    app.get("/support/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const result = await SupportAll.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // all course show
    app.get("/courses", async (req, res) => {
      const result = await CoursesAll.find().toArray();
      res.send(result);
    });
    // add courses
    app.post("/addCourse", async(req,res)=>{
      const body = req.body;
      const result = await CoursesAll.insertOne(body);
      res.send(result);
    })
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
        { $set: { role: updateRole.role } }
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
