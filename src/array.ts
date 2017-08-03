export type Key<T> = keyof T
export type KeysToTrue<T> = {
  [P in Key<T>]: true;
}

export type Mapping<T, S> = {
  [P in Key<T>]: S
}

export function arrayToMap<T>(array: Key<T>[]): KeysToTrue<T>
export function arrayToMap(array: string[]): { [key: string]: true }
export function arrayToMap<T>(array: Key<T>[]) {
  const result: KeysToTrue<T> = {} as any
  array.forEach((v: Key<T>) => {
    result[v] = true
  })
  return result
}
