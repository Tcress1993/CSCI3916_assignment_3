const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies'); // You're not using Movie, consider removing it
require('dotenv').config();
const app = express();
app.use(cors());
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

router.route('/movies')
    .get(async (req, res) => {
      try {
        const {title} = req.body; // pulls the title from the request body
        if (!title){
          // if the user doesnt chose a title then it will return all movies
          const movies = await Movie.find({}); // Fetch all movies
          res.status(200).json(movies); // Respond with the movies
        }
        const oneMovie = await Movie.findOne({title: title}); // Find the movie by title
        if (!oneMovie){
          res.status(404).json({success: false, msg: "Movie not found."}); // 404 Not Found
        }
        res.status(200).json(oneMovie); // Respond with the movie
      } catch(err){
        res.status(500).json({ success: false, message: 'GET request not supported' });
      }
      
    })
    .post(async (req, res) => {
        try {
          const { title, releaseDate, genre, actors } = req.body; // Destructure the request body
          if (!title || !releaseDate || !genre || !actors) {
            //if any part of the request body is missing, return a 400 error
            return res.status(400).json({ success: false, msg: 'Please include all required fields.' }); // 400 Bad Request
          }
          if (actors.length < 3) {
            return res.status(400).json({ success: false, msg: "Please include atleast 3 actors."}); // 400 Bad Request
          }
          // Check for duplicate movies
          if (await Movie.findOne({ title })) {
            return res.status(409).json({ success: false, msg: 'Movie already exists.' }); // 409 Conflict
          }
          const newMovie = new Movie(req.body); // Create a new movie instance
          await newMovie.save(); // Save the movie to the database
          res.status(201).json({ success: true, msg: 'Movie added successfully.', movie: newMovie }); // 200 OK
        } catch (err) {
          console.error(err); // Log the error for debugging
          res.status(500).json({success: false, message: "movie not saved."}); // 500 Internal Server Error
        }
    })
    .delete(async (req, res) => {
        try{
          const {title} = req.body; // pulls the id from the request body
          if (!title) {
            return res.status(400).json({ success: false, msg: 'Please include the title of the movie to delete.' }); // 400 Bad Request
          }
          const deleteMovie = await Movie.findOneAndDelete({title: title}); // Find and delete the movie by title
          if (!deleteMovie) {
            return res.status(404).json({ success: false, msg: 'Movie not found.' }); // 404 Not Found
          }
          res.status(200).json({sucess: true, msg: "Movie deleted successfully."}); //movie deleted successfully
        } catch(err){
          res.status(500).json({ success: false, message: 'DELETE request not supported' }); // 500 Internal Server Error
        }
    })
    .put(async (req, res) => {
      try {
        const {title, ...update} = req.body;
        if (title){
          // No ID provided, return an error
          res.status(400).json({success: false, msg: "ID is required to update a movie."}); // 400 Bad Request
        }
        // Update the movie with the new data
        const movieUpdates = await Movie.findByIdAndUpdate(title, {$set: update}, {new: true, runValidators: true});
        if (!movieUpdates){
          // Movie not found, return an error
          res.status(404).json({success: false, msg: "Movie not found."}); // 404 Not Found
        }
        res.status(200).json({success: true, msg: "Movie updated successfully.", movie: movieUpdates}); // 200 OK
      }catch(err){
        res.status(500).json({success: false, msg: "Movie not updated."}); // 500 Internal Server Error
      }
    });

app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only