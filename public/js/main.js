window.GA = {};
function compareTwoParagraph(p_1, p_2){
  var diffChars = 0;
  /*
  for (var i = 0; i < p_1.length ; ++i){
    diffChars += (p_1[i] == p_2[i]) ? 1 : 0;
  }
  */
  if (p_1 === undefined){
    diffChars += _.reduce(p_2, function(m, c){
      return m + (c.charCodeAt() - 32);
    }, 0);
  } else if (p_2 === undefined){
    diffChars += _.reduce(p_1, function(m, c){
      return m + (c.charCodeAt() - 32);
    }, 0);
  } else {
    var longer = p_1.length > p_2.length ? p_1 : p_2;
    var shorter = p_1.length > p_2.length ? p_2 : p_1;
    diffChars += _.reduce(longer, function(m, c1, i){
      var ascii1 = c1.charCodeAt();
      var ascii2 = shorter[i] ? shorter[i].charCodeAt() : 0;
      return m + Math.abs(ascii1 - ascii2);
    }, 0);
  }
  /*
  */
  return diffChars;
}

(function(GA){
  'use strict';
  var choicesForPopSize = {};

  var goalText = [
    'Our Father in heaven,',
    '',
    '    hallowed be your name,',
    '    your kingdom come,',
    '    your will be done,',
    '',
    '        on earth as in heaven.',
    '',
    'Give us today our daily bread.',
    'Forgive us our sins',
    '',
    '    as we forgive those who sin against us.',
    '',
    'Save us from the time of trial',
    '',
    '    and deliver us from evil.',
    '',
    'For the kingdom, the power, and the glory are yours',
    '',
    '    now and for ever. Amen.',
  ];

  var Generation = Backbone.Model.extend({
    defaults: function(){
      var ret = {
        maxPopulation: 20,
        maxElites: 2,   // 10%
        maxElitesMutants: 8,
        maxIntercourses: 20-2-2-2,
        collectionClass: Backbone.Collection,
      };
      ret.maxIntercourses = ret.maxPopulation - ret.maxElites - ret.maxElitesMutants - 2;
      return ret;
    },

    initialize: function(attributes, options){
      options = options || {};
      if (options.previousPopulation){
        // TODO: populate this generation with previous population
        // Find the elites,
        var oldPop = options.previousPopulation;
        var maxElites = this.get('maxElites');
        var elites = [];
        if (maxElites > 0){
          elites = oldPop.slice(0, maxElites);
        }

        // Find the elites' mutants,
        var elitesMutants = [];
        var maxElitesMutants = this.get('maxElitesMutants');
        if (maxElitesMutants > 0){
          elitesMutants = _.map(_.range(0, maxElitesMutants), function(i){
            var elite = elites[i % elites.length];
            var mutant = elite.clone().mutate();
            return mutant;
          });
        }

        // Find the offsprings,
        var offsprings = [];
        var maxIntercourses = this.get('maxIntercourses');
        if (maxIntercourses){
          offsprings = this.getOffsprings(oldPop);
          //console.log(offsprings);
        }

        options.seeds = Array.prototype.concat([], elites, elitesMutants, offsprings);
        //_.each(options.seeds, function(s){
        //  console.log(s.toJSON());
        //});
        this.populate(options);
      } else {
        this.populate(options);
      }
    },

    evaluate: function(){
      this.get('population').evaluate();
      return this;
    },

    sort: function(){
      this.get('population').sort();
    },

    getParents: function(pop){
      var s = pop.size();
      var choices = _.range(0, s);
      var tmp = choicesForPopSize[s];
      if (!tmp){
        tmp = [];
        _.each(choices, function(i){
          tmp = tmp.concat(Array.apply(null, {length: i+1}).map(Number.call, Number));
        });
        choicesForPopSize[s] = tmp;
      }
      var maxIntercourses = this.get('maxIntercourses');
      var parents = _.map(_.range(0, maxIntercourses), function(t){
        var p = [];
        do{
          p = _.sample(tmp, 2);
        } while(p[0] == p[1]);
        return p;
      });
      //console.log(JSON.stringify(parents));
      return parents;
    },

    getOffsprings: function(pop){
      var parents = this.getParents(pop);
      var offsprings = _.map(parents, function(p){
        return pop.at(p[0]).intercourse(pop.at(p[1]));
      });
      return offsprings;
    },

    populate: function(options){
      var seeds = options.seeds || [];
      var CollectionClass = this.get('collectionClass');
      var maxPopulation = this.get('maxPopulation');
      var population = new CollectionClass(seeds, options);

      while (population.size() < maxPopulation){
        var Model = CollectionClass.prototype.model;
        // Create a new individual randomly.
        var newIndividual = new Model();
        population.add(newIndividual);
      }
      this.set('population', population);
    },

    toJSON: function(){
      var ret = Backbone.Model.prototype.toJSON.call(this);
      ret.population = this.get('population').toJSON();
      return ret;
    }
  });

  var Generations = Backbone.Collection.extend({
    model: Generation,
  });

  var Monkey = Backbone.Model.extend({
    toJSON: function(){
      return {
        paragraphs: this.get('paragraphs'),
        score: this.get('score'),
      };
    },

    defaults: function(){
      var ret = {};
      // randomly create 1-2 paragraphs
      // if there is any paragraph, it contains 0 to 5 characters.
      ret.paragraphs = _.map( _.range(0, _.random(1, 2)), function(){
        var tmpParagraph = _.reduce(_.range(0, _.random(0, 5)), function(memo, i){
          return memo + String.fromCharCode(_.random(32, 126));
        }, '');
        return tmpParagraph;
      });

      ret.mutationOperationsHigh = [ 'changeChar', 'addChar', 'splitParagraphs', 'mergeParagraphs', 'addParagraphs' ];
      ret.mutationOperationsLow = ['changeChar', 'addChar', 'removeCharLow'];
      ret.mutationOperationsVeryLow = [
        'changeCharLow', 'addCharLow', 'removeCharLow', 'changeChar'
      ];
      //ret.mutationOperations = ['mergeParagraphs'];
      return ret;
    },

    evaluate: function(){
      var score = 0;
      // match the # of paragraphs
      // match the characters in the paragraphs
      var paragraphs = this.get('paragraphs');
      var diffParagraphs = paragraphs.length - goalText.length;
      if (diffParagraphs > 0 ){
        diffParagraphs *= 100000;
      } else if (diffParagraphs < 0){
        diffParagraphs *= -10000;
      }
      var diffChars = 0;
      var i=0;
      var p_m = paragraphs[0], p_g = goalText[0];
      while( p_m !== undefined && p_g !== undefined ){
        var diffLength = p_m.length - p_g.length;
        if (diffLength > 0){
          diffChars += 2 * diffLength;
        } else if (diffLength < 0){
          diffChars += 1 * -diffLength;
        }

        if (Math.abs(diffLength) > 10){
          diffChars += 200 * Math.abs(diffLength);
        } else {
          if (diffLength > 0){
            if (p_g.length != 0){
              p_m = p_m.substr(0, p_g.length);
              diffChars += compareTwoParagraph(p_m, p_g);
            } else {
              diffChars += 1000;
            }
          }
          else if (diffLength < 0){
            if (p_m.length != 0){
              p_g = p_g.substr(0, p_m.length);
              diffChars += compareTwoParagraph(p_m, p_g);
            } else {
              diffChars += 1000;
            }
          }
          else {
            //console.log('same length');
            diffChars += compareTwoParagraph(p_m, p_g);
          }
        }
        //if (p_m === undefined){
        //  // we have fewer paragraphs than the goal
        //  diffChars += 1000;
        //} else if (p_g === undefined) {
        //  // we have more paragraphs than the goal
        //  diffChars += 100;
        //} else {
        //  if (p_m.length == 0 && p_g.length == 0){
        //    // we prefer to have empty line over other things.
        //    diffChars += 0;
        //  } else if (p_m.length == 0){
        //    diffChars += 1000;
        //  } else if (p_g.length == 0 ){
        //    diffChars += 1000;
        //  } else if (p_m.length > p_g.length){
        //    // this p is longer, just compare the first n char
        //    //diffChars += 10 * (p_m.length - p_g.length);
        //    p_m = p_m.substr(0, p_g.length);
        //    diffChars += compareTwoParagraph(p_m, p_g);
        //  } else if (p_m.length < p_g.length){
        //    //diffChars += 1000 * (p_g.length - p_m.length);
        //    p_g = p_g.substr(0, p_m.length);
        //    diffChars += compareTwoParagraph(p_m, p_g);
        //  }
        //}
        i++;
        p_m = paragraphs[i];
        p_g = goalText[i];
      }

      score = diffParagraphs + diffChars;

      this.set({
        score: score,
      });
      return score;
    },

    // "slightly" modify itself.
    mutate: function(){
      var paragraphs = this.get('paragraphs');
      // mutation can only be any one of the following operations:
      //   1. split 1 paragraph into 2 at random point of a paragraph
      //   2. merge 2 paragraph into 1
      //   3. change a character in a paragraph by (-5 ~ 5) ascii code but never be zero.
      //   4. append a character to a paragraph
      var score = this.get('score');
      var operations = score > 10000 ? this.get('mutationOperationsHigh') : 
        (score > 2500 ? this.get('mutationOperationsLow') : this.get('mutationOperationsVeryLow'));
      var operation = '';
      do {
        operation = _.sample(operations, 1);
      } while (paragraphs.length == 1 && operation == 'mergeParagraphs');
      paragraphs = this[operation](paragraphs);
      this.set('paragraphs', paragraphs);
      return this;
    },

    intercourse: function(monkey){
      var paragraphs = [];
      var ps1 = this.get('paragraphs');
      var ps2 = monkey.get('paragraphs');

      var l = Math.max(ps1.length, ps2.length);
      for (var i = 0; i < l ; i++){
        var p1 = ps1[i], p2 = ps2[i];
        var newP;
        var idx = 0, len = 0;
        if (p1 === undefined){
          idx = _.random(0, p2.length - 1);
          len = _.random(1, p2.length);
          newP = p2.substr(idx, len);
        } else if (p2 === undefined){
          idx = _.random(0, p1.length - 1);
          len = _.random(1, p1.length);
          newP = p1.substr(idx, len);
        } else {
          newP = _.random(0, 1) == 0 ? p1 : p2;
        }
        paragraphs.push(newP);
      }

      var newMonkey = new Monkey({
        paragraphs: paragraphs,
      });

      return newMonkey;
    },

    addParagraphs: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = _.random(0, paragraphs.length - 1);

      newParagraphs.splice(
        i,
        0,
        '',
        '',
        ''
      );

      return newParagraphs;

    },

    mergeParagraphs: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = paragraphs.length == 2 ? 0 : _.random(0, paragraphs.length - 2);
      var p1 = paragraphs[i];
      var p2 = paragraphs[i+1];

      newParagraphs.splice(
        i,
        2,
        p1+p2
      );

      //console.log('oldParagraphs = ' + JSON.stringify(paragraphs));
      //console.log('newParagraphs = ' + JSON.stringify(newParagraphs));
      
      return newParagraphs;
    },

    splitParagraphs: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var lengthSum = _.reduce(paragraphs, function(m, p){
        return m + p.length;
      }, 0);
      if (lengthSum == 0){
        newParagraphs.push('');
        return newParagraphs;
      }

      var i = _.random(0, paragraphs.length - 1);
      var p = paragraphs[i];
      if (p.length == 0){
        newParagraphs.splice(
          i,
          0,
          ''
        );
      } else {
        var idx = _.random(0, p.length - 1);

        var p1 = p.substr(0, idx);
        var p2 = p.substr(idx);
        newParagraphs.splice(
          i,
          1,
          p1, p2
        );
      }

      //console.log('oldParagraphs = ' + JSON.stringify(paragraphs));
      //console.log('newParagraphs = ' + JSON.stringify(newParagraphs));
      
      return newParagraphs;
    },

    addCharLow: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = _.random(0, paragraphs.length - 1);
      var p = paragraphs[i];
      var newChar = '';
      newChar = String.fromCharCode(_.random(32, 126));
      newParagraphs[i] += newChar;
      return newParagraphs;
    },

    addChar: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = _.random(0, paragraphs.length - 1);
      var p = paragraphs[i];
      var newChar = '';
      for(var j = 0 ; j < 5; ++j){
        newChar = String.fromCharCode(_.random(32, 126));
        newParagraphs[i] += newChar;
      }
      //if (i == 1){
      //console.log('oldParagraphs = ' + JSON.stringify(paragraphs));
      //console.log('newParagraphs = ' + JSON.stringify(newParagraphs));
      //}
      return newParagraphs;
    },

    removeCharLow: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = 0, p = '';
      do {
        i = _.random(0, paragraphs.length - 1);
        p = paragraphs[i];
      }while(p.length == 0);
      var idx = _.random(0, p.length - 1);
      if (p.length == 1){
        newParagraphs[i] = '';
      } else if (p.length == idx + 1){
        newParagraphs[i] = p.substr(0, idx);
      } else {
        newParagraphs[i] = p.substr(0, idx) + p.substr(idx+1);
      }
      return newParagraphs;
    },

    changeCharMultipleLow: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = _.random(0, paragraphs.length - 1);
      if (i == 17){
        console.log('yeah2');
      }
      var p = newParagraphs[i];
      if (p.length == 0){
        newParagraphs[i] += 
          String.fromCharCode(_.random(32, 126))
        ;
      } else {
        for (var k = 0 ; k < 3 ; k++){
          var nthChar = _.random(0, p.length - 1);
          var theChar = p[nthChar];
          var ascii = theChar.charCodeAt();
          var d = _.random(0, 5);
          d = _.random(0, 1) == 0 ? d : -d;
          if (ascii + d < 32){
            ascii = 126 + d +1;
          } else if (ascii + d > 126){
            ascii = 32 + d - 1;
          } else {
            ascii += d;
          }
          if (ascii > 126 || ascii < 32){
            console.error(ascii); console.error(d);
            throw {};
          }
          if (nthChar == p.length - 1){
            newParagraphs[i] = newParagraphs[i].substr(0, nthChar) + String.fromCharCode(ascii);
          } else {
            newParagraphs[i] = newParagraphs[i].substr(0, nthChar) + String.fromCharCode(ascii) + p.substr(nthChar+1);
          }
        }
        if (i == 17){
          console.log('paragraphs[17] =    ' + paragraphs[17]);
          console.log('newParagraphs[17] = ' + newParagraphs[17]);
        }

      }

      return newParagraphs;
    },

    changeCharLow: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = _.random(0, paragraphs.length - 1);
      if (i == 17){
        console.log('yeah');
      }
      var p = newParagraphs[i];
      if (p.length == 0){
        newParagraphs[i] += 
          String.fromCharCode(_.random(32, 126))
        ;
      } else {
        var nthChar = _.random(0, p.length - 1);
        var theChar = p[nthChar];
        var ascii = theChar.charCodeAt();
        var d = _.random(1, 5);
        d = _.random(0, 1) == 0 ? d : -d;
        if (ascii + d < 32){
          ascii = 126 + d +1;
        } else if (ascii + d > 126){
          ascii = 32 + d - 1;
        } else {
          ascii += d;
        }
        if (ascii > 126 || ascii < 32){
          console.error(ascii); console.error(d);
          throw {};
        }
        if (nthChar == p.length - 1){
          newParagraphs[i] = p.substr(0, nthChar) + String.fromCharCode(ascii);
        } else {
          newParagraphs[i] = p.substr(0, nthChar) + String.fromCharCode(ascii) + p.substr(nthChar+1);
        }
        if (i == 17){
          console.log('paragraphs[17] =    ' + paragraphs[17]);
          console.log('newParagraphs[17] = ' + newParagraphs[17]);
        }
      }

      return newParagraphs;
    },

    changeChar: function(paragraphs){
      var newParagraphs = paragraphs.slice(0);
      var i = _.random(0, paragraphs.length - 1);
      var p = newParagraphs[i];
      if (p.length == 0){
        newParagraphs[i] += 
          String.fromCharCode(_.random(32, 126))
        ;
      } else {
        var nthChar = _.random(0, p.length - 1);
        var theChar = p[nthChar];
        var ascii = theChar.charCodeAt();
        var d = _.random(5, 20);
        d = _.random(0, 1) == 0 ? d : -d;
        if (ascii + d < 32){
          ascii = 126 + d +1;
        } else if (ascii + d > 126){
          ascii = 32 + d - 1;
        } else {
          ascii += d;
        }
        if (ascii > 126 || ascii < 32){
          console.error(ascii); console.error(d);
          throw {};
        }
        if (nthChar == p.length - 1){
          newParagraphs[i] = p.substr(0, nthChar) + String.fromCharCode(ascii);
        } else {
          newParagraphs[i] = p.substr(0, nthChar) + String.fromCharCode(ascii) + p.substr(nthChar+1);
        }
        if (i == 17){
          console.log('yeah3');
          console.log('paragraphs[17] =    ' + paragraphs[17]);
          console.log('newParagraphs[17] = ' + newParagraphs[17]);
        }
      }

      return newParagraphs;
    },
  });

  var Monkeys = Backbone.Collection.extend({
    model: Monkey,
    localStorage: new Backbone.LocalStorage('monkeys'),
    comparator: 'score',
    evaluate: function(){
      this.invoke('evaluate');
    },
  });

  var GenerationView = Backbone.View.extend({
    template: _.template('<h1><%= nthGeneration %></h1><pre><%= JSON.stringify(population, null, 2) %></pre>'),
    render: function(){
      if (this.model.get('nthGeneration') % 100 == 99){
      //if (this.model.get('nthGeneration')){
        this.$el.html(this.template(this.model.toJSON()));
      } else {

      }
      return this;
    },
  });

  var GenerationsView = Backbone.View.extend({
    initialize: function(options){
      this.collection.on('add', this.renderNewGeneration, this);
    },

    render: function(){
      return this;
    },

    renderNewGeneration: function(model, collection){
      var view = new GenerationView({
        model: model,
      });
      //this.$el.append(view.render().el);
      this.$el.prepend(view.render().el);
    },
  });

  $(document).ready(function(){
    var generations = new Generations();
    var generationsView = new GenerationsView({
      collection: generations,                                        
      el: $('.generations'),
    });

    var lastPopulation = new Monkeys();
    lastPopulation.fetch();
    if (lastPopulation.size() == 0){
      lastPopulation.add([
        new Monkey({ "paragraphs": [
          "Our Father in h",
          "",
          "    hallowed be ",
          "    your kin",
          "    your wil",
          "",
          "        on earth as ",
          "",
          "Give us today our da",
          "Forgive us",
          "",
          "   \"as we forgive thote who sin aga",
          "",
          "Save us from the tim",
          "",
          "    and deliver us fr",
          "S",
          "or|fivpaf<0|PNM/B:pkur^X/**UF[I{.(qFf`]",
          "",
          "    now and for e"
        ]}),
        new Monkey({ paragraphs: [
          "Our Father in heaven,",
          "",
          "    hallowed be your name,",
          "    your kingdom come,",
          "    your will be done,",
          "",
          "        on earth as in heaven.",
          "",
          "Give us today our daily bread.",
          "Forgive us our sins",
          "",
          "    as we forgive those who sin against us.",
          "",
          "Save us from the time of trial",
          "",
          "    and deliver us from evil.",
          "",
          "or|fivp\\f<2|PNM0B:pkur^X/**UF[I{.(qFg`]t",
          "",
          "    now and for ever. Amen."
        ], }),
      ], {});
    } else {
      window.localStorage.clear();
    }

    var firstGeneration = new Generation({
      maxPopulation: 20,
      nthGeneration: 1,
      collectionClass: Monkeys,
    }, {
      previousPopulation: lastPopulation,
    });

    firstGeneration.evaluate().sort();

    generations.add(firstGeneration);

    var previousGeneration = firstGeneration;
    var maxGenerations = 2000;
    var nthGen = 1;
    var findOneGeneration = function(){
      nthGen++;
      var newGeneration = new Generation({
        maxPopulation: previousGeneration.get('maxPopulation'),
        collectionClass: previousGeneration.get('collectionClass'),
        nthGeneration: nthGen,
      }, {
        previousPopulation: previousGeneration.get('population'),
      });
      newGeneration.evaluate().sort();

      generations.add(newGeneration);

      previousGeneration = newGeneration;
      
      if (generations.size() < maxGenerations){
        setTimeout(findOneGeneration, 50);
      } else {
        newGeneration.get('population').invoke('save');
      }
    };

    setTimeout(findOneGeneration, 50);
  });

  GA.Monkey = Monkey;
  GA.Monkeys = Monkeys;
  GA.goalText = goalText;
})(window.GA);
