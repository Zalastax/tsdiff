export declare type Key<T> = keyof T;
export declare type KeysToTrue<T> = {
    [P in Key<T>]: true;
};
export declare type Mapping<T, S> = {
    [P in Key<T>]: S;
};
export declare function arrayToMap<T>(array: Key<T>[]): KeysToTrue<T>;
export declare function arrayToMap(array: string[]): {
    [key: string]: true;
};
