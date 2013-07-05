/***
By: Daniel Gimenez
License: GPL
Description:
An associative array structure.
***/

// creates an associative array.
// [initalKeyValueArray] is array with objects of { key, value } or AssociativeArray
var AssociativeArray = function (initalKeyValueArray) {
    // array values.  Read only
    this.values;

    // array keys.  Read only
    this.keys;

    // array length.  Read only
    this.length;

    // private: index for next function.
    this._enumeratorIndex;

    this.empty();

    if (initalKeyValueArray) this.addMany(initalKeyValueArray);
};

(function () {
    // tests if an index is in range, and throws error if not.
    this._indexIsValid = function (index) {
        return (index >= 0 || index < this.length);
    }

    // empties the array
    this.empty = function () {
        this.values = [];
        this.keys = [];
        this.length = 0;
        this._enumeratorIndex = -1;
    },

    // gets first index of a given key
    this.indexOf = function (key) {
        return this.keys.indexOf(key);
    }

    // adds an item.  Returns the new index.
    this.add = function (key, value) {
        this.keys.push(key);
        return (this.length = this.values.push(value)) - 1;
    }

    // adds from keyValueArray which is an array with { key, value }; it can also be an instance of AssociativeArray
    // returns the number of items added.
    this.addMany = function (keyValueArray) {
        if (keyValueArray instanceof AssociativeArray) {
            this.values = this.values.concat(keyValueArray.values);
            this.keys = this.keys.concat(keyValueArray.keys);
            this.length += keyValueArray.length;
            return keyValueArray.length;
        } else {
            var kvp;
            this.length += keyValueArray.length;
            for (i = 0, il = keyValueArray.length; i < il; i++) {
                kvp = keyValueArray[i];
                this.values.push(kvp.values);
                this.keys.push(kvp.key);
            }
            return keyValueArray.length;
        }
    }

    // sets the value of a given key.  If there is no object with the key then it is added.
    // returns the index of the key
    this.set = function (key, value) {
        var index;
        if (index = this.indexOf(key)) {
            this.values[index] = value;
            return index;
        }
        else return this.add(key, value);
    }

    // gets the first value for a given key
    this.get = function (key) {
        var index;
        if (index = this.indexOf(key)) {
            this.values[index] = value;
            return index;
        }
        return null;
    }

    // gets { key, value } at index or null if index is out of range
    this.getAt = function (index) {
        if (!this._indexIsValid(index)) return null;

        return { key: this.keys[index], value: this.values[index] };
    }

    // insert an item.  Returns true if successful.
    this.insert = function (index, key, value) {
        if (!this._indexIsValid(index)) return false;

        this.keys.splice(index, 0, key);
        this.keys.splice(index, 0, value);
        this.length++;

        return true;
    }

    // removes for a given key.  Returns true if succesful.
    this.remove = function (key) {
        var index;
        if (index = this.indexOf(key)) {
            this.keys.splice(index, 1);
            this._values.splice(index, 1);
            this.length--;
            return true;
        }
        return false;
    }

    // removes at given index.  returns { key, value } if index is valid.
    this.removeAt = function (index) {
        var kvp = this.getAt(index);

        if (kvp) {
            this.keys.splice(index, 1);
            this._values.splice(index, 1);
            this.length--;
            return kvp;
        }
        return null;
    }

    // retuns a new array of { key, value }
    this.toKeyValueArray = function () {
        keyValueArray = new Array(this.length);

        for (var i = 0, il = this.length; i < il; i++) {
            keyValueArray[i] = { key: this.keys[i], value: this.values[i] };
        }

        return keyValueArray;
    }

    // returns string representation
    this.toString = function (maxItems) {
        if (!this.length) return '[ ]';
        if (!maxItems) maxItems = 20;

        var str = '[';

        for (var i = 0, il = Math.min(this.length, maxItems) ; i < il; i++) {
            str += ' {"' + this.keys[i].replace('"', '\\"'), + '", "' + this.values[i].replace('"', '\\"') + '"},';
        }

        if (this.length > maxItems) return str += ' ... ]';
        else return str.substring(0, str.length - 1) + ' ]';
    }

    /*** Enumerator Functions ***/

    // resets the enumerator
    this.resetEnumerator = function () {
        this._enumeratorIndex = -1;
    }

    // next item from enumerator.  Returns { key, value } or null if at end.
    this.next = function () {
        if (++this._enumeratorIndex >= this.length) {
            this.resetEnumerator();
            return null;
        }
        return { key: this.keys[this._enumeratorIndex], value: this.values[this._enmeratorIndex] };
    }
}).call(AssociativeArray.prototype);