const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'http://localhost:5173'],
  credentials: true
}));
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
    const bannerCollection = client.db("MediCareDb").collection("banners");
    const paymentCollection = client.db("MediCareDb").collection("payments");
    const recommendationCollection = client.db("MediCareDb").collection("recommendation");
    const blogCollection = client.db("MediCareDb").collection("healthWellness");
    const doctorCollection = client.db("MediCareDb").collection("findDoctors");
    const departmentCollection = client.db("MediCareDb").collection("departments");
    // jwt related api start
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify Token', req.headers.authorization);
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
    app.get('/user/admin/:email', async (req, res) => {
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }
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
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })
      } else {
        const result = await userCollection.insertOne(user)
        res.send(result);
      }
    });

    // Update User Profile
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
      // console.log('Today:', today);
      try {
        const result = await testCollection.find({
          'availableDates.date': { $gte: today },
        }).toArray();
        res.send(result);
      } catch (error) {
        // console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/test/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await testCollection.findOne(query);
      res.send(result);
    });

    // cerate API for add a new Test
    app.post('/addATest', verifyToken, verifyAdmin, async (req, res) => {
      const test = req.body;
      // console.log(test);
      const result = await testCollection.insertOne(test);
      res.send(result);
    });

    // delete test api data 
    app.delete('/deleteTest/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await testCollection.deleteOne(query);
      res.send(result)
    })

    // Update Test
    app.patch('/updateTest/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userTest = req.body;
      console.log(userTest);
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: userTest
      }
      console.log(updatedDoc);
      const result = await testCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // get all Reservations for Admin
    app.get('/allReservations', verifyToken, verifyAdmin, async (req, res) => {
      const result = await appointmentCollection.find().toArray();
      res.send(result);
    });

    // get only mostly Booked Tests
    app.get('/mostlyBookedTests', async (req, res) => {
      try {
        const allTests = await appointmentCollection.find().toArray();

        // Group tests by test title and count bookings
        const testCounts = allTests.reduce((acc, test) => {
          const testTitle = test.testTitle;
          acc[testTitle] = (acc[testTitle] || 0) + 1;
          return acc;
        }, {});

        // Convert testCounts object to an array of { testTitle, bookingCount, image } objects
        const testsWithCountsAndImages = Object.keys(testCounts).map(testTitle => {
          const relevantTest = allTests.find(test => test.testTitle === testTitle);
          return {
            testTitle,
            bookingCount: testCounts[testTitle],
            image: relevantTest ? relevantTest.image : null,
          };
        });

        // Sort tests by booking count in descending order
        const sortedTests = testsWithCountsAndImages.sort((a, b) => b.bookingCount - a.bookingCount);

        // You can customize the number of top tests to retrieve (e.g., top 5)
        const topTests = sortedTests.slice(0, 10);

        res.json(topTests);
      } catch (error) {
        console.error("Error fetching mostly booked tests:", error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


    // get Appointments collection as per user email
    app.get('/upcomingAppointments', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await appointmentCollection.find(query).toArray();
      res.send(result);
    });

    // get Test Result as per user
    app.get('/testResults', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email, reportStatus: "Delivered" }
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

    // get All banners 
    app.get('/AllBanners', verifyToken, verifyAdmin, async (req, res) => {
      const result = await bannerCollection.find().toArray();
      res.send(result);
    });

    // get only isActive=true banner 
    app.get('/activeBanner', async (req, res) => {
      const result = await bannerCollection.findOne({ isActive: true });
      res.send(result);
    });

    // cerate API for add a new banner
    app.post('/addBanner', verifyToken, verifyAdmin, async (req, res) => {
      const test = req.body;
      console.log(test);
      const result = await bannerCollection.insertOne(test);
      res.send(result);
    });

    // delete test api data 
    app.delete('/deleteBanner/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bannerCollection.deleteOne(query);
      res.send(result)
    })

    // set isActive=true for a specific banner and isActive=false for others
    app.patch('/setActiveBanner/:id', verifyToken, verifyAdmin, async (req, res) => {
      const bannerId = req.params.id;

      // Start a session to ensure atomicity in updates
      const session = client.startSession();
      session.startTransaction();

      try {
        // Set isActive=false for all banners
        await bannerCollection.updateMany({}, { $set: { isActive: false } }, { session });

        // Set isActive=true for the clicked banner
        const result = await bannerCollection.updateOne(
          { _id: new ObjectId(bannerId) },
          { $set: { isActive: true } },
          { session }
        );

        // Commit the transaction
        await session.commitTransaction();

        res.json({ updatedCount: result.modifiedCount });
      } catch (error) {
        // Abort the transaction on error
        await session.abortTransaction();
        console.error('Error setting banner as active:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      } finally {
        // End the session
        session.endSession();
      }
    });


    // update test Status for user only
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

    // update report status only for admin
    app.patch('/updateReportStatus/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { reportLink } = req.body;
      console.log(reportLink);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          testStatus: 'Done',
          reportStatus: 'Delivered',
          reportLink: reportLink
        }
      }
      const result = await appointmentCollection.updateOne(filter, updateDoc, { upsert: true });
      res.send(result);
    });


    app.get('/recommendation', async (req, res) => {
      const result = await recommendationCollection.find().toArray();
      res.send(result);
    });

    // get user
    app.get('/healthWellness', async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result);
    });

    // get all doctors
    app.get('/findDoctors', async (req, res) => {
      const result = await doctorCollection.find().toArray();
      res.send(result);
    });

    // get all departments
    app.get('/departments', async (req, res) => {
      const result = await departmentCollection.find().toArray();
      res.send(result);
    });


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
    // await client.db("admin").command({ ping: 1 });
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