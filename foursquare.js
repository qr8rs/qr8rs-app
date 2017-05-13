// var foursquare = (require('foursquarevenues'))('CLIENTIDKEY', 'CLIENTSECRETKEY');
var foursquare = (require('foursquarevenues'))('Y5D1QX0FS4R5ZTJ5TLU3RDL1U0PUE4ZU3NPTQDS2AGMW1KGP', 'XM2PZ15QKM0I5TQYTCTYXOVBGWKRHCCFZFNNKZYQA1JV1SNZ');

var params = {
    "ll": "40.7,-74"
};

foursquare.getVenues(params, function(error, venues) {
    if (!error) {
	console.log(venues.toString());
    }
});

foursquare.exploreVenues(params, function(error, venues) {
    if (!error) {
  	console.log(venues.toString());
    }
});
