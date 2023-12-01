const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bjwj9uc.mongodb.net/?retryWrites=true&w=majority`;

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

    const districtCollection = client.db("MediCareDb").collection("districts");
    const upazilaCollection = client.db("MediCareDb").collection("upazilas");
    const userCollection = client.db("MediCareDb").collection("users");
    const testCollection = client.db("MediCareDb").collection("allTests");
    const appointmentCollection = client.db("MediCareDb").collection("upcomingAppointments");
    const paymentCollection = client.db("MediCareDb").collection("payments");
    // jwt related api start
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log('inside verify Token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    app.get('/districts', async (req, res) => {
      const result = await districtCollection.find().toArray();
      res.send(result);
    });

    app.get('/upazilas', async (req, res) => {
      const result = await upazilaCollection.find().toArray();
      res.send(result);
    });

    // get user
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get each user by id
    app.get('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    //get admin 
    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin })
    })

    // get user as per user email
    app.get('/userProfile', verifyToken, async (req, res) => {
      const user = req.query.email;
      const query = { email: user }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    //create user collection
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesn't exist
      // can do this many ways (1. email unique, 2. upsert, 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })
      } else {
        const result = await userCollection.insertOne(user)
        res.send(result);
      }
    });

    // update menu
    app.patch('/editUserProfile/:id', verifyToken, async (req, res) => {
      const userProfile = req.body;
      const id = req.params.id;
      // const filter = { _id: new ObjectId(id) }
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: userProfile.name,
          email: userProfile.email,
          bloodGroup: userProfile.bloodGroup,
          district: userProfile.district,
          upazila: userProfile.upazila,
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // delete user api 
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })

    // update user role
    app.patch('/updateUserRole/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // update user status
    app.patch('/updateUserStatus/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'blocked'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // user related api ---------------end-------------

    // all tests related api end point ----Start---------

    app.get('/allTests', async (req, res) => {
      const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
      console.log('Today:', today);
      try {
        const result = await testCollection.find({
          'availableDates.date': { $gte: today },
        }).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/test/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await testCollection.findOne(query);
      res.send(result);
    });

    app.patch('/updateSlot/:id/decrementSlot', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // Use $inc with a negative value to decrement the slots field
      const result = await testCollection.updateOne(query, { $inc: { 'availableDates.$.slots': -1 } });

      if (result.matchedCount === 1 && result.modifiedCount === 1) {
        res.status(200).send('Slots decremented successfully');
      } else {
        res.status(404).send('Test not found or slots count not updated');
      }
    });


    // update menu
    app.patch('/menuEdit/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      // const filter = { _id: new ObjectId(id) }
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // get Appointments collection as per user email
    app.get('/upcomingAppointments', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await appointmentCollection.find(query).toArray();
      res.send(result);
    });

    //create Appointments collection
    app.post('/upcomingAppointments', verifyToken, async (req, res) => {
      const appointment = req.body;
      const id = req.query.id;
      // console.log(id);
      const date = appointment.appointmentDate.split('/')
      let [month, day, year] = date
      if (parseInt(month) < 10) {
        month = '0' + month
      }
      if (parseInt(day) < 10) {
        day = '0' + day
      }

      const actualDate = `${year}-${month}-${day}`
      // console.log(date);
      const result1 = await testCollection.updateOne({ _id: new ObjectId(id), "availableDates.date": actualDate }, {
        $inc: {
          "availableDates.$.slots": -1
        }
      })
      // console.log(result1);
      // console.log(appointment.appointmentDate.split('T')[0]);
      const result = await appointmentCollection.insertOne(appointment)
      res.send(result);

    });

    // update user role
    app.patch('/upcomingAppointment/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          testStatus: 'Canceled'
        }
      }
      const result = await appointmentCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // delete cart api 
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })

    // payment intent

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });


    // payment history
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);
    });


    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the best way
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => total + payment.price, 0);

      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue
      })
    })

    // using aggregate pipeline
    app.get('/order-stats', async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuItemIds'
        },
        {
          $lookup: {
            from: "menu",
            let: { menuItemId: { $toObjectId: "$menuItemIds" } }, // Convert menuItemIds to ObjectId
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$$menuItemId", "$_id"], // Compare converted menuItemIds with _id in menuCollection
                  },
                },
              },
            ],
            as: "menuItems",
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItems.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('MediCare is sitting')
})

app.listen(port, () => {
  console.log(`MediCare is sitting on port ${port}`);
})