export { default as lcsGreedy, LcsOpsTypes } from "./greedy_lcs";
import { Map as IMap, Record, Collection } from "immutable";
export declare type Path = (string | number)[];
export interface ChangeAdd<T> {
    type: ChangeType.ADD;
    path: Path;
    vals: T[];
}
export interface ChangeSet<T> {
    type: ChangeType.SET;
    path: Path;
    val: T;
}
export interface ChangeRm {
    type: ChangeType.REMOVE;
    path: Path;
    num: number;
}
export interface ChangeMod<T> {
    type: ChangeType.MODIFIED;
    path: Path;
    from: T;
    to: T;
}
export declare type Change<T> = ChangeAdd<T> | ChangeSet<T> | ChangeRm;
export declare type ArrayChange<T> = ChangeAdd<T> | ChangeSet<T> | ChangeRm | ChangeMod<T>;
export declare type RecursiveChange = Change<any>;
export declare const enum ChangeType {
    ADD = "add",
    SET = "set",
    REMOVE = "rm",
    MODIFIED = "mod",
}
export default function diffRecursive(a: any, b: any, acc?: RecursiveChange[], base?: (string | number)[]): Change<any>[];
export declare function objectDifferHOF<T, K, V>(zipper: (a: T, b: T) => [K, V | undefined, V | undefined][], has: (obj: T, key: K) => boolean): (a: T, b: T, acc?: Change<V>[], base?: any[]) => Change<V>[];
export declare const diffMap: <K, V>(a: IMap<K, V>, b: IMap<K, V>, acc?: Change<V>[], base?: K[]) => Change<V>[];
export declare const diffRecord: <T, K extends keyof T>(a: Record.Instance<T>, b: Record.Instance<T>, acc?: Change<T[K]>[], base?: K[]) => Change<T[K]>[];
export declare const diffObject: <T, K extends keyof T>(a: T, b: T, acc?: Change<T[K]>[], base?: K[]) => Change<T[K]>[];
export declare function diffArray<V>(a: V[], b: V[], acc?: ArrayChange<V>[], base?: (string | number)[]): ArrayChange<V>[];
export declare function diffSeq<T, C extends Collection.Indexed<T>>(a: C, b: C, acc?: ArrayChange<T>[], base?: (string | number)[]): ArrayChange<T>[];
export declare function similar(a: any, b: any): boolean;
export declare function equal(a: any, b: any): boolean;
export declare function lastKey(change: Change<any>): string | number;
export declare function index(change: Change<any>): number;
