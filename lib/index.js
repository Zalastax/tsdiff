'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var immutable = require('immutable');

function arrayToMap(array) {
    var result = {};
    array.forEach(function (v) {
        result[v] = true;
    });
    return result;
}

function keyEscape(prefix, v) {
    var typ = typeof v;
    if (typ === "string" || typ === "number") {
        return prefix + v;
    }
    return v;
}
function basicGetKey(v) {
    if (v instanceof Object) {
        if (v.hasOwnProperty("id")) {
            return keyEscape("fromid_", v.id);
        }
    }
    return keyEscape("direct_", v);
}
function lcs_greedy_modifications(from, to, getKey) {
    if (getKey === void 0) { getKey = basicGetKey; }
    var toIndices = groupSeq(to, getKey);
    var fromIter = from.entries();
    var toIter = to.entries();
    var currentFrom = fromIter.next();
    var nextFrom = function () { return currentFrom = fromIter.next(); };
    var currentTo = toIter.next();
    var index = 0;
    var nextTo = function () {
        currentTo = toIter.next();
        index++;
    };
    var acc = [];
    var temp;
    var add = function (value) {
        if (temp != null) {
            temp.add.push(value);
        }
        else {
            temp = {
                type: "splice",
                index: index,
                remove: 0,
                add: [value],
            };
        }
    };
    var rm = function () {
        if (temp != null) {
            temp.remove++;
        }
        else {
            temp = {
                type: "splice",
                index: index,
                remove: 1,
                add: [],
            };
        }
    };
    var commit = function () {
        if (temp != null) {
            acc.push(temp);
            temp = undefined;
        }
    };
    while (currentFrom.done === false && currentTo.done === false) {
        var fromValue = currentFrom.value[1];
        var fromKey = getKey(fromValue);
        var _a = getIndexOfAndFilter(toIndices, fromKey, currentTo.value[0]), foundToIndex = _a[0], newToIndices = _a[1];
        toIndices = newToIndices;
        if (foundToIndex != null) {
            while (!currentTo.done) {
                var toValue = currentTo.value[1];
                if (currentTo.value[0] === foundToIndex) {
                    commit();
                    if (!immutable.is(fromValue, toValue)) {
                        acc.push({
                            type: "mod",
                            index: index,
                            from: fromValue,
                            to: toValue,
                        });
                    }
                    nextTo();
                    nextFrom();
                    break;
                }
                else {
                    add(currentTo.value[1]);
                    nextTo();
                }
            }
        }
        else {
            rm();
            nextFrom();
        }
    }
    if (temp != null && !currentTo.done && currentTo.value[0] !== temp.index + temp.add.length) {
        commit();
    }
    while (!currentTo.done) {
        add(currentTo.value[1]);
        nextTo();
    }
    if (temp != null && !currentFrom.done && currentFrom.value[0] !== temp.index + temp.remove) {
        commit();
    }
    while (!currentFrom.done) {
        rm();
        nextFrom();
    }
    commit();
    return acc;
}
function groupSeq(seq, getKey) {
    return immutable.Map().withMutations(function (map) {
        var size = seq.count();
        seq.reverse().forEach(function (v, k) {
            var key = getKey(v);
            var pre = map.get(key) || immutable.Stack();
            var post = pre.unshift(size - k - 1);
            map.set(key, post);
        });
    });
}
function getIndexOfAndFilter(indices, el, fromIndex) {
    var stack = indices.get(el);
    if (stack != null) {
        stack = stack.withMutations(function (mut) {
            while (!mut.isEmpty()) {
                var v = mut.first();
                if (v < fromIndex) {
                    mut.shift();
                }
                else {
                    break;
                }
            }
        });
        if (stack.isEmpty) {
            indices = indices.delete(el);
        }
        else {
            indices.set(el, stack);
        }
    }
    return [stack && stack.first(), indices];
}

