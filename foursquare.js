const dotenv = require('dotenv');

dotenv.config();

var foursquare = (require('foursquarevenues'))(process.env.FOURSQUARE_CLIENT_ID, process.env.FOURSQUARE_CLIENT_SECRET);

var params = {
    "ll": "40.7,-74"
};

foursquare.getVenues(params, function(error, venues) {
    if (!error) {
	console.log(venues);
    }
});

foursquare.exploreVenues(params, function(error, venues) {
    if (!error) {
  	console.log(venues);
    }
});
