
import { arrayToMap, Key } from "./array"
import lcsGreedy, { LcsOpsTypes } from "./greedy_lcs"
export { default as lcsGreedy, LcsOpsTypes } from "./greedy_lcs"
import { Map as IMap, is, fromJS, Seq, isIndexed, Record, Collection } from "immutable"

export type Path = (string | number)[]

export interface ChangeAdd<T> {
  type: ChangeType.ADD
  path: Path
  vals: T[]
}

export interface ChangeSet<T> {
  type: ChangeType.SET
  path: Path
  val: T
}

export interface ChangeRm {
  type: ChangeType.REMOVE
  path: Path
  num: number
}

export interface ChangeMod<T> {
  type: ChangeType.MODIFIED
  path: Path
  from: T
  to: T
}

export type Change<T> = ChangeAdd<T> | ChangeSet<T> | ChangeRm
export type ArrayChange<T> = ChangeAdd<T> | ChangeSet<T> | ChangeRm | ChangeMod<T>
export type RecursiveChange = Change<any>

export const enum ChangeType {
  ADD = "add",
  SET = "set",
  REMOVE = "rm",
  MODIFIED = "mod",
}

/*
* Get the changes between `from` and `to`
* Compares recursively in order to get as small modifications as possible
*/
export default function diffRecursive(a: any, b: any, acc: RecursiveChange[] = [], base: (string | number)[] = []) {
  const applySeqDiffs = (diffs: ArrayChange<any>[]) => {
    diffs.forEach(v => {
      if (v.type === ChangeType.MODIFIED) {
        diffRecursive(v.from, v.to, acc, v.path)
      } else {
        const from = a[v.path[v.path.length - 1]]
        if (v.type === ChangeType.SET && similar(from, v.val)) {
          diffRecursive(from, v.val, acc, v.path)
        } else {
          acc.push(v)
        }
      }
    })
  }

  if (a === b || Number.isNaN(a) && Number.isNaN(b)) {
    // no-op
  } else if (a instanceof Array && b instanceof Array) {
    applySeqDiffs(diffSeq(Seq.Indexed(a), Seq.Indexed(b), [], base))
  } else if (a instanceof Object && b instanceof Object) {
    if (isIndexed(a) && isIndexed(b)) {
          applySeqDiffs(diffSeq(a, b, [], base))
      } else if (IMap.isMap(a) && IMap.isMap(b)) {
        const mapDiffs = diffMap<string | number, any>(a, b, [], base)

          mapDiffs.forEach(d => {
            if (d.type === "set") {
              const index = d.path[d.path.length - 1]
              diffRecursive(a.get(index), d.val, acc, d.path)
            } else {
              acc.push(d)
            }
          })
      } else if (Record.isRecord(a) && Record.isRecord(b)) {
        if ((a as any)._keys === (b as any)._keys) {
            const recordDiffs = diffRecord<string | number, any>(a, b, [], base)

            recordDiffs.forEach(d => {
              if (d.type === "set") {
                const index = d.path[d.path.length - 1]
                diffRecursive((a as any).get(index), d.val, acc, d.path)
              } else {
                acc.push(d)
              }
            })

          } else {
            set(acc, base, b)
          }
      } else {
        const diffs = diffObject<any, any>(a, b, [], base)

          diffs.forEach(d => {
            if (d.type === "set") {
              const index = d.path[d.path.length - 1]
              diffRecursive(a[index], d.val, acc, d.path)
            } else {
              acc.push(d)
            }
          })
      }
  } else {
      set(acc, base, b)
  }

  return acc
}

type ObjectZip<K, V> = [K, V | undefined, V | undefined]

function zipObjects<T, K extends keyof T>(
  a: T, b: T): ObjectZip<K, T[K]>[] {
  const keyMap = Object.assign(
    arrayToMap<T>(Object.keys(a) as K[]),
    arrayToMap<T>(Object.keys(b) as K[]))

  const acc: ObjectZip<K, T[K]>[] = []
  for (const key in keyMap) {
    // tslint:disable:forin
    acc.push([key as K, a[key], b[key]])
    // tslint:enable:forin
  }

  return acc
}

function zipMaps<K, V>(
  a: IMap<K, V>, b: IMap<K, V>): ObjectZip<K, V>[] {
  const keys = a.keySeq().toSet().union(b.keySeq().toArray()).values()

  const acc: ObjectZip<K, V>[] = []

  let temp = keys.next()
  while (!temp.done) {
    const key = temp.value
    acc.push([key, a.get(key), b.get(key)])
    temp = keys.next()
  }

  return acc
}

function zipRecords<T>(a: Record.Instance<T>, b: Record.Instance<T>): ObjectZip<any, any>[]
function zipRecords(a: any, b: any): ObjectZip<any, any>[] {
  const keys = a._keys

  const acc: ObjectZip<any, any>[] = []
  for (const key of keys) {
    acc.push([key, a.get(key), b.get(key)])
  }

  return acc
}

export function objectDifferHOF<T, K, V>(
  zipper: (a: T, b: T) => [K, V | undefined, V | undefined][],
  has: (obj: T, key: K) => boolean,
) {
  return (a: T, b: T, acc: Change<V>[] = [], base: any[] = []): Change<V>[] => {
    for (const zip of zipper(a, b)) {
      const [key, aValue, bValue] = zip
      if (!equal(aValue, bValue)) {
        const path = base.concat(key)
        if (!has(a, key)) {
          add(acc, path, [bValue])
        } else if (!has(b, key)) {
          rm(acc, path, 1)
        } else {
          set(acc, path, bValue)
        }
      }
    }

    return acc
  }
}

