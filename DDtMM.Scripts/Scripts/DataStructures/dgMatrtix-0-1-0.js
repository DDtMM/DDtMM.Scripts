var Matrix = (function () {
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    function isString(str) {
        return ( Object.prototype.toString.call(str) == '[object String]' ) ;
    }
    function isMatrix(obj) {
        return obj.constructor == Matrix;
    }
    // Matrix constructor
    // source: based on type the following happens
    //   Matrix: then this is created copying values in source
    //   Number: then a square matrix with 0 values is created, so if 2 passed then 2x2 is created
    //   Array: 
    //     if 2 dimensional array (array of arrays), then the first dimension is rows, and second is columns.
    //        assumes that column arrays are of equal length.
    //     if 1 dimensional and options.rows and options.cols passed then rows x cols = array.length
    //     else create a square array
    //   String: attempts to parse the string.  If nothing is passed to options.rowbreak, then a row
    //     is terminated with a new line.
    // options: object literal with various options for a source
    //   .rows: number of rows if array is passed as source.  If source is a string, is used and cols in computed
    //   .cols: number of columns if array is passed as source.  If source is a string, is used and rows in computed
    //   .rowbreak: either a regular expression or string that ends rows if a string is passed as source
    //   .isSquare: creates a square matrix if string is passed as source
    var Matrix = function (source, options) {
        this.array = [];
        this.rows = 0;
        this.cols = 0;

        // if source is a Matrix then copy values.
        if (isMatrix(source.constructor)) {
            this.rows = source.rows;
            this.cols = source.cols;
            this._initArray();
            for (var i = 0, il = this.array.length; i < il; i++) {
                this.array[i] = source.array[i];
            }
        }
        else if (source.rows !== undefined && source.cols !== undefined) {
            this.rows = source.rows;
            this.cols = source.cols;
            this.init();
        }
        else if (isNumber(source)) {
            // assumes square matrix
            this.rows = this.cols = source;
            this.init();
        }
        else if (Array.isArray(source)) {
            if (source.length == 0) {
                throw ('invalid length for array');
            }
            else if (Array.isArray(source[0])) {
                // a 2d array
                this.rows = source.length;
                this.cols = source[0].length;
                this._initArray();

                for (var i = 0; i < this.rows; i++) {
                    for (var j = 0; j < this.cols; i++) {
                        this.array[i * this.cols + j] = source[i][j];
                    }
                }
            } else {
                if (options && options.rows && options.cols) {
                    this.rows = options.rows;
                    this.cols = options.cols;
                } else {
                    // assumes square matrix;
                    this.rows = this.cols = Math.sqrt(source.length);
                }
                this._initArray();
                if (this.array.length != source.length) {
                    throw ('source array does not not jive with rows and cols');
                }
                for (var i = 0, il = this.array.length; i < il; i++) {
                    this.array[i] = source[i];
                }
            }
        }
        else if (isString(source)) {
            var match,
                arrayLen,
                size,
                reNumbers = /[-+]?\d*\.?\d+/g,
                reBreaks = /[\n\r]+/g
            ;
            this.array = [];
            while ((match = reNumbers.exec(source))) {
                this.array.push(parseFloat(match));
            }
            arrayLen = this.array.length;

 
            if (options && options.isSquare) {
                size = Math.sqrt(arrayLen);
                if (size == Math.floor(size)) {
                    this.rows = this.cols = size;
                }
                else {
                    throw 'not a square matrix.';
                }
            }
            else if (options && options.cols) {
                this.rows = arrayLen / options.cols;
                this.cols = options.cols;
            }
            else if (options && options.rows) {
                this.cols = arrayLen / options.rows;
                this.rows = options.rows;
            }
            else {
                // use breaks to find rows
                if (options && options.rowbreak) {
                    if (options.rowbreak.constructor == RegExp) {
                        reBreaks = options.rowbreak;
                        if (!reBreaks.global) throw 'global required for rowbreak RegExp object';
                    }
                    else {
                        reBreaks = new RegExp(options.rowbreak, "g");
                    }
                }

                size = 1;
                while ((match = reBreaks.exec(source.trim()))) {
                    size++;
                }
                this.cols = arrayLen / size;
                if (this.cols == Math.floor(this.cols)) {
                    this.rows = size;
                }
                else {

                    throw ('unable to determine dimensions from string');
                }
            }
        }
        else {
            throw ('Either size, array (for square matrix) Matrix, string, or { rows, cols } required for constructor');
        }

        this.isSquare = true;
    };

    (function () {
        // in order of columns then rows [r1, c1] [r1, c2] ...
        this.array = [];
        this.rows = 0;
        this.cols = 0;
        this.isSquare = false;

        // creates a new array of the size of rows and cols.
        this._initArray = function() {
            this.array = new Array(this.rows * this.cols);
        }

        // creates the value to do the operation on.  If value is a matrix, just returns value.
        this._createOperatingMatrix = function(value) {
            if (isMatrix(value)) return value;
            return new Matrix(value);
        }

        // a new matrix that has the minimum rows and cols of this and matrixB
        this._createMinimumMatrix = function(matrixB) {
            return new Matrix({ 
                rows: Math.min(this.rows, matrixB.rows), 
                cols: Math.min(this.cols, matrixB.cols) 
            });
        }

        // calls a scalar or matrix function based on value type
        this._branchScalarOrMatrix = function(value, scalarFunc, matrixFunc) {
            if (isNumber(value)) return scalarFunc(value);
            else return matrixFunc.call(this, this._createOperatingMatrix(value));
        }

        // performs a function on each value of the matrix.
        // func = Function (matrixValue, scalarValue);
        // returns new matrix with result of function
        this._scalarFuncOnMatrix = function (scalarValue, func) {
            var result = new Matrix(this);

            for (var i = 0, il = result.array.length; i < il; i++) {
                result.array[i] = func(result.array[i], scalarValue);
            }

            return result;
        }
        // performs an entrywise function (this and matrixB rows = rows and cols = cols)
        // func = Function (matrixValue, matrixBvalue);
        // returns new matrix with result of function
        this._entryWiseFuncOnMatrix = function (matrixB, func) {
            if (this.cols != matrixB.cols || this.rows != matrixB.rows) throw ('matrix row col mismatch');

            var result = this._createMinimumMatrix({ cols: this.cols, rows: this.rows }),
                value;

            for (var i = 0, il = result.array.length; i < il; i++) {
                result.array[i] = func(this.array[i], matrixB.array[i]);
            }
            
            return result;
        }

        // performs an function where the result is the value of that function on the rows and cols added together
        // func = Function (matrixValue, matrixBvalue);
        // returns new matrix with result of function
        this._rowColFuncOnMatrix = function (matrixB, func) {
            if (this.cols != matrixB.rows || this.rows != matrixB.cols) throw ('matrix mismatch: rows != columns');

            var result = new Matrix({ rows: this.rows, cols: matrixB.cols }),
                value;

            for (var i = 0, il = result.rows; i < il; i++) {
                for (var j = 0, jl = result.cols; j < jl; j++) {
                    value = 0;
                    for (var k = 0; k < this.cols; k++) {
                        value += func(this.array[this.rows * i + k],
                            matrixB.array[matrixB.rows * k + j]);
                    }
                    result.array[result.rows * i + j] = value;
                }
            }

            return result;
        }

        // sets all values in the matrix to 0
        this.init = function () {
            this._initArray();
            for (var i = 0, il = this.array.length; i < il; i++) {
                this.array[i] = 0.0;
            }
        };

        // gets an array of values for a row
        this.getRow = function (rowIndex) {
            var startIndex = rowIndex * this.rows;
            return this.array.slice(startIndex, startIndex + this.rows + 1);
        }

        // gets an array of values for a column
        this.getCol = function (colIndex) {
            var column = new Array(this.cols);
            for (var i = 0; i < this.rows; i++) {
                column[i] = this.array[i * this.rows + colIndex];
            }
        }

        // gets a value at a particular row, column.
        this.get = function (rowIndex, colIndex) {
            return this.array[this.cols * rowIndex + colIndex];
        }

        // sets a value at a particular row, column.
        this.set = function (rowIndex, colIndex, value) {
            return this.array[this.cols * rowIndex + colIndex] = value;
        }

        // is this equal to matrixB?
        this.equals = function (matrixB) {
            if (this.cols != matrixB.cols && this.rows != matrixB.rows) return false;

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (this.array[i] != matrixB.array[i]) return false;
            }

            return true;
        }

        // returns identity for this matrix if square.  Also returns identity of given size.
        this.identity = function (size) {
            if (size === undefined) {
                if (this.isSquare) {
                    size = this.rows;
                }
                else {
                    throw ('can not create identity on non square matrix');
                }
            }

            var identity = new Matrix(size);
            for (var i = 0; i < size; i++) {
                identity[i * size + i] = 1.0;
            }

            return identity;
        };

        // rotates the values in the matrix clockwise
        this.rotate = function () {
            var rotated = new Matrix({ rows: this.cols, cols: this.rows });
            var maxRowIndex = (this.rows - 1) * this.cols;
            for (var i = 0; i < this.rows; i++) {
                for (var j = 0; j < this.cols; j++) {
                    rotated.array[j * this.rows + this.rows - i - 1] = this.array[this.cols * i + j];
                }
            }
            return rotated;
        }

        // rotates the values in the matrix counter clockwise
        this.rotateCounter = function () {
            var rotated = new Matrix({ rows: this.cols, cols: this.rows });
            var maxRowIndex = (this.rows - 1) * this.cols;
            for (var i = 0; i < this.rows; i++) {
                for (var j = 0; j < this.cols; j++) {
                    rotated.array[(this.cols - j - 1) * this.rows + i] = this.array[this.cols * i + j];
                }
            }
            return rotated;
        }

        /************
        multiply 
        ************/
        // multiples by either a number or matrix
        this.multiply = function (multiplier) {
            return this._branchScalarOrMatrix(multiplier, this.multiplyScalar, this.multiplyMatrix);
        };

        // multiples each value in the matrix
        this._multiply = function (a, b) { return a * b; }

        // scalar multiplication
        this.multiplyScalar = function (multiplier) {
            return this._scalarFuncOnMatrix(multiplier, this._multiply);
        }

        // matrix multiplication
        this.multiplyMatrix = function (multiplier) {
            return this._rowColFuncOnMatrix(multiplier, this._multiply);
        }
        
        /************
        addition 
        ************/
        // add either a number or matrix
        this.add = function (addend) {
            return this._branchScalarOrMatrix(addend, this.addScalar, this.addMatrix);
        };

        // adds each value in the matrix
        this._add = function (a, b) { return a + b; }

        // scalar addition
        this.addScalar = function (addend) {
            return this._scalarFuncOnMatrix(addend, this._add);
        }

        // matrix addition
        this.addMatrix = function (addend) {
            return this._entryWiseFuncOnMatrix(addend, this._add);
        }


        /************
        subtraction 
        ************/
        // subtracts either a number of matrix
        this.sub = function (subtrahend) {
            return this._branchScalarOrMatrix(subtrahend, this.subScalar, this.subMatrix);
        };

        // subtracs each value in the matrix
        this._sub = function (a, b) { return a - b; }

        // scalar subtraction
        this.subScalar = function (subtrahend) {
            return this._scalarFuncOnMatrix(subtrahend, this._sub);
        }

        // matrix subtraction
        this.subMatrix = function (subtrahend) {
            return this._entryWiseFuncOnMatrix(subtrahend, this._sub);
        }
        
        // string representation of matrix.
        this.toString = function () {
            var result = '';
            for (var i = 0, il = this.array.length; i < il; i += this.cols) {
                for (var j = 0; j < this.cols; j++) {
                    result += this.array[i + j] + ', '
                }
                result = result.substring(0, result.length - 2) + '\r\n';
            }

            return result;
        }
    }).call(Matrix.prototype);

    return Matrix;
})();