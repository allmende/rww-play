var App = {
	attr: {
		"name":"This information does not exist !",
		"imgUrl":"/assets/ldp/images/user_background.png",
		"nickname":"-",
		"email":"-",
		"phone":"-",
		"city":"-",
		"country":"-",
		"postalCode":"-",
		"street":"-",
		"birthday":"-",
		"gender":"-",
		"website":"-"
	},

	initialize: function(){
		var self = this;
		var templateUri = "/assets/ldp/templates/userProfileTemplate.html";
		console.log('initialise user profile view');

		// Get base graph and uri.
		this.baseUri = baseUriGlobal;
		this.baseGraph = graphsCache[baseUriGlobal];

		// Get current user relative URI.
		currentUserGlobal = this.currentUserGlobal = this.getPersonToDisplay(this.baseGraph).value;
		console.log("Person to display:" + this.currentUserGlobal);

		// Get corresponding template.
		$.get(templateUri, function(template) {
			loadScript("/assets/ldp/js/menuViewer.js", function() {
				// Create menu.
				MenuView.initialize();

				// Set template.
				self.template = template;

				// Create a PG.
				pointedGraphGlobal = self.pointedGraph = new $rdf.pointedGraph(self.baseGraph, $rdf.sym(self.currentUserGlobal), $rdf.sym(self.baseUri));

				// Load current user.
				self.loadUser(self.currentUserGlobal, function() {
					// render.
					self.render();
				})
			});
		})

		// useful Define templates.
		var formTemplate =
			'<form id="form">' +
				'<input id="input" style="">' +
				'<div class="savePrompt">Save changes?' +
				'<span class="yesSave submit">Yes</span>' +
				'<span class="noCancel cancel">No</span>' +
				'</div>'+
				'</form>';

		// Bind events to DOM.
		this.bindEventsToDom();
	},

	getSubjectsOfType:function (g, subjectType) {
		var triples = g.statementsMatching(undefined,
			RDF('type'),
			subjectType,
			$rdf.sym(this.baseUri));
		return _.map(triples, function (triple) {
			return triple['subject'];
		})
	},

	getFoafPrimaryTopic:function (g) {
		return g.any($rdf.sym(this.baseUri), FOAF('primaryTopic'), undefined)
	},

	getPersonToDisplay:function (g) {
		var foafPrimaryTopic = this.getFoafPrimaryTopic(g);
		if (foafPrimaryTopic) {
			return foafPrimaryTopic;
		} else {
			var personUris = this.getSubjectsOfType(this.baseGraph, FOAF("Person"));
			if (personUris.length === 0) {
				throw "No person to display in this card: " + this.baseUri;
			} else {
				return personUris[0];
			}
		}
	},

 	// Clean URI.
 	// i.e. : look for hashbang in URL and remove it and anything after it
 	cleanUri: function (uri) {
 		var docURI, indexOf = uri.indexOf('#');
 		if (indexOf >= 0)
 		docURI = uri.slice(0, indexOf);
 		else  docURI = uri;
 		return docURI;
 	},

 	loadUser:function (webId, callback) {
		var self = this;

		// Turn Uri into symbol.
		var uriSym = $rdf.sym(webId);

		// Clean Uri.
		var uriCleaned = this.cleanUri(webId);

		// If user graph already fetched, get attributes and render, otherwise fetch it.
		var graph = graphsCache[uriCleaned];
		if (!graph) {
			graph = graphsCache[uriCleaned] = new $rdf.IndexedFormula();
			var fetch = $rdf.fetcher(graph);
			fetch.nowOrWhenFetched(uriCleaned, undefined, function () {
				self.getUserAttributes(this.pointedGraph,
					function () {
						if (callback) callback();
					});
			});
		}
		else {
			self.getUserAttributes(this.pointedGraph,
				function () {
					if (callback) callback();
				});
		}
	},

	/*
 	*
 	* @param userPG pointed graph with pointer pointing on user.
 	* @param callback
 	*/
	getUserAttributes:function (userPg, callback) {
		console.log("getUserAttributes");

		// add name
		var namesPg = userPg.rel(FOAF('name'));
		var names =
			_.chain(namesPg)
				.filter(function (pg) {
					return pg.pointer.termType == 'literal';
				})
				.map(function (pg) {
					return pg.pointer
				})
				.value();
		this.attr.name = (names && names.length > 0 ) ? names[0].value : "No value";
		console.log(this.attr.name);

		// Add image if available
		var imgsPg1 = userPg.rel(FOAF('img'));
		var imgsPg2 = userPg.rel(FOAF('depiction'));
		console.log(imgsPg1);
		console.log(imgsPg2);
		var imgs =
			_.chain(imgsPg1.concat(imgsPg2))
				.map(function (pg) {
					return pg.pointer
				})
				.value();
		this.attr.imgUrl = (imgs && imgs.length > 0 ) ? imgs[0].value : "No profile picture";

		// Render callback.
		if (callback) callback();
	},

	// Define handlers.
	handlerClickOnEditLink:function (e) {
		console.log("handlerClickOnEditLink");
		var parent, parentId , $labelText, $editLink, $form, $input, formerValue;

		// Get target.
		parent = $(e.target).parent().parent();
		parentId = parent.attr('id');

		// Hide name and Open form editor.
		$labelText = parent.find(".labelText");
		$editLink = parent.find(".editLink");
		formerValue = $labelText.html();
		$labelText.hide();
		$editLink.hide();

		// Insert template in the DOM.
		$(formTemplate).insertAfter(parent.find(".labelContainer"));

		// Store useful references.
		$form = parent.find("#form");
		$input = parent.find("#input");

		// Give the form the focus.
		$input
			.val(formerValue)
			.show()
			.focus();

		parent.find(".submit").on("click", function () {
			console.log('submit !');

			// Get the new value.
			var newValue = $input.val();

			// Make the SPARQL request.
			var pred = ' foaf:' + parentId;
			var queryDelete =
				'PREFIX foaf: <http://xmlns.com/foaf/0.1/> \n' +
					'DELETE DATA \n' +
					'{' +
					"<" + baseUri + "#me" + ">" + pred + ' "' + formerValue + '"' + '. \n' +
					'}';

			var queryInsert =
				'PREFIX foaf: <http://xmlns.com/foaf/0.1/> \n' +
					'INSERT DATA \n' +
					'{' +
					"<" + baseUri + "#me" + ">" + pred + ' "' + newValue + '"' + '. \n' +
					'}';

			// Callback success.
			function successCallback() {
				console.log('Saved!');
				// Change value in label.
				$labelText.html(newValue);

				// Re-initiliaze the form.
				$form.remove();
				$labelText.show();
				$editLink.show();
			}

			// Callback error.
			function errorCallback() {
				console.log('error!');
				// Re-initiliaze the form.
				$form.remove();
				$labelText.show();
				$editLink.show();
			}

			// Delete old and insert new triples.
			sparqlPatch(baseUri, queryDelete,
				function () {
					sparqlPatch(baseUri, queryInsert, successCallback, errorCallback);
				},
				function () {
					if (errorCallback) errorCallback();
				}
			);

		});
		parent.find(".cancel").on("click", function () {
			console.log('cancel');
			$form.remove();
			$labelText.show();
			$editLink.show();
		});
	},

	handlerClickOnfriends:function (e) {
		console.log('handlerClickOnfriends');
		if ($('#userbar').css('display') == 'none') {
			// Show contacts Bar.
			loadScript("/assets/ldp/js/contactsViewer.js", function () {
				ContactsView.initialize();
				$("#friends").find('label').html('Hide Contacts')
			});
		}
		else {
			$('#userbar').css('display', 'none');
			$('#userbar').find("#userBarContent").remove();
			$("#friends").find('label').html('Show Contacts')
		}

	},

	bindEventsToView: function() {
		console.log($(".showContacts"));
		// Bind click for on view elements.
		$(".editLinkImg").on("click", this.handlerClickOnEditLink);
		$("#friends").on("click", this.handlerClickOnfriends);
		$(".showContacts").on("click", this.handlerClickOnEditLink);
	},

	bindEventsToDom: function() {},

	render: function(){
		// Define view template.
		var html = _.template(this.template, this.attr);

		// Append in the DOM.
		$('#viewerContent').append(html);

		// Bind events to View elements.
		this.bindEventsToView();
	}
};