interface Hasable<K> {
  has: (key: K) => boolean
}

function freeHas<K>(obj: Hasable<K>, key: K) {
  return obj.has(key)
}

function freeObjectGet<T>(obj: T, key: keyof T) {
  return obj[key]
}

export const diffMap: <K, V>(a: IMap<K, V>, b: IMap<K, V>, acc?: Change<V>[], base?: K[]) => Change<V>[]
  = objectDifferHOF(zipMaps, freeHas)

export const diffRecord: <T, K extends keyof T>(
  a: Record.Instance<T>,
  b: Record.Instance<T>,
  acc?: Change<T[K]>[], base?: K[]) => Change<T[K]>[]
  = objectDifferHOF(zipRecords, freeHas)

export const diffObject: <T, K extends keyof T>(a: T, b: T, acc?: Change<T[K]>[], base?: K[]) => Change<T[K]>[]
 = objectDifferHOF(zipObjects, freeObjectGet)

export function diffSeq<T, C extends Collection.Indexed<T>>(
  a: C, b: C, acc: ArrayChange<T>[] = [], base: (string | number)[] = []) {

  const lcsOps = lcsGreedy(a, b)

  lcsOps.forEach(op => {
    if (op.type === LcsOpsTypes.SPLICE) {
      let i = 0
      while (i < op.remove && i < op.add.length) {
        set(acc, base.concat(op.index + i), op.add[i])
        i++
      }
      if (i < op.remove) {
        rm(acc, base.concat(op.index + i), op.remove - i)
      } else if (i < op.add.length) {
        add(acc, base.concat(op.index + i), op.add.slice(i))
      }
    } else {
      modify(acc, base.concat(op.index), op.from, op.to)
    }
  })

  return acc
}
// adds an 'set' type to the changeList
function set<T>(changeList: ArrayChange<T>[], path: Path, value: T): void
function set<T>(changeList: Change<T>[], path: Path, value: T) {
  changeList.push({
    type: ChangeType.SET,
    path,
    val: value,
  })
}

// adds an 'rm' type to the changeList
function rm<T>(changeList: ArrayChange<T>[] | Change<T>[], path: Path, count: number): void
function rm<T>(changeList: Change<T>[], path: Path, count: number) {
  changeList.push({
    type: ChangeType.REMOVE,
    path,
    num: count,
  })
}

// adds an 'add' type to the changeList
function add<T>(changeList: ArrayChange<T>[] | Change<T>[], path: Path, values: T[]): void
function add<T>(changeList: Change<T>[], path: Path, values: T[]) {
  changeList.push({
    type: ChangeType.ADD,
    path,
    vals: values,
  })
}

function modify<T>(changeList: ArrayChange<T>[], path: Path, from: T, to: T) {
  changeList.push({
    type: ChangeType.MODIFIED,
    path,
    from,
    to,
  })
}

// compares arrays and objects and returns true if they're similar meaning:
// less than 2 changes, or
// less than 10% different members
export function similar(a: any, b: any) {
  if (a instanceof Array) {
    if (!(b instanceof Array)) {
      return false
    }

    const tenPercent = a.length / 10
    let notEqual = Math.abs(a.length - b.length) // initialize with the length difference
    for (let n = 0; n < a.length; n++) {
      if (!equal(a[n], b[n])) {
        if (notEqual >= 2 && notEqual > tenPercent || notEqual === a.length) {
          return false
        }

        notEqual++
      }
    }
    // else
    return true

  } else if (a instanceof Object) {
    if (!(b instanceof Object)) {
      return false
    }

    const keyMap = Object.assign(arrayToMap(Object.keys(a)), arrayToMap(Object.keys(b)))
    const keyLength = Object.keys(keyMap).length
    const tenPercent = keyLength / 10
    let notEqual = 0
    for (const key in keyMap) {
      // tslint:disable:forin
      // tslint:enable
      const aVal = a[key]
      const bVal = b[key]

      if (!equal(aVal, bVal)) {
        if (notEqual >= 2 && notEqual > tenPercent || notEqual + 1 === keyLength) {
          return false
        }

        notEqual++
      }
    }
    // else
    return true

  } else {
    return a === b || Number.isNaN(a) && Number.isNaN(b)
  }
}

// compares arrays and objects for value equality (all elements and members must match)
export function equal(a: any, b: any) {
  if (a instanceof Array) {
    if (!(b instanceof Array)) {
      return false
    }
    if (a.length !== b.length) {
      return false
    } else {
      for (let n = 0; n < a.length; n++) {
        if (!equal(a[n], b[n])) {
          return false
        }
      }
      // else
      return true
    }
  } else if (a instanceof Object) {
    if (!(b instanceof Object)) {
      return false
    }

    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)

    if (aKeys.length !== bKeys.length) {
      return false
    } else {
      for (const key of aKeys) {
        const aVal = a[key]
        const bVal = b[key]

        if (!equal(aVal, bVal)) {
          return false
        }
      }
      // else
      return true
    }
  } else {
    return a === b || Number.isNaN(a) && Number.isNaN(b)
  }
}