function diffRecursive(a, b, acc, base) {
    if (acc === void 0) { acc = []; }
    if (base === void 0) { base = []; }
    var applySeqDiffs = function (diffs) {
        diffs.forEach(function (v) {
            if (v.type === "mod") {
                diffRecursive(v.from, v.to, acc, v.path);
            }
            else {
                var from = a[v.path[v.path.length - 1]];
                if (v.type === "set" && similar(from, v.val)) {
                    diffRecursive(from, v.val, acc, v.path);
                }
                else {
                    acc.push(v);
                }
            }
        });
    };
    if (a === b || Number.isNaN(a) && Number.isNaN(b)) {
    }
    else if (a instanceof Array && b instanceof Array) {
        applySeqDiffs(diffArray(a, b, [], base));
    }
    else if (a instanceof Object && b instanceof Object) {
        if (immutable.isIndexed(a) && immutable.isIndexed(b)) {
            applySeqDiffs(diffSeq(a, b, [], base));
        }
        else if (immutable.Map.isMap(a) && immutable.Map.isMap(b)) {
            var mapDiffs = diffMap(a, b, [], base);
            mapDiffs.forEach(function (d) {
                if (d.type === "set") {
                    diffRecursive(a.get(lastKey(d)), d.val, acc, d.path);
                }
                else {
                    acc.push(d);
                }
            });
        }
        else if (immutable.Record.isRecord(a) && immutable.Record.isRecord(b)) {
            if (a._keys === b._keys) {
                var recordDiffs = diffRecord(a, b, [], base);
                recordDiffs.forEach(function (d) {
                    if (d.type === "set") {
                        diffRecursive(a.get(lastKey(d)), d.val, acc, d.path);
                    }
                    else {
                        acc.push(d);
                    }
                });
            }
            else {
                set(acc, base, b);
            }
        }
        else {
            var diffs = diffObject(a, b, [], base);
            diffs.forEach(function (d) {
                if (d.type === "set") {
                    diffRecursive(a[lastKey(d)], d.val, acc, d.path);
                }
                else {
                    acc.push(d);
                }
            });
        }
    }
    else {
        set(acc, base, b);
    }
    return acc;
}
function zipObjects(a, b) {
    var keyMap = Object.assign(arrayToMap(Object.keys(a)), arrayToMap(Object.keys(b)));
    var acc = [];
    for (var key in keyMap) {
        acc.push([key, a[key], b[key]]);
    }
    return acc;
}
function zipMaps(a, b) {
    var keys = a.keySeq().toSet().union(b.keySeq().toArray()).values();
    var acc = [];
    var temp = keys.next();
    while (!temp.done) {
        var key = temp.value;
        acc.push([key, a.get(key), b.get(key)]);
        temp = keys.next();
    }
    return acc;
}
function zipRecords(a, b) {
    var keys = a._keys;
    var acc = [];
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        acc.push([key, a.get(key), b.get(key)]);
    }
    return acc;
}
function objectDifferHOF(zipper, has) {
    return function (a, b, acc, base) {
        if (acc === void 0) { acc = []; }
        if (base === void 0) { base = []; }
        for (var _i = 0, _a = zipper(a, b); _i < _a.length; _i++) {
            var zip = _a[_i];
            var key = zip[0], aValue = zip[1], bValue = zip[2];
            if (!equal(aValue, bValue)) {
                var path = base.concat(key);
                if (!has(a, key)) {
                    add(acc, path, [bValue]);
                }
                else if (!has(b, key)) {
                    rm(acc, path, 1);
                }
                else {
                    set(acc, path, bValue);
                }
            }
        }
        return acc;
    };
}
function freeHas(obj, key) {
    return obj.has(key);
}
function freeObjectGet(obj, key) {
    return obj[key];
}
var diffMap = objectDifferHOF(zipMaps, freeHas);
var diffRecord = objectDifferHOF(zipRecords, freeHas);
var diffObject = objectDifferHOF(zipObjects, freeObjectGet);
function diffArray(a, b, acc, base) {
    if (acc === void 0) { acc = []; }
    if (base === void 0) { base = []; }
    return diffSeq(immutable.Seq.Indexed(a), immutable.Seq.Indexed(b), acc, base);
}
function diffSeq(a, b, acc, base) {
    if (acc === void 0) { acc = []; }
    if (base === void 0) { base = []; }
    var lcsOps = lcs_greedy_modifications(a, b);
    lcsOps.forEach(function (op) {
        if (op.type === "splice") {
            var i = 0;
            while (i < op.remove && i < op.add.length) {
                set(acc, base.concat(op.index + i), op.add[i]);
                i++;
            }
            if (i < op.remove) {
                rm(acc, base.concat(op.index + i), op.remove - i);
            }
            else if (i < op.add.length) {
                add(acc, base.concat(op.index + i), op.add.slice(i));
            }
        }
        else {
            modify(acc, base.concat(op.index), op.from, op.to);
        }
    });
    return acc;
}
function set(changeList, path, value) {
    changeList.push({
        type: "set",
        path: path,
        val: value,
    });
}
function rm(changeList, path, count) {
    changeList.push({
        type: "rm",
        path: path,
        num: count,
    });
}
function add(changeList, path, values) {
    changeList.push({
        type: "add",
        path: path,
        vals: values,
    });
}
function modify(changeList, path, from, to) {
    changeList.push({
        type: "mod",
        path: path,
        from: from,
        to: to,
    });
}
function similar(a, b) {
    if (a instanceof Array) {
        if (!(b instanceof Array)) {
            return false;
        }
        var tenPercent = a.length / 10;
        var notEqual = Math.abs(a.length - b.length);
        for (var n = 0; n < a.length; n++) {
            if (!equal(a[n], b[n])) {
                if (notEqual >= 2 && notEqual > tenPercent || notEqual === a.length) {
                    return false;
                }
                notEqual++;
            }
        }
        return true;
    }
    else if (a instanceof Object) {
        if (!(b instanceof Object)) {
            return false;
        }
        var keyMap = Object.assign(arrayToMap(Object.keys(a)), arrayToMap(Object.keys(b)));
        var keyLength = Object.keys(keyMap).length;
        var tenPercent = keyLength / 10;
        var notEqual = 0;
        for (var key in keyMap) {
            var aVal = a[key];
            var bVal = b[key];
            if (!equal(aVal, bVal)) {
                if (notEqual >= 2 && notEqual > tenPercent || notEqual + 1 === keyLength) {
                    return false;
                }
                notEqual++;
            }
        }
        return true;
    }
    else {
        return a === b || Number.isNaN(a) && Number.isNaN(b);
    }
}
function equal(a, b) {
    if (a instanceof Array) {
        if (!(b instanceof Array)) {
            return false;
        }
        if (a.length !== b.length) {
            return false;
        }
        else {
            for (var n = 0; n < a.length; n++) {
                if (!equal(a[n], b[n])) {
                    return false;
                }
            }
            return true;
        }
    }
    else if (a instanceof Object) {
        if (!(b instanceof Object)) {
            return false;
        }
        var aKeys = Object.keys(a);
        var bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) {
            return false;
        }
        else {
            for (var _i = 0, aKeys_1 = aKeys; _i < aKeys_1.length; _i++) {
                var key = aKeys_1[_i];
                var aVal = a[key];
                var bVal = b[key];
                if (!equal(aVal, bVal)) {
                    return false;
                }
            }
            return true;
        }
    }
    else {
        return a === b || Number.isNaN(a) && Number.isNaN(b);
    }
}
function lastKey(change) {
    return change.path[change.path.length - 1];
}
function index(change) {
    return +lastKey(change);
}

exports['default'] = diffRecursive;
exports.objectDifferHOF = objectDifferHOF;
exports.diffMap = diffMap;
exports.diffRecord = diffRecord;
exports.diffObject = diffObject;
exports.diffArray = diffArray;
exports.diffSeq = diffSeq;
exports.similar = similar;
exports.equal = equal;
exports.lastKey = lastKey;
exports.index = index;
exports.lcsGreedy = lcs_greedy_modifications;
