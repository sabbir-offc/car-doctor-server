const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;



//middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.klmlttn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


//custom middleware
const logger = async (req, res, next) => {
    next();
}
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access.' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access.' })
        }
        req.user = decoded;
        next();
    });
}



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const serviceCollection = client.db('carsDoctor').collection('services')
        const bookingCollection = client.db('carsDoctor').collection('booking')

        //auth related
        app.post('/jwt', async (req, res) => {
            try {
                const userEmail = req.body;
                const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    // sameSite: 'none'
                })
                    .send({ success: true });
            } catch (error) {
                return res.send({ error: true, message: error.message });
            }
        })
        app.post('/logout', async (req, res) => {
            try {
                res.clearCookie('token', { maxAge: 0 }).send({ success: true });
            } catch (error) {
                return res.send({ error: true, message: error.message });
            };
        })

        app.get('/services', async (req, res) => {
            const result = await serviceCollection.find().toArray();
            res.send(result)
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = {
                projection: { title: 1, img: 1, price: 1, service_id: 1 },
            };
            const result = await serviceCollection.findOne(query, options)
            res.send(result);
        })


        //booking
        app.get('/bookings', verifyToken, logger, async (req, res) => {
            try {
                if (req.user.email !== req.query.email) {
                    return res.status(403).send({ message: 'forbidden' })
                }
                let query = {};
                if (req.query?.email) {
                    query = { email: req.query.email }
                }
                const result = await bookingCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                return res.send({ error: true, message: error.message });
            }
        })

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const updatedBookings = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: updatedBookings.status,
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result)


        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
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
    res.send('Car Doctor Server is running successfully.');
});

app.listen(port, () => {
    console.log(`Server is Running on PORT: ${port}`);
});