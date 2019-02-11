const express = require("express");
const router = express.Router();
const Game = require("../models/Game");
const Event = require("../models/Event");
const Join = require("../models/Join");
const User = require("../models/User")
const mapbox = require('../public/javascripts/geocode');


/* GET home page */
router.get("/", (req, res, next) => {
  res.render("index");
});

//GET add-event page
router.get("/add-event", (req, res, next) => {
  if (!req.user) {
    // req.flash("errorMessage", "You need to be connected to add a link");
    res.redirect("/auth/login");
    return;
  }
  
  Game.find().then(games => {
    res.render("add-event", { games });
  });
});

//POST add-event
router.post("/add-event", (req, res, next) => {
  const { address, date, _game, description, slot } = req.body;
  const _user = req.user._id;

  mapbox('pk.eyJ1IjoiZnJkMjZ4IiwiYSI6ImNqcnQ4ZGFzMjF4dDA0M3BzOWg4NGNlem4ifQ.SgF_HKYViz0-nlirZ9Ksag', `${address}`, function(err, data) { 
    const newEvent = new Event({
      address,
      "loc": { 
        "type": "Point",
        "coordinates": data.features[0].center
    },
      date,
      _game,
      description,
      slot,
      _user
    });
  
    newEvent
      .save()
      .then(event => {
        res.redirect("/events");
      })
      .catch(err => console.log(err));
    /*console.log(`LONG & LAT of ${address} `,data.features[0].center);*/ });
  
});

//GET events  //find all the events
router.get('/events',(req,res,next)=>{
  Promise.all([
    Join.find({_user:req.user._id}).lean(),
    Event.find()
    .populate('_game')
    .populate('_user').lean()
  ]).then(([usersEvents, allEvents])=>{
   
    res.render('events',{ 
      allEvents: allEvents.map(event=>({
        ...event,
        isJoined: usersEvents.some(join=>join._user.equals(req.user._id)&&join._event.equals(event._id)),
        isOwner: event._user._id.equals(req.user._id)  ? true : false
      })),
      errorMessage: req.flash('errorMessage')[0]
    })
  })
  .catch(err=>console.log(err))
})



//GET join 
router.get('/join-event/:eventId',(req,res,next)=>{
  const _event = req.params.eventId
  const _user  = req.user._id
  
  const newJoin = new Join({
   _event,
   _user
  })

  newJoin.save()
   .then(()=>{
     Event.update({_id:req.params.eventId},{ $inc: { slot: -1 }}).then(()=>{
      res.redirect('/events')
     }).catch(err=>console.log(err))
     
   })
   .catch(err=>console.log(err))


})

//GET cancel join
router.get('/cancel-event-join/:eventId',(req,res,next)=>{
  
  Join.findOneAndRemove({_event:req.params.eventId,
  _user:req.user._id})
  .then(()=>{

    Event.update({_id:req.params.eventId},{ $inc: { slot: +1 }}).then(()=>{
      res.redirect('/events')
     }).catch(err=>console.log(err))
  })
  .catch(err=>console.log(err))

})

//GET cancel EVENT
router.get('/cancel-event/:eventId',(req,res,next)=>{
 
  Promise.all([
    Event.findOneAndRemove({_id:req.params.eventId}),
    Join.deleteMany({_event:req.params.eventId}).exec()
  ])
  .then(()=>res.redirect('/events'))
  .catch(err=>console.log(err))

})

//get user profile
router.get('/profile/:userId', (req, res, next)=>{
  Promise.all([
    User.findOne({_id: req.params.userId}),
    Join.find({_user: req.params.userId}).populate({ 
      path: '_event',
      populate: {
        path: '_game',
        model: 'Game'
      } 
   }).lean(),
    Event.find({_user: req.params.userId})
  ])
    .then(([user, join, event])=>{
      console.log( user)
      res.render('profile', {user, join, event})
    })
    .catch(err=> console.log(err))
})
module.exports = router;