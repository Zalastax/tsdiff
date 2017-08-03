import { Map as IMap, Stack, Collection } from "immutable";
export interface Splice<T> {
    type: LcsOpsTypes.SPLICE;
    index: number;
    remove: number;
    add: T[];
}
export interface Mod<T> {
    type: LcsOpsTypes.MOD;
    index: number;
    from: T;
    to: T;
}
export declare type LcsOps<T> = Splice<T> | Mod<T>;
export declare const enum LcsOpsTypes {
    MOD = "mod",
    SPLICE = "splice",
}
export declare function keyEscape(prefix: string, v: any): any;
export declare function basicGetKey(v: any): any;
export default function lcs_greedy_modifications<V, C extends Collection.Indexed<V>>(from: C, to: C, getKey?: (v: V) => any): LcsOps<V>[];
export declare function groupSeq<V, I, C extends Collection.Indexed<V>>(seq: C, getKey: (v: V) => I): IMap<I, Stack<number>>;
export declare function getIndexOfAndFilter<T>(indices: IMap<T, Stack<number>>, el: T, fromIndex: number): [number | undefined, IMap<T, Stack<number>>];