/*

// Define templates.
var templateURI = "/assets/ldp/templates/userProfileTemplate.html";
var formTemplate =
	'<form id="form">' +
		'<input id="input" style="">' +
		'<div class="savePrompt">Save changes?' +
			'<span class="yesSave submit">Yes</span>' +
			'<span class="noCancel cancel">No</span>' +
		'</div>'+
		'</form>';



// Default attributes of the user.
var tab = {
	"name":"This information does not exist !",
	"imgUrl":"/assets/ldp/images/user_background.png",
	"nickname":"-",
	"email":"-",
	"phone":"-",
	"city":"-",
	"country":"-",
	"postalCode":"-",
	"street":"-",
	"birthday":"-",
	"gender":"-",
	"website":"-"
};

// Get base graph and uri.
var baseUri = baseUriGlobal;
var baseGraph = graphsCache[baseUri];

// Get the template.
$.get(templateURI, function(data) {
	// Get current user relative URI.
	currentUserGlobal = getPersonToDisplay(baseGraph).value;
	console.log("Person to display:" + currentUserGlobal);

	// Create a PG.
	pointedGraphGlobal = new $rdf.pointedGraph(baseGraph, $rdf.sym(currentUserGlobal), $rdf.sym(baseUri));

	// Load current user.
	loadUser(currentUserGlobal, function() {
		// Define view template.
		var template = _.template(data, tab);

		// Append in the DOM.
		$('#viewerContent').append(template);

		// Bind click for on view elements.
		$(".editLinkImg").on("click", handlerClickOnEditLink);
		$("#friends").on("click", handlerClickOnfriends);
	});
});

function getSubjectsOfType(g,subjectType) {
	var triples = g.statementsMatching(undefined,
		RDF('type'),
		subjectType,
		$rdf.sym(baseUri));
	return _.map(triples,function(triple) { return triple['subject']; })
}

function getFoafPrimaryTopic(g) {
	return g.any($rdf.sym(baseUri),FOAF('primaryTopic'),undefined)
}

function getPersonToDisplay(g) {
	var foafPrimaryTopic = getFoafPrimaryTopic(g);
	if ( foafPrimaryTopic ) {
		return foafPrimaryTopic;
	} else {
		var personUris = getSubjectsOfType(baseGraph,FOAF("Person"));
		if ( personUris.length === 0 ) {
			throw "No person to display in this card: " + baseUri;
		} else {
			return personUris[0];
		}
	}
}


*/
/*
* Define handlers.
* *//*

function handlerClickOnEditLink(e) {
	console.log("handlerClickOnEditLink");
	var parent, parentId , $labelText, $editLink, $form, $input, formerValue;

	// Get target.
	parent = $(e.target).parent().parent();
	parentId = parent.attr('id');

	// Hide name and Open form editor.
	$labelText = parent.find(".labelText");
	$editLink = parent.find(".editLink");
	formerValue = $labelText.html();
	$labelText.hide();
	$editLink.hide();

	// Insert template in the DOM.
	$(formTemplate).insertAfter(parent.find(".labelContainer"));

	// Store useful references.
	$form = parent.find("#form");
	$input = parent.find("#input");

	// Give the form the focus.
	$input
		.val(formerValue)
		.show()
		.focus();

	parent.find(".submit").on("click", function() {
		console.log('submit !');

		// Get the new value.
		var newValue = $input.val();

		// Make the SPARQL request.
		var pred = ' foaf:' + parentId;
		var queryDelete =
			'PREFIX foaf: <http://xmlns.com/foaf/0.1/> \n' +
			'DELETE DATA \n' +
			'{'+
				"<"+ baseUri+"#me" +">" + pred + ' "' + formerValue + '"' + '. \n' +
			'}';

		var queryInsert =
			'PREFIX foaf: <http://xmlns.com/foaf/0.1/> \n' +
				'INSERT DATA \n' +
				'{'+
				"<"+ baseUri+"#me" +">" + pred + ' "' + newValue + '"' + '. \n' +
				'}';

		// Callback success.
		function successCallback() {
			console.log('Saved!');
			// Change value in label.
			$labelText.html(newValue);

			// Re-initiliaze the form.
			$form.remove();
			$labelText.show();
			$editLink.show();
		}

		// Callback error.
		function errorCallback() {
			console.log('error!');
			// Re-initiliaze the form.
			$form.remove();
			$labelText.show();
			$editLink.show();
		}

		// Delete old and insert new triples.
		sparqlPatch(baseUri, queryDelete,
			function() {
				sparqlPatch(baseUri, queryInsert, successCallback, errorCallback);
			},
			function() {
				if (errorCallback) errorCallback();
			}
		);

	});
	parent.find(".cancel").on("click", function() {
		console.log('cancel');
		$form.remove();
		$labelText.show();
		$editLink.show();
	});
}

function handlerClickOnfriends(e) {

	if ($('#userbar').css('display') == 'none') {
		// Show contacts Bar.
		loadScript("/assets/ldp/js/contactsViewer.js", function() {
			$("#friends").find('label').html('Hide Contacts')
		});
	}
	else {
		$('#userbar').css('display', 'none');
		$('#userbar').find("#userBarContent").remove();
		$("#friends").find('label').html('Show Contacts')
	}

}


*/
/*
* Clean URI.
* i.e. : look for hashbang in URL and remove it and anything after it
* *//*

function cleanUri(uri) {
	var docURI, indexOf = uri.indexOf('#');
	if (indexOf >= 0)
		docURI = uri.slice(0, indexOf);
	else  docURI = uri;
	return docURI;
}


*/
/*
* Load a given user (get attributes and render).
* *//*

function loadUser(webId, callback) {
	console.log("loadUser");

	// Turn Uri into symbol.
	var uriSym = $rdf.sym(webId);

	// Clean Uri.
	var uriCleaned = cleanUri(webId);

	// If user graph already fetched, get attributes and render, otherwise fetch it.
	var graph = graphsCache[uriCleaned];
	if (!graph) {
		graph = graphsCache[uriCleaned] = new $rdf.IndexedFormula();
		var fetch = $rdf.fetcher(graph);
		fetch.nowOrWhenFetched(uriCleaned, undefined, function () {
			getUserAttributes(graph, uriSym,
				function() {
					if (callback) callback();
			});
		});
	}
	else {
		getUserAttributes(pointedGraphGlobal,
			function() {
				if (callback) callback();
		});
	}
}

*/
/*
 * Clean URI.
 * i.e. : look for hashbang in URL and remove it and anything after it
 * *//*

function cleanUri(uri) {
	var docURI, indexOf = uri.indexOf('#');
	if (indexOf >= 0)
		docURI = uri.slice(0, indexOf);
	else  docURI = uri;
	return docURI;
}

*/
/**
 * Get attributes of given user by querrying the graph.
 *//*

function getUserAttributes2(graph, uriSym, callback) {
	console.log("getUserAttributes");
	// Helper to select the first existing element of a series of arguments
	var findFirst = function () {
		var obj = undefined,
			i = 0;
		while (!obj && i < arguments.length) {
			obj = graph.any(uriSym, arguments[i++]);
		}
		return obj
	};

	// Add image if available
	var img = findFirst(FOAF('img'), FOAF('depiction'));
	if (img && img.uri) tab.imgUrl=img.uri;

	// Add name
	var nam = findFirst(FOAF('name'));
	if (nam && nam.value) tab.name=nam.value;

	// Add nickname
	var nick = findFirst(FOAF('nick'));
	if (nick && nick.value) tab.nickname=nick.value;

	// Add email if available
	var email = graph.any(uriSym, FOAF('mbox'));
	if (email && email.value) tab.email=email.value;

	// Add phone if available
	var phone = graph.any(uriSym, FOAF('phone'));
	if (phone && phone.value) tab.phone=phone.value;

	// Add website if available
	var website = graph.any(uriSym, FOAF('homepage'));
	if (website && website.value) tab.website=website.value;

	// Add bday if available
	var gender = graph.any(uriSym, FOAF('gender'));
	if (gender && gender) tab.gender=gender.value;

	// Add bday if available
	var bday = graph.any(uriSym, FOAF('birthday'));
	if(bday && bday.value) tab.birthday=bday.value;

	*/
