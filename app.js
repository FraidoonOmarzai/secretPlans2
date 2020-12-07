require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy; 
const findOrCreate = require("mongoose-findorcreate");

const app = express();

// able us to access the entire body portion
app.use(bodyParser.urlencoded({
   extended: true
}));
app.set("view engine", "ejs"); // to set ejs on our project
app.use(express.static("public")); // for using css we write this code

app.use(session({
   secret: process.env.SECRET,
   resave: false,
   saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// connecting my db to localhost
mongoose.connect("mongodb://localhost:27017/planDB", {
   useNewUrlParser: true,
   useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true); // avoid error/warning on terminal with help of stack overflow
mongoose.set('useFindAndModify', false); // avoid error/warning on terminal with help of stack overflow

// creating schema for our db
const planSchema = new mongoose.Schema({
   email: String,
   password: String,
   secret: [String],
   googleId:String
});

planSchema.plugin(passportLocalMongoose);
planSchema.plugin(findOrCreate);

const Plan = new mongoose.model("Plan", planSchema);

passport.use(Plan.createStrategy());

passport.serializeUser(function(user, done) {
   done(null, user.id);
});

passport.deserializeUser(function(id, done) {
   Plan.findById(id, function(err, user) {
      done(err, user);
   });
});

passport.use(new GoogleStrategy({
   clientID: process.env.CLIENT_ID,
   clientSecret: process.env.CLIENT_SECRET,
   callbackURL: "http://localhost:3000/auth/google/plans",
   userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
 },
 function(accessToken, refreshToken, profile, cb) {
   //  console.log(profile);
   Plan.findOrCreate({ googleId: profile.id }, function (err, user) { // we have to install findorcreate
     return cb(err, user);
   });
 }
));

app.get("/", (req, res) => {
   res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/plans", 
  passport.authenticate('google', { failureRedirect: "/login" }),
   function(req, res) {
    // Successful authentication, redirect plans.
    res.redirect('/plans');
});

app.get("/login", (req, res) => {
   res.render("login");
});

app.get("/register", (req, res) => {
   res.render("register");
});

app.get("/logout", (req, res) => {
   req.logout(); // got this code from doc passport
   res.redirect("/");
});

app.get("/plans", (req, res) => {
   // first check for authentication than find specific user with id
   if (req.isAuthenticated()) {
      Plan.findById(req.user.id, (err, foundUser) => {
         if (err) {
            console.log(err);
         } else {
            if (foundUser) {
               res.render("plans", {
                  username: foundUser.username,
                  plans: foundUser.secret,
                  userID:foundUser._id
               });
            }
         }
      });
   } else {
      res.redirect("/login");
   }
});

app.post("/submit", (req, res) => {
   const submitedPlan = req.body.newPlan;

   // we are gonna find the specific user and push the plan to that user which typed and redirect to plans
   Plan.findById(req.user.id, (err, foundUser) => {
      if (err) {
         console.log(err);
      } else {
         if (foundUser) {
            foundUser.secret.push(submitedPlan); // push the plan to user plans list
            foundUser.save(() => {
               res.redirect("/plans");
            });
         }
      }
   });
});

app.post("/delete", (req, res) => {
   const checkedPlan = req.body.checkbox;

   // find the username and than delete the specific ele from array of secrets back redirect to plans
   Plan.findOneAndUpdate({
         _id:req.body.userID
      }, {
         $pull: {
            secret: checkedPlan
         }
      },
      (err, found) => {
         if (!err) {
            res.redirect("/plans");
         }
      }
   );
});

app.post("/register", (req, res) => {
   // regirster the user for first time and redirect to his plans page
   Plan.register({
      username: req.body.username
   }, req.body.password, (err, user) => {
      if (err) {
         console.log(err);
         res.redirect("/register");
      } else {
         passport.authenticate("local")(req, res, () => {
            res.redirect("/plans");
         });
      }
   });
});

app.post("/login", (req, res) => {
   // we are storying user email and password if it matchs than redirect to plans
   const user = new Plan({
      username: req.body.username,
      password: req.body.password
   });

   req.login(user, err => {
      if (err) {
         console.log(err);
      } else {
         passport.authenticate("local")(req, res, () => {
            res.redirect("/plans");
         });
      }
   });
});

app.listen(3000, () => {
   console.log("running on port 3000");
});
