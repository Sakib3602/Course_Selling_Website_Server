const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    
    const CoursesAll = client.db("COURSE").collection("courses");
    const UsersAll = client.db("COURSE").collection("users");

    // all course show
    app.get("/courses", async (req, res) => {
      const result = await CoursesAll.find().toArray();
      res.send(result);
    });
    // single data
    app.get("/single/:id", async(req,res)=>{
      const {id} = req.params
      console.log(id)
      const result = await CoursesAll.findOne({_id : new ObjectId(id)})
      console.log("OPp")
      res.send(result)
    })

    // users
    app.post("/users", async(req,res)=>{
      const body = req.body;
      console.log(body);
      if (await UsersAll.findOne({ email: body?.email })) {
        return;
      }
      const result = await UsersAll.insertOne(body);
      res.send(result);
    })

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