/*
	* Get Contact.
	* *//*


	// Define a SPARQL query to fetch the address
	var sparqlQuery = "PREFIX contact:  <http://www.w3.org/2000/10/swap/pim/contact#> \n" +
			"SELECT ?city ?country ?postcode ?street \n" +
			"WHERE {\n" +
			"  " + uriSym + " contact:home ?h . \n" +
			"  ?h contact:address ?addr  . \n" +
			"  OPTIONAL { ?addr contact:city ?city . } \n" +
			"  OPTIONAL { ?addr contact:country ?country . } \n" +
			"  OPTIONAL { ?addr contact:postalCode ?postcode . } \n" +
			"  OPTIONAL { ?addr contact:street ?street . } \n" +
			"}",

	// Build the address query JS object
	addressQuery = $rdf.SPARQLToQuery(sparqlQuery, false, graph);

	// Place address in HTML
	var onResult = function (result) {
		// Fill in the address in tab.
		if (result["?city"]) {tab.city=result["?city"].value;}
		if (result["?country"]) {tab.country=result["?country"].value;}
		if (result["?street"]) {tab.street=result["?street"].value;}
		if (result["?postcode"]) {tab.postalCode=result["?postcode"].value;}
	};

	// Hide address field if no address
	var onDone = function () {
		if (callback) callback();
	};

	// Query the fetched graph
	graph.query(addressQuery, onResult, undefined, onDone);
}

*/
/**
 *
 * @param userPG pointed graph with pointer pointing on user.
 * @param callback
 *//*

function getUserAttributes(userPg, callback) {
	console.log("getUserAttributes");

	// add name
	var namesPg = userPg.rel(FOAF('name'));
	var names =
		_.chain(namesPg)
		.filter(function(pg) {return pg.pointer.termType == 'literal';})
		.map(function(pg) {return pg.pointer})
		.value();
	tab.name = (names && names.length >0 )? names[0].value : "No value";
	console.log(tab.name);

	// Add image if available
	var imgsPg1 = userPg.rel(FOAF('img'));
	var imgsPg2 = userPg.rel(FOAF('depiction'));
	console.log(imgsPg1);
	console.log(imgsPg2);
	var imgs =
		_.chain(imgsPg1.concat(imgsPg2))
		.map(function(pg) {return pg.pointer})
		.value();
	tab.imgUrl = (imgs && imgs.length >0 )? imgs[0].value : "No profile picture";

	// Render callback.
	if (callback) callback();
}


function updateAttributesPg(value) {

}
*/
