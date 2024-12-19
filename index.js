const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://users-management-9a54e.web.app',
    'https://users-management-9a54e.firebaseapp.com',
    ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) =>{
  const token = req.cookies.token;

  if(!token){
   return  res.status(401).send({message: 'Unauthorized access'});
  }

  // verify token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) =>{
    if(err){
      return res.status(401).send({message: "Unauthorized access"})
    }
    req.user = decoded;
    next()
  })
  
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wwm8j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // jobs related apis
    const jobsApplication = client.db("jobPortal").collection("jobs");
    const jobApply = client.db("jobPortal").collection("jobApply");


    // make token apis
    app.post("/jwt", (req,res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {expiresIn: "10h"});
      res.cookie('token', token, {
        httpOnly:true,
        secure: process.env.NODE_ENV === 'production',
         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
      .send({success: true})
    })

    // token delete user logout
    app.post("/logout", (req,res) =>{
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
      .send({success: true})
    })

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if(email){
        query = {hr_email: email}
      }
      const cursor = jobsApplication.find(query);
      const result = await cursor.toArray();
      res.send(result)
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsApplication.findOne(query);
      res.send(result)
    });

    app.post("/jobs", async(req,res) =>{
      const newJob = req.body;
      const result = await jobsApplication.insertOne(newJob);
      res.send(result);
    })


    // job apply apis

    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      // if (!email) {
      //   return res.status(400).send({ message: 'Bad Request: Email is required' });
      // }

      if(req?.user?.email !== email){
        return res.status(403).send({message: 'Forbidden access'})
      }

      const result = await jobApply.find(query).toArray();

      for (const application of result) {
        // console.log(application.job_id)
        const query1 = { _id: new ObjectId(application.job_id) }
        const job = await jobsApplication.findOne(query1);
        if(job){
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
        }
      }
      res.send(result)
    })

    app.get("/job-application/jobs/:job_id", async(req,res)=>{
      const jobId = req.params.job_id;
      const query = {job_id: jobId};
      const result = await jobApply.find(query).toArray();
      res.send(result)
    })



    app.post("/jobs-application", async (req, res) => {
      const application = req.body;
      const result = await jobApply.insertOne(application);

      const id = application.job_id;
      const query = {_id: new ObjectId(id)};
      const job = await jobsApplication.findOne(query);
      let newCount = 0;
      if(job.applicationCount){
        newCount = job.applicationCount + 1;
      }
      else{
        newCount = 1;
      }

      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set:{
          applicationCount: newCount
        }
       
      }
      const updateResult = await jobsApplication.updateOne(filter,updateDoc)

      res.send(result);
    });

    app.patch("/job-application/:id", async(req,res) =>{
      const id = req.body.id;
      const data = req.body;
      const query = {_id: new ObjectId(id)};
      const updateDoc = {
        $set:{
          status:data.status
        }
      }
      const result = await jobApply.updateOne(query,updateDoc);
      res.send(result);
    })



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("job is falling from the sky")
})

app.listen(port, () => {
  console.log(`job is waiting at: ${port}`)
})