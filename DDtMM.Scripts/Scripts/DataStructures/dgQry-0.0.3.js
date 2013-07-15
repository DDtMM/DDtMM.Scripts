/***
By: Daniel Gimenez
License: Freeware
Description:
Adds functions to array
***/
(function () {
    // array keys
    var
        // aggregate init value or function
        AGG_INIT = 0,
        // aggregate function
        AGG_FUNC = 1;

    // predefined predicates
    var predicates = {
        // always true
        defaultPredicate: function () {
            return true;
        },
        // not null or undefined
        notNull: function (value) {
            return (value != null);
        },
        // null or undefined
        isNull: function (value) {
            return (value == null);
        },
        // value in param
        inArray: function (value, key, array) {
            return (array.indexOf(value) > -1);
        },
        // value not in param
        notInArray: function (value, key, array) {
            return (array.indexOf(value) == -1);
        },
        // create negation of predicate
        negate: function (predicate) {
            return function (value, key, param) {
                return !predicate(value, key, param);
            }
        },
        defaultIfNull: function(predicate) {
            return predicate || predicates.defaultPredicate;
        }
    }

    var transforms = {
        defaultKeyTransform: function (value, key) {
            return key;
        },
        defaultValueTransform: function (value, key) {
            return value;
        },
        defaultValueIfNull: function(transform) {
            return transform || transforms.defaultValueTransform;
        },
        defaultKeyIfNull: function (transform) {
            return transform || transforms.defaultKeyTransform;
        }
    }

    var aggregateFunctions = aggFuncs = {
        count: function (currentCount) {
            return currentCount + 1;
        },

        sum: function (currentSum, value) {
            return currentSum + value;
        },

        product: function (currentProd, value) {
            return currentProd * value;
        },

        min: function (currentMin, value) {
            return Math.min(currentMin, value);
        },

        max: function (currentMax, value) {
            return Math.max(currentMax, value);
        },

        sumOfDifferenceSquared: function (currentSum, value, differenceFrom) {
            return currentSum + Math.pow(value - differenceFrom, 2);
        }
    }

    var prefixOperators = {
        not: function (value) {
            return !value;
        }
    }

    function isFunction(object) {
        return typeof (object) == 'function';
    }



    var arrayModifiers = {
        addItem: function (item, key) {
            this.array.push(item);
        },

        removeAt: function (index) {
            this.array.splice(index, 1);
        },

        removeItem: function (key) {
            this.array.splice(key, 1);
        },   

        getKey: function (index) {
            return index;
        }
    }

    var objectModifiers = {
        addItem: function (item, key) {
            this.array.push(item);
            this.keys.push(key);
        },

        removeAt: function (index) {
            this.array.splice(index, 1);
            this.keys.splice(index, 1);
        },

        removeItem: function (key) {
            this.array.splice(this.keys.indexOf(key), 1);
        },

        getKey: function (index) {
            return this.keys[index];
        }
    }

    var dgQry = function (source) {
        this.savedQueries = {};
        this.predicateQueue = [];
        this.aggregateQueue = [];

        if (source.constructor == dgQry) {
            this.array = source.array.slice(0);
            this.keys = (source.keys) ? source.keys.slice(0) : null;
            this.collectionModifier = source.collectionModifier;
            
        }
        else if (Array.isArray(source)) {
            // copy of array
            this.array = source.slice(0);
            this.keys = null;
            this.collectionModifier = arrayModifiers;
        }
        else if (source) {
            // treat as associative array
            this.array = [];
            this.keys = [];
            this.collectionModifier = objectModifiers;
            for (var i in source) {
                this.keys.push(i);
                this.array.push(source[i]);
            }
        }
    };

    (function () {
        this.array = null;
        this.keys = null;
        this.savedQueries = {};
        this.predicateQueue = [];
        this.aggregateQueue = [];
        this.collectionModifier = arrayModifiers;

        /*****
        Filters
        ******/

        // returns an array of all found matches
        this.where = function (predicate) {
            this.predicateQueue.push(predicate);

            return this;
        }


        this.go = function () {
            var result = {
                    // result from aggregate functions
                    agg: [],
                    // new dgQuery with filtered results
                    filtered: this.createNewOfSameType()
                },
                executionSteps = [],
                continueProcessing, execution;
 

            if (this.predicateQueue.length) {
                executionSteps.push(this._goProcessPredicates);
                executionSteps.push(this._goAddValidItem);
            }
            else {
                result.filtered = new dgQry(this);
            }
            if (this.aggregateQueue.length) {
                this._goInitAggregates(result);
                executionSteps.push(this._goProcessAggregates);
            } 
            
            for (var i = 0, il = this.array.length; i < il; i++) {
                value = this.array[i];
                key = this.getKey(i);

                for (var j = 0, jl = executionSteps.length; j < jl; j++) {
                    // keep processing steps until one returns false.
                    if (!executionSteps[j].call(this, result, value, key)) break;
                }

            }

            this.predicateQueue = [];
            this.aggregateQueue = [];

            return result;
        }

        this._goInitAggregates = function (result) {
            var valOrFunc;

            for (var i = 0, il = this.aggregateQueue.length; i < il; i++) {
                result.agg.push(
                    (isFunction(valOrFunc = this.aggregateQueue[i][AGG_INIT])) ?
                    valOrFunc() : valOrFunc);
            }
        }

        this._goProcessPredicates = function (result, value, key) {
            for (var i = 0, il = this.predicateQueue.length; i < il; i++) {
                if (!this.predicateQueue[i](value, key)) {
                    return false;
                }
            }
            return true;
        }

        this._goAddValidItem = function (result, value, key) {
            result.filtered.addItem(value, key);
            return true;
        }

        this._goProcessAggregates = function (result, value, key) {
            var aggInfo;
            for (var i = 0, il = result.agg.length; i < il; i++) {
                result.agg[i] = this.aggregateQueue[i][AGG_FUNC](result.agg[i], value);
            }
            return true;
        }

        /*****
        Transform
        ******/
        // transforms collection to new collection
        this.transform = function (keyTrans, valueTrans) {
            var result,
                value, key;

            valueTrans = transforms.defaultValueIfNull(valueTrans);

            if (keyTrans) {
                result = new dgQry({});
                for (var i = 0, il = this.array.length; i < il; i++) {
                    result.addItem(valueTrans(value = this.array[i], key = this.getKey(i)), keyTrans(value, key));
                }
            } else {
                result = new dgQry([]);
                for (var i = 0, il = this.array.length; i < il; i++) {
                    result.addItem(valueTrans(this.array[i], this.getKey(i)));
                }
            }

            return new dgQry(result);
        }

        this.toObject = function (keyTrans, valueTrans) {
            var valueTrans = transforms.defaultValueIfNull(valueTrans),
                keyTrans = transforms.defaultKeyIfNull(keyTrans),
                obj = {},
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                obj[keyTrans(value = this.array[i], key = this.getKey(i))] = valueTrans(value, key);
            }

            return obj;
        }

        /*****
        Joins
        ******/
        this.crossJoin = function(obj, myValueTrans, objValueTrans, resultTrans) {
            var myValueTrans = transforms.defaultValueIfNull(myValueTrans),
                objValueTrans = transforms.defaultValueIfNull(objValueTrans),
                resultTrans = transforms.defaultValueIfNull(objValueTrans),
                result = new dgQry([]),
                myVal, objVal, myKey, objKey;

            obj = new dgQry(obj);

            for (var i = 0, il = this.array.length; i < il; i++) {
                myVal = myValueTrans(this.array[i], myKey = this.getKey[i]);
                for (var j = 0, jl = obj.array.length; j < jl; j++) {
                    objVal = myValueTrans(obj.array[j], objVal = obj.getKey[j]);

                    if (myVal == objVal) {
                        result.addItem(resultTrans({ a: myVal, b: objVal }, i), i);
                    }
                }
            }

            return result;
        }

        /*********
        set functions
        **********/
        this.set = function (predicate, obj) {
            var result = this.createNewOfSameType(),
                ary = new dgQry(obj).array,
                value, key;


            predicate = predicates.defaultIfNull(predicate);

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!predicates.inArray(value = this.array[i], key = this.getKey(i), result.array) &&
                    predicate(value, key, ary)) result.addItem(value, key);
            }
            return result;
        }

        this.distinct = function () {
            var result = this.createNewOfSameType(),
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!predicates.inArray(value = this.array[i], key = this.getKey(i), result.array))
                    result.addItem(value, key);
            }

            return result;
        }

        this.union = function (obj) {
            return new dgQry(this.array.concat(new dgQry(obj).array)).distinct();
        }
        this.intersect = function (obj) {
            return this.set(predicates.inArray, obj);
        }

        this.except = function (obj) {
            return this.set(predicates.notInArray, obj);
        }

        /********
        boolean value functions
        **********/
        this.all = function (predicate) {
            return (!this.findFirst(predicates.negate(predicate)) || false);
        }

        this.any = function (predicate) {
            return (this.findFirst(predicate) && true);
        }

        this.contains = function (item) {
            return predicates.inArray(item, 0, this.go().filtered.array);
        }

        /*********
        value functions
        **********/
        // return the first item that causes predicate to return true
        this.findFirst = function (predicate) {
            var filtered = this.go().filtered;

            predicate = predicates.defaultIfNull(predicate);

            for (var i = 0, il = filtered.array.length; i < il; i++) {
                if (predicate(filtered.array[i], filtered.getKey(i))) return filtered.array[i];
            }
            return null;
        }

        // return the last item that causes predicate to return true
        this.findLast = function (predicate) {
            var filtered = this.go().filtered;

            predicate = predicates.defaultIfNull(predicate);

            for (var i = this.array.length - 1; i >= 0; i--) {
                if (predicate(filtered.array[i], filtered.getKey(i))) return filtered.array[i];
            }
            return null;
        }


        /**********
        Aggregate functions
        ***********/
        // executes an aggregate function on an array.
        // init: function(predicate) or value
        // func: aggregate function
        this.addAggregate = function (init, func, predicate) {
            if (predicate) {
                this.predicateQueue.push(predicate);
            }
            this.aggregateQueue.push([init, func]);
            return this;
        }


        // returns the count of all the values that match evalutor
        this.count = function (predicate) {
            return this.addAggregate(0, aggFuncs.count, predicate).go().agg[0];
        }

        // sums all values
        this.sum = function (predicate) {
            return this.addAggregate(0, aggFuncs.sum, predicate).go().agg[0];
        }

        // product of all values
        this.product = function (predicate) {
            return this.addAggregate(1, aggFuncs.product, predicate).go().agg[0];
        }

        // get smallest value
        this.min = function (predicate) {
            return this.addAggregate(Infinity, aggFuncs.min, predicate).go().agg[0];
        }

        // get biggest value
        this.max = function (predicate) {
            return this.addAggregate(-Infinity, aggFuncs.max, predicate).go().agg[0];
        }

        // average of values
        this.avg = function (predicate) {
            var result = this.addAggregate(0, aggFuncs.sum, predicate)
                .addAggregate(0, aggFuncs.count, predicate).go();

            return (result.agg[1]) ? result.agg[0] / result.agg[1] : 0;
        }
        // variance
        this.var = function (predicate) {
            var result = this.addAggregate(0, aggFuncs.sum, predicate)
                .addAggregate(0, aggFuncs.count, predicate).go();

            var avg = (result.agg[1]) ? result.agg[0] / result.agg[1] : 0;

            if (avg) {
                return result.filtered.addAggregate(0, function (currentSum, value) {
                    return aggFuncs.sumOfDifferenceSquared(currentSum, value, avg);
                }).go().agg[0];
            }

            return 0;
        }

        // standard deviation
        this.stddev = function (predicate) {
            return Math.sqrt(this.var(predicate));
        }
        /**********
        Reusable queries
        **********/
        // saves a query for reuse
        // savedName is the name for later
        // query: the function name or function
        // predicate: the predicate to call
        this.saveQuery = function (savedName, query, predicate) {
            this._savedQueries[savedName] = {
                query: (typeof query === 'string') ? this[query] : query,
                predicate: predicate
            }
        }

        // executes a savedQuery
        this.execQuery = function (savedName) {
            var sq = this.savedQueries[savedName];
            return sq.query(sq.predicate);
        }

        /********
        Array modification
        *********/
        this.addItem = function (item, key) {
            this.collectionModifier.addItem.call(this,item,key)
            return this;
        }

        this.removeAt = function (index) {
            this.collectionModifier.removeAt.call(this, index)
            return this;
        }

        this.removeItem = function (key) {
            this.collectionModifier.removeItem.call(this, key)
            return this;
        }

        this.getKey = function (index) {
            return this.collectionModifier.getKey.call(this, index)
        }

        this.createNewOfSameType = function () {
            return new dgQry((this.keys) ? {} : []);
        }

    }).call(dgQry.prototype);

    window.dgQry = function (array) {
        return new dgQry(array);
    };
})();