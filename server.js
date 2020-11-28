const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', { useUnifiedTopology: true, useNewUrlParser: true } )
app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const userSchema = new mongoose.Schema({name: {type: String, required: true}});
const User = mongoose.model('User', userSchema);

const exerciseSchema = new mongoose.Schema({
  userId: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User'},
  description: {type: String, required: true},
  duration: {type: Number, required: true},
  date: {type: Date, default: new Date().toISOString()}
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

const getDateYYYYMMDD = date => date.toISOString().split('T')[0]

const checkIfUserExists = async id => {
  const user = await User.findOne({_id: id})
  return user || false;
}

const validateNewExercise = (req, res, next) => {
  const body = req.body;
  if (body.userId && body.description && body.duration) {
    return next();
  }
  next({status: 400, message: 'bad request'});
}

app.post('/api/exercise/new-user', (req, res, next) => {
  User.create({name: req.body.username}, (err, data) => {
    if (err) return next(err);
    else res.json({_id: data._id, username: data.name});
  })
})

app.get('/api/exercise/users', (req, res, next) => {
    User.find({}, (err, data) => {
      if (err) return next(err);
      res.send(data);
    })
})

app.post('/api/exercise/add', validateNewExercise, async (req, res, next) => {
    const body = req.body;
    const user = await checkIfUserExists(body.userId);
    if (!user) return next({status: 400, message: 'bad request'});
    const newExercise = {
      userId: body.userId,
      description: body.description,
      duration: body.duration
    };
    if (body.date) newExercise.date = new Date(body.date);
    Exercise.create(newExercise, (err, data) => {
      if (err) return next(err);
      res.json({
        _id: user._id,
        username: user.name,
        description: data.description,
        duration: data.duration,
        date: data.date.toDateString()
      });
    })
})

app.get('/api/exercise/log', async (req, res, next) => {
  const query = req.query;
  const user = await checkIfUserExists(query.userId);
  if (!user) return next({status: 400, message: "bad request"});
  let dateQuery = {};
  const limit = query.limit ? parseInt(query.limit) : 0;
  dateQuery.$gte = query.from ? new Date(query.from).toISOString() : 0;
  if (query.to) dateQuery.$lte = new Date(query.to).toISOString();
  const data = await Exercise.find({userId: user._id, date: dateQuery}).limit(limit);
  const resObj = {
    "_id": user._id,
    "username": user.name,
    "count": data.length,
    "log": data.map(data => ({
      _id: data._id,
      userId: data.userId,
      description: data.description,
      duration: data.duration,
      date: getDateYYYYMMDD(data.date)
    }))
  }
  res.json(resObj);
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
