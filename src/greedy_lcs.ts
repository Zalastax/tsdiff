import { Seq, Map as IMap, List, Stack, is, Collection } from "immutable"

interface SeqEntryIterNotDone<K, V> {
    value: [K, V]
    done: false
}

interface SeqEntryIterDone<K, V> {
    value: never[]
    done: true
}

type SeqEntryIter<K, V> = SeqEntryIterDone<K, V> | SeqEntryIterNotDone<K, V>

export interface Splice<T> {
    type: LcsOpsTypes.SPLICE
    index: number
    remove: number
    add: T[]
}

export interface Mod<T> {
    type: LcsOpsTypes.MOD
    index: number
    from: T
    to: T
}

export type LcsOps<T> = Splice<T> | Mod<T>

export const enum LcsOpsTypes {
    MOD = "mod",
    SPLICE = "splice",
}

export function keyEscape(prefix: string, v: any) {
    const typ = typeof v
    if (typ === "string" || typ === "number") {
        return prefix + v
    }
    return v
}

export function basicGetKey(v: any): any {
    if (v instanceof Object) {
        if (v.hasOwnProperty("id")) {
            return keyEscape("fromid_", v.id)
        }
    }
    return keyEscape("direct_", v)
}

/*
* Greedy longest common subsequence implementation
* Returns the modifications needed to transform `from` into `to`
*/
export default function lcs_greedy_modifications<V, C extends Collection.Indexed<V>>(
    from: C, to: C, getKey: (v: V) => any = basicGetKey ) {
    let toIndices = groupSeq(to, getKey)
    const fromIter = from.entries()
    const toIter = to.entries()
    let currentFrom: SeqEntryIter<number, V> = fromIter.next() as any
    const nextFrom = () => currentFrom = fromIter.next() as any
    let currentTo: SeqEntryIter<number, V> = toIter.next() as any
    let index = 0
    const nextTo = () => {
        currentTo = toIter.next() as any
        index++
    }

    const acc: LcsOps<V>[] = []
    let temp: Splice<V> | undefined

    const add = (value: V) => {
        if (temp != null) {
            temp.add.push(value)
        } else {
            temp = {
                type: LcsOpsTypes.SPLICE,
                index,
                remove: 0,
                add: [value],
            }
        }
    }

    const rm = () => {
        if (temp != null) {
            temp.remove++
        } else {
            temp = {
                type: LcsOpsTypes.SPLICE,
                index,
                remove: 1,
                add: [],
            }
        }
    }

    const commit = () => {
        if (temp != null) {
            acc.push(temp)
            temp = undefined
        }
    }

    // === false used to help the compiler with type inference
    while (currentFrom.done === false && currentTo.done === false) {
        const fromValue = currentFrom.value[1]
        const fromKey = getKey(fromValue)
        const [foundToIndex, newToIndices] = getIndexOfAndFilter(toIndices, fromKey, currentTo.value[0])
        toIndices = newToIndices

        if (foundToIndex != null) {
            // loop until we find the index we want
            // safe guard against no values left, should be impossible
            while (!currentTo.done) {
                const toValue = currentTo.value[1]
                if (currentTo.value[0] === foundToIndex) {
                    commit()
                    if (!is(fromValue, toValue)) {
                        acc.push({
                            type: LcsOpsTypes.MOD,
                            index,
                            from: fromValue,
                            to: toValue,
                        })
                    }
                    nextTo()
                    nextFrom()
                    break
                // value found on a later index
                } else {
                    add(currentTo.value[1])
                    nextTo()
                }
            }
        } else {
            rm()
            nextFrom()
        }
    }

    // commit if currentTo is not at the right index
    if (temp != null && !currentTo.done && currentTo.value[0] !== temp.index + temp.add.length) {
        commit()
    }
    // process rest of elements, when one sequence ends before the other
    while (!currentTo.done) {
        add(currentTo.value[1])
        nextTo()
    }

    // commit if currentFrom is not at the right index
    if (temp != null && !currentFrom.done && currentFrom.value[0] !== temp.index + temp.remove) {
        commit()
    }

    while (!currentFrom.done) {
        rm()
        nextFrom()
    }

    commit()

    return acc
}

export function groupSeq<V, I, C extends Collection.Indexed<V>>(seq: C, getKey: (v: V) => I): IMap<I, Stack<number>> {
    return IMap<I, Stack<number>>().withMutations(map => {
        const size = seq.count()
        // reverse so we can add to stack using unshift
        seq.reverse().forEach((v, k) => {
            const key = getKey(v)
            const pre = map.get(key) || Stack()
            // undo the reversal of the index k
            const post = pre.unshift(size - k - 1)
            map.set(key, post)
        })
    })
}

/*
* Filters out any index lower than fromIndex from the stack for el
* Returns the first index >= fromIndex, and the new index map
*/
export function getIndexOfAndFilter<T>(indices: IMap<T, Stack<number>>, el: T, fromIndex: number)
    : [number | undefined, IMap<T, Stack<number>>] {

    let stack = indices.get(el)

    if (stack != null) {
        stack = stack.withMutations(mut => {
            while (!mut.isEmpty()) {
                const v = mut.first()
                if (v! < fromIndex) {
                    mut.shift()
                } else {
                    break
                }
            }
        })

        if (stack.isEmpty) {
            indices = indices.delete(el)
        } else {
            indices.set(el, stack)
        }

    }

    return [stack && stack.first(), indices]
}
